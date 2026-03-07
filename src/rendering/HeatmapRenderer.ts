import { HexGrid } from '../core/HexGrid';
import { EntityState, FoodState, HexCoord } from '../core/types';

export type HeatmapMode = 'population' | 'food' | 'combat';

export class HeatmapRenderer {
  private combatCounts = new Map<string, number>();

  recordCombat(pos: HexCoord): void {
    const key = `${pos.q},${pos.r}`;
    this.combatCounts.set(key, (this.combatCounts.get(key) || 0) + 1);
  }

  decayCombat(): void {
    for (const [key, val] of this.combatCounts) {
      const next = val * 0.98;
      if (next < 0.1) this.combatCounts.delete(key);
      else this.combatCounts.set(key, next);
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    grid: HexGrid,
    entities: EntityState[],
    foods: FoodState[],
    hexSize: number,
    cx: number,
    cy: number,
    mode: HeatmapMode,
  ): void {
    const counts = new Map<string, number>();
    const cells = grid.getCells();

    if (mode === 'population') {
      for (const e of entities) {
        if (!e.alive) continue;
        const key = `${e.pos.q},${e.pos.r}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    } else if (mode === 'food') {
      for (const f of foods) {
        if (f.consumed) continue;
        const key = `${f.pos.q},${f.pos.r}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    } else {
      for (const [key, val] of this.combatCounts) {
        counts.set(key, val);
      }
    }

    if (counts.size === 0) return;

    const maxVal = Math.max(1, ...counts.values());

    for (const cell of cells) {
      const key = `${cell.q},${cell.r}`;
      const val = counts.get(key);
      if (!val) continue;

      const ratio = val / maxVal;
      const { x, y } = grid.hexToPixel(cell, hexSize, cx, cy);

      // Draw hex fill
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        const px = x + hexSize * 0.95 * Math.cos(angle);
        const py = y + hexSize * 0.95 * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Blue (low) to red (high) gradient
      const r = Math.round(ratio * 255);
      const b = Math.round((1 - ratio) * 200);
      ctx.fillStyle = `rgba(${r}, ${Math.round(ratio * 50)}, ${b}, ${0.15 + ratio * 0.3})`;
      ctx.fill();
    }
  }
}
