import { GRID_SIZE, type TerrainPresetId } from '../config';
import { fbm } from './noise';

export interface TerrainPreset {
  id: TerrainPresetId;
  name: string;
  description: string;
  swatchClass: string;
  generate: (seed?: number) => Float32Array;
}

function index(x: number, z: number): number {
  return z * GRID_SIZE + x;
}

function forEachCell(fn: (x: number, z: number, u: number, v: number) => number): Float32Array {
  const heights = new Float32Array(GRID_SIZE * GRID_SIZE);
  const inv = 1 / (GRID_SIZE - 1);

  for (let z = 0; z < GRID_SIZE; z++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const u = x * inv;
      const v = z * inv;
      heights[index(x, z)] = fn(x, z, u, v);
    }
  }

  return heights;
}

const plains: TerrainPreset = {
  id: 'plains',
  name: 'Plains',
  description: 'Gentle rolling lowlands',
  swatchClass: 'swatch-plains',
  generate(seed = 42) {
    return forEachCell((_x, _z, u, v) => {
      const n = fbm(u * 3.2, v * 3.2, seed, 4);
      return (n - 0.5) * 1.4 + 0.3;
    });
  },
};

const hills: TerrainPreset = {
  id: 'hills',
  name: 'Hills',
  description: 'Soft mounds and valleys',
  swatchClass: 'swatch-hills',
  generate(seed = 77) {
    return forEachCell((_x, _z, u, v) => {
      const n = fbm(u * 4.5, v * 4.5, seed, 5);
      const ridge = fbm(u * 2.1 + 10, v * 2.1, seed + 3, 3);
      return (n - 0.45) * 4.2 + (ridge - 0.5) * 1.5;
    });
  },
};

const crater: TerrainPreset = {
  id: 'crater',
  name: 'Crater',
  description: 'A bowl waiting for water',
  swatchClass: 'swatch-crater',
  generate(seed = 19) {
    return forEachCell((_x, _z, u, v) => {
      const dx = u - 0.5;
      const dz = v - 0.5;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const rim = Math.exp(-Math.pow((dist - 0.28) / 0.06, 2)) * 3.2;
      const bowl = -Math.exp(-Math.pow(dist / 0.22, 2)) * 3.8;
      const n = (fbm(u * 6, v * 6, seed, 3) - 0.5) * 0.6;
      return bowl + rim + n + 1.2;
    });
  },
};

const ridges: TerrainPreset = {
  id: 'ridges',
  name: 'Ridges',
  description: 'Sharp spines and draws',
  swatchClass: 'swatch-ridges',
  generate(seed = 55) {
    return forEachCell((_x, _z, u, v) => {
      const n = fbm(u * 5, v * 5, seed, 5);
      const warped = fbm(u * 3 + n, v * 3 - n, seed + 9, 4);
      const ridge = 1 - Math.abs(warped * 2 - 1);
      return ridge * ridge * 5.5 + (n - 0.5) * 1.2 - 0.5;
    });
  },
};

export const TERRAIN_PRESETS: TerrainPreset[] = [plains, hills, crater, ridges];

export function getPreset(id: TerrainPresetId): TerrainPreset {
  const preset = TERRAIN_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown preset: ${id}`);
  return preset;
}
