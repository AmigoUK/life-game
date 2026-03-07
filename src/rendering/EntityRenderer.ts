import { EntityState } from '../core/types';
import { HexGrid } from '../core/HexGrid';

export class EntityRenderer {
  draw(ctx: CanvasRenderingContext2D, entity: EntityState, grid: HexGrid, hexSize: number, cx: number, cy: number): void {
    if (!entity.alive) return;

    const { x, y } = grid.hexToPixel(entity.pos, hexSize, cx, cy);
    const baseSize = hexSize * 0.35 * entity.decoded.size;
    const energyRatio = Math.max(0.3, entity.energy / 100);
    const size = baseSize * (0.4 + 0.6 * energyRatio);

    const ageRatio = Math.min(1, entity.age / entity.decoded.maxAge);
    const alpha = 1 - ageRatio * 0.5;

    const hue = entity.decoded.hue;
    const baseSat = entity.sex === 'M' ? 80 : 85;
    const baseHueShift = entity.sex === 'M' ? 220 : 20;
    const finalHue = ((baseHueShift + (hue - 180) * 0.6) % 360 + 360) % 360;

    ctx.fillStyle = `hsla(${finalHue}, ${baseSat}%, 60%, ${alpha})`;
    ctx.strokeStyle = `hsla(${finalHue}, ${baseSat}%, 40%, ${alpha})`;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    if (entity.sex === 'M') {
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size * 0.866, y + size * 0.5);
      ctx.lineTo(x + size * 0.866, y + size * 0.5);
    } else {
      ctx.moveTo(x, y + size);
      ctx.lineTo(x - size * 0.866, y - size * 0.5);
      ctx.lineTo(x + size * 0.866, y - size * 0.5);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Energy border: white = healthy (>70%), yellow = hungry (<30%)
    if (energyRatio > 0.7) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (entity.energy < 30) {
      ctx.strokeStyle = `rgba(255, 220, 50, ${alpha * 0.9})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Aggression spikes for aggressive entities
    if (entity.decoded.aggression > 0.5) {
      const spikeLen = size * 0.35;
      ctx.strokeStyle = `hsla(0, 90%, 50%, ${alpha * 0.8})`;
      ctx.lineWidth = 1.5;
      if (entity.sex === 'M') {
        // Spikes on top corners of upward triangle
        ctx.beginPath();
        ctx.moveTo(x - size * 0.5, y - size * 0.25);
        ctx.lineTo(x - size * 0.5 - spikeLen * 0.5, y - size * 0.25 - spikeLen);
        ctx.moveTo(x + size * 0.5, y - size * 0.25);
        ctx.lineTo(x + size * 0.5 + spikeLen * 0.5, y - size * 0.25 - spikeLen);
        ctx.stroke();
      } else {
        // Spikes on bottom corners of downward triangle
        ctx.beginPath();
        ctx.moveTo(x - size * 0.5, y + size * 0.25);
        ctx.lineTo(x - size * 0.5 - spikeLen * 0.5, y + size * 0.25 + spikeLen);
        ctx.moveTo(x + size * 0.5, y + size * 0.25);
        ctx.lineTo(x + size * 0.5 + spikeLen * 0.5, y + size * 0.25 + spikeLen);
        ctx.stroke();
      }
    }
  }
}
