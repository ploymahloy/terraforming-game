import { describe, expect, it } from 'vitest';
import { GRID_SIZE } from '../config';
import {
  cellToWorld,
  getHeight,
  sampleHeightFromGrid,
  type Terrain,
} from './HeightmapTerrain';

function gridWith(cx: number, cz: number, h: number): Float32Array {
  const heights = new Float32Array(GRID_SIZE * GRID_SIZE);
  heights[cz * GRID_SIZE + cx] = h;
  return heights;
}

describe('sampleHeightFromGrid', () => {
  it('matches getHeight at a known cell', () => {
    const cx = 10;
    const cz = 20;
    const heights = gridWith(cx, cz, 3.5);
    const terrain = { heights } as Terrain;
    const world = cellToWorld(cx, cz);
    expect(sampleHeightFromGrid(heights, world.x, world.z)).toBeCloseTo(getHeight(terrain, cx, cz));
  });

  it('returns the average of neighbors at a bilinear midpoint', () => {
    const heights = new Float32Array(GRID_SIZE * GRID_SIZE);
    const cx = 4;
    const cz = 7;
    heights[cz * GRID_SIZE + cx] = 2;
    heights[cz * GRID_SIZE + (cx + 1)] = 6;
    const a = cellToWorld(cx, cz);
    const b = cellToWorld(cx + 1, cz);
    const midX = (a.x + b.x) * 0.5;
    expect(sampleHeightFromGrid(heights, midX, a.z)).toBeCloseTo(4);
  });
});
