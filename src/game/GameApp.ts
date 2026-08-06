import * as THREE from 'three/webgpu';
import { createOrbit, resizeOrbit, updateOrbit, type Orbit } from '../camera/OrbitCamera';
import {
  CELL_SIZE,
  type BrushType,
  type GameMode,
  type LifeKind,
  type TerrainPresetId,
} from '../config';
import { clearLife, createLife, placeLife, tickLife, type Life } from '../life/LifeSystem';
import {
  createTerrain,
  flushIfDirty,
  setHeights,
  worldToCell,
  type Terrain,
} from '../terrain/HeightmapTerrain';
import { getPreset } from '../terrain/TerrainPresets';
import {
  applyBrush,
  beginBrushStroke,
  createBrush,
  createBrushCursor,
  hideBrushCursor,
  setBrushCursorRadius,
  showBrushCursor,
  type Brush,
  type BrushCursor,
} from '../tools/BrushTool';
import {
  createPour,
  movePour,
  startPour,
  stopPour,
  tickPour,
  type Pour,
} from '../tools/PourTool';
import { createHud, setHudMode, showGameHud, type Hud } from '../ui/Hud';
import {
  addWater,
  createWater,
  resetWater,
  syncWaterMesh,
  tickWater,
  type Water,
} from '../water/WaterSystem';

export interface Game {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  orbit: Orbit;
  terrain: Terrain;
  water: Water;
  life: Life;
  brush: Brush;
  brushCursor: BrushCursor;
  pour: Pour;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  hud: Hud;
  mode: GameMode;
  lifeKind: LifeKind;
  started: boolean;
  pointerDown: boolean;
  clock: THREE.Clock;
  canvas: HTMLCanvasElement;
}

export function createGame(canvas: HTMLCanvasElement): Game {
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const orbit = createOrbit(canvas);
  const terrain = createTerrain();
  const water = createWater();
  const life = createLife();
  const brush = createBrush();
  const brushCursor = createBrushCursor();
  const pour = createPour();

  const game = {
    renderer,
    scene,
    orbit,
    terrain,
    water,
    life,
    brush,
    brushCursor,
    pour,
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
    mode: 'terraform' as GameMode,
    lifeKind: 'tree' as LifeKind,
    started: false,
    pointerDown: false,
    clock: new THREE.Clock(),
    canvas,
  };

  const hud = createHud({
    onSelectTerrain: (id) => startWithTerrain(fullGame, id),
    onModeChange: (mode) => setMode(fullGame, mode),
    onBrushChange: (b) => setBrush(fullGame, b),
    onBrushSizeChange: (size) => setBrushSize(fullGame, size),
    onPourRateChange: (rate) => {
      fullGame.pour.rateMultiplier = rate;
    },
    onLifeKindChange: (kind) => {
      fullGame.lifeKind = kind;
    },
  });

  const fullGame: Game = { ...game, hud };

  setupScene(fullGame);
  setupLights(fullGame);
  bindPointer(fullGame);
  window.addEventListener('resize', () => resize(fullGame));
  resize(fullGame);

  return fullGame;
}

export async function initGame(game: Game): Promise<void> {
  await game.renderer.init();
  game.renderer.setAnimationLoop(() => frame(game));
}

function setupScene(game: Game): void {
  game.scene.background = new THREE.Color('#6a8fad');
  game.scene.fog = new THREE.Fog('#9bb3a8', 28, 80);

  game.scene.add(game.terrain.mesh);
  game.scene.add(game.water.mesh);
  game.scene.add(game.life.group);
  game.scene.add(game.brushCursor.mesh);
  game.scene.add(game.pour.points);

  // Soft ground shadow disc under the map for presence
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(19, 48),
    new THREE.MeshBasicMaterial({
      color: 0x1e2a28,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -4.2;
  game.scene.add(disc);
}

function setupLights(game: Game): void {
  const hemi = new THREE.HemisphereLight(0xcfe0d8, 0x4a4035, 0.85);
  game.scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d6, 1.35);
  sun.position.set(15, 25, 9);
  game.scene.add(sun);

  const fill = new THREE.DirectionalLight(0x8eb0c8, 0.35);
  fill.position.set(-20, 20, -30);
  game.scene.add(fill);
}

function startWithTerrain(game: Game, id: TerrainPresetId): void {
  const preset = getPreset(id);
  setHeights(game.terrain, preset.generate());
  resetWater(game.water);
  clearLife(game.life);
  syncWaterMesh(game.water, game.terrain);
  game.started = true;
  showGameHud(game.hud);
  setHudMode(game.hud, 'terraform');
  setMode(game, 'terraform');
}

function setMode(game: Game, mode: GameMode): void {
  game.mode = mode;
  game.pointerDown = false;
  stopPour(game.pour);
  if (mode !== 'terraform') hideBrushCursor(game.brushCursor);
}

function setBrush(game: Game, brush: BrushType): void {
  game.brush.type = brush;
}

function setBrushSize(game: Game, size: number): void {
  game.brush.radius = size;
  setBrushCursorRadius(game.brushCursor, size * CELL_SIZE);
}

function bindPointer(game: Game): void {
  const el = game.canvas;

  el.addEventListener('contextmenu', (e) => e.preventDefault());

  el.addEventListener('pointerdown', (e) => {
    if (!game.started || e.button !== 0) return;
    game.pointerDown = true;
    updatePointer(game, e);
    onToolBegin(game);
  });

  el.addEventListener('pointermove', (e) => {
    if (!game.started) return;
    updatePointer(game, e);
    onToolMove(game);
  });

  const end = () => {
    if (!game.pointerDown) return;
    game.pointerDown = false;
    stopPour(game.pour);
  };

  el.addEventListener('pointerup', end);
  el.addEventListener('pointerleave', () => {
    end();
    hideBrushCursor(game.brushCursor);
  });
}

function updatePointer(game: Game, e: PointerEvent): void {
  const rect = game.canvas.getBoundingClientRect();
  game.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  game.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function hitTerrain(game: Game): THREE.Intersection | null {
  game.raycaster.setFromCamera(game.pointer, game.orbit.camera);
  const hits = game.raycaster.intersectObject(game.terrain.mesh);
  return hits[0] ?? null;
}

function onToolBegin(game: Game): void {
  const hit = hitTerrain(game);
  if (!hit?.point) return;

  const cell = worldToCell(hit.point.x, hit.point.z);

  if (game.mode === 'terraform') {
    beginBrushStroke(game.brush, game.terrain, cell.x, cell.z);
    applyBrush(game.brush, game.terrain, cell.x, cell.z);
    showBrushCursor(game.brushCursor, hit.point.x, hit.point.y, hit.point.z);
  } else if (game.mode === 'water') {
    startPour(game.pour, hit.point, cell);
  } else if (game.mode === 'life') {
    placeLife(game.life, game.lifeKind, cell.x, cell.z, game.terrain);
  }
}

function onToolMove(game: Game): void {
  const hit = hitTerrain(game);
  if (!hit?.point) {
    hideBrushCursor(game.brushCursor);
    return;
  }

  const cell = worldToCell(hit.point.x, hit.point.z);

  if (game.mode === 'terraform') {
    setBrushCursorRadius(game.brushCursor, game.brush.radius * CELL_SIZE);
    showBrushCursor(game.brushCursor, hit.point.x, hit.point.y, hit.point.z);
    if (game.pointerDown) {
      applyBrush(game.brush, game.terrain, cell.x, cell.z);
    }
  } else if (game.mode === 'water') {
    hideBrushCursor(game.brushCursor);
    if (game.pointerDown) {
      movePour(game.pour, hit.point, cell);
    }
  } else {
    hideBrushCursor(game.brushCursor);
  }
}

function resize(game: Game): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  game.renderer.setSize(width, height, false);
  resizeOrbit(game.orbit, width, height);
}

function frame(game: Game): void {
  const dt = Math.min(game.clock.getDelta(), 0.05);
  updateOrbit(game.orbit);

  if (game.started) {
    flushIfDirty(game.terrain);
    tickWater(game.water, dt, game.terrain);
    tickPour(game.pour, dt, game.terrain, (cx, cz, amount) => addWater(game.water, cx, cz, amount));
    tickLife(game.life, dt, game.terrain);
  }

  game.renderer.render(game.scene, game.orbit.camera);
}
