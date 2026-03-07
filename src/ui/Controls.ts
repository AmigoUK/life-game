import { GameLoop } from '../core/GameLoop';
import { Analytics, GeneAverages, TickSnapshot } from '../core/Analytics';
import { MIN_TICK_MS, MAX_TICK_MS } from '../core/constants';
import { SimulationConfig, SCENARIO_PRESETS, buildConfig } from '../core/SimulationConfig';
import { Renderer } from '../rendering/Renderer';
import { HeatmapMode } from '../rendering/HeatmapRenderer';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string>, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  if (text) e.textContent = text;
  return e;
}

function createCollapsible(title: string, defaultOpen = true): { wrapper: HTMLDivElement; body: HTMLDivElement } {
  const wrapper = el('div', { style: 'border-top:1px solid #444;padding-top:6px;' });
  const header = el('div', { style: 'cursor:pointer;user-select:none;display:flex;justify-content:space-between;align-items:center;' });
  const titleEl = el('span', { style: 'font-weight:bold;font-size:11px;text-transform:uppercase;color:#ccc;' }, title);
  const arrow = el('span', { style: 'font-size:10px;color:#888;' }, defaultOpen ? '\u25BC' : '\u25B6');
  header.append(titleEl, arrow);
  const body = el('div', { style: `font-size:12px;color:#aaa;margin-top:4px;${defaultOpen ? '' : 'display:none;'}` });
  header.addEventListener('click', () => {
    const visible = body.style.display !== 'none';
    body.style.display = visible ? 'none' : '';
    arrow.textContent = visible ? '\u25B6' : '\u25BC';
  });
  wrapper.append(header, body);
  return { wrapper, body };
}

interface SliderDef {
  key: keyof SimulationConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDER_DEFS: SliderDef[] = [
  { key: 'initialPopulation', label: 'Population', min: 5, max: 200, step: 5 },
  { key: 'initialFoodCount', label: 'Food Count', min: 5, max: 200, step: 5 },
  { key: 'foodEnergy', label: 'Food Energy', min: 5, max: 100, step: 5 },
  { key: 'foodRespawnTicks', label: 'Food Respawn', min: 10, max: 300, step: 10 },
  { key: 'energyPerTick', label: 'Energy Drain', min: 0.1, max: 3.0, step: 0.1 },
  { key: 'reproductionEnergyCost', label: 'Repro Cost', min: 10, max: 100, step: 5 },
  { key: 'mutationChance', label: 'Mutation Rate', min: 0.01, max: 0.30, step: 0.01 },
  { key: 'mutationAmount', label: 'Mut. Amount', min: 0.05, max: 0.50, step: 0.05 },
  { key: 'maxEnergy', label: 'Max Energy', min: 50, max: 300, step: 10 },
  { key: 'maxSpeed', label: 'Max Speed', min: 0.2, max: 1.0, step: 0.1 },
];

export class Controls {
  private container: HTMLElement;
  private gameLoop: GameLoop;
  private renderer: Renderer;
  private statsEl!: HTMLDivElement;
  private genePoolEl!: HTMLDivElement;
  private sparklineCanvas!: HTMLCanvasElement;
  private btnToggle!: HTMLButtonElement;
  private scenarioSelect!: HTMLSelectElement;
  private sliderInputs: Map<string, HTMLInputElement> = new Map();
  private sliderValues: Map<string, HTMLSpanElement> = new Map();
  private hungerToggle!: HTMLInputElement;
  private eventsToggle!: HTMLInputElement;
  private pendingConfig: SimulationConfig;

  constructor(container: HTMLElement, gameLoop: GameLoop, renderer: Renderer) {
    this.container = container;
    this.gameLoop = gameLoop;
    this.renderer = renderer;
    this.pendingConfig = { ...gameLoop.getConfig() };
    this.build();
    this.setupKeyboard();
  }

  private build(): void {
    this.container.textContent = '';

    const wrapper = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });

    // Buttons row
    const btnRow = el('div', { style: 'display:flex;gap:8px;' });
    this.btnToggle = el('button', { id: 'btn-toggle', style: 'flex:1;padding:6px 12px;cursor:pointer;background:#2d6a4f;color:#fff;border:none;border-radius:4px;' }, 'Start');
    const btnStep = el('button', { id: 'btn-step', style: 'padding:6px 10px;cursor:pointer;background:#4a5568;color:#fff;border:none;border-radius:4px;font-size:14px;', title: 'Step one tick (Right Arrow)' }, '\u25B6|');
    const btnReset = el('button', { id: 'btn-reset', style: 'flex:1;padding:6px 12px;cursor:pointer;background:#a4161a;color:#fff;border:none;border-radius:4px;' }, 'Reset');
    btnRow.append(this.btnToggle, btnStep, btnReset);

    // Speed slider
    const speedGroup = el('div');
    const speedLabel = el('label', { style: 'display:block;margin-bottom:4px;' });
    speedLabel.textContent = 'Speed: ';
    const speedVal = el('span', { id: 'speed-val' }, `${this.gameLoop.getTickInterval()}ms`);
    speedLabel.appendChild(speedVal);
    const speedSlider = el('input', {
      id: 'speed-slider', type: 'range',
      min: String(MIN_TICK_MS), max: String(MAX_TICK_MS),
      value: String(this.gameLoop.getTickInterval()),
      style: 'width:100%;',
    });
    speedGroup.append(speedLabel, speedSlider);

    // Scenario & Config section
    const configSection = createCollapsible('Scenario & Config', false);

    // Scenario dropdown
    const scenarioRow = el('div', { style: 'margin-bottom:8px;' });
    const scenarioLabel = el('label', { style: 'display:block;margin-bottom:4px;font-size:11px;color:#ccc;' }, 'Scenario:');
    this.scenarioSelect = el('select', { style: 'width:100%;padding:4px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;font-size:12px;' });
    for (const name of Object.keys(SCENARIO_PRESETS)) {
      this.scenarioSelect.appendChild(el('option', { value: name }, name));
    }
    this.scenarioSelect.appendChild(el('option', { value: '__custom__' }, 'Custom'));
    scenarioRow.append(scenarioLabel, this.scenarioSelect);
    configSection.body.appendChild(scenarioRow);

    // Parameter sliders
    for (const def of SLIDER_DEFS) {
      const row = el('div', { style: 'display:flex;align-items:center;gap:4px;margin-bottom:3px;' });
      const label = el('span', { style: 'width:75px;font-size:10px;color:#aaa;flex-shrink:0;' }, def.label);
      const input = el('input', {
        type: 'range',
        min: String(def.min),
        max: String(def.max),
        step: String(def.step),
        value: String(this.pendingConfig[def.key]),
        style: 'flex:1;height:14px;',
      });
      const valSpan = el('span', { style: 'width:36px;font-size:10px;text-align:right;color:#888;flex-shrink:0;' }, this.formatSliderValue(def, Number(this.pendingConfig[def.key])));
      row.append(label, input, valSpan);
      configSection.body.appendChild(row);

      this.sliderInputs.set(def.key, input);
      this.sliderValues.set(def.key, valSpan);

      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.pendingConfig as any)[def.key] = v;
        valSpan.textContent = this.formatSliderValue(def, v);
        this.scenarioSelect.value = '__custom__';
      });
    }

    // Toggles
    const togglesRow = el('div', { style: 'display:flex;gap:12px;margin-top:4px;margin-bottom:6px;' });
    this.hungerToggle = el('input', { type: 'checkbox' }) as HTMLInputElement;
    this.hungerToggle.checked = this.pendingConfig.hungerSlowdown;
    const hungerLabel = el('label', { style: 'display:flex;align-items:center;gap:4px;font-size:10px;color:#aaa;cursor:pointer;' });
    hungerLabel.append(this.hungerToggle, document.createTextNode('Hunger Slowdown'));

    this.eventsToggle = el('input', { type: 'checkbox' }) as HTMLInputElement;
    this.eventsToggle.checked = this.pendingConfig.environmentalEvents;
    const eventsLabel = el('label', { style: 'display:flex;align-items:center;gap:4px;font-size:10px;color:#aaa;cursor:pointer;' });
    eventsLabel.append(this.eventsToggle, document.createTextNode('Env. Events'));

    togglesRow.append(hungerLabel, eventsLabel);
    configSection.body.appendChild(togglesRow);

    this.hungerToggle.addEventListener('change', () => {
      this.pendingConfig.hungerSlowdown = this.hungerToggle.checked;
      this.scenarioSelect.value = '__custom__';
    });
    this.eventsToggle.addEventListener('change', () => {
      this.pendingConfig.environmentalEvents = this.eventsToggle.checked;
      this.scenarioSelect.value = '__custom__';
    });

    // Apply & Reset button
    const applyBtn = el('button', {
      style: 'width:100%;padding:5px;cursor:pointer;background:#2d6a4f;color:#fff;border:none;border-radius:4px;font-size:11px;',
    }, 'Apply & Reset');
    configSection.body.appendChild(applyBtn);

    // Population section
    const popSection = createCollapsible('Population', true);
    this.statsEl = popSection.body;

    // Gene Pool section
    const geneSection = createCollapsible('Gene Pool', true);
    this.genePoolEl = geneSection.body;

    // Population Chart section
    const chartSection = createCollapsible('Population Chart', true);
    this.sparklineCanvas = el('canvas', { width: '180', height: '60', style: 'width:100%;height:60px;background:#1a1a1a;border-radius:3px;' });
    chartSection.body.appendChild(this.sparklineCanvas);

    // Heatmap section
    const heatmapSection = createCollapsible('Heatmap', false);
    const heatmapRow = el('div', { style: 'display:flex;align-items:center;gap:8px;' });
    const heatmapCheck = el('input', { type: 'checkbox' }) as HTMLInputElement;
    const heatmapLabel = el('label', { style: 'display:flex;align-items:center;gap:4px;font-size:11px;color:#aaa;cursor:pointer;' });
    heatmapLabel.append(heatmapCheck, document.createTextNode('Enable'));
    const heatmapModeSelect = el('select', { style: 'padding:2px;background:#333;color:#fff;border:1px solid #555;border-radius:3px;font-size:11px;' });
    for (const mode of ['population', 'food', 'combat'] as HeatmapMode[]) {
      heatmapModeSelect.appendChild(el('option', { value: mode }, mode.charAt(0).toUpperCase() + mode.slice(1)));
    }
    heatmapRow.append(heatmapLabel, heatmapModeSelect);
    heatmapSection.body.appendChild(heatmapRow);

    heatmapCheck.addEventListener('change', () => {
      this.renderer.setHeatmap(heatmapCheck.checked, heatmapModeSelect.value as HeatmapMode);
    });
    heatmapModeSelect.addEventListener('change', () => {
      if (heatmapCheck.checked) {
        this.renderer.setHeatmap(true, heatmapModeSelect.value as HeatmapMode);
      }
    });

    wrapper.append(btnRow, speedGroup, configSection.wrapper, popSection.wrapper, geneSection.wrapper, chartSection.wrapper, heatmapSection.wrapper);
    this.container.appendChild(wrapper);

    // Event listeners
    this.btnToggle.addEventListener('click', () => this.toggleSim());
    btnStep.addEventListener('click', () => this.gameLoop.stepOnce());

    btnReset.addEventListener('click', () => {
      this.gameLoop.reset(buildConfig(this.pendingConfig));
      this.syncToggleButton();
    });

    speedSlider.addEventListener('input', () => {
      const val = parseInt(speedSlider.value);
      this.gameLoop.setTickInterval(val);
      speedVal.textContent = `${val}ms`;
    });

    this.scenarioSelect.addEventListener('change', () => {
      const name = this.scenarioSelect.value;
      if (name === '__custom__') return;
      const preset = SCENARIO_PRESETS[name];
      this.pendingConfig = buildConfig(preset);
      this.syncSlidersToConfig();
      this.gameLoop.reset(this.pendingConfig);
      this.syncToggleButton();
    });

    applyBtn.addEventListener('click', () => {
      this.pendingConfig.hungerSlowdown = this.hungerToggle.checked;
      this.pendingConfig.environmentalEvents = this.eventsToggle.checked;
      this.gameLoop.reset(buildConfig(this.pendingConfig));
      this.syncToggleButton();
    });

    setInterval(() => this.updateStats(), 250);
  }

  private formatSliderValue(def: SliderDef, val: number): string {
    return def.step < 1 ? val.toFixed(2) : String(val);
  }

  private syncSlidersToConfig(): void {
    for (const def of SLIDER_DEFS) {
      const input = this.sliderInputs.get(def.key);
      const valSpan = this.sliderValues.get(def.key);
      if (input && valSpan) {
        const v = Number(this.pendingConfig[def.key]);
        input.value = String(v);
        valSpan.textContent = this.formatSliderValue(def, v);
      }
    }
    this.hungerToggle.checked = this.pendingConfig.hungerSlowdown;
    this.eventsToggle.checked = this.pendingConfig.environmentalEvents;
  }

  private toggleSim(): void {
    this.gameLoop.toggle();
    this.syncToggleButton();
  }

  private syncToggleButton(): void {
    const running = this.gameLoop.isRunning();
    this.btnToggle.textContent = running ? 'Stop' : 'Start';
    this.btnToggle.style.background = running ? '#e63946' : '#2d6a4f';
  }

  private updateStats(): void {
    const analytics = this.gameLoop.getAnalytics();
    const engine = this.gameLoop.getEngine();
    const snap = analytics.currentSnapshot;
    const deathPcts = analytics.getDeathCausePercents();

    this.statsEl.textContent = '';
    const popLines = [
      `Tick: ${engine.tickCount}`,
      `Population: ${snap.total} (M:${snap.males} F:${snap.females})`,
      `Births/tick: ${snap.births} | Deaths/tick: ${snap.deaths}`,
      `Deaths: starv ${deathPcts.starvation}% | age ${deathPcts.age}% | combat ${deathPcts.combat}%`,
      `Energy: avg ${snap.avgEnergy.toFixed(1)} | min ${analytics.minEnergy.toFixed(0)} | max ${analytics.maxEnergy.toFixed(0)}`,
      `Hungry: ${analytics.hungryPercent.toFixed(0)}% | Avg Gen: ${analytics.avgGeneration.toFixed(1)}`,
      `Food: ${analytics.foodAvailable} avail | ${analytics.foodConsumed} respawning`,
    ];
    popLines.forEach((text, i) => {
      if (i > 0) this.statsEl.appendChild(document.createElement('br'));
      this.statsEl.appendChild(document.createTextNode(text));
    });

    this.updateGenePool(analytics);
    this.drawSparkline(analytics.getHistory());
  }

  private updateGenePool(analytics: Analytics): void {
    this.genePoolEl.textContent = '';
    const genes = analytics.geneAverages;
    const geneConfig: { key: keyof GeneAverages; label: string; max: number; color: string }[] = [
      { key: 'speed', label: 'Speed', max: 1, color: '#4fc3f7' },
      { key: 'aggression', label: 'Aggr', max: 1, color: '#ef5350' },
      { key: 'visionRange', label: 'Vision', max: 4, color: '#ab47bc' },
      { key: 'attack', label: 'Attack', max: 20, color: '#ff7043' },
      { key: 'defense', label: 'Defense', max: 20, color: '#66bb6a' },
    ];

    for (const g of geneConfig) {
      const row = el('div', { style: 'display:flex;align-items:center;gap:4px;margin-bottom:2px;' });
      const label = el('span', { style: `width:50px;font-size:11px;color:${g.color};` }, g.label);
      const barOuter = el('div', { style: 'flex:1;height:8px;background:#333;border-radius:2px;overflow:hidden;' });
      const ratio = Math.min(1, genes[g.key] / g.max);
      const barInner = el('div', { style: `width:${(ratio * 100).toFixed(1)}%;height:100%;background:${g.color};border-radius:2px;` });
      barOuter.appendChild(barInner);
      const val = el('span', { style: 'width:32px;font-size:10px;text-align:right;color:#888;' }, genes[g.key].toFixed(2));
      row.append(label, barOuter, val);
      this.genePoolEl.appendChild(row);
    }

    const divLine = el('div', { style: 'font-size:10px;color:#666;margin-top:2px;' }, `Diversity: ${analytics.geneticDiversity.toFixed(3)}`);
    this.genePoolEl.appendChild(divLine);
  }

  private drawSparkline(history: TickSnapshot[]): void {
    const canvas = this.sparklineCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx || history.length < 2) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const maxPop = Math.max(1, ...history.map(s => s.total));
    const step = w / (history.length - 1);

    const drawLine = (getValue: (s: TickSnapshot) => number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const px = i * step;
        const py = h - (getValue(history[i]) / maxPop) * (h - 4) - 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };

    drawLine(s => s.total, 'rgba(255,255,255,0.8)');
    drawLine(s => s.males, 'rgba(70,130,240,0.8)');
    drawLine(s => s.females, 'rgba(240,80,80,0.8)');
  }

  private setupKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.toggleSim();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        this.gameLoop.stepOnce();
      } else if (e.code === 'KeyH') {
        const enabled = !this.renderer.isHeatmapEnabled();
        this.renderer.setHeatmap(enabled);
      }
    });
  }
}
