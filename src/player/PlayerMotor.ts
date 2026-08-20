import { PLAYER, WORLD_SIZE } from '../config';
import { sampleHeightFromGrid } from '../terrain/HeightmapTerrain';

export interface MotorState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  vy: number;
  grounded: boolean;
}

export interface MotorInput {
  forward: boolean;
  back: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  jump: boolean;
}

const HALF = WORLD_SIZE * 0.5;

export function tickMotor(
  state: MotorState,
  input: MotorInput,
  dt: number,
  heights: ArrayLike<number>,
): MotorState {
  let { x, y, z, yaw, vy, grounded } = state;

  if (input.turnLeft) yaw += PLAYER.turnSpeed * dt;
  if (input.turnRight) yaw -= PLAYER.turnSpeed * dt;

  let along = 0;
  if (input.forward) along += 1;
  if (input.back) along -= 1;
  if (along !== 0) {
    x += Math.sin(yaw) * along * PLAYER.walkSpeed * dt;
    z += Math.cos(yaw) * along * PLAYER.walkSpeed * dt;
  }

  x = Math.max(-HALF, Math.min(HALF, x));
  z = Math.max(-HALF, Math.min(HALF, z));

  if (input.jump && grounded) {
    vy = PLAYER.jumpSpeed;
    grounded = false;
  }

  vy += PLAYER.gravity * dt;
  y += vy * dt;

  const ground = sampleHeightFromGrid(heights, x, z) + PLAYER.capsuleHalfHeight;
  if (y <= ground) {
    y = ground;
    vy = 0;
    grounded = true;
  } else {
    grounded = false;
  }

  return { x, y, z, yaw, vy, grounded };
}

export const idleInput: MotorInput = {
  forward: false,
  back: false,
  turnLeft: false,
  turnRight: false,
  jump: false,
};
