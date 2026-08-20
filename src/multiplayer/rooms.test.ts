import { describe, expect, it } from 'vitest';
import type { Snapshot } from './protocol';
import { createRoom, createTable, joinRoom } from './rooms';

function snapshot(marker = 1): Snapshot {
  return {
    heights: [marker],
    waterDepths: [0],
    life: [{ kind: 'bush', cellX: 2, cellZ: 3, age: 4 }],
  };
}

describe('rooms.create', () => {
  it('stores the snapshot and returns a 4-character code', () => {
    const table = createTable();
    const result = createRoom(table, snapshot(9));
    if (!result.ok) throw new Error('create failed');
    expect(result.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });
});

describe('rooms.join', () => {
  it('returns the stored snapshot and a distinct playerId', () => {
    const table = createTable();
    const created = createRoom(table, snapshot(5));
    if (!created.ok) throw new Error('create failed');
    const joined = joinRoom(table, created.code);
    expect(joined).toMatchObject({
      ok: true,
      snapshot: snapshot(5),
      playerId: expect.not.stringMatching(new RegExp(`^${created.playerId}$`)),
    });
  });

  it('returns not_found for an unknown code', () => {
    const table = createTable();
    expect(joinRoom(table, 'AB3K')).toEqual({ ok: false, reason: 'not_found' });
  });

  it('returns room_full for a 9th player', () => {
    const table = createTable();
    const created = createRoom(table, snapshot());
    if (!created.ok) throw new Error('create failed');
    for (let i = 0; i < 7; i++) {
      const joined = joinRoom(table, created.code);
      if (!joined.ok) throw new Error('join failed');
    }
    expect(joinRoom(table, created.code)).toEqual({ ok: false, reason: 'room_full' });
  });

  it('returns bad_payload for an empty code', () => {
    const table = createTable();
    expect(joinRoom(table, '')).toEqual({ ok: false, reason: 'bad_payload' });
  });

  it('returns bad_payload for a short code', () => {
    const table = createTable();
    expect(joinRoom(table, 'AB')).toEqual({ ok: false, reason: 'bad_payload' });
  });
});
