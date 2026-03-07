import { EntityState } from './types';
import { SimEvent } from './SimulationEngine';

export interface TickSnapshot {
  total: number;
  males: number;
  females: number;
  births: number;
  deaths: number;
  avgEnergy: number;
}

export interface DeathStats {
  starvation: number;
  age: number;
  combat: number;
}

export interface GeneAverages {
  speed: number;
  aggression: number;
  visionRange: number;
  attack: number;
  defense: number;
}

export class Analytics {
  private history: TickSnapshot[] = [];
  private readonly maxHistory = 200;

  // Per-tick counters (reset each tick)
  private birthsThisTick = 0;
  private deathsThisTick = 0;

  // Cumulative death causes
  deathCauses: DeathStats = { starvation: 0, age: 0, combat: 0 };
  totalDeaths = 0;

  // Current snapshot data
  currentSnapshot: TickSnapshot = { total: 0, males: 0, females: 0, births: 0, deaths: 0, avgEnergy: 0 };
  geneAverages: GeneAverages = { speed: 0, aggression: 0, visionRange: 0, attack: 0, defense: 0 };
  geneticDiversity = 0;
  hungryPercent = 0;
  minEnergy = 0;
  maxEnergy = 0;
  avgGeneration = 0;
  foodAvailable = 0;
  foodConsumed = 0;

  handleEvent(event: SimEvent): void {
    if (event.type === 'reproduce') {
      this.birthsThisTick++;
    } else if (event.type === 'death' && event.cause) {
      this.deathsThisTick++;
      this.totalDeaths++;
      this.deathCauses[event.cause]++;
    }
  }

  update(entities: EntityState[], foods: { consumed: boolean }[]): void {
    const alive = entities.filter(e => e.alive);
    const males = alive.filter(e => e.sex === 'M').length;
    const females = alive.filter(e => e.sex === 'F').length;

    const avgEnergy = alive.length > 0
      ? alive.reduce((s, e) => s + e.energy, 0) / alive.length
      : 0;

    this.currentSnapshot = {
      total: alive.length,
      males,
      females,
      births: this.birthsThisTick,
      deaths: this.deathsThisTick,
      avgEnergy,
    };

    // Energy stats
    if (alive.length > 0) {
      this.minEnergy = alive.reduce((m, e) => Math.min(m, e.energy), Infinity);
      this.maxEnergy = alive.reduce((m, e) => Math.max(m, e.energy), 0);
      this.hungryPercent = alive.filter(e => e.energy < 30).length / alive.length * 100;
    } else {
      this.minEnergy = 0;
      this.maxEnergy = 0;
      this.hungryPercent = 0;
    }

    // Gene averages
    if (alive.length > 0) {
      const sum = { speed: 0, aggression: 0, visionRange: 0, attack: 0, defense: 0 };
      const sumSq = { speed: 0, aggression: 0, visionRange: 0, attack: 0, defense: 0 };
      for (const e of alive) {
        for (const key of Object.keys(sum) as (keyof GeneAverages)[]) {
          const val = e.decoded[key] as number;
          sum[key] += val;
          sumSq[key] += val * val;
        }
      }
      const n = alive.length;
      let totalVariance = 0;
      for (const key of Object.keys(sum) as (keyof GeneAverages)[]) {
        this.geneAverages[key] = sum[key] / n;
        const variance = sumSq[key] / n - (sum[key] / n) ** 2;
        totalVariance += variance;
      }
      this.geneticDiversity = Math.sqrt(totalVariance / 5);
    }

    // Generation
    this.avgGeneration = alive.length > 0
      ? alive.reduce((s, e) => s + e.generation, 0) / alive.length
      : 0;

    // Food
    this.foodAvailable = foods.filter(f => !f.consumed).length;
    this.foodConsumed = foods.filter(f => f.consumed).length;

    // Push to history
    this.history.push({ ...this.currentSnapshot });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Reset per-tick counters
    this.birthsThisTick = 0;
    this.deathsThisTick = 0;
  }

  getHistory(): TickSnapshot[] {
    return this.history;
  }

  getDeathCausePercents(): { starvation: number; age: number; combat: number } {
    const t = this.totalDeaths || 1;
    return {
      starvation: Math.round(this.deathCauses.starvation / t * 100),
      age: Math.round(this.deathCauses.age / t * 100),
      combat: Math.round(this.deathCauses.combat / t * 100),
    };
  }

  reset(): void {
    this.history = [];
    this.birthsThisTick = 0;
    this.deathsThisTick = 0;
    this.deathCauses = { starvation: 0, age: 0, combat: 0 };
    this.totalDeaths = 0;
  }
}
