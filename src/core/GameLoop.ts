import { SimulationEngine } from './SimulationEngine';
import { Analytics } from './Analytics';
import { Renderer } from '../rendering/Renderer';
import { EndScreenData } from '../rendering/EndScreen';
import { SimulationConfig } from './SimulationConfig';
import { TICK_INTERVAL_MS } from './constants';
import { Season } from './Seasons';

export class GameLoop {
  private engine: SimulationEngine;
  private renderer: Renderer;
  private running = false;
  private tickInterval = TICK_INTERVAL_MS;
  private lastTick = 0;
  private rafId = 0;
  private analytics = new Analytics();
  private currentConfig: SimulationConfig;
  private prevSeason: Season | undefined;
  private resetCallbacks: (() => void)[] = [];

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
      const season = this.engine.seasonManager?.getState().current;
      this.analytics.handleEvent(event, season);
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
    this.postTick();
    this.render();
  }

  private postTick(): void {
    // Season tracking
    if (this.engine.seasonManager) {
      const sm = this.engine.seasonManager;
      const state = sm.getState();
      this.analytics.setSeason(state.current);
      this.renderer.getUIOverlay().seasonLabel = sm.getLabel();
      this.renderer.getUIOverlay().seasonColor = sm.getColor();
      if (this.prevSeason && this.prevSeason !== state.current) {
        const aliveCount = this.engine.entities.filter(e => e.alive).length;
        this.analytics.onSeasonChange(this.prevSeason, state.current, aliveCount);
      }
      this.prevSeason = state.current;
    }

    this.analytics.update(this.engine.entities, this.engine.foods, this.engine.tickCount);
    this.analytics.updateTribes(this.engine.tribeRegistry, this.engine);

    // Extinction detection
    const aliveCount = this.engine.entities.filter(e => e.alive).length;
    if (aliveCount === 0 && this.analytics.totalDeaths > 0) {
      this.triggerExtinction();
      return;
    }

    this.renderer.getUIOverlay().tribeCount = this.engine.tribeRegistry.tribes.size;
    this.renderer.getEffects().tick();
    this.renderer.advanceFoodTick();
    this.renderer.getUIOverlay().tickBanner();
  }

  reset(config?: SimulationConfig): void {
    this.stop();
    this.prevSeason = undefined;
    this.renderer.getEndScreen().hide();
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

  isEndScreenVisible(): boolean {
    return this.renderer.getEndScreen().isVisible();
  }

  onReset(cb: () => void): void {
    this.resetCallbacks.push(cb);
  }

  private triggerExtinction(): void {
    this.stop();

    const a = this.analytics;
    const seasonState = this.engine.seasonManager?.getState() ?? null;

    const data: EndScreenData = {
      totalTicks: this.engine.tickCount,
      seasonState,
      deathCauses: { ...a.deathCauses },
      deathCausePercents: a.getDeathCausePercents(),
      totalDeaths: a.totalDeaths,
      totalBirths: a.totalBirths,
      peakPopulation: a.peakPopulation,
      peakPopulationTick: a.peakPopulationTick,
      hallOfFame: [...a.hallOfFame],
      tribeRanking: [...a.tribeRanking],
      birthsBySeason: { ...a.birthsBySeason },
      starvationsBySeason: { ...a.starvationsBySeason },
      winterSurvivalRate: a.winterSurvivalRate,
      initialGeneAverages: a.initialGeneAverages ? { ...a.initialGeneAverages } : null,
      finalGeneAverages: { ...a.geneAverages },
      finalCarriedGeneAverages: { ...a.carriedGeneAverages },
      geneticDiversity: a.geneticDiversity,
      populationHistory: [...a.fullHistory],
      seasonsEnabled: this.currentConfig.seasonsEnabled,
      tribesEnabled: this.currentConfig.tribesEnabled,
    };

    this.renderer.getEndScreen().show(data, () => this.onNewGame());
    this.renderLoop();
  }

  private renderLoop(): void {
    if (this.running || !this.renderer.getEndScreen().isVisible()) return;
    this.renderer.getEndScreen().tick();
    this.render();
    requestAnimationFrame(() => this.renderLoop());
  }

  private onNewGame(): void {
    this.renderer.getEndScreen().hide();
    this.reset(this.currentConfig);
    for (const cb of this.resetCallbacks) cb();
  }

  private loop(now: number): void {
    if (!this.running) return;

    if (now - this.lastTick >= this.tickInterval) {
      this.engine.tick();
      this.postTick();
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
