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

export class HeightmapTerrain {
  readonly heights: Float32Array;
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.PlaneGeometry;
  private readonly colors: Float32Array;
  private dirty = false;

  constructor() {
    this.heights = new Float32Array(GRID_SIZE * GRID_SIZE);
    this.geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, GRID_SIZE - 1, GRID_SIZE - 1);
    this.geometry.rotateX(-Math.PI / 2);

    const count = this.geometry.attributes.position.count;
    this.colors = new Float32Array(count * 3);
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
      flatShading: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.name = 'terrain';
  }

  get resolution(): number {
    return GRID_SIZE;
  }

  worldToCell(wx: number, wz: number): { x: number; z: number } {
    const half = WORLD_SIZE * 0.5;
    const x = Math.round(((wx + half) / WORLD_SIZE) * (GRID_SIZE - 1));
    const z = Math.round(((wz + half) / WORLD_SIZE) * (GRID_SIZE - 1));
    return {
      x: THREE.MathUtils.clamp(x, 0, GRID_SIZE - 1),
      z: THREE.MathUtils.clamp(z, 0, GRID_SIZE - 1),
    };
  }

  cellToWorld(cx: number, cz: number): { x: number; z: number } {
    const half = WORLD_SIZE * 0.5;
    return {
      x: -half + cx * CELL_SIZE,
      z: -half + cz * CELL_SIZE,
    };
  }

  getHeight(cx: number, cz: number): number {
    return this.heights[cz * GRID_SIZE + cx] ?? 0;
  }

  sampleHeightWorld(wx: number, wz: number): number {
    const half = WORLD_SIZE * 0.5;
    const fx = ((wx + half) / WORLD_SIZE) * (GRID_SIZE - 1);
    const fz = ((wz + half) / WORLD_SIZE) * (GRID_SIZE - 1);
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const x1 = Math.min(x0 + 1, GRID_SIZE - 1);
    const z1 = Math.min(z0 + 1, GRID_SIZE - 1);
    const tx = fx - x0;
    const tz = fz - z0;

    const h00 = this.getHeight(x0, z0);
    const h10 = this.getHeight(x1, z0);
    const h01 = this.getHeight(x0, z1);
    const h11 = this.getHeight(x1, z1);

    const a = h00 + (h10 - h00) * tx;
    const b = h01 + (h11 - h01) * tx;
    return a + (b - a) * tz;
  }

  setHeights(source: Float32Array): void {
    this.heights.set(source);
    this.applyToGeometry();
  }

  modifyHeights(fn: (h: number, cx: number, cz: number) => number): void {
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const i = z * GRID_SIZE + x;
        this.heights[i] = THREE.MathUtils.clamp(fn(this.heights[i], x, z), MIN_HEIGHT, MAX_HEIGHT);
      }
    }
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
  }

  flushIfDirty(): void {
    if (!this.dirty) return;
    this.applyToGeometry();
    this.dirty = false;
  }

  private applyToGeometry(): void {
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    const col = this.geometry.attributes.color as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i++) {
      const h = this.heights[i] ?? 0;
      pos.setY(i, h);
      heightToColor(h, tmpColor);
      col.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}
