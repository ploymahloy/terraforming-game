import './style.css';
import { createGame, initGame } from './game/GameApp';

async function main(): Promise<void> {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Missing #game-canvas');
  }

  const game = createGame(canvas);
  await initGame(game);
}

main().catch((err) => {
  console.error(err);
  const msg = document.createElement('div');
  msg.style.cssText =
    'position:fixed;inset:0;display:grid;place-items:center;background:#1e2a28;color:#e8f0ea;font:16px/1.4 sans-serif;padding:2rem;text-align:center';
  msg.textContent =
    'Failed to start WebGPU renderer. Try Chrome or Edge with WebGPU enabled, or check the console.';
  document.body.appendChild(msg);
});
