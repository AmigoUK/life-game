import { EntityState } from '../core/types';

export class UIOverlay {
  draw(ctx: CanvasRenderingContext2D, tick: number, entities: EntityState[]): void {
    const alive = entities.filter(e => e.alive);
    const males = alive.filter(e => e.sex === 'M').length;
    const females = alive.filter(e => e.sex === 'F').length;
    const maxGen = alive.reduce((max, e) => Math.max(max, e.generation), 0);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '14px monospace';
    const x = 16;
    let y = 30;
    const line = (text: string) => { ctx.fillText(text, x, y); y += 20; };

    line(`Tick: ${tick}`);
    line(`Population: ${alive.length} (M:${males} F:${females})`);
    line(`Max Generation: ${maxGen}`);

    this.drawLegend(ctx);
  }

  private drawLegend(ctx: CanvasRenderingContext2D): void {
    const canvasH = ctx.canvas.height;
    const lx = 16;
    const ly = canvasH - 190;
    const w = 260;
    const h = 180;

    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(lx - 8, ly - 8, w, h, 6);
    ctx.fill();

    ctx.font = '12px monospace';
    let y = ly + 6;
    const lineH = 18;

    const textLine = (text: string, color = 'rgba(255,255,255,0.9)') => {
      ctx.fillStyle = color;
      ctx.fillText(text, lx, y);
      y += lineH;
    };

    textLine('LEGEND', 'rgba(255,255,255,1)');

    // Male triangle (up, blue)
    ctx.fillStyle = 'hsla(220, 80%, 60%, 1)';
    ctx.beginPath();
    ctx.moveTo(lx + 6, y - 10);
    ctx.lineTo(lx, y - 2);
    ctx.lineTo(lx + 12, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('Male (M)', lx + 20, y);

    // Female triangle (down, red-orange) on same line, offset
    ctx.fillStyle = 'hsla(20, 85%, 60%, 1)';
    ctx.beginPath();
    const fx = lx + 130;
    ctx.moveTo(fx + 6, y - 2);
    ctx.lineTo(fx, y - 10);
    ctx.lineTo(fx + 12, y - 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('Female (F)', fx + 20, y);
    y += lineH;

    // Food
    ctx.fillStyle = 'rgba(80, 200, 80, 0.85)';
    ctx.beginPath();
    ctx.arc(lx + 6, y - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('Food', lx + 20, y);

    // Respawn preview
    ctx.fillStyle = 'rgba(120, 120, 120, 0.3)';
    ctx.beginPath();
    ctx.arc(fx + 6, y - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80, 200, 80, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(fx + 6, y - 5, 5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('Respawn', fx + 20, y);
    y += lineH;

    // Effects
    ctx.font = '14px serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('\u2620', lx + 2, y);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px monospace';
    ctx.fillText('Death', lx + 20, y);

    ctx.font = '14px serif';
    ctx.fillStyle = '#ff69b4';
    ctx.fillText('\u2665', lx + 82, y);
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Birth', lx + 100, y);

    ctx.font = '14px serif';
    ctx.fillStyle = '#ff4444';
    ctx.fillText('\u2694', fx + 2, y);
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Combat', fx + 20, y);
    y += lineH + 2;

    // Separator
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, y - 10);
    ctx.lineTo(lx + w - 20, y - 10);
    ctx.stroke();

    // Visual cues explanation
    textLine('Border: white=healthy  yellow=hungry', 'rgba(255,255,255,0.7)');
    textLine('Size = energy   Opacity = age', 'rgba(255,255,255,0.7)');
    textLine('Spikes = aggressive', 'rgba(255,255,255,0.7)');
  }
}
