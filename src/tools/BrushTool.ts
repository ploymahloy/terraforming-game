import * as THREE from 'three/webgpu';
import { GRID_SIZE, type BrushType } from '../config';
import { getHeight, markDirty, type Terrain } from '../terrain/HeightmapTerrain';

export interface Brush {
  type: BrushType;
  radius: number;
  strength: number;
  flattenTarget: number;
}

export function createBrush(): Brush {
  return {
    type: 'raise',
    radius: 4,
    strength: 0.35,
    flattenTarget: 0,
  };
}

export function beginBrushStroke(brush: Brush, terrain: Terrain, cx: number, cz: number): void {
  if (brush.type === 'flatten') {
    brush.flattenTarget = getHeight(terrain, cx, cz);
  }
}

export function applyBrush(brush: Brush, terrain: Terrain, cx: number, cz: number): void {
  const r = brush.radius;
  const rCells = Math.ceil(r) + 1;
  const strength = brush.strength;

  const x0 = Math.max(0, cx - rCells);
  const x1 = Math.min(GRID_SIZE - 1, cx + rCells);
  const z0 = Math.max(0, cz - rCells);
  const z1 = Math.min(GRID_SIZE - 1, cz + rCells);

  if (brush.type === 'smooth') {
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

        if (brush.type === 'raise') {
          terrain.heights[i] = h + strength * w;
        } else if (brush.type === 'lower') {
          terrain.heights[i] = h - strength * w;
        } else if (brush.type === 'flatten') {
          terrain.heights[i] = THREE.MathUtils.lerp(h, brush.flattenTarget, w * strength);
        }
      }
    }
  }

  markDirty(terrain);
}

export interface BrushCursor {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
}

export function createBrushCursor(): BrushCursor {
  const geo = new THREE.RingGeometry(0.92, 1, 48);
  geo.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0xc4a35a,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.visible = false;
  mesh.renderOrder = 10;
  return { mesh, material };
}

export function setBrushCursorRadius(cursor: BrushCursor, worldRadius: number): void {
  cursor.mesh.scale.setScalar(Math.max(worldRadius, 0.5));
}

export function showBrushCursor(cursor: BrushCursor, x: number, y: number, z: number): void {
  cursor.mesh.visible = true;
  cursor.mesh.position.set(x, y + 0.08, z);
}

export function hideBrushCursor(cursor: BrushCursor): void {
  cursor.mesh.visible = false;
}
