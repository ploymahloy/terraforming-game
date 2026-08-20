/** @vitest-environment happy-dom */

import { beforeEach, describe, expect, it } from 'vitest';
import { createHud, showShareCode, WALK_HINT, type Hud, type HudCallbacks } from './Hud';

function hudFixture(): void {
  document.body.innerHTML = `
    <div id="boot-screen">
      <div id="terrain-picker"></div>
      <input id="join-code" type="text" />
      <button type="button" id="join-space">Join</button>
      <p id="join-error" class="hidden"></p>
    </div>
    <div id="hud" class="hidden">
      <div id="mode-tabs">
        <button type="button" data-mode="terraform" class="active">Shape</button>
        <button type="button" data-mode="water">Water</button>
        <button type="button" data-mode="life">Life</button>
        <button type="button" data-mode="walk">Walk</button>
      </div>
      <button type="button" id="share-space">Share space</button>
      <span id="share-code" class="hidden"></span>
      <div id="hud-hint">RMB orbit · A/D pan · scroll zoom · LMB tool</div>
      <aside id="tool-panel">
        <div id="brush-section"></div>
        <div id="water-section" class="hidden"></div>
        <div id="life-section" class="hidden"></div>
      </aside>
      <div id="brush-tools"></div>
      <div id="life-tools"></div>
      <input id="brush-size" type="range" value="4" />
      <span id="brush-size-value">4.0</span>
      <input id="pour-rate" type="range" value="1" />
      <span id="pour-rate-value">1.0</span>
    </div>
  `;
}

function callbacks(over: Partial<HudCallbacks> = {}): HudCallbacks {
  return {
    onSelectTerrain: () => {},
    onModeChange: () => {},
    onBrushChange: () => {},
    onBrushSizeChange: () => {},
    onPourRateChange: () => {},
    onLifeKindChange: () => {},
    onShareSpace: () => {},
    onJoinSpace: () => {},
    ...over,
  };
}

function mount(over: Partial<HudCallbacks> = {}): Hud {
  hudFixture();
  return createHud(callbacks(over));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Hud walk and multiplayer controls', () => {
  it('calls onModeChange walk and hides brush water and life sections', () => {
    let mode: string | undefined;
    const hud = mount({ onModeChange: (next) => { mode = next; } });
    (document.querySelector('[data-mode="walk"]') as HTMLButtonElement).click();
    expect(mode).toBe('walk');
    expect(hud.brushSection.classList.contains('hidden')).toBe(true);
    expect(hud.waterSection.classList.contains('hidden')).toBe(true);
    expect(hud.lifeSection.classList.contains('hidden')).toBe(true);
    expect(hud.hint.textContent).toBe(WALK_HINT);
  });

  it('calls onShareSpace and shows the share code after showShareCode', () => {
    let shared = false;
    const hud = mount({ onShareSpace: () => { shared = true; } });
    (document.getElementById('share-space') as HTMLButtonElement).click();
    expect(shared).toBe(true);
    showShareCode(hud, 'AB3K');
    expect(hud.shareCode.textContent).toBe('AB3K');
    expect(hud.shareCode.classList.contains('hidden')).toBe(false);
  });

  it('calls onJoinSpace with AB3K when Join is clicked', () => {
    let code: string | undefined;
    mount({ onJoinSpace: (next) => { code = next; } });
    const input = document.getElementById('join-code') as HTMLInputElement;
    input.value = 'AB3K';
    (document.getElementById('join-space') as HTMLButtonElement).click();
    expect(code).toBe('AB3K');
  });

  it('does not call onJoinSpace for a blank or whitespace code', () => {
    let called = false;
    mount({ onJoinSpace: () => { called = true; } });
    const input = document.getElementById('join-code') as HTMLInputElement;
    input.value = '   ';
    (document.getElementById('join-space') as HTMLButtonElement).click();
    expect(called).toBe(false);
  });
});
