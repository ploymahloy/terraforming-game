import { defineConfig } from 'vite';
import { multiplayerPlugin } from './server/multiplayerPlugin';

export default defineConfig({
  build: {
    target: 'esnext',
  },
  plugins: [multiplayerPlugin()],
  server: {
    open: true,
  },
});
