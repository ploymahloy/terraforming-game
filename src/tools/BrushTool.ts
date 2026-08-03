import * as THREE from 'three/webgpu';
import { GRID_SIZE, type BrushType } from '../config';
import type { HeightmapTerrain } from '../terrain/HeightmapTerrain';

export class BrushTool {
  type: BrushType = 'raise';
  radius = 4;
  strength = 0.35;
  private flattenTarget = 0;

  beginStroke(terrain: HeightmapTerrain, cx: number, cz: number): void {
    if (this.type === 'flatten') {
      this.flattenTarget = terrain.getHeight(cx, cz);
    }
  }

  apply(terrain: HeightmapTerrain, cx: number, cz: number): void {
    const r = this.radius;
    const rCells = Math.ceil(r) + 1;
    const strength = this.strength;

    const x0 = Math.max(0, cx - rCells);
    const x1 = Math.min(GRID_SIZE - 1, cx + rCells);
    const z0 = Math.max(0, cz - rCells);
    const z1 = Math.min(GRID_SIZE - 1, cz + rCells);

    if (this.type === 'smooth') {
      const snapshot = terrain.heights.slice();
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          const dz = z - cz;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > r) continue;
          const falloff = 1 - dist / r;
          const w = falloff * falloff;

          let sum = 0;
          let count = 0;
          for (let oz = -1; oz <= 1; oz++) {
            for (let ox = -1; ox <= 1; ox++) {
              const nx = x + ox;
              const nz = z + oz;
              if (nx < 0 || nz < 0 || nx >= GRID_SIZE || nz >= GRID_SIZE) continue;
              sum += snapshot[nz * GRID_SIZE + nx];
              count++;
            }
          }
          const avg = sum / count;
          const i = z * GRID_SIZE + x;
          const h = snapshot[i];
          terrain.heights[i] = THREE.MathUtils.lerp(h, avg, w * strength * 0.85);
        }
      }
    } else {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          const dz = z - cz;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > r) continue;
          const falloff = 1 - dist / r;
          const w = falloff * falloff;
          const i = z * GRID_SIZE + x;
          const h = terrain.heights[i];

          if (this.type === 'raise') {
            terrain.heights[i] = h + strength * w;
          } else if (this.type === 'lower') {
            terrain.heights[i] = h - strength * w;
          } else if (this.type === 'flatten') {
            terrain.heights[i] = THREE.MathUtils.lerp(h, this.flattenTarget, w * strength);
          }
        }
      }
    }

    terrain.markDirty();
  }
}

export class BrushCursor {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;

  constructor() {
    const geo = new THREE.RingGeometry(0.92, 1, 48);
    geo.rotateX(-Math.PI / 2);
    this.material = new THREE.MeshBasicMaterial({
      color: 0xc4a35a,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.visible = false;
    this.mesh.renderOrder = 10;
  }

  setRadius(worldRadius: number): void {
    this.mesh.scale.setScalar(Math.max(worldRadius, 0.5));
  }

  showAt(x: number, y: number, z: number): void {
    this.mesh.visible = true;
    this.mesh.position.set(x, y + 0.08, z);
  }

  hide(): void {
    this.mesh.visible = false;
  }
}
