import { EntityState, Sex } from './types';
import { SimEvent, SimulationEngine } from './SimulationEngine';
import { TribeRegistry } from './Tribe';
import { Season } from './Seasons';
import { decodeDNA } from './DNA';

export interface TickSnapshot {
  total: number;
  males: number;
  females: number;
  births: number;
  deaths: number;
  avgEnergy: number;
  season?: Season;
}

export interface DeathStats {
  starvation: number;
  age: number;
  combat: number;
}

export interface GeneAverages {
  maxAge: number;
  speed: number;
  directionBias: number;
  visionRange: number;
  attack: number;
  defense: number;
  maxHP: number;
  aggression: number;
  foodAffinity: number;
  fleeSpeed: number;
  energyEfficiency: number;
  fertilityBonus: number;
  mutationResist: number;
  cooperation: number;
  storageCapacity: number;
}

export interface EntityRecord {
  id: number;
  name: string;
  sex: Sex;
  generation: number;
  age: number;
  children: number;
  score: number;
  dna: number[];
  alive: boolean;
}

export interface TribeRankEntry {
  id: number;
  name: string;
  color: string;
  members: number;
  kills: number;
  foodShared: number;
  score: number;
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

  // Peak tracking & end screen data
  peakPopulation = 0;
  peakPopulationTick = 0;
  totalBirths = 0;
  initialGeneAverages: GeneAverages | null = null;
  fullHistory: TickSnapshot[] = [];

  // Current snapshot data
  currentSnapshot: TickSnapshot = { total: 0, males: 0, females: 0, births: 0, deaths: 0, avgEnergy: 0 };
  geneAverages: GeneAverages = { maxAge: 0, speed: 0, directionBias: 0, visionRange: 0, attack: 0, defense: 0, maxHP: 0, aggression: 0, foodAffinity: 0, fleeSpeed: 0, energyEfficiency: 0, fertilityBonus: 0, mutationResist: 0, cooperation: 0, storageCapacity: 0 };
  carriedGeneAverages: GeneAverages = { maxAge: 0, speed: 0, directionBias: 0, visionRange: 0, attack: 0, defense: 0, maxHP: 0, aggression: 0, foodAffinity: 0, fleeSpeed: 0, energyEfficiency: 0, fertilityBonus: 0, mutationResist: 0, cooperation: 0, storageCapacity: 0 };
  initialCarriedGeneAverages: GeneAverages | null = null;
  tribeCount = 0;
  avgTribeSize = 0;
  geneticDiversity = 0;
  hungryPercent = 0;
  minEnergy = 0;
  maxEnergy = 0;
  avgGeneration = 0;
  foodAvailable = 0;
  foodConsumed = 0;

  // Hall of Fame
  childrenCount = new Map<number, number>();
  private entityRecords = new Map<number, EntityRecord>();
  hallOfFame: EntityRecord[] = [];

  // Tribe ranking
  tribeRanking: TribeRankEntry[] = [];

  // Seasonal stats
  birthsBySeason: Record<Season, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };
  starvationsBySeason: Record<Season, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };
  winterStartPop = 0;
  winterSurvivalRate = 0;
  avgFoodStorage = 0;
  private currentSeason: Season | undefined;

  handleEvent(event: SimEvent, season?: Season): void {
    if (event.type === 'reproduce') {
      this.birthsThisTick++;
      this.totalBirths++;
      if (event.parentIds) {
        for (const pid of event.parentIds) {
          this.childrenCount.set(pid, (this.childrenCount.get(pid) ?? 0) + 1);
        }
      }
      if (season) this.birthsBySeason[season]++;
    } else if (event.type === 'death' && event.cause) {
      this.deathsThisTick++;
      this.totalDeaths++;
      this.deathCauses[event.cause]++;
      if (season && event.cause === 'starvation') {
        this.starvationsBySeason[season]++;
      }
    }
  }

  onSeasonChange(from: Season, to: Season, aliveCount: number): void {
    if (to === 'winter') {
      this.winterStartPop = aliveCount;
    } else if (from === 'winter' && this.winterStartPop > 0) {
      this.winterSurvivalRate = Math.round((aliveCount / this.winterStartPop) * 100);
    }
  }

  setSeason(season: Season | undefined): void {
    this.currentSeason = season;
  }

  update(entities: EntityState[], foods: { consumed: boolean }[], tick: number): void {
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

    // Peak population tracking
    if (alive.length > this.peakPopulation) {
      this.peakPopulation = alive.length;
      this.peakPopulationTick = tick;
    }

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
      const sum: GeneAverages = { maxAge: 0, speed: 0, directionBias: 0, visionRange: 0, attack: 0, defense: 0, maxHP: 0, aggression: 0, foodAffinity: 0, fleeSpeed: 0, energyEfficiency: 0, fertilityBonus: 0, mutationResist: 0, cooperation: 0, storageCapacity: 0 };
      const sumSq: GeneAverages = { maxAge: 0, speed: 0, directionBias: 0, visionRange: 0, attack: 0, defense: 0, maxHP: 0, aggression: 0, foodAffinity: 0, fleeSpeed: 0, energyEfficiency: 0, fertilityBonus: 0, mutationResist: 0, cooperation: 0, storageCapacity: 0 };
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
      this.geneticDiversity = Math.sqrt(totalVariance / Object.keys(sum).length);

      // Capture initial gene averages on first call with alive entities
      if (this.initialGeneAverages === null) {
        this.initialGeneAverages = { ...this.geneAverages };
      }

      // Carried gene averages (true genetic values, ignoring activation)
      const carriedSum: GeneAverages = { maxAge: 0, speed: 0, directionBias: 0, visionRange: 0, attack: 0, defense: 0, maxHP: 0, aggression: 0, foodAffinity: 0, fleeSpeed: 0, energyEfficiency: 0, fertilityBonus: 0, mutationResist: 0, cooperation: 0, storageCapacity: 0 };
      for (const e of alive) {
        const carried = decodeDNA(e.dna);
        for (const key of Object.keys(carriedSum) as (keyof GeneAverages)[]) {
          carriedSum[key] += carried[key] as number;
        }
      }
      for (const key of Object.keys(carriedSum) as (keyof GeneAverages)[]) {
        this.carriedGeneAverages[key] = carriedSum[key] / n;
      }
      if (this.initialCarriedGeneAverages === null) {
        this.initialCarriedGeneAverages = { ...this.carriedGeneAverages };
      }
    }

    // Generation
    this.avgGeneration = alive.length > 0
      ? alive.reduce((s, e) => s + e.generation, 0) / alive.length
      : 0;

    // Food
    this.foodAvailable = foods.filter(f => !f.consumed).length;
    this.foodConsumed = foods.filter(f => f.consumed).length;

    // Food storage
    this.avgFoodStorage = alive.length > 0
      ? alive.reduce((s, e) => s + e.foodStorage, 0) / alive.length
      : 0;

    // Hall of Fame: update records for alive entities
    for (const e of alive) {
      const children = this.childrenCount.get(e.id) ?? 0;
      this.entityRecords.set(e.id, {
        id: e.id,
        name: e.name,
        sex: e.sex,
        generation: e.generation,
        age: e.age,
        children,
        score: e.age + children * 50,
        dna: e.dna,
        alive: true,
      });
    }

    // Mark dead entities
    const aliveIds = new Set(alive.map(e => e.id));
    for (const [id, record] of this.entityRecords) {
      if (!aliveIds.has(id)) {
        record.alive = false;
      }
    }

    // Extract full ranking (up to 50)
    const allRecords = [...this.entityRecords.values()];
    allRecords.sort((a, b) => b.score - a.score);
    this.hallOfFame = allRecords.slice(0, 50);

    // Prune: keep top 50 + all alive
    if (this.entityRecords.size > 100) {
      const keepIds = new Set<number>();
      for (const r of allRecords.slice(0, 50)) keepIds.add(r.id);
      for (const id of aliveIds) keepIds.add(id);
      for (const id of this.entityRecords.keys()) {
        if (!keepIds.has(id)) this.entityRecords.delete(id);
      }
    }

    // Push to history (include season)
    this.currentSnapshot.season = this.currentSeason;
    this.history.push({ ...this.currentSnapshot });

    // Sample to fullHistory every 10 ticks for end screen timeline
    if (tick % 10 === 0) {
      this.fullHistory.push({ ...this.currentSnapshot });
    }
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

  updateTribes(registry: TribeRegistry, engine?: SimulationEngine): void {
    this.tribeCount = registry.tribes.size;
    if (this.tribeCount > 0) {
      let totalSize = 0;
      for (const [, tribe] of registry.tribes) {
        totalSize += tribe.memberIds.size;
      }
      this.avgTribeSize = totalSize / this.tribeCount;
    } else {
      this.avgTribeSize = 0;
    }

    // Build tribe ranking
    if (this.tribeCount > 0) {
      const entries: TribeRankEntry[] = [];
      for (const [id, tribe] of registry.tribes) {
        const kills = engine?.tribeKills.get(id) ?? 0;
        const foodShared = engine?.tribeFoodShared.get(id) ?? 0;
        entries.push({
          id,
          name: tribe.name,
          color: tribe.color,
          members: tribe.memberIds.size,
          kills,
          foodShared: Math.round(foodShared),
          score: tribe.memberIds.size + kills * 10,
        });
      }
      entries.sort((a, b) => b.score - a.score);
      this.tribeRanking = entries;
    } else {
      this.tribeRanking = [];
    }
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
    this.peakPopulation = 0;
    this.peakPopulationTick = 0;
    this.totalBirths = 0;
    this.initialGeneAverages = null;
    this.initialCarriedGeneAverages = null;
    this.fullHistory = [];
    this.childrenCount.clear();
    this.entityRecords.clear();
    this.hallOfFame = [];
    this.tribeRanking = [];
    this.birthsBySeason = { spring: 0, summer: 0, autumn: 0, winter: 0 };
    this.starvationsBySeason = { spring: 0, summer: 0, autumn: 0, winter: 0 };
    this.winterStartPop = 0;
    this.winterSurvivalRate = 0;
    this.avgFoodStorage = 0;
    this.currentSeason = undefined;
  }
}
