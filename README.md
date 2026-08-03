# Terraform

Browser terraforming sandbox built with **TypeScript**, **Three.js**, and **WebGPU**.

Pick a base terrain, sculpt the land with brushes, pour water into valleys, and place simple flora and fauna that age over time.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build    # production build
npm run preview  # serve the build
```

## Browser support

Uses `THREE.WebGPURenderer` from `three/webgpu`. Prefer **Chrome** or **Edge** with WebGPU enabled. If WebGPU is unavailable, Three.js may fall back to WebGL 2.

## Controls

| Input | Action |
| --- | --- |
| Left drag | Active tool (sculpt / pour / place life) |
| Right drag | Orbit around the world |
| Middle drag / scroll | Zoom (dolly) |
| `[` / `]` or size slider | Brush radius |
| `1`–`4` | Raise / Lower / Smooth / Flatten |

## Modes

1. **Shape** — raise, lower, smooth, and flatten the heightmap.
2. **Water** — hold left mouse to pour; water seeps downhill into basins.
3. **Life** — place trees, bushes, or critters; they grow through simple lifecycle stages.
