import { HexGrid } from '../core/HexGrid';
import { EntityState, FoodState } from '../core/types';
import { HexRenderer } from './HexRenderer';
import { EntityRenderer } from './EntityRenderer';
import { FoodRenderer } from './FoodRenderer';
import { UIOverlay } from './UIOverlay';
import { EffectsRenderer } from './EffectsRenderer';
import { Inspector } from './Inspector';
import { HeatmapRenderer, HeatmapMode } from './HeatmapRenderer';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private hexRenderer = new HexRenderer();
  private entityRenderer = new EntityRenderer();
  private foodRenderer = new FoodRenderer();
  private uiOverlay = new UIOverlay();
  private effectsRenderer = new EffectsRenderer();
  private inspector = new Inspector();
  private heatmapRenderer = new HeatmapRenderer();
  private gridImageCache: ImageData | null = null;
  private heatmapEnabled = false;
  private heatmapMode: HeatmapMode = 'population';
  private lastEntities: EntityState[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setupClickHandler();
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
    this.lastEntities = entities;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.gridImageCache) {
      this.hexRenderer.drawGrid(ctx, grid);
      this.gridImageCache = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    } else {
      ctx.putImageData(this.gridImageCache, 0, 0);
    }

    const size = this.hexRenderer.getHexSize();
    const { x: cx, y: cy } = this.hexRenderer.getCenter();

    // Heatmap overlay (between grid and entities)
    if (this.heatmapEnabled) {
      this.heatmapRenderer.draw(ctx, grid, entities, foods, size, cx, cy, this.heatmapMode);
    }

    for (const food of foods) {
      this.foodRenderer.draw(ctx, food, grid, size, cx, cy);
    }

    for (const entity of entities) {
      this.entityRenderer.draw(ctx, entity, grid, size, cx, cy);
    }

    this.effectsRenderer.draw(ctx, grid, size, cx, cy);
    this.uiOverlay.draw(ctx, tick, entities);
    this.inspector.draw(ctx);
  }

  getEffects(): EffectsRenderer {
    return this.effectsRenderer;
  }

  getUIOverlay(): UIOverlay {
    return this.uiOverlay;
  }

  advanceFoodTick(): void {
    this.foodRenderer.advanceTick();
  }

  invalidateGridCache(): void {
    this.gridImageCache = null;
  }

  setHeatmap(enabled: boolean, mode?: HeatmapMode): void {
    this.heatmapEnabled = enabled;
    if (mode) this.heatmapMode = mode;
  }

  isHeatmapEnabled(): boolean {
    return this.heatmapEnabled;
  }

  getHeatmapMode(): HeatmapMode {
    return this.heatmapMode;
  }

  private setupClickHandler(): void {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      // Check if clicking inside inspector panel (close button area)
      if (this.inspector.getSelected()) {
        if (this.inspector.isClickInPanel(px, py)) {
          this.inspector.deselect();
          return;
        }
        // Click outside panel = deselect
        this.inspector.deselect();
      }

      // Find entity at clicked hex
      const size = this.hexRenderer.getHexSize();
      if (size === 0) return;
      const { x: cx, y: cy } = this.hexRenderer.getCenter();
      const grid = this.hexRenderer.getGrid();
      if (!grid) return;

      const hex = grid.pixelToHex(px, py, size, cx, cy);
      if (!grid.isValid(hex)) return;

      const entity = this.lastEntities.find(ent =>
        ent.alive && HexGrid.equals(ent.pos, hex)
      );

      if (entity) {
        this.inspector.select(entity, px, py);
      }
    });
  }
}
