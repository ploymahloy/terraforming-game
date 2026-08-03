import * as THREE from 'three/webgpu';
import {
  CELL_SIZE,
  GRID_SIZE,
  MAX_HEIGHT,
  MIN_HEIGHT,
  WORLD_SIZE,
} from '../config';

const ROCK = new THREE.Color('#5c6b6a');
const DIRT = new THREE.Color('#8a7355');
const GRASS = new THREE.Color('#5a7a52');
const HIGH = new THREE.Color('#9aa39a');
const tmpColor = new THREE.Color();

function heightToColor(h: number, out: THREE.Color): THREE.Color {
  if (h < 0.2) {
    return out.copy(ROCK).lerp(DIRT, THREE.MathUtils.clamp((h + 2) / 2.2, 0, 1));
  }
  if (h < 3) {
    return out.copy(DIRT).lerp(GRASS, THREE.MathUtils.clamp((h - 0.2) / 2.8, 0, 1));
  }
  return out.copy(GRASS).lerp(HIGH, THREE.MathUtils.clamp((h - 3) / 5, 0, 1));
}

export interface Terrain {
  heights: Float32Array;
  mesh: THREE.Mesh;
  geometry: THREE.PlaneGeometry;
  colors: Float32Array;
  dirty: boolean;
}

export function createTerrain(): Terrain {
  const heights = new Float32Array(GRID_SIZE * GRID_SIZE);
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, GRID_SIZE - 1, GRID_SIZE - 1);
  geometry.rotateX(-Math.PI / 2);

  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'terrain';

  return { heights, mesh, geometry, colors, dirty: false };
}

export function worldToCell(wx: number, wz: number): { x: number; z: number } {
  const half = WORLD_SIZE * 0.5;
  const x = Math.round(((wx + half) / WORLD_SIZE) * (GRID_SIZE - 1));
  const z = Math.round(((wz + half) / WORLD_SIZE) * (GRID_SIZE - 1));
  return {
    x: THREE.MathUtils.clamp(x, 0, GRID_SIZE - 1),
    z: THREE.MathUtils.clamp(z, 0, GRID_SIZE - 1),
  };
}

export function cellToWorld(cx: number, cz: number): { x: number; z: number } {
  const half = WORLD_SIZE * 0.5;
  return {
    x: -half + cx * CELL_SIZE,
    z: -half + cz * CELL_SIZE,
  };
}

export function getHeight(terrain: Terrain, cx: number, cz: number): number {
  return terrain.heights[cz * GRID_SIZE + cx] ?? 0;
}

export function sampleHeightWorld(terrain: Terrain, wx: number, wz: number): number {
  const half = WORLD_SIZE * 0.5;
  const fx = ((wx + half) / WORLD_SIZE) * (GRID_SIZE - 1);
  const fz = ((wz + half) / WORLD_SIZE) * (GRID_SIZE - 1);
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(x0 + 1, GRID_SIZE - 1);
  const z1 = Math.min(z0 + 1, GRID_SIZE - 1);
  const tx = fx - x0;
  const tz = fz - z0;

  const h00 = getHeight(terrain, x0, z0);
  const h10 = getHeight(terrain, x1, z0);
  const h01 = getHeight(terrain, x0, z1);
  const h11 = getHeight(terrain, x1, z1);

  const a = h00 + (h10 - h00) * tx;
  const b = h01 + (h11 - h01) * tx;
  return a + (b - a) * tz;
}

export function setHeights(terrain: Terrain, source: Float32Array): void {
  terrain.heights.set(source);
  applyToGeometry(terrain);
}

export function modifyHeights(
  terrain: Terrain,
  fn: (h: number, cx: number, cz: number) => number,
): void {
  for (let z = 0; z < GRID_SIZE; z++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const i = z * GRID_SIZE + x;
      terrain.heights[i] = THREE.MathUtils.clamp(fn(terrain.heights[i], x, z), MIN_HEIGHT, MAX_HEIGHT);
    }
  }
  terrain.dirty = true;
}

export function markDirty(terrain: Terrain): void {
  terrain.dirty = true;
}

export function flushIfDirty(terrain: Terrain): void {
  if (!terrain.dirty) return;
  applyToGeometry(terrain);
  terrain.dirty = false;
}

function applyToGeometry(terrain: Terrain): void {
  const pos = terrain.geometry.attributes.position as THREE.BufferAttribute;
  const col = terrain.geometry.attributes.color as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const h = terrain.heights[i] ?? 0;
    pos.setY(i, h);
    heightToColor(h, tmpColor);
    col.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
  }

  pos.needsUpdate = true;
  col.needsUpdate = true;
  terrain.geometry.computeVertexNormals();
}
