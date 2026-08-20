import { describe, expect, it } from 'vitest';
import { makeRoomCode, parseMessage, serializeMessage } from './protocol';

describe('parseMessage', () => {
  it('returns a valid join message', () => {
    const result = parseMessage(JSON.stringify({ type: 'join', code: 'AB3K' }));
    expect(result).toEqual({ ok: true, message: { type: 'join', code: 'AB3K' } });
  });

  it('returns a failed parse for truncated JSON without throwing', () => {
    expect(parseMessage('{"type":"join","code":')).toEqual({ ok: false });
  });

  it('returns a failed parse for an unknown type without throwing', () => {
    expect(parseMessage(JSON.stringify({ type: 'teleport' }))).toEqual({ ok: false });
  });
});

describe('serializeMessage then parseMessage', () => {
  it('round-trips a create message', () => {
    const snapshot = {
      heights: [1, 2],
      waterDepths: [0, 0],
      life: [{ kind: 'tree' as const, cellX: 1, cellZ: 2, age: 3 }],
    };
    const original = { type: 'create' as const, snapshot };
    expect(parseMessage(serializeMessage(original))).toEqual({ ok: true, message: original });
  });

  it('round-trips a pose message', () => {
    const original = { type: 'pose' as const, id: 'p1', x: 1, y: 2, z: 3, yaw: 0.5 };
    expect(parseMessage(serializeMessage(original))).toEqual({ ok: true, message: original });
  });

  it('round-trips an error message', () => {
    const original = { type: 'error' as const, reason: 'not_found' as const };
    expect(parseMessage(serializeMessage(original))).toEqual({ ok: true, message: original });
  });
});

describe('makeRoomCode', () => {
  it('returns 4 characters from the allowed alphabet', () => {
    const code = makeRoomCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });
});
