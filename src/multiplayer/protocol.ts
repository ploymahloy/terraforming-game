import type { LifeKind } from '../config';

export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type ErrorReason = 'not_found' | 'room_full' | 'bad_payload' | 'not_started';

export interface SnapshotLife {
  kind: LifeKind;
  cellX: number;
  cellZ: number;
  age: number;
}

export interface Snapshot {
  heights: number[];
  waterDepths: number[];
  life: SnapshotLife[];
}

export interface PosePayload {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export type ClientMessage =
  | { type: 'create'; snapshot: Snapshot }
  | { type: 'join'; code: string }
  | { type: 'pose'; x: number; y: number; z: number; yaw: number };

export type ServerMessage =
  | { type: 'created'; code: string; playerId: string; pose: PosePayload }
  | {
      type: 'joined';
      code: string;
      playerId: string;
      snapshot: Snapshot;
      pose: PosePayload;
      others: Array<{ id: string } & PosePayload>;
    }
  | { type: 'error'; reason: ErrorReason }
  | { type: 'peerJoined'; id: string; pose?: PosePayload }
  | { type: 'peerLeft'; id: string; pose?: PosePayload }
  | { type: 'pose'; id: string; x: number; y: number; z: number; yaw: number };

export type ProtocolMessage = ClientMessage | ServerMessage;

export type ParseResult = { ok: true; message: ProtocolMessage } | { ok: false };

export function serializeMessage(message: ProtocolMessage): string {
  return JSON.stringify(message);
}

export function parseMessage(raw: string): ParseResult {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return { ok: false };
    const rec = value as Record<string, unknown>;
    const parsed = parseRecord(rec);
    return parsed ? { ok: true, message: parsed } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export function makeRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return code;
}

function parseRecord(rec: Record<string, unknown>): ProtocolMessage | null {
  switch (rec.type) {
    case 'join':
      return typeof rec.code === 'string' ? { type: 'join', code: rec.code } : null;
    case 'create': {
      const snapshot = parseSnapshot(rec.snapshot);
      return snapshot ? { type: 'create', snapshot } : null;
    }
    case 'pose': {
      if (!isFiniteNumber(rec.x) || !isFiniteNumber(rec.y) || !isFiniteNumber(rec.z) || !isFiniteNumber(rec.yaw)) {
        return null;
      }
      if (typeof rec.id === 'string') {
        return { type: 'pose', id: rec.id, x: rec.x, y: rec.y, z: rec.z, yaw: rec.yaw };
      }
      return { type: 'pose', x: rec.x, y: rec.y, z: rec.z, yaw: rec.yaw };
    }
    case 'error':
      return isErrorReason(rec.reason) ? { type: 'error', reason: rec.reason } : null;
    case 'created': {
      const pose = parsePose(rec.pose);
      if (typeof rec.code !== 'string' || typeof rec.playerId !== 'string' || !pose) return null;
      return { type: 'created', code: rec.code, playerId: rec.playerId, pose };
    }
    case 'joined': {
      const snapshot = parseSnapshot(rec.snapshot);
      const pose = parsePose(rec.pose);
      if (typeof rec.code !== 'string' || typeof rec.playerId !== 'string' || !snapshot || !pose) return null;
      if (!Array.isArray(rec.others)) return null;
      const others: Array<{ id: string } & PosePayload> = [];
      for (const item of rec.others) {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        if (typeof row.id !== 'string' || !isFiniteNumber(row.x) || !isFiniteNumber(row.y) || !isFiniteNumber(row.z) || !isFiniteNumber(row.yaw)) {
          return null;
        }
        others.push({ id: row.id, x: row.x, y: row.y, z: row.z, yaw: row.yaw });
      }
      return { type: 'joined', code: rec.code, playerId: rec.playerId, snapshot, pose, others };
    }
    case 'peerJoined': {
      if (typeof rec.id !== 'string') return null;
      if (rec.pose === undefined) return { type: 'peerJoined', id: rec.id };
      const pose = parsePose(rec.pose);
      return pose ? { type: 'peerJoined', id: rec.id, pose } : null;
    }
    case 'peerLeft': {
      if (typeof rec.id !== 'string') return null;
      if (rec.pose === undefined) return { type: 'peerLeft', id: rec.id };
      const pose = parsePose(rec.pose);
      return pose ? { type: 'peerLeft', id: rec.id, pose } : null;
    }
    default:
      return null;
  }
}

function parseSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  if (!Array.isArray(rec.heights) || !Array.isArray(rec.waterDepths) || !Array.isArray(rec.life)) return null;
  if (!rec.heights.every((n) => typeof n === 'number') || !rec.waterDepths.every((n) => typeof n === 'number')) {
    return null;
  }
  const life: SnapshotLife[] = [];
  for (const item of rec.life) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    if (!isLifeKind(row.kind) || !isFiniteNumber(row.cellX) || !isFiniteNumber(row.cellZ) || !isFiniteNumber(row.age)) {
      return null;
    }
    life.push({ kind: row.kind, cellX: row.cellX, cellZ: row.cellZ, age: row.age });
  }
  return {
    heights: rec.heights as number[],
    waterDepths: rec.waterDepths as number[],
    life,
  };
}

function parsePose(value: unknown): PosePayload | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  if (!isFiniteNumber(rec.x) || !isFiniteNumber(rec.y) || !isFiniteNumber(rec.z) || !isFiniteNumber(rec.yaw)) {
    return null;
  }
  return { x: rec.x, y: rec.y, z: rec.z, yaw: rec.yaw };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isErrorReason(value: unknown): value is ErrorReason {
  return value === 'not_found' || value === 'room_full' || value === 'bad_payload' || value === 'not_started';
}

function isLifeKind(value: unknown): value is LifeKind {
  return value === 'tree' || value === 'bush' || value === 'critter';
}
