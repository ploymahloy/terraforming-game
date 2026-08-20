import { PLAYER } from '../config';

export interface AvatarPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export function cameraOffsetFromYaw(
  yaw: number,
  distance = PLAYER.cameraDistance,
  height = PLAYER.cameraHeight,
): { x: number; y: number; z: number } {
  return {
    x: -Math.sin(yaw) * distance,
    y: height,
    z: -Math.cos(yaw) * distance,
  };
}

export function lookAtFromAvatar(avatar: Pick<AvatarPose, 'x' | 'y' | 'z'>): { x: number; y: number; z: number } {
  return { x: avatar.x, y: avatar.y + 0.4, z: avatar.z };
}

export function applyThirdPerson(
  camera: { position: { set(x: number, y: number, z: number): void }; lookAt(x: number, y: number, z: number): void },
  avatar: AvatarPose,
): void {
  const offset = cameraOffsetFromYaw(avatar.yaw);
  camera.position.set(avatar.x + offset.x, avatar.y + offset.y, avatar.z + offset.z);
  const look = lookAtFromAvatar(avatar);
  camera.lookAt(look.x, look.y, look.z);
}
