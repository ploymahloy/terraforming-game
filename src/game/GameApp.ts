import * as THREE from 'three/webgpu';
import { applyThirdPerson } from '../camera/ThirdPersonCamera';
import { createOrbit, resizeOrbit, updateOrbit, type Orbit } from '../camera/OrbitCamera';
import {
  CELL_SIZE,
  PLAYER,
  type BrushType,
  type GameMode,
  type LifeKind,
  type TerrainPresetId,
} from '../config';
import { clearLife, createLife, placeLife, restoreEntities, tickLife, type Life } from '../life/LifeSystem';
import { createMultiplayerClient, type MpClient } from '../multiplayer/client';
import type { PosePayload, Snapshot } from '../multiplayer/protocol';
import { createAvatar, disposeAvatar } from '../player/Avatar';
import { tickMotor, type MotorInput, type MotorState } from '../player/PlayerMotor';
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
import {
  createHud,
  setHudMode,
  showGameHud,
  showJoinError,
  showShareCode,
  type Hud,
} from '../ui/Hud';
import {
  addWater,
  createWater,
  resetWater,
  setDepths,
  syncWaterMesh,
  tickWater,
  type Water,
} from '../water/WaterSystem';

interface RemoteAvatar {
  id: string;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  yaw: number;
  visX: number;
  visY: number;
  visZ: number;
  visYaw: number;
}

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
  mp: MpClient | null;
  localPlayer: MotorState | null;
  localAvatar: THREE.Mesh | null;
  remotes: Map<string, RemoteAvatar>;
  walkKeys: MotorInput;
  poseAcc: number;
  isHost: boolean;
  roomCode: string | null;
  playerId: string | null;
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
    mp: null as MpClient | null,
    localPlayer: null as MotorState | null,
    localAvatar: null as THREE.Mesh | null,
    remotes: new Map<string, RemoteAvatar>(),
    walkKeys: {
      forward: false,
      back: false,
      turnLeft: false,
      turnRight: false,
      jump: false,
    },
    poseAcc: 0,
    isHost: false,
    roomCode: null as string | null,
    playerId: null as string | null,
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
    onShareSpace: () => shareSpace(fullGame),
    onJoinSpace: (code) => joinSpace(fullGame, code),
  });

  const fullGame: Game = { ...game, hud };

  setupScene(fullGame);
  setupLights(fullGame);
  bindPointer(fullGame);
  bindWalkKeys(fullGame);
  connectMultiplayer(fullGame);
  window.addEventListener('resize', () => resize(fullGame));
  resize(fullGame);

  return fullGame;
}

export async function initGame(game: Game): Promise<void> {
  await game.renderer.init();
  game.renderer.setAnimationLoop(() => frame(game));
}

function connectMultiplayer(game: Game): void {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  game.mp = createMultiplayerClient(`${proto}://${location.host}/mp`, {
    onCreated: (msg) => {
      game.isHost = true;
      game.roomCode = msg.code;
      game.playerId = msg.playerId;
      ensureLocalPlayer(game, msg.playerId, msg.pose);
      showShareCode(game.hud, msg.code);
      sendLocalPose(game);
    },
    onJoined: (msg) => {
      game.isHost = false;
      game.roomCode = msg.code;
      game.playerId = msg.playerId;
      applySnapshot(game, msg.snapshot);
      game.started = true;
      showGameHud(game.hud);
      setHudMode(game.hud, 'walk');
      setMode(game, 'walk');
      ensureLocalPlayer(game, msg.playerId, msg.pose);
      for (const other of msg.others) {
        upsertRemote(game, other.id, other);
      }
      sendLocalPose(game);
    },
    onError: (msg) => {
      if (!game.started) showJoinError(game.hud, msg.reason);
    },
    onPose: (msg) => {
      upsertRemote(game, msg.id, msg);
    },
    onPeerJoined: (msg) => {
      if (msg.pose) upsertRemote(game, msg.id, msg.pose);
      else upsertRemote(game, msg.id, { x: 0, y: 0, z: 0, yaw: 0 });
    },
    onPeerLeft: (msg) => {
      removeRemote(game, msg.id);
    },
    onClose: () => {
      if (!game.isHost) {
        for (const id of [...game.remotes.keys()]) removeRemote(game, id);
      }
    },
  });
}

function captureSnapshot(game: Game): Snapshot {
  return {
    heights: Array.from(game.terrain.heights),
    waterDepths: Array.from(game.water.depths),
    life: game.life.entities.map((e) => ({
      kind: e.kind,
      cellX: e.cellX,
      cellZ: e.cellZ,
      age: e.age,
    })),
  };
}

function applySnapshot(game: Game, snapshot: Snapshot): void {
  setHeights(game.terrain, Float32Array.from(snapshot.heights));
  setDepths(game.water, Float32Array.from(snapshot.waterDepths));
  restoreEntities(game.life, snapshot.life, game.terrain);
  syncWaterMesh(game.water, game.terrain);
}

function shareSpace(game: Game): void {
  if (!game.started || !game.mp) return;
  if (game.roomCode && !game.isHost) return;
  game.mp.sendCreate(captureSnapshot(game));
}

function joinSpace(game: Game, code: string): void {
  game.mp?.sendJoin(code);
}

function ensureLocalPlayer(game: Game, playerId: string, pose: PosePayload): void {
  const keep = game.localPlayer;
  const next: MotorState = keep
    ? { ...keep }
    : { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, vy: 0, grounded: true };
  if (!keep) {
    next.x = pose.x;
    next.y = pose.y;
    next.z = pose.z;
    next.yaw = pose.yaw;
  }
  game.playerId = playerId;
  game.localPlayer = next;
  if (game.localAvatar) {
    game.scene.remove(game.localAvatar);
    disposeAvatar(game.localAvatar);
  }
  game.localAvatar = createAvatar(playerId);
  game.scene.add(game.localAvatar);
  syncLocalAvatar(game);
}

function sendLocalPose(game: Game): void {
  const p = game.localPlayer;
  if (!p || !game.mp) return;
  game.mp.sendPose(p.x, p.y, p.z, p.yaw);
  game.poseAcc = 0;
}

function syncLocalAvatar(game: Game): void {
  const p = game.localPlayer;
  if (!p || !game.localAvatar) return;
  game.localAvatar.position.set(p.x, p.y, p.z);
  game.localAvatar.rotation.y = p.yaw;
}

function upsertRemote(game: Game, id: string, pose: PosePayload): void {
  if (id === game.playerId) return;
  const existing = game.remotes.get(id);
  if (existing) {
    existing.x = pose.x;
    existing.y = pose.y;
    existing.z = pose.z;
    existing.yaw = pose.yaw;
    return;
  }
  const mesh = createAvatar(id);
  game.scene.add(mesh);
  mesh.position.set(pose.x, pose.y, pose.z);
  mesh.rotation.y = pose.yaw;
  game.remotes.set(id, {
    id,
    mesh,
    x: pose.x,
    y: pose.y,
    z: pose.z,
    yaw: pose.yaw,
    visX: pose.x,
    visY: pose.y,
    visZ: pose.z,
    visYaw: pose.yaw,
  });
}

function removeRemote(game: Game, id: string): void {
  const remote = game.remotes.get(id);
  if (!remote) return;
  game.scene.remove(remote.mesh);
  disposeAvatar(remote.mesh);
  game.remotes.delete(id);
}

function lerpRemotes(game: Game, dt: number): void {
  const k = 1 - Math.exp(-dt * PLAYER.remoteLerp);
  for (const remote of game.remotes.values()) {
    remote.visX += (remote.x - remote.visX) * k;
    remote.visY += (remote.y - remote.visY) * k;
    remote.visZ += (remote.z - remote.visZ) * k;
    remote.visYaw += (remote.yaw - remote.visYaw) * k;
    remote.mesh.position.set(remote.visX, remote.visY, remote.visZ);
    remote.mesh.rotation.y = remote.visYaw;
  }
}

function setupScene(game: Game): void {
  game.scene.background = new THREE.Color('#6a8fad');
  game.scene.fog = new THREE.Fog('#9bb3a8', 28, 80);

  game.scene.add(game.terrain.mesh);
  game.scene.add(game.water.mesh);
  game.scene.add(game.life.group);
  game.scene.add(game.brushCursor.mesh);
  game.scene.add(game.pour.points);

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
  game.orbit.controls.enabled = mode !== 'walk';
  if (mode === 'walk') {
    ensureSoloWalker(game);
  }
}

function ensureSoloWalker(game: Game): void {
  if (game.localPlayer) return;
  const id = game.playerId ?? 'local';
  ensureLocalPlayer(game, id, { x: 0, y: 0, z: 0, yaw: 0 });
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
    if (game.mode === 'walk') return;
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

function bindWalkKeys(game: Game): void {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === 'ArrowUp') {
      game.walkKeys.forward = true;
      e.preventDefault();
    } else if (e.code === 'ArrowDown') {
      game.walkKeys.back = true;
      e.preventDefault();
    } else if (e.code === 'ArrowLeft') {
      game.walkKeys.turnLeft = true;
      e.preventDefault();
    } else if (e.code === 'ArrowRight') {
      game.walkKeys.turnRight = true;
      e.preventDefault();
    } else if (e.code === 'Space') {
      game.walkKeys.jump = true;
      if (game.mode === 'walk') e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp') game.walkKeys.forward = false;
    else if (e.code === 'ArrowDown') game.walkKeys.back = false;
    else if (e.code === 'ArrowLeft') game.walkKeys.turnLeft = false;
    else if (e.code === 'ArrowRight') game.walkKeys.turnRight = false;
    else if (e.code === 'Space') game.walkKeys.jump = false;
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
  if (game.mode === 'walk') return;
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
  if (game.mode === 'walk') {
    hideBrushCursor(game.brushCursor);
    return;
  }
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

  if (game.mode === 'walk' && game.localPlayer) {
    game.localPlayer = tickMotor(game.localPlayer, game.walkKeys, dt, game.terrain.heights);
    syncLocalAvatar(game);
    applyThirdPerson(game.orbit.camera, game.localPlayer);
    if (game.mp && game.roomCode) {
      game.poseAcc += dt;
      if (game.poseAcc >= 1 / PLAYER.poseHz) {
        sendLocalPose(game);
      }
    }
  } else {
    updateOrbit(game.orbit, dt);
  }

  lerpRemotes(game, dt);

  if (game.started) {
    flushIfDirty(game.terrain);
    tickWater(game.water, dt, game.terrain);
    tickPour(game.pour, dt, game.terrain, (cx, cz, amount) => addWater(game.water, cx, cz, amount));
    tickLife(game.life, dt, game.terrain);
  }

  game.renderer.render(game.scene, game.orbit.camera);
}
