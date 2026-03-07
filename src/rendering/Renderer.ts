import { HexGrid } from '../core/HexGrid';
import { EntityState, FoodState } from '../core/types';
import { HexRenderer } from './HexRenderer';
import { EntityRenderer } from './EntityRenderer';
import { FoodRenderer } from './FoodRenderer';
import { UIOverlay } from './UIOverlay';
import { EffectsRenderer } from './EffectsRenderer';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private hexRenderer = new HexRenderer();
  private entityRenderer = new EntityRenderer();
  private foodRenderer = new FoodRenderer();
  private uiOverlay = new UIOverlay();
  private effectsRenderer = new EffectsRenderer();
  private gridImageCache: ImageData | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.gridImageCache = null;
  }

  configure(grid: HexGrid): void {
    this.hexRenderer.configure(this.canvas, grid);
    this.gridImageCache = null;
  }

  render(grid: HexGrid, entities: EntityState[], foods: FoodState[], tick: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Cache static grid
    if (!this.gridImageCache) {
      this.hexRenderer.drawGrid(ctx, grid);
      this.gridImageCache = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    } else {
      ctx.putImageData(this.gridImageCache, 0, 0);
    }

    const size = this.hexRenderer.getHexSize();
    const { x: cx, y: cy } = this.hexRenderer.getCenter();

    for (const food of foods) {
      this.foodRenderer.draw(ctx, food, grid, size, cx, cy);
    }

    for (const entity of entities) {
      this.entityRenderer.draw(ctx, entity, grid, size, cx, cy);
    }

    this.effectsRenderer.draw(ctx, grid, size, cx, cy);
    this.uiOverlay.draw(ctx, tick, entities);
  }

  getEffects(): EffectsRenderer {
    return this.effectsRenderer;
  }

  advanceFoodTick(): void {
    this.foodRenderer.advanceTick();
  }

  invalidateGridCache(): void {
    this.gridImageCache = null;
  }
}
