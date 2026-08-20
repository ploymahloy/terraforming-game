import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { parseMessage, serializeMessage, type Snapshot } from '../src/multiplayer/protocol';
import { attachMultiplayer } from './multiplayerPlugin';

const snapshot: Snapshot = {
  heights: [1, 2, 3],
  waterDepths: [0, 0, 0],
  life: [],
};

let server: http.Server | undefined;
let stopMp: (() => void) | undefined;
const clients: WebSocket[] = [];

async function listen(): Promise<number> {
  server = http.createServer();
  stopMp = attachMultiplayer(server);
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  return addr.port;
}

function track(ws: WebSocket): WebSocket {
  clients.push(ws);
  return ws;
}

function openClient(url: string): Promise<WebSocket> {
  const ws = track(new WebSocket(url));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`timeout opening ${url}`));
    }, 2000);
    ws.once('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function nextMessage(ws: WebSocket, ms = 1000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for message')), ms);
    ws.once('message', (data) => {
      clearTimeout(timer);
      const parsed = parseMessage(String(data));
      resolve(parsed.ok ? parsed.message : parsed);
    });
  });
}

afterEach(async () => {
  for (const ws of clients) {
    ws.terminate();
  }
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

describe('multiplayer plugin sockets', () => {
  it('completes create, join, and pose between two WebSocket clients', async () => {
    const port = await listen();
    const host = await openClient(`ws://127.0.0.1:${port}/mp`);
    const guest = await openClient(`ws://127.0.0.1:${port}/mp`);

    host.send(serializeMessage({ type: 'create', snapshot }));
    const created = await nextMessage(host);
    expect(created).toMatchObject({ type: 'created', code: expect.stringMatching(/^[A-Z2-9]{4}$/) });

    const code = (created as { code: string }).code;
    guest.send(serializeMessage({ type: 'join', code }));
    const joined = await nextMessage(guest);
    expect(joined).toMatchObject({ type: 'joined', code, snapshot });
    await nextMessage(host);

    guest.send(serializeMessage({ type: 'pose', x: 3, y: 1, z: 2, yaw: 0.25 }));
    const relayed = await nextMessage(host);
    expect(relayed).toMatchObject({
      type: 'pose',
      id: (joined as { playerId: string }).playerId,
      x: 3,
      y: 1,
      z: 2,
      yaw: 0.25,
    });

    host.close();
    guest.close();
  });

  it('does not echo a pose back to the sender', async () => {
    const port = await listen();
    const host = await openClient(`ws://127.0.0.1:${port}/mp`);
    const guest = await openClient(`ws://127.0.0.1:${port}/mp`);
    host.send(serializeMessage({ type: 'create', snapshot }));
    const created = (await nextMessage(host)) as { code: string };
    guest.send(serializeMessage({ type: 'join', code: created.code }));
    await nextMessage(guest);
    await nextMessage(host);

    const extra: unknown[] = [];
    guest.on('message', (data) => extra.push(String(data)));
    guest.send(serializeMessage({ type: 'pose', x: 1, y: 2, z: 3, yaw: 0 }));
    await nextMessage(host);
    await new Promise((r) => setTimeout(r, 80));
    expect(extra).toEqual([]);

    host.close();
    guest.close();
  });

  it('sends peerJoined to the host when a guest connects', async () => {
    const port = await listen();
    const host = await openClient(`ws://127.0.0.1:${port}/mp`);
    const guest = await openClient(`ws://127.0.0.1:${port}/mp`);
    host.send(serializeMessage({ type: 'create', snapshot }));
    const created = (await nextMessage(host)) as { code: string };
    guest.send(serializeMessage({ type: 'join', code: created.code }));
    const joined = (await nextMessage(guest)) as { playerId: string };
    const peer = await nextMessage(host);
    expect(peer).toMatchObject({ type: 'peerJoined', id: joined.playerId });
    host.close();
    guest.close();
  });

  it('sends peerLeft to the remaining client when a guest disconnects', async () => {
    const port = await listen();
    const host = await openClient(`ws://127.0.0.1:${port}/mp`);
    const guest = await openClient(`ws://127.0.0.1:${port}/mp`);
    host.send(serializeMessage({ type: 'create', snapshot }));
    const created = (await nextMessage(host)) as { code: string };
    guest.send(serializeMessage({ type: 'join', code: created.code }));
    const joined = (await nextMessage(guest)) as { playerId: string };
    await nextMessage(host);
    guest.close();
    const left = await nextMessage(host);
    expect(left).toMatchObject({ type: 'peerLeft', id: joined.playerId });
    host.close();
  });

  it('closes the guest when the host disconnects so later pose is ignored', async () => {
    const port = await listen();
    const host = await openClient(`ws://127.0.0.1:${port}/mp`);
    const guest = await openClient(`ws://127.0.0.1:${port}/mp`);
    host.send(serializeMessage({ type: 'create', snapshot }));
    const created = (await nextMessage(host)) as { code: string };
    guest.send(serializeMessage({ type: 'join', code: created.code }));
    await nextMessage(guest);
    await nextMessage(host);

    const closed = new Promise<void>((resolve) => guest.once('close', () => resolve()));
    host.close();
    await closed;

    let poseAccepted = false;
    guest.once('message', () => {
      poseAccepted = true;
    });
    try {
      guest.send(serializeMessage({ type: 'pose', x: 0, y: 0, z: 0, yaw: 0 }));
    } catch {
      // already closed
    }
    await new Promise((r) => setTimeout(r, 80));
    expect(poseAccepted).toBe(false);
  });

  it('does not accept a WebSocket on a non-/mp path as a game session', async () => {
    const port = await listen();
    const wrong = track(new WebSocket(`ws://127.0.0.1:${port}/nope`));
    const outcome = await new Promise<'error' | 'timeout' | 'open'>((resolve) => {
      const timer = setTimeout(() => resolve('timeout'), 250);
      wrong.once('open', () => {
        clearTimeout(timer);
        resolve('open');
      });
      wrong.once('error', () => {
        clearTimeout(timer);
        resolve('error');
      });
    });
    if (outcome === 'open') {
      wrong.send(serializeMessage({ type: 'create', snapshot }));
      await expect(nextMessage(wrong, 250)).rejects.toThrow();
    }
    wrong.terminate();
    expect(outcome).not.toBe('open');
  });
});
