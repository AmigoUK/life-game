import { GameLoop } from '../core/GameLoop';
import { Analytics, GeneAverages, TickSnapshot } from '../core/Analytics';
import { MIN_TICK_MS, MAX_TICK_MS } from '../core/constants';

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

export class Controls {
  private container: HTMLElement;
  private gameLoop: GameLoop;
  private statsEl!: HTMLDivElement;
  private genePoolEl!: HTMLDivElement;
  private sparklineCanvas!: HTMLCanvasElement;
  private btnToggle!: HTMLButtonElement;

  constructor(container: HTMLElement, gameLoop: GameLoop) {
    this.container = container;
    this.gameLoop = gameLoop;
    this.build();
    this.setupKeyboard();
  }

  private build(): void {
    this.container.textContent = '';

    const wrapper = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });

    // Buttons row
    const btnRow = el('div', { style: 'display:flex;gap:8px;' });
    this.btnToggle = el('button', { id: 'btn-toggle', style: 'flex:1;padding:6px 12px;cursor:pointer;background:#2d6a4f;color:#fff;border:none;border-radius:4px;' }, 'Start');
    const btnReset = el('button', { id: 'btn-reset', style: 'flex:1;padding:6px 12px;cursor:pointer;background:#a4161a;color:#fff;border:none;border-radius:4px;' }, 'Reset');
    btnRow.append(this.btnToggle, btnReset);

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

    // Grid size selector
    const sizeGroup = el('div');
    const sizeLabel = el('label', { style: 'display:block;margin-bottom:4px;' }, 'Grid Radius:');
    const gridSize = el('select', { id: 'grid-size', style: 'width:100%;padding:4px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;' });
    const sizes: [string, string, boolean][] = [['8', 'Small (8)', false], ['12', 'Medium (12)', true], ['18', 'Large (18)', false], ['24', 'Huge (24)', false]];
    for (const [val, label, selected] of sizes) {
      const opt = el('option', { value: val }, label);
      if (selected) opt.selected = true;
      gridSize.appendChild(opt);
    }
    sizeGroup.append(sizeLabel, gridSize);

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

    wrapper.append(btnRow, speedGroup, sizeGroup, popSection.wrapper, geneSection.wrapper, chartSection.wrapper);
    this.container.appendChild(wrapper);

    // Event listeners
    this.btnToggle.addEventListener('click', () => this.toggleSim());

    btnReset.addEventListener('click', () => {
      const radius = parseInt(gridSize.value);
      this.gameLoop.reset(radius);
      this.syncToggleButton();
    });

    speedSlider.addEventListener('input', () => {
      const val = parseInt(speedSlider.value);
      this.gameLoop.setTickInterval(val);
      speedVal.textContent = `${val}ms`;
    });

    gridSize.addEventListener('change', () => {
      const radius = parseInt(gridSize.value);
      this.gameLoop.reset(radius);
      this.syncToggleButton();
    });

    setInterval(() => this.updateStats(), 250);
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

    // Population section
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

    // Gene Pool section
    this.updateGenePool(analytics);

    // Sparkline chart
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
      }
    });
  }
}
