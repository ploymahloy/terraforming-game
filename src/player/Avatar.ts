import * as THREE from 'three/webgpu';
import { PLAYER } from '../config';

export function colorForPlayerId(playerId: string): number {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0;
  }
  const hue = (hash % 360) / 360;
  return new THREE.Color().setHSL(hue, 0.58, 0.52).getHex();
}

export function createAvatar(playerId: string): THREE.Mesh {
  const cylinder = PLAYER.capsuleHalfHeight * 2 - PLAYER.capsuleRadius * 2;
  const geometry = new THREE.CapsuleGeometry(PLAYER.capsuleRadius, Math.max(cylinder, 0.1), 4, 10);
  const material = new THREE.MeshStandardMaterial({ color: colorForPlayerId(playerId) });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `avatar-${playerId}`;
  mesh.castShadow = true;
  return mesh;
}

export function disposeAvatar(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  const { material } = mesh;
  if (Array.isArray(material)) {
    for (const item of material) item.dispose();
  } else {
    material.dispose();
  }
}
