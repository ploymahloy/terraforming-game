import * as THREE from 'three/webgpu';
import { GRID_SIZE } from '../config';
import { cellToWorld, getHeight, type Terrain } from '../terrain/HeightmapTerrain';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  settled: boolean;
  targetCell: { x: number; z: number };
}

const MAX_PARTICLES = 400;
const POUR_RATE = 28;
const WATER_PER_PARTICLE = 0.045;

export interface Pour {
  particles: Particle[];
  pouring: boolean;
  pourPoint: THREE.Vector3;
  pourCell: { x: number; z: number };
  emitAcc: number;
  rateMultiplier: number;
  points: THREE.Points;
  positions: Float32Array;
  geometry: THREE.BufferGeometry;
}

export function createPour(): Pour {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);

  const material = new THREE.PointsMaterial({
    color: 0x7eb6d9,
    size: 0.28,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;

  return {
    particles: [],
    pouring: false,
    pourPoint: new THREE.Vector3(),
    pourCell: { x: 0, z: 0 },
    emitAcc: 0,
    rateMultiplier: 1,
    points,
    positions,
    geometry,
  };
}

export function startPour(pour: Pour, world: THREE.Vector3, cell: { x: number; z: number }): void {
  pour.pouring = true;
  pour.pourPoint.copy(world);
  pour.pourCell = { ...cell };
  // Immediate splash so short clicks still leave a puddle
  pour.emitAcc = 8 * pour.rateMultiplier;
}

export function movePour(pour: Pour, world: THREE.Vector3, cell: { x: number; z: number }): void {
  pour.pourPoint.copy(world);
  pour.pourCell = { ...cell };
}

export function stopPour(pour: Pour): void {
  pour.pouring = false;
}

export function tickPour(
  pour: Pour,
  dt: number,
  terrain: Terrain,
  addWaterFn: (cx: number, cz: number, amount: number) => void,
): void {
  if (pour.pouring) {
    pour.emitAcc += POUR_RATE * pour.rateMultiplier * dt;
    while (pour.emitAcc >= 1 && pour.particles.length < MAX_PARTICLES) {
      pour.emitAcc -= 1;
      spawnParticle(pour, terrain);
    }
  }

  for (let i = pour.particles.length - 1; i >= 0; i--) {
    const p = pour.particles[i];
    p.life += dt;

    if (!p.settled) {
      p.velocity.y -= 18 * dt;
      p.position.addScaledVector(p.velocity, dt);

      const ground = getHeight(terrain, p.targetCell.x, p.targetCell.z) + 0.05;
      if (p.position.y <= ground) {
        p.position.y = ground;
        p.settled = true;
        addWaterFn(p.targetCell.x, p.targetCell.z, WATER_PER_PARTICLE);
        // splash neighbors a little
        const n = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (const [ox, oz] of n) {
          const nx = p.targetCell.x + ox;
          const nz = p.targetCell.z + oz;
          if (nx < 0 || nz < 0 || nx >= GRID_SIZE || nz >= GRID_SIZE) continue;
          addWaterFn(nx, nz, WATER_PER_PARTICLE * 0.15);
        }
      }
    }

    if (p.life >= p.maxLife || (p.settled && p.life > 0.35)) {
      pour.particles.splice(i, 1);
    }
  }

  syncPourGeometry(pour);
}

function spawnParticle(pour: Pour, terrain: Terrain): void {
  const jitter = 0.35;
  const cx = pour.pourCell.x;
  const cz = pour.pourCell.z;
  const world = cellToWorld(cx, cz);
  const surface = getHeight(terrain, cx, cz);

  pour.particles.push({
    position: new THREE.Vector3(
      pour.pourPoint.x + (Math.random() - 0.5) * jitter,
      Math.max(pour.pourPoint.y, surface) + 2.2 + Math.random() * 0.6,
      pour.pourPoint.z + (Math.random() - 0.5) * jitter,
    ),
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      -1.5 - Math.random(),
      (Math.random() - 0.5) * 0.8,
    ),
    life: 0,
    maxLife: 1.4,
    settled: false,
    targetCell: {
      x: THREE.MathUtils.clamp(
        Math.round(cx + (Math.random() - 0.5) * 1.5),
        0,
        GRID_SIZE - 1,
      ),
      z: THREE.MathUtils.clamp(
        Math.round(cz + (Math.random() - 0.5) * 1.5),
        0,
        GRID_SIZE - 1,
      ),
    },
  });

  // prefer pour cell center for most particles
  if (Math.random() > 0.4) {
    const last = pour.particles[pour.particles.length - 1];
    last.targetCell = { x: cx, z: cz };
    last.position.x = world.x + (Math.random() - 0.5) * 0.4;
    last.position.z = world.z + (Math.random() - 0.5) * 0.4;
  }
}

function syncPourGeometry(pour: Pour): void {
  const n = pour.particles.length;
  for (let i = 0; i < n; i++) {
    const p = pour.particles[i].position;
    pour.positions[i * 3] = p.x;
    pour.positions[i * 3 + 1] = p.y;
    pour.positions[i * 3 + 2] = p.z;
  }
  pour.geometry.setDrawRange(0, n);
  const attr = pour.geometry.attributes.position as THREE.BufferAttribute;
  attr.needsUpdate = true;
}
