import * as THREE from 'three/webgpu';
import type { LifeKind } from '../config';
import type { HeightmapTerrain } from '../terrain/HeightmapTerrain';

export type LifeStage = 'seed' | 'sprout' | 'mature' | 'decay';

export interface LifeEntity {
  id: number;
  kind: LifeKind;
  cellX: number;
  cellZ: number;
  age: number;
  stage: LifeStage;
  mesh: THREE.Object3D;
}

const STAGE_AGES: Record<LifeStage, number> = {
  seed: 0,
  sprout: 4,
  mature: 12,
  decay: 28,
};

function stageForAge(age: number): LifeStage {
  if (age >= STAGE_AGES.decay) return 'decay';
  if (age >= STAGE_AGES.mature) return 'mature';
  if (age >= STAGE_AGES.sprout) return 'sprout';
  return 'seed';
}

export class LifeSystem {
  readonly group = new THREE.Group();
  private entities: LifeEntity[] = [];
  private nextId = 1;
  private readonly templates: Record<LifeKind, THREE.Object3D>;

  constructor() {
    this.group.name = 'life';
    this.templates = {
      tree: this.makeTree(),
      bush: this.makeBush(),
      critter: this.makeCritter(),
    };
  }

  get count(): number {
    return this.entities.length;
  }

  place(kind: LifeKind, cellX: number, cellZ: number, terrain: HeightmapTerrain): LifeEntity | null {
    // Avoid stacking many on same cell
    if (this.entities.some((e) => e.cellX === cellX && e.cellZ === cellZ && e.kind === kind)) {
      return null;
    }

    const mesh = this.templates[kind].clone();
    const world = terrain.cellToWorld(cellX, cellZ);
    const y = terrain.getHeight(cellX, cellZ);
    mesh.position.set(world.x, y, world.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.scale.setScalar(0.55);
    this.group.add(mesh);

    const entity: LifeEntity = {
      id: this.nextId++,
      kind,
      cellX,
      cellZ,
      age: 0,
      stage: 'seed',
      mesh,
    };
    this.entities.push(entity);
    return entity;
  }

  clear(): void {
    for (const e of this.entities) {
      this.group.remove(e.mesh);
    }
    this.entities = [];
  }

  /** Lifecycle tick — ages entities and scales mesh by stage (simple visual growth). */
  tick(dt: number, terrain: HeightmapTerrain): void {
    for (const e of this.entities) {
      e.age += dt;
      const stage = stageForAge(e.age);
      if (stage !== e.stage) {
        e.stage = stage;
      }

      const world = terrain.cellToWorld(e.cellX, e.cellZ);
      const y = terrain.getHeight(e.cellX, e.cellZ);
      e.mesh.position.set(world.x, y, world.z);

      const scale =
        e.stage === 'seed'
          ? 0.55
          : e.stage === 'sprout'
            ? 0.85
            : e.stage === 'mature'
              ? 1.25
              : 0.95;
      const current = e.mesh.scale.x;
      const next = THREE.MathUtils.lerp(current, scale, 1 - Math.exp(-dt * 2));
      e.mesh.scale.setScalar(next);

      if (e.kind === 'critter' && e.stage !== 'decay') {
        e.mesh.position.x += Math.sin(e.age * 1.4 + e.id) * 0.002;
        e.mesh.position.z += Math.cos(e.age * 1.1 + e.id) * 0.002;
      }
    }
  }

  private makeTree(): THREE.Object3D {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 0.9, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 0.95 }),
    );
    trunk.position.y = 0.45;
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.2, 7),
      new THREE.MeshStandardMaterial({ color: 0x3f6b3f, roughness: 0.9 }),
    );
    canopy.position.y = 1.25;
    g.add(trunk, canopy);
    return g;
  }

  private makeBush(): THREE.Object3D {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x4f7a45, roughness: 0.92 }),
    );
    mesh.position.y = 0.35;
    mesh.scale.set(1, 0.75, 1);
    return mesh;
  }

  private makeCritter(): THREE.Object3D {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 0.28, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.85 }),
    );
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.28;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xc4a06a, roughness: 0.85 }),
    );
    head.position.set(0.28, 0.34, 0);
    g.add(body, head);
    return g;
  }
}
