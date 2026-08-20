import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket as WsWebSocket } from 'ws';
import { attachMultiplayer } from '../../server/multiplayerPlugin';
import { createMultiplayerClient } from './client';
import type { Snapshot } from './protocol';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WsWebSocket as unknown as typeof WebSocket;
}

const snapshot: Snapshot = {
  heights: [4, 5, 6],
  waterDepths: [0, 0, 0],
  life: [{ kind: 'tree', cellX: 1, cellZ: 1, age: 2 }],
};

let server: http.Server | undefined;
let stopMp: (() => void) | undefined;
const clients: Array<{ close(): void }> = [];

async function listen(): Promise<number> {
  server = http.createServer();
  stopMp = attachMultiplayer(server);
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  return addr.port;
}

afterEach(async () => {
  for (const c of clients) c.close();
  clients.length = 0;
  stopMp?.();
  stopMp = undefined;
  if (!server) return;
  const closing = server;
  server = undefined;
  closing.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => resolve(), 1000);
    closing.close((err) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    });
  });
});

describe('multiplayer client', () => {
  it('creates a room and a second client joins the same snapshot', async () => {
    const port = await listen();
    const url = `ws://127.0.0.1:${port}/mp`;

    const created = new Promise<{ code: string; playerId: string }>((resolve) => {
      const host = createMultiplayerClient(url, {
        onCreated: (msg) => resolve({ code: msg.code, playerId: msg.playerId }),
      });
      clients.push(host);
      host.sendCreate(snapshot);
    });

    const { code, playerId } = await created;

    const joined = await new Promise<{ code: string; snapshot: Snapshot; playerId: string }>((resolve) => {
      const guest = createMultiplayerClient(url, {
        onJoined: (msg) => resolve({ code: msg.code, snapshot: msg.snapshot, playerId: msg.playerId }),
      });
      clients.push(guest);
      guest.sendJoin(code);
    });

    expect(joined).toMatchObject({ code, snapshot });
    expect(joined.playerId).not.toBe(playerId);
  });
});
