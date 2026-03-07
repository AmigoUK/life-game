import { FoodState } from '../core/types';
import { HexGrid } from '../core/HexGrid';

export class FoodRenderer {
  private tick = 0;

  advanceTick(): void {
    this.tick++;
  }

  draw(ctx: CanvasRenderingContext2D, food: FoodState, grid: HexGrid, hexSize: number, cx: number, cy: number): void {
    const { x, y } = grid.hexToPixel(food.pos, hexSize, cx, cy);
    const baseRadius = hexSize * 0.2;

    if (food.consumed) {
      const maxTimer = food.maxRespawnTimer || 1;
      const progress = 1 - food.respawnTimer / maxTimer;
      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(120, 120, 120, ${0.15 + progress * 0.15})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, baseRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.strokeStyle = `rgba(80, 200, 80, ${0.3 + progress * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      return;
    }

    const pulse = 1 + 0.12 * Math.sin(this.tick * 0.08 + food.id * 1.7);
    const radius = baseRadius * pulse;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80, 200, 80, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 140, 40, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
