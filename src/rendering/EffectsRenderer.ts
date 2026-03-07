import { HexGrid } from '../core/HexGrid';
import { HexCoord } from '../core/types';

interface Effect {
  pos: HexCoord;
  symbol: string;
  color: string;
  ttl: number;
  maxTtl: number;
}

export class EffectsRenderer {
  private effects: Effect[] = [];

  addDeath(pos: HexCoord): void {
    this.effects.push({ pos, symbol: '\u2620', color: '#aaa', ttl: 30, maxTtl: 30 }); // skull
  }

  addReproduction(pos: HexCoord): void {
    this.effects.push({ pos, symbol: '\u2665', color: '#ff69b4', ttl: 35, maxTtl: 35 }); // heart
  }

  addCombat(pos: HexCoord): void {
    this.effects.push({ pos, symbol: '\u2694', color: '#ff4444', ttl: 25, maxTtl: 25 }); // crossed swords
  }

  tick(): void {
    for (const e of this.effects) {
      e.ttl--;
    }
    this.effects = this.effects.filter(e => e.ttl > 0);
  }

  draw(ctx: CanvasRenderingContext2D, grid: HexGrid, hexSize: number, cx: number, cy: number): void {
    for (const e of this.effects) {
      const { x, y } = grid.hexToPixel(e.pos, hexSize, cx, cy);
      const progress = e.ttl / e.maxTtl;
      const alpha = progress;
      const offsetY = (1 - progress) * hexSize * 0.6;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${hexSize * 0.6}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = e.color;
      ctx.fillText(e.symbol, x, y - offsetY);
      ctx.restore();
    }
  }

  clear(): void {
    this.effects = [];
  }
}
