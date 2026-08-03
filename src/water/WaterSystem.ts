import * as THREE from 'three/webgpu';
import { GRID_SIZE, WORLD_SIZE } from '../config';
import type { Terrain } from '../terrain/HeightmapTerrain';

const MAX_DEPTH = 3.5;
const SEEP_RATE = 0.55;

export interface Water {
  depths: Float32Array;
  mesh: THREE.Mesh;
  geometry: THREE.PlaneGeometry;
  dirty: boolean;
  displayHeights: Float32Array;
}

export function createWater(): Water {
  const depths = new Float32Array(GRID_SIZE * GRID_SIZE);
  const displayHeights = new Float32Array(GRID_SIZE * GRID_SIZE);

  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, GRID_SIZE - 1, GRID_SIZE - 1);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    color: 0x3d7ea6,
    transparent: true,
    opacity: 0.62,
    roughness: 0.18,
    metalness: 0.05,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'water';
  mesh.renderOrder = 2;

  return { depths, mesh, geometry, dirty: true, displayHeights };
}

export function resetWater(water: Water): void {
  water.depths.fill(0);
  water.dirty = true;
}

export function addWater(water: Water, cx: number, cz: number, amount: number): void {
  const i = cz * GRID_SIZE + cx;
  water.depths[i] = Math.min(MAX_DEPTH, water.depths[i] + amount);
  water.dirty = true;
}

export function tickWater(water: Water, dt: number, terrain: Terrain): void {
  // One-pass downhill seep into lower neighbors
  const next = water.depths.slice();
  const flow = SEEP_RATE * dt;

  for (let z = 1; z < GRID_SIZE - 1; z++) {
    for (let x = 1; x < GRID_SIZE - 1; x++) {
      const i = z * GRID_SIZE + x;
      const d = water.depths[i];
      if (d < 0.001) continue;

      const surface = terrain.heights[i] + d;
      const neighbors = [i - 1, i + 1, i - GRID_SIZE, i + GRID_SIZE];

      let lowest = i;
      let lowestSurface = surface;
      for (const ni of neighbors) {
        const ns = terrain.heights[ni] + water.depths[ni];
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

  water.depths.set(next);
  water.dirty = true;
  syncWaterMesh(water, terrain);
}

export function syncWaterMesh(water: Water, terrain: Terrain): void {
  if (!water.dirty) return;

  const pos = water.geometry.attributes.position as THREE.BufferAttribute;
  let wet = false;

  for (let i = 0; i < pos.count; i++) {
    const depth = water.depths[i];
    const target = terrain.heights[i] + depth;
    // Lerp display for soft motion
    water.displayHeights[i] = THREE.MathUtils.lerp(
      water.displayHeights[i] || terrain.heights[i],
      target,
      0.35,
    );

    if (depth > 0.02) {
      pos.setY(i, water.displayHeights[i] + 0.02);
      wet = true;
    } else {
      // Sink dry cells below terrain so they aren't visible
      pos.setY(i, terrain.heights[i] - 0.5);
      water.displayHeights[i] = terrain.heights[i];
    }
  }

  pos.needsUpdate = true;
  water.geometry.computeVertexNormals();
  water.mesh.visible = wet;
  water.dirty = false;
}
