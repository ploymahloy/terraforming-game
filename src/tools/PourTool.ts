import * as THREE from 'three/webgpu';
import { GRID_SIZE } from '../config';
import type { HeightmapTerrain } from '../terrain/HeightmapTerrain';

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

export class PourTool {
  private particles: Particle[] = [];
  private pouring = false;
  private pourPoint = new THREE.Vector3();
  private pourCell = { x: 0, z: 0 };
  private emitAcc = 0;
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly geometry: THREE.BufferGeometry;

  constructor() {
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setDrawRange(0, 0);

    const material = new THREE.PointsMaterial({
      color: 0x7eb6d9,
      size: 0.28,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  start(world: THREE.Vector3, cell: { x: number; z: number }): void {
    this.pouring = true;
    this.pourPoint.copy(world);
    this.pourCell = { ...cell };
    // Immediate splash so short clicks still leave a puddle
    this.emitAcc = 8;
  }

  move(world: THREE.Vector3, cell: { x: number; z: number }): void {
    this.pourPoint.copy(world);
    this.pourCell = { ...cell };
  }

  stop(): void {
    this.pouring = false;
  }

  tick(
    dt: number,
    terrain: HeightmapTerrain,
    addWater: (cx: number, cz: number, amount: number) => void,
  ): void {
    if (this.pouring) {
      this.emitAcc += POUR_RATE * dt;
      while (this.emitAcc >= 1 && this.particles.length < MAX_PARTICLES) {
        this.emitAcc -= 1;
        this.spawnParticle(terrain);
      }
    }

    const surfaceY = (cx: number, cz: number) => terrain.getHeight(cx, cz);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (!p.settled) {
        p.velocity.y -= 18 * dt;
        p.position.addScaledVector(p.velocity, dt);

        const ground = surfaceY(p.targetCell.x, p.targetCell.z) + 0.05;
        if (p.position.y <= ground) {
          p.position.y = ground;
          p.settled = true;
          addWater(p.targetCell.x, p.targetCell.z, WATER_PER_PARTICLE);
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
            addWater(nx, nz, WATER_PER_PARTICLE * 0.15);
          }
        }
      }

      if (p.life >= p.maxLife || (p.settled && p.life > 0.35)) {
        this.particles.splice(i, 1);
      }
    }

    this.syncGeometry();
  }

  private spawnParticle(terrain: HeightmapTerrain): void {
    const jitter = 0.35;
    const cx = this.pourCell.x;
    const cz = this.pourCell.z;
    const world = terrain.cellToWorld(cx, cz);
    const surface = terrain.getHeight(cx, cz);

    this.particles.push({
      position: new THREE.Vector3(
        this.pourPoint.x + (Math.random() - 0.5) * jitter,
        Math.max(this.pourPoint.y, surface) + 2.2 + Math.random() * 0.6,
        this.pourPoint.z + (Math.random() - 0.5) * jitter,
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
      const last = this.particles[this.particles.length - 1];
      last.targetCell = { x: cx, z: cz };
      last.position.x = world.x + (Math.random() - 0.5) * 0.4;
      last.position.z = world.z + (Math.random() - 0.5) * 0.4;
    }
  }

  private syncGeometry(): void {
    const n = this.particles.length;
    for (let i = 0; i < n; i++) {
      const p = this.particles[i].position;
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
    }
    this.geometry.setDrawRange(0, n);
    const attr = this.geometry.attributes.position as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }
}
