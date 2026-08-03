import type { BrushType, GameMode, LifeKind, TerrainPresetId } from '../config';
import { TERRAIN_PRESETS } from '../terrain/TerrainPresets';

export interface HudCallbacks {
  onSelectTerrain: (id: TerrainPresetId) => void;
  onModeChange: (mode: GameMode) => void;
  onBrushChange: (brush: BrushType) => void;
  onBrushSizeChange: (size: number) => void;
  onPourRateChange: (rate: number) => void;
  onLifeKindChange: (kind: LifeKind) => void;
}

export interface Hud {
  boot: HTMLElement;
  hud: HTMLElement;
  brushSection: HTMLElement;
  waterSection: HTMLElement;
  lifeSection: HTMLElement;
  brushSize: HTMLInputElement;
  brushSizeValue: HTMLElement;
  pourRate: HTMLInputElement;
  pourRateValue: HTMLElement;
  mode: GameMode;
  cb: HudCallbacks;
}

export function createHud(cb: HudCallbacks): Hud {
  const hud: Hud = {
    boot: document.getElementById('boot-screen')!,
    hud: document.getElementById('hud')!,
    brushSection: document.getElementById('brush-section')!,
    waterSection: document.getElementById('water-section')!,
    lifeSection: document.getElementById('life-section')!,
    brushSize: document.getElementById('brush-size') as HTMLInputElement,
    brushSizeValue: document.getElementById('brush-size-value')!,
    pourRate: document.getElementById('pour-rate') as HTMLInputElement,
    pourRateValue: document.getElementById('pour-rate-value')!,
    mode: 'terraform',
    cb,
  };

  buildTerrainPicker(hud);
  bindModes(hud);
  bindBrushes(hud);
  bindLife(hud);
  bindBrushSize(hud);
  bindPourRate(hud);
  bindKeys(hud);

  return hud;
}

export function showGameHud(hud: Hud): void {
  hud.boot.classList.add('hidden');
  hud.hud.classList.remove('hidden');
}

export function setHudMode(hud: Hud, mode: GameMode): void {
  hud.mode = mode;
  document.querySelectorAll('#mode-tabs button').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
  });
  hud.brushSection.classList.toggle('hidden', mode !== 'terraform');
  hud.waterSection.classList.toggle('hidden', mode !== 'water');
  hud.lifeSection.classList.toggle('hidden', mode !== 'life');
}

function buildTerrainPicker(hud: Hud): void {
  const picker = document.getElementById('terrain-picker')!;
  picker.innerHTML = '';

  for (const preset of TERRAIN_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'terrain-card';
    btn.innerHTML = `
      <div class="terrain-swatch ${preset.swatchClass}"></div>
      <h3>${preset.name}</h3>
      <p>${preset.description}</p>
    `;
    btn.addEventListener('click', () => hud.cb.onSelectTerrain(preset.id));
    picker.appendChild(btn);
  }
}

function bindModes(hud: Hud): void {
  document.getElementById('mode-tabs')!.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!target?.dataset.mode) return;
    const mode = target.dataset.mode as GameMode;
    setHudMode(hud, mode);
    hud.cb.onModeChange(mode);
  });
}

function bindBrushes(hud: Hud): void {
  document.getElementById('brush-tools')!.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!target?.dataset.brush) return;
    const brush = target.dataset.brush as BrushType;
    document.querySelectorAll('#brush-tools button').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.brush === brush);
    });
    hud.cb.onBrushChange(brush);
  });
}

function bindLife(hud: Hud): void {
  document.getElementById('life-tools')!.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!target?.dataset.life) return;
    const kind = target.dataset.life as LifeKind;
    document.querySelectorAll('#life-tools button').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.life === kind);
    });
    hud.cb.onLifeKindChange(kind);
  });
}

function bindBrushSize(hud: Hud): void {
  const update = () => {
    const size = Number(hud.brushSize.value);
    hud.brushSizeValue.textContent = size.toFixed(1);
    hud.cb.onBrushSizeChange(size);
  };
  hud.brushSize.addEventListener('input', update);
}

function bindPourRate(hud: Hud): void {
  const update = () => {
    const rate = Number(hud.pourRate.value);
    hud.pourRateValue.textContent = rate.toFixed(1);
    hud.cb.onPourRateChange(rate);
  };
  hud.pourRate.addEventListener('input', update);
}

function bindKeys(hud: Hud): void {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;

    const brushMap: Record<string, BrushType> = {
      Digit1: 'raise',
      Digit2: 'lower',
      Digit3: 'smooth',
      Digit4: 'flatten',
      Numpad1: 'raise',
      Numpad2: 'lower',
      Numpad3: 'smooth',
      Numpad4: 'flatten',
    };

    if (brushMap[e.code] && hud.mode === 'terraform') {
      const brush = brushMap[e.code];
      document.querySelectorAll('#brush-tools button').forEach((btn) => {
        btn.classList.toggle('active', (btn as HTMLElement).dataset.brush === brush);
      });
      hud.cb.onBrushChange(brush);
    }

    if (e.key === '[' || e.key === ']') {
      const delta = e.key === ']' ? 0.5 : -0.5;
      const next = Math.min(16, Math.max(1, Number(hud.brushSize.value) + delta));
      hud.brushSize.value = String(next);
      hud.brushSizeValue.textContent = next.toFixed(1);
      hud.cb.onBrushSizeChange(next);
    }
  });
}
