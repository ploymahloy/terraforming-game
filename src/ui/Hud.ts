import type { BrushType, GameMode, LifeKind, TerrainPresetId } from '../config';
import { TERRAIN_PRESETS } from '../terrain/TerrainPresets';

export interface HudCallbacks {
  onSelectTerrain: (id: TerrainPresetId) => void;
  onModeChange: (mode: GameMode) => void;
  onBrushChange: (brush: BrushType) => void;
  onBrushSizeChange: (size: number) => void;
  onLifeKindChange: (kind: LifeKind) => void;
}

export class Hud {
  private readonly boot = document.getElementById('boot-screen')!;
  private readonly hud = document.getElementById('hud')!;
  private readonly brushSection = document.getElementById('brush-section')!;
  private readonly lifeSection = document.getElementById('life-section')!;
  private readonly brushSize = document.getElementById('brush-size') as HTMLInputElement;
  private readonly brushSizeValue = document.getElementById('brush-size-value')!;
  private mode: GameMode = 'terraform';
  private readonly cb: HudCallbacks;

  constructor(cb: HudCallbacks) {
    this.cb = cb;
    this.buildTerrainPicker();
    this.bindModes();
    this.bindBrushes();
    this.bindLife();
    this.bindBrushSize();
    this.bindKeys();
  }

  showGame(): void {
    this.boot.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  setMode(mode: GameMode): void {
    this.mode = mode;
    document.querySelectorAll('#mode-tabs button').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
    });
    this.brushSection.classList.toggle('hidden', mode !== 'terraform');
    this.lifeSection.classList.toggle('hidden', mode !== 'life');
    const panel = document.getElementById('tool-panel')!;
    panel.classList.toggle('hidden', mode === 'water');
  }

  private buildTerrainPicker(): void {
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
      btn.addEventListener('click', () => this.cb.onSelectTerrain(preset.id));
      picker.appendChild(btn);
    }
  }

  private bindModes(): void {
    document.getElementById('mode-tabs')!.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('button') as HTMLElement | null;
      if (!target?.dataset.mode) return;
      const mode = target.dataset.mode as GameMode;
      this.setMode(mode);
      this.cb.onModeChange(mode);
    });
  }

  private bindBrushes(): void {
    document.getElementById('brush-tools')!.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('button') as HTMLElement | null;
      if (!target?.dataset.brush) return;
      const brush = target.dataset.brush as BrushType;
      document.querySelectorAll('#brush-tools button').forEach((btn) => {
        btn.classList.toggle('active', (btn as HTMLElement).dataset.brush === brush);
      });
      this.cb.onBrushChange(brush);
    });
  }

  private bindLife(): void {
    document.getElementById('life-tools')!.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('button') as HTMLElement | null;
      if (!target?.dataset.life) return;
      const kind = target.dataset.life as LifeKind;
      document.querySelectorAll('#life-tools button').forEach((btn) => {
        btn.classList.toggle('active', (btn as HTMLElement).dataset.life === kind);
      });
      this.cb.onLifeKindChange(kind);
    });
  }

  private bindBrushSize(): void {
    const update = () => {
      const size = Number(this.brushSize.value);
      this.brushSizeValue.textContent = size.toFixed(1);
      this.cb.onBrushSizeChange(size);
    };
    this.brushSize.addEventListener('input', update);
  }

  private bindKeys(): void {
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

      if (brushMap[e.code] && this.mode === 'terraform') {
        const brush = brushMap[e.code];
        document.querySelectorAll('#brush-tools button').forEach((btn) => {
          btn.classList.toggle('active', (btn as HTMLElement).dataset.brush === brush);
        });
        this.cb.onBrushChange(brush);
      }

      if (e.key === '[' || e.key === ']') {
        const delta = e.key === ']' ? 0.5 : -0.5;
        const next = Math.min(16, Math.max(1, Number(this.brushSize.value) + delta));
        this.brushSize.value = String(next);
        this.brushSizeValue.textContent = next.toFixed(1);
        this.cb.onBrushSizeChange(next);
      }
    });
  }
}
