import { GRID_SIZE } from '../config';
import { makeRoomCode, type ErrorReason, type PosePayload, type Snapshot } from './protocol';

const MAX_PLAYERS = 8;
const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

export interface RoomPlayer {
  id: string;
  pose: PosePayload;
}

export interface Room {
  code: string;
  hostId: string;
  snapshot: Snapshot;
  players: Map<string, RoomPlayer>;
}

export interface RoomTable {
  rooms: Map<string, Room>;
  byPlayer: Map<string, string>;
}

export type CreateResult =
  | { ok: true; code: string; playerId: string; pose: PosePayload }
  | { ok: false; reason: ErrorReason };

export type JoinResult =
  | {
      ok: true;
      code: string;
      playerId: string;
      snapshot: Snapshot;
      pose: PosePayload;
      others: Array<{ id: string } & PosePayload>;
    }
  | { ok: false; reason: ErrorReason };

export type LeaveResult =
  | { ok: true; hostLeft: true; code: string; guestIds: string[] }
  | { ok: true; hostLeft: false; code: string; remainingIds: string[]; leftId: string }
  | { ok: false };

export type PoseResult =
  | { ok: true; others: string[]; pose: { id: string } & PosePayload }
  | { ok: false };

let nextPlayer = 1;

export function createTable(): RoomTable {
  return { rooms: new Map(), byPlayer: new Map() };
}

export function createRoom(table: RoomTable, snapshot: Snapshot): CreateResult {
  if (!isSnapshot(snapshot)) return { ok: false, reason: 'bad_payload' };
  const code = uniqueCode(table);
  const playerId = allocPlayerId();
  const pose = spawnPose();
  const room: Room = {
    code,
    hostId: playerId,
    snapshot,
    players: new Map([[playerId, { id: playerId, pose }]]),
  };
  table.rooms.set(code, room);
  table.byPlayer.set(playerId, code);
  return { ok: true, code, playerId, pose };
}

export function joinRoom(table: RoomTable, code: string): JoinResult {
  if (typeof code !== 'string' || !CODE_RE.test(code)) {
    return { ok: false, reason: 'bad_payload' };
  }
  const room = table.rooms.get(code);
  if (!room) return { ok: false, reason: 'not_found' };
  if (room.players.size >= MAX_PLAYERS) return { ok: false, reason: 'room_full' };

  const playerId = allocPlayerId();
  const pose = spawnPose();
  const others = [...room.players.values()].map((p) => ({ id: p.id, ...p.pose }));
  room.players.set(playerId, { id: playerId, pose });
  table.byPlayer.set(playerId, code);
  return { ok: true, code, playerId, snapshot: room.snapshot, pose, others };
}

export function refreshSnapshot(table: RoomTable, playerId: string, snapshot: Snapshot): boolean {
  if (!isSnapshot(snapshot)) return false;
  const room = roomForPlayer(table, playerId);
  if (!room || room.hostId !== playerId) return false;
  room.snapshot = snapshot;
  return true;
}

export function leaveRoom(table: RoomTable, playerId: string): LeaveResult {
  const room = roomForPlayer(table, playerId);
  if (!room) return { ok: false };
  table.byPlayer.delete(playerId);
  room.players.delete(playerId);

  if (playerId === room.hostId) {
    const guestIds = [...room.players.keys()];
    for (const id of guestIds) {
      table.byPlayer.delete(id);
    }
    table.rooms.delete(room.code);
    return { ok: true, hostLeft: true, code: room.code, guestIds };
  }

  return {
    ok: true,
    hostLeft: false,
    code: room.code,
    remainingIds: [...room.players.keys()],
    leftId: playerId,
  };
}

export function setPose(table: RoomTable, playerId: string, pose: PosePayload): PoseResult {
  const room = roomForPlayer(table, playerId);
  const player = room?.players.get(playerId);
  if (!room || !player) return { ok: false };
  player.pose = pose;
  const others = [...room.players.keys()].filter((id) => id !== playerId);
  return { ok: true, others, pose: { id: playerId, ...pose } };
}

export function roomForPlayer(table: RoomTable, playerId: string): Room | undefined {
  const code = table.byPlayer.get(playerId);
  return code ? table.rooms.get(code) : undefined;
}

function uniqueCode(table: RoomTable): string {
  for (let i = 0; i < 64; i++) {
    const code = makeRoomCode();
    if (!table.rooms.has(code)) return code;
  }
  throw new Error('failed to allocate room code');
}

function allocPlayerId(): string {
  return `p${nextPlayer++}`;
}

function spawnPose(): PosePayload {
  return { x: 0, y: 0, z: 0, yaw: 0 };
}

function isSnapshot(snapshot: Snapshot): boolean {
  return (
    Array.isArray(snapshot.heights) &&
    Array.isArray(snapshot.waterDepths) &&
    Array.isArray(snapshot.life) &&
    (snapshot.heights.length === GRID_SIZE * GRID_SIZE || snapshot.heights.length > 0)
  );
}
