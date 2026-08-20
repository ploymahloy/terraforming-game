import { describe, expect, it } from 'vitest';
import { GRID_SIZE, PLAYER, WORLD_SIZE } from '../config';
import { cellToWorld } from '../terrain/HeightmapTerrain';
import { idleInput, tickMotor, type MotorInput, type MotorState } from './PlayerMotor';

function flatHeights(value: number): Float32Array {
  const heights = new Float32Array(GRID_SIZE * GRID_SIZE);
  heights.fill(value);
  return heights;
}

function spawn(over: Partial<MotorState> = {}): MotorState {
  return {
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    vy: 0,
    grounded: false,
    ...over,
  };
}

describe('PlayerMotor', () => {
  it('stands on a flat height-1 grid at capsuleHalfHeight and is grounded', () => {
    const next = tickMotor(spawn(), idleInput, 1 / 60, flatHeights(1));
    expect(next).toMatchObject({
      grounded: true,
      y: 1 + PLAYER.capsuleHalfHeight,
    });
  });

  it('moves about walkSpeed along +Z in one second of ArrowUp at yaw 0 and stays in bounds', () => {
    let state = tickMotor(spawn(), idleInput, 1 / 60, flatHeights(1));
    const input: MotorInput = { ...idleInput, forward: true };
    const startZ = state.z;
    for (let i = 0; i < 60; i++) {
      state = tickMotor(state, input, 1 / 60, flatHeights(1));
    }
    const dz = state.z - startZ;
    const half = WORLD_SIZE / 2;
    expect(dz).toBeGreaterThan(PLAYER.walkSpeed * 0.9);
    expect(dz).toBeLessThan(PLAYER.walkSpeed * 1.1);
    expect(state.x).toBeGreaterThanOrEqual(-half);
    expect(state.x).toBeLessThanOrEqual(half);
    expect(state.z).toBeGreaterThanOrEqual(-half);
    expect(state.z).toBeLessThanOrEqual(half);
  });

  it('sets vy > 0 and grounded false when Space is pressed while grounded', () => {
    const grounded = tickMotor(spawn(), idleInput, 1 / 60, flatHeights(1));
    const jumped = tickMotor(grounded, { ...idleInput, jump: true }, 1 / 60, flatHeights(1));
    expect(jumped.vy).toBeGreaterThan(0);
    expect(jumped.grounded).toBe(false);
  });

  it('does not boost vy when Space is pressed while airborne', () => {
    const grounded = tickMotor(spawn(), idleInput, 1 / 60, flatHeights(1));
    const airborne = tickMotor(grounded, { ...idleInput, jump: true }, 1 / 60, flatHeights(1));
    const boosted = tickMotor(airborne, { ...idleInput, jump: true }, 1 / 60, flatHeights(1));
    const coasting = tickMotor(airborne, idleInput, 1 / 60, flatHeights(1));
    expect(boosted.vy).toBeCloseTo(coasting.vy, 5);
  });

  it('returns to ground with vy 0 after a jump under gravity', () => {
    let state = tickMotor(spawn(), idleInput, 1 / 60, flatHeights(1));
    state = tickMotor(state, { ...idleInput, jump: true }, 1 / 60, flatHeights(1));
    for (let i = 0; i < 180; i++) {
      state = tickMotor(state, idleInput, 1 / 60, flatHeights(1));
    }
    expect(state).toMatchObject({ grounded: true, vy: 0 });
  });

  it('is falling after walking off a 2-unit drop until landing', () => {
    const heights = new Float32Array(GRID_SIZE * GRID_SIZE);
    for (let cz = 0; cz < GRID_SIZE; cz++) {
      for (let cx = 0; cx < GRID_SIZE; cx++) {
        const world = cellToWorld(cx, cz);
        heights[cz * GRID_SIZE + cx] = world.z < 1 ? 2 : 0;
      }
    }
    let state = tickMotor(spawn({ z: -2 }), idleInput, 1 / 60, heights);
    const input: MotorInput = { ...idleInput, forward: true };
    for (let i = 0; i < 40; i++) {
      state = tickMotor(state, input, 1 / 60, heights);
    }
    expect(state.grounded).toBe(false);
    expect(state.y).toBeGreaterThan(0 + PLAYER.capsuleHalfHeight + 0.2);
  });
});
