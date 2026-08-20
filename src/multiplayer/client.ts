import type {
  PosePayload,
  ServerMessage,
  Snapshot,
} from './protocol';
import { serializeMessage } from './protocol';

export interface MpHandlers {
  onCreated?: (msg: Extract<ServerMessage, { type: 'created' }>) => void;
  onJoined?: (msg: Extract<ServerMessage, { type: 'joined' }>) => void;
  onError?: (msg: Extract<ServerMessage, { type: 'error' }>) => void;
  onPose?: (msg: Extract<ServerMessage, { type: 'pose' }>) => void;
  onPeerJoined?: (msg: Extract<ServerMessage, { type: 'peerJoined' }>) => void;
  onPeerLeft?: (msg: Extract<ServerMessage, { type: 'peerLeft' }>) => void;
  onClose?: () => void;
}

export interface MpClient {
  sendCreate(snapshot: Snapshot): void;
  sendJoin(code: string): void;
  sendPose(x: number, y: number, z: number, yaw: number): void;
  close(): void;
  whenOpen(): Promise<void>;
}

export function createMultiplayerClient(url: string, handlers: MpHandlers = {}): MpClient {
  const socket = new WebSocket(url);
  const pending: string[] = [];

  const flush = (): void => {
    while (pending.length > 0 && socket.readyState === WebSocket.OPEN) {
      const next = pending.shift();
      if (next) socket.send(next);
    }
  };

  const send = (payload: string): void => {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    else pending.push(payload);
  };

  socket.addEventListener('open', flush);

  socket.addEventListener('message', (event) => {
    const raw = typeof event.data === 'string' ? event.data : String(event.data);
    dispatch(raw, handlers);
  });

  socket.addEventListener('close', () => handlers.onClose?.());

  return {
    sendCreate(snapshot) {
      send(serializeMessage({ type: 'create', snapshot }));
    },
    sendJoin(code) {
      send(serializeMessage({ type: 'join', code }));
    },
    sendPose(x, y, z, yaw) {
      send(serializeMessage({ type: 'pose', x, y, z, yaw }));
    },
    close() {
      pending.length = 0;
      socket.close();
    },
    whenOpen() {
      if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout waiting for socket open')), 2000);
        socket.addEventListener('open', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
        socket.addEventListener('error', () => {
          clearTimeout(timer);
          reject(new Error('socket error'));
        }, { once: true });
      });
    },
  };
}

function dispatch(raw: string, handlers: MpHandlers): void {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return;
  }
  if (!value || typeof value !== 'object') return;
  const msg = value as ServerMessage;
  switch (msg.type) {
    case 'created':
      handlers.onCreated?.(msg);
      break;
    case 'joined':
      handlers.onJoined?.(msg);
      break;
    case 'error':
      handlers.onError?.(msg);
      break;
    case 'pose':
      handlers.onPose?.(msg);
      break;
    case 'peerJoined':
      handlers.onPeerJoined?.(msg);
      break;
    case 'peerLeft':
      handlers.onPeerLeft?.(msg);
      break;
    default:
      break;
  }
}

export type { PosePayload, Snapshot };
