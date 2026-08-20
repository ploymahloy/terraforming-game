# Terraform

Browser terraforming sandbox built with **TypeScript**, **Three.js**, and **WebGPU**.

Pick a base terrain, sculpt the land with brushes, pour water into valleys, and place simple flora and fauna that age over time. Share a short room code so another browser can walk the same snapshot in third person.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

**Multiplayer requires a Vite server.** Use `npm run dev` or `npm run preview` so the `/mp` WebSocket plugin is attached. A static `vite build` folder by itself has no multiplayer server.

```bash
npm run build    # production build
npm run preview  # serve the build (multiplayer plugin attached)
npm test         # Vitest
```

## Browser support

Uses `THREE.WebGPURenderer` from `three/webgpu`. Prefer **Chrome** or **Edge** with WebGPU enabled. If WebGPU is unavailable, Three.js may fall back to WebGL 2.

## Controls

| Input | Action |
| --- | --- |
| Left drag | Active tool (sculpt / pour / place life) — ignored in Walk |
| Right drag | Orbit around the world (tool modes) |
| Middle drag / scroll | Zoom (dolly) |
| `[` / `]` or size slider | Brush radius |
| `1`–`4` | Raise / Lower / Smooth / Flatten |
| Arrow keys | Walk / turn (Walk mode) |
| Space | Jump (Walk mode) |

## Modes

1. **Shape** — raise, lower, smooth, and flatten the heightmap.
2. **Water** — hold left mouse to pour; water seeps downhill into basins.
3. **Life** — place trees, bushes, or critters; they grow through simple lifecycle stages.
4. **Walk** — third-person capsule on the heightmap. Camera sits behind you; tools do not sculpt.

## Share and join

- After the world starts, click **Share space** to create an in-memory room and show a 4-character code. Click again to refresh the stored snapshot for future joiners (peers already in the room do not receive terrain deltas).
- On the boot screen, type that code and click **Join**. Guests load the heightmap, water, and life snapshot and spawn in Walk mode.
- Up to 8 players. The host disconnecting closes the room. Shape / Water / Life stay local to the host; they are not live-synced.
