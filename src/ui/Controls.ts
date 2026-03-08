import { GameLoop } from '../core/GameLoop';
import { Analytics, GeneAverages, TickSnapshot } from '../core/Analytics';
import { MIN_TICK_MS, MAX_TICK_MS } from '../core/constants';
import { SimulationConfig, SCENARIO_PRESETS, buildConfig } from '../core/SimulationConfig';
import { decodeDNA } from '../core/DNA';
import { Renderer } from '../rendering/Renderer';
import { HeatmapMode } from '../rendering/HeatmapRenderer';
import { Season } from '../core/Seasons';

const SEASON_BG_COLORS: Record<Season, string> = {
  spring: 'rgba(102,187,106,0.1)',
  summer: 'rgba(255,213,79,0.1)',
  autumn: 'rgba(255,138,101,0.1)',
  winter: 'rgba(144,202,249,0.15)',
};

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
  private tribesToggle!: HTMLInputElement;
  private tribeSizeSlider!: HTMLInputElement;
  private tribeSizeValue!: HTMLSpanElement;
  private hallOfFameEl!: HTMLDivElement;
  private tribeRankingEl!: HTMLDivElement;
  private seasonalStatsEl!: HTMLDivElement;
  private seasonsToggle!: HTMLInputElement;
  private seasonLengthSlider!: HTMLInputElement;
  private seasonLengthValue!: HTMLSpanElement;
  private pendingConfig: SimulationConfig;

  constructor(container: HTMLElement, gameLoop: GameLoop, renderer: Renderer) {
    this.container = container;
    this.gameLoop = gameLoop;
    this.renderer = renderer;
    this.pendingConfig = { ...gameLoop.getConfig() };
    this.build();
    this.setupKeyboard();
    this.gameLoop.onReset(() => this.syncToggleButton());
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

    this.tribesToggle = el('input', { type: 'checkbox' }) as HTMLInputElement;
    this.tribesToggle.checked = this.pendingConfig.tribesEnabled;
    const tribesLabel = el('label', { style: 'display:flex;align-items:center;gap:4px;font-size:10px;color:#aaa;cursor:pointer;' });
    tribesLabel.append(this.tribesToggle, document.createTextNode('Tribes'));

    this.seasonsToggle = el('input', { type: 'checkbox' }) as HTMLInputElement;
    this.seasonsToggle.checked = this.pendingConfig.seasonsEnabled;
    const seasonsLabel = el('label', { style: 'display:flex;align-items:center;gap:4px;font-size:10px;color:#aaa;cursor:pointer;' });
    seasonsLabel.append(this.seasonsToggle, document.createTextNode('Seasons'));

    togglesRow.append(hungerLabel, eventsLabel, tribesLabel, seasonsLabel);
    configSection.body.appendChild(togglesRow);

    // Max tribe size slider
    const tribeSizeRow = el('div', { style: 'display:flex;align-items:center;gap:4px;margin-bottom:3px;' });
    const tribeSizeLabel = el('span', { style: 'width:75px;font-size:10px;color:#aaa;flex-shrink:0;' }, 'Tribe Size');
    this.tribeSizeSlider = el('input', {
      type: 'range', min: '2', max: '12', step: '1',
      value: String(this.pendingConfig.maxTribeSize),
      style: 'flex:1;height:14px;',
    });
    this.tribeSizeValue = el('span', { style: 'width:36px;font-size:10px;text-align:right;color:#888;flex-shrink:0;' }, String(this.pendingConfig.maxTribeSize));
    tribeSizeRow.append(tribeSizeLabel, this.tribeSizeSlider, this.tribeSizeValue);
    configSection.body.appendChild(tribeSizeRow);

    // Season length slider
    const seasonLengthRow = el('div', { style: 'display:flex;align-items:center;gap:4px;margin-bottom:3px;' });
    const seasonLengthLabel = el('span', { style: 'width:75px;font-size:10px;color:#aaa;flex-shrink:0;' }, 'Season Len');
    this.seasonLengthSlider = el('input', {
      type: 'range', min: '20', max: '100', step: '10',
      value: String(this.pendingConfig.seasonLength),
      style: 'flex:1;height:14px;',
    });
    this.seasonLengthValue = el('span', { style: 'width:36px;font-size:10px;text-align:right;color:#888;flex-shrink:0;' }, String(this.pendingConfig.seasonLength));
    seasonLengthRow.append(seasonLengthLabel, this.seasonLengthSlider, this.seasonLengthValue);
    configSection.body.appendChild(seasonLengthRow);

    this.hungerToggle.addEventListener('change', () => {
      this.pendingConfig.hungerSlowdown = this.hungerToggle.checked;
      this.scenarioSelect.value = '__custom__';
    });
    this.eventsToggle.addEventListener('change', () => {
      this.pendingConfig.environmentalEvents = this.eventsToggle.checked;
      this.scenarioSelect.value = '__custom__';
    });
    this.tribesToggle.addEventListener('change', () => {
      this.pendingConfig.tribesEnabled = this.tribesToggle.checked;
      this.scenarioSelect.value = '__custom__';
    });
    this.tribeSizeSlider.addEventListener('input', () => {
      const v = parseInt(this.tribeSizeSlider.value);
      this.pendingConfig.maxTribeSize = v;
      this.tribeSizeValue.textContent = String(v);
      this.scenarioSelect.value = '__custom__';
    });
    this.seasonsToggle.addEventListener('change', () => {
      this.pendingConfig.seasonsEnabled = this.seasonsToggle.checked;
      this.scenarioSelect.value = '__custom__';
    });
    this.seasonLengthSlider.addEventListener('input', () => {
      const v = parseInt(this.seasonLengthSlider.value);
      this.pendingConfig.seasonLength = v;
      this.seasonLengthValue.textContent = String(v);
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

    // Chart legend
    const chartLegend = el('div', { style: 'display:flex;gap:10px;margin-top:3px;font-size:10px;' });
    const legendItems: [string, string][] = [
      ['rgba(255,255,255,0.8)', 'Total'],
      ['rgba(70,130,240,0.8)', 'Males'],
      ['rgba(240,80,80,0.8)', 'Females'],
    ];
    for (const [color, label] of legendItems) {
      const item = el('span', { style: `color:${color};` });
      item.textContent = `\u2014 ${label}`;
      chartLegend.appendChild(item);
    }
    chartSection.body.appendChild(chartLegend);

    // Hall of Fame section
    const hofSection = createCollapsible('Hall of Fame', false);
    this.hallOfFameEl = hofSection.body;

    // Tribe Ranking section
    const tribeRankSection = createCollapsible('Tribe Ranking', false);
    this.tribeRankingEl = tribeRankSection.body;

    // Seasonal Stats section
    const seasonalSection = createCollapsible('Seasonal Stats', false);
    this.seasonalStatsEl = seasonalSection.body;

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

    wrapper.append(
      btnRow, speedGroup, configSection.wrapper, popSection.wrapper,
      geneSection.wrapper, chartSection.wrapper, hofSection.wrapper,
      tribeRankSection.wrapper, seasonalSection.wrapper, heatmapSection.wrapper,
    );
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
      this.pendingConfig.tribesEnabled = this.tribesToggle.checked;
      this.pendingConfig.maxTribeSize = parseInt(this.tribeSizeSlider.value);
      this.pendingConfig.seasonsEnabled = this.seasonsToggle.checked;
      this.pendingConfig.seasonLength = parseInt(this.seasonLengthSlider.value);
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
    this.tribesToggle.checked = this.pendingConfig.tribesEnabled;
    this.tribeSizeSlider.value = String(this.pendingConfig.maxTribeSize);
    this.tribeSizeValue.textContent = String(this.pendingConfig.maxTribeSize);
    this.seasonsToggle.checked = this.pendingConfig.seasonsEnabled;
    this.seasonLengthSlider.value = String(this.pendingConfig.seasonLength);
    this.seasonLengthValue.textContent = String(this.pendingConfig.seasonLength);
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
      ...(analytics.tribeCount > 0 ? [`Tribes: ${analytics.tribeCount} | Avg size: ${analytics.avgTribeSize.toFixed(1)}`] : []),
    ];
    popLines.forEach((text, i) => {
      if (i > 0) this.statsEl.appendChild(document.createElement('br'));
      this.statsEl.appendChild(document.createTextNode(text));
    });

    this.updateGenePool(analytics);
    this.drawSparkline(analytics.getHistory());
    this.updateHallOfFame(analytics);
    this.updateTribeRanking(analytics);
    this.updateSeasonalStats(analytics);
  }

  private updateGenePool(analytics: Analytics): void {
    this.genePoolEl.textContent = '';
    const genes = analytics.geneAverages;
    const geneConfig: { key: keyof GeneAverages; label: string; max: number; color: string }[] = [
      { key: 'maxAge', label: 'Lifespan', max: 160, color: '#8bc34a' },
      { key: 'speed', label: 'Speed', max: 1, color: '#4fc3f7' },
      { key: 'directionBias', label: 'Direction', max: 1, color: '#ffb74d' },
      { key: 'visionRange', label: 'Vision', max: 4, color: '#ab47bc' },
      { key: 'attack', label: 'Attack', max: 20, color: '#ff7043' },
      { key: 'defense', label: 'Defense', max: 20, color: '#66bb6a' },
      { key: 'maxHP', label: 'Health', max: 100, color: '#ef5350' },
      { key: 'aggression', label: 'Aggr', max: 1, color: '#e53935' },
      { key: 'foodAffinity', label: 'Foraging', max: 1, color: '#81c784' },
      { key: 'fleeSpeed', label: 'Flee', max: 0.5, color: '#29b6f6' },
      { key: 'energyEfficiency', label: 'Efficiency', max: 1, color: '#aed581' },
      { key: 'fertilityBonus', label: 'Fertility', max: 0.5, color: '#f48fb1' },
      { key: 'mutationResist', label: 'Stability', max: 0.5, color: '#90a4ae' },
      { key: 'cooperation', label: 'Coop', max: 1, color: '#78909c' },
      { key: 'storageCapacity', label: 'Storage', max: 100, color: '#ffab40' },
    ];

    const carried = analytics.carriedGeneAverages;
    for (const g of geneConfig) {
      const row = el('div', { style: 'display:flex;align-items:center;gap:4px;margin-bottom:2px;' });
      const label = el('span', { style: `width:50px;font-size:11px;color:${g.color};` }, g.label);
      const barOuter = el('div', { style: 'flex:1;height:8px;background:#333;border-radius:2px;overflow:hidden;position:relative;' });
      // Ghost bar: carried average (faint, behind)
      const carriedRatio = Math.min(1, carried[g.key] / g.max);
      const ghostBar = el('div', { style: `position:absolute;top:0;left:0;width:${(carriedRatio * 100).toFixed(1)}%;height:100%;background:${g.color};opacity:0.2;border-radius:2px;` });
      // Expressed bar (solid, on top)
      const ratio = Math.min(1, genes[g.key] / g.max);
      const barInner = el('div', { style: `position:absolute;top:0;left:0;width:${(ratio * 100).toFixed(1)}%;height:100%;background:${g.color};border-radius:2px;` });
      barOuter.append(ghostBar, barInner);
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
    const drawX = 26; // offset for Y-axis labels
    const drawW = w - drawX;
    const step = drawW / (history.length - 1);

    // Y-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(maxPop), drawX - 3, 10);
    ctx.fillText('0', drawX - 3, h - 2);
    ctx.textAlign = 'left';

    // Season background bands
    for (let i = 0; i < history.length; i++) {
      const s = history[i].season;
      if (s) {
        const px = drawX + i * step;
        ctx.fillStyle = SEASON_BG_COLORS[s];
        ctx.fillRect(px, 0, Math.max(step, 1), h);
      }
    }

    const drawLine = (getValue: (s: TickSnapshot) => number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const px = drawX + i * step;
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

  private updateHallOfFame(analytics: Analytics): void {
    this.hallOfFameEl.textContent = '';
    const hof = analytics.hallOfFame;
    if (hof.length === 0) {
      this.hallOfFameEl.appendChild(document.createTextNode('No data yet'));
      return;
    }

    const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32'];

    for (let i = 0; i < hof.length; i++) {
      const r = hof[i];
      const row = el('div', { style: `padding:4px 0;${i > 0 ? 'border-top:1px solid #333;' : ''}` });

      const header = el('div', { style: 'display:flex;align-items:center;gap:6px;' });
      const rank = el('span', { style: `font-weight:bold;font-size:13px;color:${rankColors[i]};` }, `#${i + 1}`);
      const sex = r.sex === 'M' ? '\u2642' : '\u2640';
      const sexColor = r.sex === 'M' ? '#4682f0' : '#f05050';
      const info = el('span', { style: 'font-size:11px;color:#ccc;' }, `Entity #${r.id} `);
      const sexSpan = el('span', { style: `color:${sexColor};` }, sex);
      const genSpan = el('span', { style: 'color:#888;font-size:10px;margin-left:4px;' }, `Gen ${r.generation}`);
      const aliveSpan = el('span', { style: `font-size:9px;margin-left:4px;color:${r.alive ? '#4caf50' : '#666'};` }, r.alive ? 'ALIVE' : 'DEAD');
      header.append(rank, info, sexSpan, genSpan, aliveSpan);

      const stats = el('div', { style: 'font-size:10px;color:#999;margin-top:2px;padding-left:22px;' });
      stats.textContent = `Age: ${r.age} | Children: ${r.children} | Score: ${r.score}`;

      const decoded = decodeDNA(r.dna);
      const genes = el('div', { style: 'font-size:9px;color:#666;margin-top:1px;padding-left:22px;' });
      genes.textContent = `Spd:${decoded.speed.toFixed(2)} Aggr:${decoded.aggression.toFixed(2)} Coop:${decoded.cooperation.toFixed(2)}`;

      row.append(header, stats, genes);
      this.hallOfFameEl.appendChild(row);
    }
  }

  private updateTribeRanking(analytics: Analytics): void {
    this.tribeRankingEl.textContent = '';
    const ranking = analytics.tribeRanking;
    if (ranking.length === 0) {
      this.tribeRankingEl.appendChild(document.createTextNode('No tribes'));
      return;
    }

    for (const t of ranking) {
      const row = el('div', { style: 'display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px;' });
      // Color dot
      const dot = el('span', { style: `display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.color};flex-shrink:0;` });
      const name = el('span', { style: 'color:#ccc;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, t.name);
      const detail = el('span', { style: 'color:#888;font-size:10px;flex-shrink:0;' }, `${t.members}m ${t.kills}k ${t.foodShared}f`);
      const score = el('span', { style: 'color:#aaa;font-size:10px;font-weight:bold;flex-shrink:0;width:28px;text-align:right;' }, String(t.score));
      row.append(dot, name, detail, score);
      this.tribeRankingEl.appendChild(row);
    }
  }

  private updateSeasonalStats(analytics: Analytics): void {
    this.seasonalStatsEl.textContent = '';
    const b = analytics.birthsBySeason;
    const s = analytics.starvationsBySeason;
    const lines = [
      `Winter survival: ${analytics.winterSurvivalRate}%`,
      `Births: Spr:${b.spring} | Sum:${b.summer} | Aut:${b.autumn} | Win:${b.winter}`,
      `Starvation: Spr:${s.spring} | Sum:${s.summer} | Aut:${s.autumn} | Win:${s.winter}`,
      `Avg food storage: ${analytics.avgFoodStorage.toFixed(1)}`,
    ];
    lines.forEach((text, i) => {
      if (i > 0) this.seasonalStatsEl.appendChild(document.createElement('br'));
      this.seasonalStatsEl.appendChild(document.createTextNode(text));
    });
  }

  private setupKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.gameLoop.isEndScreenVisible()) return;
        this.toggleSim();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (this.gameLoop.isEndScreenVisible()) return;
        this.gameLoop.stepOnce();
      } else if (e.code === 'KeyH') {
        const enabled = !this.renderer.isHeatmapEnabled();
        this.renderer.setHeatmap(enabled);
      }
    });
  }
}
