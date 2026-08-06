import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA } from '../config';

export interface Orbit {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
}

export function createOrbit(canvas: HTMLCanvasElement): Orbit {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camera.position.set(14, 16, 18);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = CAMERA.dampingFactor;
  controls.minDistance = CAMERA.minDistance;
  controls.maxDistance = CAMERA.maxDistance;
  controls.maxPolarAngle = CAMERA.maxPolarAngle;
  controls.enablePan = true;

  // Left mouse reserved for tools; orbit with right / middle.
  controls.mouseButtons = {
    LEFT: -1 as THREE.MOUSE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE,
  };

  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };

  return { camera, controls };
}

export function resizeOrbit(orbit: Orbit, width: number, height: number): void {
  orbit.camera.aspect = width / Math.max(height, 1);
  orbit.camera.updateProjectionMatrix();
}

export function updateOrbit(orbit: Orbit): void {
  orbit.controls.update();
}

export function disposeOrbit(orbit: Orbit): void {
  orbit.controls.dispose();
}
