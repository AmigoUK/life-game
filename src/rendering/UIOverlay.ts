import { EntityState } from '../core/types';

export class UIOverlay {
  private bannerText = '';
  private bannerAlpha = 0;

  showBanner(text: string): void {
    this.bannerText = text;
    this.bannerAlpha = 1.0;
  }

  tickBanner(): void {
    if (this.bannerAlpha > 0) {
      this.bannerAlpha -= 0.008;
    }
  }

  draw(ctx: CanvasRenderingContext2D, tick: number, entities: EntityState[]): void {
    const alive = entities.filter(e => e.alive);
    const males = alive.filter(e => e.sex === 'M').length;
    const females = alive.filter(e => e.sex === 'F').length;
    const maxGen = alive.reduce((max, e) => Math.max(max, e.generation), 0);
    const avgGen = alive.length > 0
      ? alive.reduce((s, e) => s + e.generation, 0) / alive.length
      : 0;

    // HUD top-left
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '14px monospace';
    const x = 16;
    let y = 30;
    const line = (text: string) => { ctx.fillText(text, x, y); y += 20; };

    line(`Tick: ${tick}`);
    line(`Population: ${alive.length} (M:${males} F:${females})`);
    line(`Gen: ${maxGen}  Avg Gen: ${avgGen.toFixed(1)}`);

    this.drawLegend(ctx);
    this.drawBanner(ctx);
  }

  private drawBanner(ctx: CanvasRenderingContext2D): void {
    if (this.bannerAlpha <= 0 || !this.bannerText) return;
    const cw = ctx.canvas.width;
    ctx.save();
    ctx.globalAlpha = this.bannerAlpha;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 6;
    ctx.fillText(this.bannerText, cw / 2, 20);
    ctx.restore();
  }

  private drawLegend(ctx: CanvasRenderingContext2D): void {
    const canvasH = ctx.canvas.height;
    const lx = 16;
    const w = 280;
    const h = 370;
    const ly = canvasH - h - 16;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(lx - 8, ly - 8, w, h, 6);
    ctx.fill();

    ctx.font = '12px monospace';
    let y = ly + 6;
    const lineH = 18;
    const col2x = lx + 140;

    const sectionHeader = (text: string) => {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px monospace';
      ctx.fillText(text, lx, y);
      // Underline
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lx, y + 3);
      ctx.lineTo(lx + w - 20, y + 3);
      ctx.stroke();
      y += lineH;
      ctx.font = '12px monospace';
    };

    const textItem = (text: string, tx: number, color = 'rgba(255,255,255,0.85)') => {
      ctx.fillStyle = color;
      ctx.fillText(text, tx, y);
    };

    // ── ENTITIES ──
    sectionHeader('ENTITIES');

    // Male triangle
    ctx.fillStyle = 'hsla(220, 80%, 60%, 1)';
    ctx.beginPath();
    ctx.moveTo(lx + 6, y - 10);
    ctx.lineTo(lx, y - 2);
    ctx.lineTo(lx + 12, y - 2);
    ctx.closePath();
    ctx.fill();
    textItem('Male', lx + 20);

    // Female triangle
    ctx.fillStyle = 'hsla(20, 85%, 60%, 1)';
    ctx.beginPath();
    ctx.moveTo(col2x + 6, y - 2);
    ctx.lineTo(col2x, y - 10);
    ctx.lineTo(col2x + 12, y - 10);
    ctx.closePath();
    ctx.fill();
    textItem('Female', col2x + 20);
    y += lineH;

    // Aggressive (triangle with red spikes)
    ctx.fillStyle = 'hsla(0, 70%, 55%, 0.9)';
    ctx.beginPath();
    ctx.moveTo(lx + 6, y - 10);
    ctx.lineTo(lx, y - 2);
    ctx.lineTo(lx + 12, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'hsla(0, 90%, 50%, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx + 3, y - 6);
    ctx.lineTo(lx - 2, y - 10);
    ctx.moveTo(lx + 9, y - 6);
    ctx.lineTo(lx + 14, y - 10);
    ctx.stroke();
    textItem('Aggressive', lx + 20);
    y += lineH;

    // Healthy (white-bordered)
    ctx.fillStyle = 'hsla(220, 80%, 60%, 0.7)';
    ctx.beginPath();
    ctx.moveTo(lx + 6, y - 10);
    ctx.lineTo(lx, y - 2);
    ctx.lineTo(lx + 12, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    textItem('Healthy (>70%)', lx + 20);

    // Hungry (yellow-bordered)
    ctx.fillStyle = 'hsla(220, 80%, 60%, 0.5)';
    ctx.beginPath();
    ctx.moveTo(col2x + 6, y - 10);
    ctx.lineTo(col2x, y - 2);
    ctx.lineTo(col2x + 12, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,50,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    textItem('Hungry (<30%)', col2x + 20);
    y += lineH + 2;

    // ── FOOD ──
    sectionHeader('FOOD');

    // Food circle
    ctx.fillStyle = 'rgba(80, 200, 80, 0.85)';
    ctx.beginPath();
    ctx.arc(lx + 6, y - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    textItem('Food', lx + 20);

    // Respawning
    ctx.fillStyle = 'rgba(120, 120, 120, 0.3)';
    ctx.beginPath();
    ctx.arc(col2x + 6, y - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80, 200, 80, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(col2x + 6, y - 5, 5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    textItem('Respawning', col2x + 20);
    y += lineH + 2;

    // ── EVENTS ──
    sectionHeader('EVENTS');

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
    ctx.fillText('\u2694', col2x + 2, y);
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Combat', col2x + 20, y);
    y += lineH + 2;

    // ── VISUAL CUES ──
    sectionHeader('VISUAL CUES');

    // Size = energy (small to large triangles)
    for (let i = 0; i < 3; i++) {
      const s = 3 + i * 2.5;
      const tx = lx + i * 12;
      ctx.fillStyle = `rgba(100, 160, 255, ${0.5 + i * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(tx + s / 2, y - 8);
      ctx.lineTo(tx, y - 2);
      ctx.lineTo(tx + s, y - 2);
      ctx.closePath();
      ctx.fill();
    }
    textItem('Size = energy', lx + 42);
    y += lineH;

    // Opacity = age (fading triangles)
    for (let i = 0; i < 3; i++) {
      const alpha = 1 - i * 0.3;
      const tx = lx + i * 12;
      ctx.fillStyle = `rgba(100, 160, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(tx + 4, y - 8);
      ctx.lineTo(tx, y - 2);
      ctx.lineTo(tx + 8, y - 2);
      ctx.closePath();
      ctx.fill();
    }
    textItem('Opacity = age', lx + 42);
    y += lineH;

    // Hue = DNA (color gradient swatch)
    for (let i = 0; i < 8; i++) {
      const hue = i * 45;
      ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
      ctx.fillRect(lx + i * 4, y - 9, 4, 8);
    }
    textItem('Hue = DNA', lx + 42);
    y += lineH;

    // Generation label
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '9px monospace';
    ctx.fillText('G3', lx + 2, y - 3);
    ctx.font = '12px monospace';
    textItem('Generation number', lx + 42);
    y += lineH;

    // DNA size gene
    for (let i = 0; i < 3; i++) {
      const s = 4 + i * 3;
      const tx = lx + i * 14;
      ctx.fillStyle = `rgba(100, 160, 255, 0.7)`;
      ctx.beginPath();
      ctx.moveTo(tx + s / 2, y - 8);
      ctx.lineTo(tx, y - 2);
      ctx.lineTo(tx + s, y - 2);
      ctx.closePath();
      ctx.fill();
    }
    textItem('DNA size gene', lx + 48);
  }
}
