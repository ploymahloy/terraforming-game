import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import {
  parseMessage,
  serializeMessage,
  type ClientMessage,
  type ServerMessage,
} from '../src/multiplayer/protocol';
import {
  createRoom,
  createTable,
  joinRoom,
  leaveRoom,
  refreshSnapshot,
  roomForPlayer,
  setPose,
} from '../src/multiplayer/rooms';

export interface UpgradeServer {
  on(
    event: 'upgrade',
    listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
  ): unknown;
  off(
    event: 'upgrade',
    listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
  ): unknown;
}

function pathnameOf(req: IncomingMessage): string {
  const raw = req.url ?? '/';
  return new URL(raw, 'http://localhost').pathname;
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(serializeMessage(message));
  }
}

export function attachMultiplayer(httpServer: UpgradeServer): () => void {
  const table = createTable();
  const sockets = new Map<string, WebSocket>();
  const wss = new WebSocketServer({ noServer: true });

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    if (pathnameOf(req) !== '/mp') return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  };

  httpServer.on('upgrade', onUpgrade);

  wss.on('connection', (ws: WebSocket) => {
    let playerId: string | null = null;
    let finished = false;

    const finish = (): void => {
      if (finished) return;
      finished = true;
      if (!playerId) return;
      const id = playerId;
      playerId = null;
      sockets.delete(id);
      const left = leaveRoom(table, id);
      if (!left.ok) return;
      if (left.hostLeft) {
        for (const guestId of left.guestIds) {
          const guest = sockets.get(guestId);
          sockets.delete(guestId);
          guest?.close();
        }
      } else {
        for (const remainId of left.remainingIds) {
          const peer = sockets.get(remainId);
          if (peer) send(peer, { type: 'peerLeft', id: left.leftId });
        }
      }
    };

    ws.on('message', (data) => {
      const parsed = parseMessage(String(data));
      if (!parsed.ok) {
        send(ws, { type: 'error', reason: 'bad_payload' });
        return;
      }
      handleClientMessage(ws, parsed.message as ClientMessage);
    });

    ws.on('close', finish);
    ws.on('error', finish);

    function handleClientMessage(socket: WebSocket, msg: ClientMessage): void {
      if (msg.type === 'create') {
        if (playerId) {
          const room = roomForPlayer(table, playerId);
          if (room?.hostId === playerId) {
            refreshSnapshot(table, playerId, msg.snapshot);
          }
          return;
        }
        const created = createRoom(table, msg.snapshot);
        if (!created.ok) {
          send(socket, { type: 'error', reason: created.reason });
          return;
        }
        playerId = created.playerId;
        sockets.set(playerId, socket);
        send(socket, {
          type: 'created',
          code: created.code,
          playerId: created.playerId,
          pose: created.pose,
        });
        return;
      }

      if (msg.type === 'join') {
        if (playerId) return;
        const joined = joinRoom(table, msg.code);
        if (!joined.ok) {
          send(socket, { type: 'error', reason: joined.reason });
          return;
        }
        playerId = joined.playerId;
        sockets.set(playerId, socket);
        send(socket, {
          type: 'joined',
          code: joined.code,
          playerId: joined.playerId,
          snapshot: joined.snapshot,
          pose: joined.pose,
          others: joined.others,
        });
        for (const other of joined.others) {
          const peer = sockets.get(other.id);
          if (peer) send(peer, { type: 'peerJoined', id: joined.playerId, pose: joined.pose });
        }
        return;
      }

      if (msg.type === 'pose') {
        if (!playerId) return;
        const result = setPose(table, playerId, {
          x: msg.x,
          y: msg.y,
          z: msg.z,
          yaw: msg.yaw,
        });
        if (!result.ok) return;
        for (const otherId of result.others) {
          const peer = sockets.get(otherId);
          if (peer) send(peer, { type: 'pose', ...result.pose });
        }
      }
    }
  });

  return () => {
    httpServer.off('upgrade', onUpgrade);
    for (const ws of sockets.values()) {
      ws.terminate();
    }
    sockets.clear();
    wss.close();
  };
}

function hookServer(server: ViteDevServer | PreviewServer): void {
  if (server.httpServer) attachMultiplayer(server.httpServer);
}

export function multiplayerPlugin(): Plugin {
  return {
    name: 'terraforming-multiplayer',
    configureServer(server) {
      return () => hookServer(server);
    },
    configurePreviewServer(server) {
      return () => hookServer(server);
    },
  };
}
