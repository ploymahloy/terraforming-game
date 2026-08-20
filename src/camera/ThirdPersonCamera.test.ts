import { describe, expect, it } from 'vitest';
import { PLAYER } from '../config';
import { applyThirdPerson, cameraOffsetFromYaw, lookAtFromAvatar } from './ThirdPersonCamera';

describe('third-person camera', () => {
  it('places the camera behind the avatar at yaw 0 (negative Z) and above by camera height', () => {
    const offset = cameraOffsetFromYaw(0);
    expect(offset.z).toBeLessThan(0);
    expect(offset.y).toBe(PLAYER.cameraHeight);
    expect(offset.x).toBeCloseTo(0);
  });

  it('looks at a point above the avatar feet', () => {
    const avatar = { x: 1, y: 1.8, z: 2, yaw: 0 };
    const look = lookAtFromAvatar(avatar);
    const feetY = avatar.y - PLAYER.capsuleHalfHeight;
    expect(look.y).toBeGreaterThan(feetY);
    const cam = {
      pos: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 0, z: 0 },
      position: {
        set(x: number, y: number, z: number) {
          cam.pos = { x, y, z };
        },
      },
      lookAt(x: number, y: number, z: number) {
        cam.target = { x, y, z };
      },
    };
    applyThirdPerson(cam, avatar);
    expect(cam.target.y).toBeGreaterThan(feetY);
  });
});
