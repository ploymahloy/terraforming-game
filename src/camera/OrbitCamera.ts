import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA } from '../config';

const _right = new THREE.Vector3();

export interface Orbit {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  strafeLeft: boolean;
  strafeRight: boolean;
  onKeyDown: (e: KeyboardEvent) => void;
  onKeyUp: (e: KeyboardEvent) => void;
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

  const orbit: Orbit = {
    camera,
    controls,
    strafeLeft: false,
    strafeRight: false,
    onKeyDown: () => {},
    onKeyUp: () => {},
  };

  orbit.onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === 'KeyA') {
      orbit.strafeLeft = true;
      e.preventDefault();
    } else if (e.code === 'KeyD') {
      orbit.strafeRight = true;
      e.preventDefault();
    }
  };

  orbit.onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'KeyA') orbit.strafeLeft = false;
    else if (e.code === 'KeyD') orbit.strafeRight = false;
  };

  window.addEventListener('keydown', orbit.onKeyDown);
  window.addEventListener('keyup', orbit.onKeyUp);

  return orbit;
}

export function resizeOrbit(orbit: Orbit, width: number, height: number): void {
  orbit.camera.aspect = width / Math.max(height, 1);
  orbit.camera.updateProjectionMatrix();
}

export function updateOrbit(orbit: Orbit, dt: number): void {
  let dir = 0;
  if (orbit.strafeLeft) dir -= 1;
  if (orbit.strafeRight) dir += 1;

  if (dir !== 0) {
    orbit.camera.getWorldDirection(_right);
    _right.cross(orbit.camera.up).setY(0);
    if (_right.lengthSq() > 1e-8) {
      _right.normalize().multiplyScalar(dir * CAMERA.strafeSpeed * dt);
      orbit.camera.position.add(_right);
      orbit.controls.target.add(_right);
    }
  }

  orbit.controls.update();
}

export function disposeOrbit(orbit: Orbit): void {
  window.removeEventListener('keydown', orbit.onKeyDown);
  window.removeEventListener('keyup', orbit.onKeyUp);
  orbit.controls.dispose();
}
