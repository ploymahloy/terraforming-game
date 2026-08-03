import * as THREE from 'three/webgpu';
import { GRID_SIZE, WORLD_SIZE } from '../config';
import type { HeightmapTerrain } from '../terrain/HeightmapTerrain';

const MAX_DEPTH = 3.5;
const SEEP_RATE = 0.55;

export class WaterSystem {
  readonly depths: Float32Array;
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.PlaneGeometry;
  private dirty = true;
  private readonly displayHeights: Float32Array;

  constructor() {
    this.depths = new Float32Array(GRID_SIZE * GRID_SIZE);
    this.displayHeights = new Float32Array(GRID_SIZE * GRID_SIZE);

    this.geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, GRID_SIZE - 1, GRID_SIZE - 1);
    this.geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0x3d7ea6,
      transparent: true,
      opacity: 0.62,
      roughness: 0.18,
      metalness: 0.05,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.name = 'water';
    this.mesh.renderOrder = 2;
  }

  reset(): void {
    this.depths.fill(0);
    this.dirty = true;
  }

  add(cx: number, cz: number, amount: number): void {
    const i = cz * GRID_SIZE + cx;
    this.depths[i] = Math.min(MAX_DEPTH, this.depths[i] + amount);
    this.dirty = true;
  }

  tick(dt: number, terrain: HeightmapTerrain): void {
    // One-pass downhill seep into lower neighbors
    const next = this.depths.slice();
    const flow = SEEP_RATE * dt;

    for (let z = 1; z < GRID_SIZE - 1; z++) {
      for (let x = 1; x < GRID_SIZE - 1; x++) {
        const i = z * GRID_SIZE + x;
        const d = this.depths[i];
        if (d < 0.001) continue;

        const surface = terrain.heights[i] + d;
        const neighbors = [
          i - 1,
          i + 1,
          i - GRID_SIZE,
          i + GRID_SIZE,
        ];

        let lowest = i;
        let lowestSurface = surface;
        for (const ni of neighbors) {
          const ns = terrain.heights[ni] + this.depths[ni];
          if (ns < lowestSurface) {
            lowestSurface = ns;
            lowest = ni;
          }
        }

        if (lowest !== i) {
          const delta = Math.min(d * flow, (surface - lowestSurface) * 0.5);
          if (delta > 0.0001) {
            next[i] -= delta;
            next[lowest] = Math.min(MAX_DEPTH, next[lowest] + delta);
          }
        }
      }
    }

    this.depths.set(next);
    this.dirty = true;
    this.syncMesh(terrain);
  }

  syncMesh(terrain: HeightmapTerrain): void {
    if (!this.dirty) return;

    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    let wet = false;

    for (let i = 0; i < pos.count; i++) {
      const depth = this.depths[i];
      const target = terrain.heights[i] + depth;
      // Lerp display for soft motion
      this.displayHeights[i] = THREE.MathUtils.lerp(this.displayHeights[i] || terrain.heights[i], target, 0.35);

      if (depth > 0.02) {
        pos.setY(i, this.displayHeights[i] + 0.02);
        wet = true;
      } else {
        // Sink dry cells below terrain so they aren't visible
        pos.setY(i, terrain.heights[i] - 0.5);
        this.displayHeights[i] = terrain.heights[i];
      }
    }

    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.mesh.visible = wet;
    this.dirty = false;
  }
}
