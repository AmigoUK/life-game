import { DeathStats, GeneAverages, EntityRecord, TribeRankEntry, TickSnapshot } from '../core/Analytics';
import { Season, SeasonState } from '../core/Seasons';
import { decodeDNA } from '../core/DNA';

export interface EndScreenData {
  totalTicks: number;
  seasonState: SeasonState | null;
  deathCauses: DeathStats;
  deathCausePercents: { starvation: number; age: number; combat: number };
  totalDeaths: number;
  totalBirths: number;
  peakPopulation: number;
  peakPopulationTick: number;
  hallOfFame: EntityRecord[];
  tribeRanking: TribeRankEntry[];
  birthsBySeason: Record<Season, number>;
  starvationsBySeason: Record<Season, number>;
  winterSurvivalRate: number;
  initialGeneAverages: GeneAverages | null;
  finalGeneAverages: GeneAverages;
  finalCarriedGeneAverages: GeneAverages;
  geneticDiversity: number;
  populationHistory: TickSnapshot[];
  seasonsEnabled: boolean;
  tribesEnabled: boolean;
}

const SECTION_GAP = 28;
const CONTENT_WIDTH = 660;
const BUTTON_HEIGHT = 44;
const BUTTON_WIDTH = 200;

const SEASON_COLORS: Record<Season, string> = {
  spring: '#66bb6a',
  summer: '#ffd54f',
  autumn: '#ff8a65',
  winter: '#90caf9',
};

export class EndScreen {
  private visible = false;
  private data: EndScreenData | null = null;
  private fadeAlpha = 0;
  private scrollY = 0;
  private buttonRect = { x: 0, y: 0, w: BUTTON_WIDTH, h: BUTTON_HEIGHT };
  private onNewGameCb: (() => void) | null = null;
  private contentHeight = 0;

  show(data: EndScreenData, onNewGame: () => void): void {
    this.data = data;
    this.onNewGameCb = onNewGame;
    this.fadeAlpha = 0;
    this.scrollY = 0;
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
    this.data = null;
    this.fadeAlpha = 0;
    this.scrollY = 0;
  }

  isVisible(): boolean {
    return this.visible;
  }

  tick(): void {
    if (this.fadeAlpha < 1) {
      this.fadeAlpha = Math.min(1, this.fadeAlpha + 0.02);
    }
  }

  handleClick(px: number, py: number): boolean {
    if (!this.visible || !this.data) return false;
    const b = this.buttonRect;
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
      this.onNewGameCb?.();
      return true;
    }
    return true; // consume all clicks when visible
  }

  handleScroll(deltaY: number, canvasHeight: number): void {
    if (!this.visible) return;
    this.scrollY += deltaY;
    const maxScroll = Math.max(0, this.contentHeight - canvasHeight + 80);
    this.scrollY = Math.max(0, Math.min(this.scrollY, maxScroll));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible || !this.data) return;

    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;
    const alpha = this.fadeAlpha;

    // Dark backdrop
    ctx.save();
    ctx.globalAlpha = alpha * 0.88;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalAlpha = alpha;

    // Content column
    const colW = Math.min(CONTENT_WIDTH, cw - 40);
    const colX = (cw - colW) / 2;
    let y = 50 - this.scrollY;

    const d = this.data;

    // --- HEADER ---
    y = this.drawHeader(ctx, colX, y, colW, d);
    y += SECTION_GAP;

    // --- DEATH STATS ---
    y = this.drawDeathStats(ctx, colX, y, colW, d);
    y += SECTION_GAP;

    // --- HALL OF FAME ---
    y = this.drawHallOfFame(ctx, colX, y, colW, d);
    y += SECTION_GAP;

    // --- TRIBE LEGACY ---
    if (d.tribesEnabled && d.tribeRanking.length > 0) {
      y = this.drawTribeLegacy(ctx, colX, y, colW, d);
      y += SECTION_GAP;
    }

    // --- SEASONAL SUMMARY ---
    if (d.seasonsEnabled) {
      y = this.drawSeasonalSummary(ctx, colX, y, colW, d);
      y += SECTION_GAP;
    }

    // --- GENE EVOLUTION ---
    if (d.initialGeneAverages) {
      y = this.drawGeneEvolution(ctx, colX, y, colW, d);
      y += SECTION_GAP;
    }

    // --- TIMELINE ---
    if (d.populationHistory.length > 1) {
      y = this.drawTimeline(ctx, colX, y, colW, d);
      y += SECTION_GAP;
    }

    // --- NEW GAME BUTTON ---
    y = this.drawButton(ctx, colX, y, colW);
    y += 60;

    this.contentHeight = y + this.scrollY;

    ctx.restore();
  }

  // ── Section Renderers ──

  private drawHeader(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: EndScreenData): number {
    // Title
    ctx.textAlign = 'center';
    ctx.font = 'bold 42px monospace';
    ctx.fillStyle = '#e53935';
    ctx.fillText('EXTINCTION', x + w / 2, y + 40);
    y += 60;

    // Subtitle
    ctx.font = '16px monospace';
    ctx.fillStyle = '#aaa';
    let subtitle = `Survived ${d.totalTicks} ticks`;
    if (d.seasonState) {
      const sName = d.seasonState.current.charAt(0).toUpperCase() + d.seasonState.current.slice(1);
      subtitle += ` · Year ${d.seasonState.year}, ${sName}`;
    }
    ctx.fillText(subtitle, x + w / 2, y + 16);
    y += 30;

    ctx.font = '14px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText(`Peak population: ${d.peakPopulation} (tick ${d.peakPopulationTick})`, x + w / 2, y + 14);
    y += 24;

    return y;
  }

  private drawDeathStats(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: EndScreenData): number {
    ctx.textAlign = 'left';
    this.drawSectionTitle(ctx, x, y, 'Death Statistics');
    y += 22;

    const pcts = d.deathCausePercents;
    const causes: [string, number, string][] = [
      ['Starvation', pcts.starvation, '#ff7043'],
      ['Old Age', pcts.age, '#78909c'],
      ['Combat', pcts.combat, '#ef5350'],
    ];

    for (const [label, pct, color] of causes) {
      ctx.fillStyle = '#999';
      ctx.font = '13px monospace';
      ctx.fillText(`${label}: ${pct}%`, x, y + 13);

      const barX = x + 180;
      const barW = w - 220;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, y + 2, barW, 14);
      ctx.fillStyle = color;
      ctx.fillRect(barX, y + 2, barW * (pct / 100), 14);

      ctx.fillStyle = '#ddd';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(d.deathCauses[label === 'Old Age' ? 'age' : label === 'Starvation' ? 'starvation' : 'combat' as keyof DeathStats]), x + w, y + 13);
      ctx.textAlign = 'left';
      y += 22;
    }

    ctx.fillStyle = '#777';
    ctx.font = '12px monospace';
    ctx.fillText(`Total deaths: ${d.totalDeaths}  ·  Total births: ${d.totalBirths}`, x, y + 12);
    y += 18;

    return y;
  }

  private drawHallOfFame(ctx: CanvasRenderingContext2D, x: number, y: number, _w: number, d: EndScreenData): number {
    this.drawSectionTitle(ctx, x, y, 'Gene Pool Ranking');
    y += 22;

    const podiumColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
    const podiumLabels = ['1st', '2nd', '3rd'];

    // Top 3: expanded view with gene details
    for (let i = 0; i < Math.min(3, d.hallOfFame.length); i++) {
      const r = d.hallOfFame[i];
      const decoded = decodeDNA(r.dna);
      const sexSymbol = r.sex === 'M' ? '\u2642' : '\u2640';
      const sexColor = r.sex === 'M' ? '#4682f0' : '#f05050';

      // Rank badge
      ctx.fillStyle = podiumColors[i];
      ctx.font = 'bold 16px monospace';
      ctx.fillText(podiumLabels[i], x, y + 16);

      // Entity info
      ctx.fillStyle = sexColor;
      ctx.font = '14px monospace';
      ctx.fillText(sexSymbol, x + 40, y + 16);

      ctx.fillStyle = '#ccc';
      ctx.font = '13px monospace';
      ctx.fillText(`${r.name}  Gen ${r.generation}  Age ${r.age}  ${r.children} children  Score: ${r.score}`, x + 58, y + 16);
      y += 22;

      // Key genes (2 rows to fit all 15)
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.fillText(
        `Life:${decoded.maxAge.toFixed(0)} Spd:${decoded.speed.toFixed(2)} Dir:${decoded.directionBias.toFixed(2)} Vis:${decoded.visionRange.toFixed(1)} Atk:${decoded.attack.toFixed(1)} Def:${decoded.defense.toFixed(1)} HP:${decoded.maxHP.toFixed(0)} Aggr:${decoded.aggression.toFixed(2)}`,
        x + 58, y + 10
      );
      y += 14;
      ctx.fillText(
        `Food:${decoded.foodAffinity.toFixed(2)} Flee:${decoded.fleeSpeed.toFixed(2)} Eff:${decoded.energyEfficiency.toFixed(2)} Fert:${decoded.fertilityBonus.toFixed(2)} Stab:${decoded.mutationResist.toFixed(2)} Coop:${decoded.cooperation.toFixed(2)} Stor:${decoded.storageCapacity.toFixed(0)}`,
        x + 58, y + 10
      );
      y += 18;
    }

    // Remaining entries: compact rows
    if (d.hallOfFame.length > 3) {
      y += 6;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + _w, y);
      ctx.stroke();
      y += 8;

      for (let i = 3; i < d.hallOfFame.length; i++) {
        const r = d.hallOfFame[i];
        const sexSymbol = r.sex === 'M' ? '\u2642' : '\u2640';
        const sexColor = r.sex === 'M' ? '#4682f0' : '#f05050';

        // Rank number
        ctx.fillStyle = '#666';
        ctx.font = '11px monospace';
        const rankStr = `${i + 1}.`;
        ctx.fillText(rankStr, x, y + 11);

        // Sex symbol
        ctx.fillStyle = sexColor;
        ctx.font = '12px monospace';
        ctx.fillText(sexSymbol, x + 28, y + 11);

        // Name and stats
        ctx.fillStyle = '#aaa';
        ctx.font = '11px monospace';
        ctx.fillText(`${r.name}`, x + 42, y + 11);

        ctx.fillStyle = '#777';
        ctx.fillText(`Gen ${r.generation}  Age ${r.age}  ${r.children} kids  Score: ${r.score}`, x + 140, y + 11);

        // Alive indicator
        if (r.alive) {
          ctx.fillStyle = '#4caf50';
          ctx.font = '9px monospace';
          ctx.fillText('ALIVE', x + _w - 40, y + 11);
        }

        y += 16;
      }
    }

    return y;
  }

  private drawTribeLegacy(ctx: CanvasRenderingContext2D, x: number, y: number, _w: number, d: EndScreenData): number {
    this.drawSectionTitle(ctx, x, y, 'Tribe Legacy');
    y += 22;

    for (const t of d.tribeRanking.slice(0, 8)) {
      // Color dot
      ctx.beginPath();
      ctx.arc(x + 6, y + 8, 5, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();

      // Name and stats
      ctx.fillStyle = '#ccc';
      ctx.font = '13px monospace';
      ctx.fillText(t.name, x + 18, y + 12);

      ctx.fillStyle = '#888';
      ctx.font = '11px monospace';
      const stats = `${t.members} members · ${t.kills} kills · ${t.foodShared} food shared · Score: ${t.score}`;
      ctx.fillText(stats, x + 18 + Math.min(120, ctx.measureText(t.name).width + 12), y + 12);
      y += 20;
    }

    return y;
  }

  private drawSeasonalSummary(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: EndScreenData): number {
    this.drawSectionTitle(ctx, x, y, 'Seasonal Summary');
    y += 22;

    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText(`Winter survival rate: ${d.winterSurvivalRate}%`, x, y + 12);
    y += 22;

    const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
    const colW = (w - 20) / 4;

    // Column headers
    for (let i = 0; i < 4; i++) {
      const sx = x + i * colW;
      ctx.fillStyle = SEASON_COLORS[seasons[i]];
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(seasons[i].charAt(0).toUpperCase() + seasons[i].slice(1), sx + colW / 2, y + 12);
    }
    y += 20;

    // Births row
    ctx.font = '11px monospace';
    ctx.fillStyle = '#777';
    ctx.textAlign = 'left';
    ctx.fillText('Births', x - 2, y + 12);
    for (let i = 0; i < 4; i++) {
      const sx = x + i * colW;
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'center';
      ctx.fillText(String(d.birthsBySeason[seasons[i]]), sx + colW / 2, y + 12);
    }
    y += 18;

    // Starvations row
    ctx.textAlign = 'left';
    ctx.fillStyle = '#777';
    ctx.fillText('Starv.', x - 2, y + 12);
    for (let i = 0; i < 4; i++) {
      const sx = x + i * colW;
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'center';
      ctx.fillText(String(d.starvationsBySeason[seasons[i]]), sx + colW / 2, y + 12);
    }
    y += 18;
    ctx.textAlign = 'left';

    return y;
  }

  private drawGeneEvolution(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: EndScreenData): number {
    this.drawSectionTitle(ctx, x, y, 'Gene Evolution');
    y += 22;

    const initial = d.initialGeneAverages!;
    const final_ = d.finalGeneAverages;
    const carried = d.finalCarriedGeneAverages;
    const genes: { key: keyof GeneAverages; label: string; max: number; color: string }[] = [
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

    const barW = (w - 140) / 2;

    for (const g of genes) {
      ctx.fillStyle = '#999';
      ctx.font = '11px monospace';
      ctx.fillText(g.label, x, y + 14);

      const initialRatio = Math.min(1, initial[g.key] / g.max);
      const finalRatio = Math.min(1, final_[g.key] / g.max);
      const carriedRatio = Math.min(1, carried[g.key] / g.max);

      const barX = x + 70;

      // Initial bar (dimmer)
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = g.color;
      ctx.fillRect(barX, y, barW * initialRatio, 6);
      ctx.globalAlpha = 1;

      // Final expressed bar
      ctx.fillStyle = g.color;
      ctx.fillRect(barX, y + 8, barW * finalRatio, 6);

      // Final carried bar (dotted/lighter)
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = g.color;
      ctx.fillRect(barX, y + 16, barW * carriedRatio, 6);
      ctx.globalAlpha = 1;

      // Values
      ctx.fillStyle = '#666';
      ctx.font = '9px monospace';
      ctx.fillText(initial[g.key].toFixed(2), barX + barW + 6, y + 7);
      ctx.fillStyle = '#aaa';
      ctx.fillText(final_[g.key].toFixed(2), barX + barW + 6, y + 15);
      ctx.fillStyle = '#777';
      ctx.fillText(carried[g.key].toFixed(2), barX + barW + 6, y + 23);

      y += 28;
    }

    // Legend
    ctx.fillStyle = '#555';
    ctx.font = '10px monospace';
    ctx.fillText('(top: initial, mid: final expressed, bottom: final carried)', x + 70, y + 10);
    y += 16;

    ctx.fillStyle = '#666';
    ctx.fillText(`Genetic diversity: ${d.geneticDiversity.toFixed(3)}`, x, y + 10);
    y += 14;

    return y;
  }

  private drawTimeline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: EndScreenData): number {
    this.drawSectionTitle(ctx, x, y, 'Population Timeline');
    y += 22;

    const history = d.populationHistory;
    const graphH = 80;
    const maxPop = Math.max(1, ...history.map(s => s.total));
    const step = w / (history.length - 1);

    // Season bands background
    if (d.seasonsEnabled) {
      for (let i = 0; i < history.length; i++) {
        const s = history[i].season;
        if (s) {
          ctx.fillStyle = SEASON_COLORS[s];
          ctx.globalAlpha = 0.08;
          ctx.fillRect(x + i * step, y, Math.max(step, 1), graphH);
          ctx.globalAlpha = 1;
        }
      }
    }

    // Graph background
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, graphH);

    // Population line
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = x + i * step;
      const py = y + graphH - (history[i].total / maxPop) * (graphH - 4) - 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#555';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(String(maxPop), x + 2, y + 10);
    ctx.fillText('0', x + 2, y + graphH - 2);
    ctx.textAlign = 'left';

    y += graphH + 8;

    return y;
  }

  private drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): number {
    const bx = x + (w - BUTTON_WIDTH) / 2;
    const by = y;

    // Rounded rect
    const r = 8;
    ctx.beginPath();
    ctx.roundRect(bx, by, BUTTON_WIDTH, BUTTON_HEIGHT, r);
    ctx.fillStyle = '#2d6a4f';
    ctx.fill();

    // Hover-ish border
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('New Game', bx + BUTTON_WIDTH / 2, by + BUTTON_HEIGHT / 2 + 6);
    ctx.textAlign = 'left';

    this.buttonRect = { x: bx, y: by, w: BUTTON_WIDTH, h: BUTTON_HEIGHT };

    return by + BUTTON_HEIGHT;
  }

  // ── Helpers ──

  private drawSectionTitle(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
    ctx.fillStyle = '#ccc';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(text, x, y + 12);

    // Underline
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 16);
    ctx.lineTo(x + ctx.measureText(text).width + 10, y + 16);
    ctx.stroke();
  }
}
