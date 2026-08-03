import * as THREE from 'three/webgpu';
import { OrbitCamera } from '../camera/OrbitCamera';
import {
  CELL_SIZE,
  type BrushType,
  type GameMode,
  type LifeKind,
  type TerrainPresetId,
} from '../config';
import { LifeSystem } from '../life/LifeSystem';
import { HeightmapTerrain } from '../terrain/HeightmapTerrain';
import { getPreset } from '../terrain/TerrainPresets';
import { BrushCursor, BrushTool } from '../tools/BrushTool';
import { PourTool } from '../tools/PourTool';
import { Hud } from '../ui/Hud';
import { WaterSystem } from '../water/WaterSystem';

export class GameApp {
  private readonly renderer: THREE.WebGPURenderer;
  private readonly scene = new THREE.Scene();
  private readonly orbit: OrbitCamera;
  private readonly terrain = new HeightmapTerrain();
  private readonly water = new WaterSystem();
  private readonly life = new LifeSystem();
  private readonly brush = new BrushTool();
  private readonly brushCursor = new BrushCursor();
  private readonly pour = new PourTool();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly hud: Hud;

  private mode: GameMode = 'terraform';
  private lifeKind: LifeKind = 'tree';
  private started = false;
  private pointerDown = false;
  private readonly clock = new THREE.Clock();
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.orbit = new OrbitCamera(canvas);
    this.setupScene();
    this.setupLights();

    this.hud = new Hud({
      onSelectTerrain: (id) => this.startWithTerrain(id),
      onModeChange: (mode) => this.setMode(mode),
      onBrushChange: (brush) => this.setBrush(brush),
      onBrushSizeChange: (size) => this.setBrushSize(size),
      onLifeKindChange: (kind) => {
        this.lifeKind = kind;
      },
    });

    this.bindPointer();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  async init(): Promise<void> {
    await this.renderer.init();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color('#6a8fad');
    this.scene.fog = new THREE.Fog('#9bb3a8', 55, 160);

    this.scene.add(this.terrain.mesh);
    this.scene.add(this.water.mesh);
    this.scene.add(this.life.group);
    this.scene.add(this.brushCursor.mesh);
    this.scene.add(this.pour.points);

    // Soft ground shadow disc under the map for presence
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(38, 48),
      new THREE.MeshBasicMaterial({
        color: 0x1e2a28,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -4.2;
    this.scene.add(disc);
  }

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0xcfe0d8, 0x4a4035, 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d6, 1.35);
    sun.position.set(30, 50, 18);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8eb0c8, 0.35);
    fill.position.set(-20, 20, -30);
    this.scene.add(fill);
  }

  private startWithTerrain(id: TerrainPresetId): void {
    const preset = getPreset(id);
    this.terrain.setHeights(preset.generate());
    this.water.reset();
    this.life.clear();
    this.water.syncMesh(this.terrain);
    this.started = true;
    this.hud.showGame();
    this.hud.setMode('terraform');
    this.setMode('terraform');
  }

  private setMode(mode: GameMode): void {
    this.mode = mode;
    this.pointerDown = false;
    this.pour.stop();
    if (mode !== 'terraform') this.brushCursor.hide();
  }

  private setBrush(brush: BrushType): void {
    this.brush.type = brush;
  }

  private setBrushSize(size: number): void {
    this.brush.radius = size;
    this.brushCursor.setRadius(size * CELL_SIZE);
  }

  private bindPointer(): void {
    const el = this.canvas;

    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('pointerdown', (e) => {
      if (!this.started || e.button !== 0) return;
      this.pointerDown = true;
      this.updatePointer(e);
      this.onToolBegin();
    });

    el.addEventListener('pointermove', (e) => {
      if (!this.started) return;
      this.updatePointer(e);
      this.onToolMove();
    });

    const end = () => {
      if (!this.pointerDown) return;
      this.pointerDown = false;
      this.pour.stop();
    };

    el.addEventListener('pointerup', end);
    el.addEventListener('pointerleave', () => {
      end();
      this.brushCursor.hide();
    });
  }

  private updatePointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private hitTerrain(): THREE.Intersection | null {
    this.raycaster.setFromCamera(this.pointer, this.orbit.camera);
    const hits = this.raycaster.intersectObject(this.terrain.mesh);
    return hits[0] ?? null;
  }

  private onToolBegin(): void {
    const hit = this.hitTerrain();
    if (!hit?.point) return;

    const cell = this.terrain.worldToCell(hit.point.x, hit.point.z);

    if (this.mode === 'terraform') {
      this.brush.beginStroke(this.terrain, cell.x, cell.z);
      this.brush.apply(this.terrain, cell.x, cell.z);
      this.brushCursor.showAt(hit.point.x, hit.point.y, hit.point.z);
    } else if (this.mode === 'water') {
      this.pour.start(hit.point, cell);
    } else if (this.mode === 'life') {
      this.life.place(this.lifeKind, cell.x, cell.z, this.terrain);
    }
  }

  private onToolMove(): void {
    const hit = this.hitTerrain();
    if (!hit?.point) {
      this.brushCursor.hide();
      return;
    }

    const cell = this.terrain.worldToCell(hit.point.x, hit.point.z);

    if (this.mode === 'terraform') {
      this.brushCursor.setRadius(this.brush.radius * CELL_SIZE);
      this.brushCursor.showAt(hit.point.x, hit.point.y, hit.point.z);
      if (this.pointerDown) {
        this.brush.apply(this.terrain, cell.x, cell.z);
      }
    } else if (this.mode === 'water') {
      this.brushCursor.hide();
      if (this.pointerDown) {
        this.pour.move(hit.point, cell);
      }
    } else {
      this.brushCursor.hide();
    }
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.orbit.resize(width, height);
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.orbit.update();

    if (this.started) {
      this.terrain.flushIfDirty();
      this.water.tick(dt, this.terrain);
      this.pour.tick(dt, this.terrain, (cx, cz, amount) => this.water.add(cx, cz, amount));
      this.life.tick(dt, this.terrain);
    }

    this.renderer.render(this.scene, this.orbit.camera);
  }
}
