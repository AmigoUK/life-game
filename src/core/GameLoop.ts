import { SimulationEngine } from './SimulationEngine';
import { Analytics } from './Analytics';
import { Renderer } from '../rendering/Renderer';
import { SimulationConfig } from './SimulationConfig';
import { TICK_INTERVAL_MS } from './constants';

export class GameLoop {
  private engine: SimulationEngine;
  private renderer: Renderer;
  private running = false;
  private tickInterval = TICK_INTERVAL_MS;
  private lastTick = 0;
  private rafId = 0;
  private analytics = new Analytics();
  private currentConfig: SimulationConfig;

  constructor(engine: SimulationEngine, renderer: Renderer) {
    this.engine = engine;
    this.currentConfig = engine.config;
    this.renderer = renderer;
    this.renderer.configure(this.engine.grid);
    this.renderer.setTribeRegistry(this.engine.tribeRegistry);
    this.wireEffects();
  }

  private wireEffects(): void {
    const effects = this.renderer.getEffects();
    this.engine.onEvent((event) => {
      if (event.type === 'death') effects.addDeath(event.pos);
      else if (event.type === 'reproduce') effects.addReproduction(event.pos);
      else if (event.type === 'combat') effects.addCombat(event.pos);
      this.analytics.handleEvent(event);
    });
    this.engine.onBanner((text) => {
      this.renderer.getUIOverlay().showBanner(text);
    });
  }

  getAnalytics(): Analytics {
    return this.analytics;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTick = performance.now();
    this.loop(performance.now());
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  toggle(): void {
    if (this.running) this.stop();
    else this.start();
  }

  isRunning(): boolean {
    return this.running;
  }

  setTickInterval(ms: number): void {
    this.tickInterval = ms;
  }

  getTickInterval(): number {
    return this.tickInterval;
  }

  stepOnce(): void {
    if (this.running) return;
    this.engine.tick();
    this.analytics.update(this.engine.entities, this.engine.foods);
    this.analytics.updateTribes(this.engine.tribeRegistry, this.engine);
    this.renderer.getUIOverlay().tribeCount = this.engine.tribeRegistry.tribes.size;
    this.renderer.getEffects().tick();
    this.renderer.advanceFoodTick();
    this.renderer.getUIOverlay().tickBanner();
    this.render();
  }

  reset(config?: SimulationConfig): void {
    this.stop();
    if (config) {
      this.currentConfig = config;
      this.engine = new SimulationEngine(config);
      this.renderer.setTribeRegistry(this.engine.tribeRegistry);
      this.wireEffects();
    } else {
      this.engine.init();
    }
    this.renderer.getEffects().clear();
    this.analytics.reset();
    this.renderer.configure(this.engine.grid);
    this.renderer.invalidateGridCache();
    this.render();
  }

  getConfig(): SimulationConfig {
    return this.currentConfig;
  }

  getEngine(): SimulationEngine {
    return this.engine;
  }

  private loop(now: number): void {
    if (!this.running) return;

    if (now - this.lastTick >= this.tickInterval) {
      this.engine.tick();
      this.analytics.update(this.engine.entities, this.engine.foods);
      this.analytics.updateTribes(this.engine.tribeRegistry, this.engine);
      this.renderer.getUIOverlay().tribeCount = this.engine.tribeRegistry.tribes.size;
      this.renderer.getEffects().tick();
      this.renderer.advanceFoodTick();
      this.renderer.getUIOverlay().tickBanner();
      this.lastTick = now;
    }

    this.render();
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  private render(): void {
    this.renderer.render(
      this.engine.grid,
      this.engine.entities,
      this.engine.foods,
      this.engine.tickCount
    );
  }
}
