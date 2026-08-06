export const GRID_SIZE = 128;
export const WORLD_SIZE = 32;
export const CELL_SIZE = WORLD_SIZE / (GRID_SIZE - 1);

export const MIN_HEIGHT = -4;
export const MAX_HEIGHT = 12;

export const CAMERA = {
  minDistance: 4,
  maxDistance: 60,
  maxPolarAngle: Math.PI * 0.48,
  dampingFactor: 0.08,
  strafeSpeed: 12,
} as const;

export type GameMode = 'terraform' | 'water' | 'life';
export type BrushType = 'raise' | 'lower' | 'smooth' | 'flatten';
export type LifeKind = 'tree' | 'bush' | 'critter';
export type TerrainPresetId = 'plains' | 'hills' | 'crater' | 'ridges';
