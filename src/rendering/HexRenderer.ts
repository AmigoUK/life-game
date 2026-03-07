import { HexGrid } from '../core/HexGrid';

export class HexRenderer {
  private hexSize = 0;
  private centerX = 0;
  private centerY = 0;
  private grid: HexGrid | null = null;

  configure(canvas: HTMLCanvasElement, grid: HexGrid): void {
    this.grid = grid;
    const padding = 20;
    const maxW = (canvas.width - padding * 2) / (3 * grid.radius + 1.5);
    const maxH = (canvas.height - padding * 2) / (Math.sqrt(3) * (2 * grid.radius + 1));
    this.hexSize = Math.min(maxW, maxH);
    this.centerX = canvas.width / 2;
    this.centerY = canvas.height / 2;
  }

  getHexSize(): number { return this.hexSize; }
  getCenter(): { x: number; y: number } { return { x: this.centerX, y: this.centerY }; }
  getGrid(): HexGrid | null { return this.grid; }

  drawGrid(ctx: CanvasRenderingContext2D, grid: HexGrid): void {
    const size = this.hexSize;
    ctx.strokeStyle = 'rgba(100, 100, 140, 0.3)';
    ctx.lineWidth = 1;

    for (const cell of grid.getCells()) {
      const { x, y } = grid.hexToPixel(cell, size, this.centerX, this.centerY);
      this.drawHexOutline(ctx, x, y, size);
    }
  }

  private drawHexOutline(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i);
      const px = cx + size * Math.cos(angle);
      const py = cy + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
}
