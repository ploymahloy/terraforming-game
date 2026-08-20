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

export const PLAYER = {
  walkSpeed: 5,
  turnSpeed: 2.2,
  jumpSpeed: 7,
  gravity: -22,
  capsuleHalfHeight: 0.8,
  capsuleRadius: 0.35,
  poseHz: 15,
  cameraDistance: 6,
  cameraHeight: 2.2,
  remoteLerp: 12,
} as const;

export type GameMode = 'terraform' | 'water' | 'life' | 'walk';
export type BrushType = 'raise' | 'lower' | 'smooth' | 'flatten';
export type LifeKind = 'tree' | 'bush' | 'critter';
export type TerrainPresetId = 'plains' | 'hills' | 'crater' | 'ridges';
