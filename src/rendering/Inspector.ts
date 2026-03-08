import { EntityState } from '../core/types';
import { DNA_RANGES } from '../core/constants';
import { TribeRegistry } from '../core/Tribe';

const DNA_LABELS = [
  'Lifespan', 'Speed', 'Direction', 'Vision', 'Attack', 'Defense', 'Health',
  'Aggression', 'Foraging', 'Flee', 'Efficiency', 'Fertility', 'Stability',
  'Appearance', 'Cooperation', 'Storage',
];

const DNA_DESCRIPTIONS = [
  'Max ticks alive', 'Move probability', 'Go-straight tendency', 'Detection hexes',
  'Combat damage', 'Damage reduction', 'Max hit points', 'Fight tendency',
  'Food-seek priority', 'Escape speed bonus', 'Energy drain rate', 'Repro bonus',
  'Mutation resistance', 'Body hue', 'Tribe affinity', 'Winter food reserve',
];

const DNA_COLORS = [
  '#8bc34a', '#4fc3f7', '#ffb74d', '#ab47bc', '#ff7043', '#66bb6a', '#ef5350',
  '#e53935', '#81c784', '#29b6f6', '#aed581', '#f48fb1', '#90a4ae',
  '#ffd54f', '#78909c', '#ffab40',
];

export class Inspector {
  private selected: EntityState | null = null;
  private panelX = 0;
  private panelY = 0;

  select(entity: EntityState | null, screenX: number, screenY: number): void {
    this.selected = entity;
    this.panelX = screenX;
    this.panelY = screenY;
  }

  getSelected(): EntityState | null {
    return this.selected;
  }

  deselect(): void {
    this.selected = null;
  }

  isClickInPanel(px: number, py: number): boolean {
    if (!this.selected) return false;
    const { x, y } = this.getPanelPos();
    return px >= x && px <= x + 220 && py >= y && py <= y + 520;
  }

  private getPanelPos(): { x: number; y: number } {
    return { x: this.panelX + 15, y: this.panelY - 50 };
  }

  draw(ctx: CanvasRenderingContext2D, tribeRegistry?: TribeRegistry): void {
    const e = this.selected;
    if (!e) return;

    // If entity died, clear
    if (!e.alive) {
      this.selected = null;
      return;
    }

    const { x, y: startY } = this.getPanelPos();
    const w = 220;
    const h = 520;

    // Clamp to canvas
    const cx = Math.min(x, ctx.canvas.width - w - 8);
    const cy = Math.min(Math.max(8, startY), ctx.canvas.height - h - 8);

    // Background
    ctx.fillStyle = 'rgba(15, 15, 25, 0.92)';
    ctx.beginPath();
    ctx.roundRect(cx, cy, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 140, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    let yy = cy + 18;
    const lx = cx + 10;

    // Close button
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px monospace';
    ctx.fillText('\u2715', cx + w - 20, cy + 16);

    // Header
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${e.name}  ${e.sex === 'M' ? '\u2642' : '\u2640'}  Gen ${e.generation}`, lx, yy);
    yy += 18;

    // Basic stats
    ctx.font = '11px monospace';
    ctx.fillStyle = '#ccc';
    ctx.fillText(`Age: ${e.age} / ${e.decoded.maxAge}`, lx, yy);
    yy += 15;

    // Energy bar
    ctx.fillText('Energy:', lx, yy);
    const maxE = 150;
    const eRatio = Math.min(1, e.energy / maxE);
    this.drawBar(ctx, lx + 55, yy - 9, 100, 10, eRatio, e.energy < 30 ? '#ffc107' : '#4caf50');
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.fillText(`${e.energy.toFixed(0)}`, lx + 160, yy);
    yy += 15;

    // HP bar
    ctx.font = '11px monospace';
    ctx.fillStyle = '#ccc';
    ctx.fillText('HP:', lx, yy);
    const hpRatio = Math.min(1, e.hp / e.decoded.maxHP);
    this.drawBar(ctx, lx + 55, yy - 9, 100, 10, hpRatio, hpRatio < 0.3 ? '#f44336' : '#e91e63');
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.fillText(`${e.hp.toFixed(0)}/${e.decoded.maxHP}`, lx + 160, yy);
    yy += 15;

    // Tribe info
    ctx.font = '11px monospace';
    ctx.fillStyle = '#ccc';
    if (e.tribeId !== null && tribeRegistry) {
      const tribe = tribeRegistry.tribes.get(e.tribeId);
      const name = tribe?.name ?? `Tribe #${e.tribeId}`;
      ctx.fillText(name, lx, yy);
    } else if (e.tribeId !== null) {
      ctx.fillText(`Tribe #${e.tribeId}`, lx, yy);
    } else {
      ctx.fillText('No tribe', lx, yy);
    }
    yy += 18;

    // DNA section
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(lx, yy - 5);
    ctx.lineTo(lx + w - 20, yy - 5);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px monospace';
    ctx.fillText('DNA TRAITS', lx, yy + 4);
    yy += 14;

    for (let i = 0; i < e.dna.length && i < DNA_LABELS.length; i++) {
      const [min, max] = DNA_RANGES[i];
      const decoded = min + e.dna[i] * (max - min);
      const ratio = e.dna[i];

      // Label + bar + value
      ctx.fillStyle = '#999';
      ctx.font = '9px monospace';
      ctx.fillText(DNA_LABELS[i], lx, yy);
      this.drawBar(ctx, lx + 68, yy - 7, 80, 7, ratio, DNA_COLORS[i]);
      ctx.fillStyle = '#777';
      ctx.fillText(decoded.toFixed(1), lx + 155, yy);
      yy += 11;

      // Description in muted smaller text
      ctx.fillStyle = '#555';
      ctx.font = '8px monospace';
      ctx.fillText(DNA_DESCRIPTIONS[i], lx + 4, yy);
      yy += 9;
    }
  }

  private drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ratio: number, color: string): void {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
  }
}
