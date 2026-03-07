import { EntityState, FoodState, HexCoord } from './types';
import { HexGrid } from './HexGrid';
import { createEntity, resetEntityIdCounter } from './Entity';
import { createFood, consumeFood, tickFood, resetFoodIdCounter } from './Food';
import { crossover, mutate } from './DNA';
import { SimulationConfig } from './SimulationConfig';

export type DeathCause = 'starvation' | 'age' | 'combat';
export type SimEvent = { type: 'death' | 'reproduce' | 'combat'; pos: HexCoord; cause?: DeathCause };

export class SimulationEngine {
  grid: HexGrid;
  entities: EntityState[] = [];
  foods: FoodState[] = [];
  tickCount = 0;
  config: SimulationConfig;
  private eventListeners: ((event: SimEvent) => void)[] = [];

  onEvent(listener: (event: SimEvent) => void): void {
    this.eventListeners.push(listener);
  }

  private emit(event: SimEvent): void {
    for (const l of this.eventListeners) l(event);
  }

  constructor(config: SimulationConfig) {
    this.config = config;
    this.grid = new HexGrid(config.gridRadius);
    this.init();
  }

  init(): void {
    resetEntityIdCounter();
    resetFoodIdCounter();
    this.entities = [];
    this.foods = [];
    this.tickCount = 0;

    for (let i = 0; i < this.config.initialPopulation; i++) {
      const sex = i % 2 === 0 ? 'M' as const : 'F' as const;
      this.entities.push(
        createEntity(this.grid.randomCell(), sex, undefined, 0, undefined, this.config.initialEnergy, this.config.aggressionBias)
      );
    }

    for (let i = 0; i < this.config.initialFoodCount; i++) {
      this.foods.push(createFood(this.grid.randomCell(), this.config.foodEnergy));
    }
  }

  tick(): void {
    this.tickCount++;
    const cfg = this.config;

    // Phase 1: Aging and energy drain
    for (const e of this.entities) {
      if (!e.alive) continue;
      e.age++;
      e.energy -= cfg.energyPerTick * e.decoded.energyEfficiency;
      if (e.age > e.decoded.maxAge || e.energy <= 0) {
        const cause: DeathCause = e.energy <= 0 ? 'starvation' : 'age';
        e.alive = false;
        this.emit({ type: 'death', pos: { ...e.pos }, cause });
      }
    }

    // Phase 2: Decision and movement
    for (const e of this.entities) {
      if (!e.alive) continue;
      const speed = Math.min(e.decoded.speed, cfg.maxSpeed);
      let moveProb = speed;
      if (cfg.hungerSlowdown && e.energy < 30) {
        moveProb *= 0.5;
      }
      if (Math.random() > moveProb) continue;
      this.moveEntity(e);
    }

    // Phase 3: Food consumption
    for (const e of this.entities) {
      if (!e.alive) continue;
      for (const food of this.foods) {
        if (!food.consumed && HexGrid.equals(e.pos, food.pos)) {
          e.energy += consumeFood(food, cfg.foodRespawnTicks);
          e.energy = Math.min(e.energy, cfg.maxEnergy);
          break;
        }
      }
    }

    // Phase 4: Interactions on same hex
    const alive = this.entities.filter(e => e.alive);
    const checked = new Set<string>();

    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i];
        const b = alive[j];
        if (!a.alive || !b.alive) continue;
        if (!HexGrid.equals(a.pos, b.pos)) continue;

        const pairKey = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);

        if (a.sex !== b.sex) {
          this.tryReproduce(a, b);
        } else {
          this.handleSameSexEncounter(a, b);
        }
      }
    }

    // Phase 5: Food respawn
    for (const food of this.foods) {
      tickFood(food);
    }

    // Phase 6: Cleanup dead
    this.entities = this.entities.filter(e => e.alive);
  }

  private moveEntity(e: EntityState): void {
    const vision = e.decoded.visionRange;
    const visibleCells = this.grid.hexInRange(e.pos, vision);

    const threats = this.entities.filter(other =>
      other.alive && other.id !== e.id && other.sex === e.sex &&
      other.decoded.aggression > 0.5 &&
      HexGrid.distance(e.pos, other.pos) <= vision
    );

    if (threats.length > 0 && e.decoded.aggression < 0.5) {
      const nearest = threats.reduce((best, t) =>
        HexGrid.distance(e.pos, t.pos) < HexGrid.distance(e.pos, best.pos) ? t : best
      );
      const fleeChance = e.decoded.speed + e.decoded.fleeSpeed;
      if (Math.random() < fleeChance) {
        e.pos = this.grid.stepAwayFrom(e.pos, nearest.pos);
      }
      return;
    }

    const seekFood = Math.random() < e.decoded.foodAffinity || e.energy < 30;

    if (seekFood) {
      const nearbyFood = this.foods.filter(f =>
        !f.consumed && visibleCells.some(c => HexGrid.equals(c, f.pos))
      );
      if (nearbyFood.length > 0) {
        const closest = nearbyFood.reduce((best, f) =>
          HexGrid.distance(e.pos, f.pos) < HexGrid.distance(e.pos, best.pos) ? f : best
        );
        e.pos = this.grid.stepToward(e.pos, closest.pos);
        return;
      }
    } else {
      const partners = this.entities.filter(other =>
        other.alive && other.id !== e.id && other.sex !== e.sex &&
        HexGrid.distance(e.pos, other.pos) <= vision
      );
      if (partners.length > 0) {
        const closest = partners.reduce((best, p) =>
          HexGrid.distance(e.pos, p.pos) < HexGrid.distance(e.pos, best.pos) ? p : best
        );
        e.pos = this.grid.stepToward(e.pos, closest.pos);
        return;
      }
    }

    if (Math.random() > e.decoded.directionBias) {
      e.pos = this.grid.randomNeighborOrStay(e.pos);
    }
  }

  private tryReproduce(a: EntityState, b: EntityState): void {
    const cfg = this.config;
    const costA = cfg.reproductionEnergyCost * (1 - a.decoded.fertilityBonus);
    const costB = cfg.reproductionEnergyCost * (1 - b.decoded.fertilityBonus);

    if (a.energy < costA || b.energy < costB) return;

    a.energy -= costA;
    b.energy -= costB;

    let childDna = crossover(a.dna, b.dna);
    childDna = mutate(childDna, a.decoded.mutationResist, b.decoded.mutationResist, cfg.mutationChance, cfg.mutationAmount);

    const childSex = Math.random() < 0.5 ? 'M' as const : 'F' as const;
    const childGen = Math.max(a.generation, b.generation) + 1;

    const child = createEntity(
      { ...a.pos },
      childSex,
      childDna,
      childGen,
      cfg.childEnergy,
      cfg.initialEnergy,
    );

    this.entities.push(child);
    this.emit({ type: 'reproduce', pos: { ...a.pos } });
  }

  private handleSameSexEncounter(a: EntityState, b: EntityState): void {
    const aFights = a.decoded.aggression > 0.5;
    const bFights = b.decoded.aggression > 0.5;

    if (!aFights && !bFights) return;

    if (aFights && !bFights) {
      b.pos = this.grid.stepAwayFrom(b.pos, a.pos);
      return;
    }
    if (!aFights && bFights) {
      a.pos = this.grid.stepAwayFrom(a.pos, b.pos);
      return;
    }

    this.emit({ type: 'combat', pos: { ...a.pos } });
    this.resolveCombat(a, b);
  }

  private resolveCombat(a: EntityState, b: EntityState): void {
    const aDmg = a.decoded.attack * Math.random();
    const bDef = b.decoded.defense * Math.random();
    const aNet = Math.max(0, aDmg - bDef);

    const bDmg = b.decoded.attack * Math.random();
    const aDef = a.decoded.defense * Math.random();
    const bNet = Math.max(0, bDmg - aDef);

    b.hp -= aNet;
    a.hp -= bNet;

    if (a.hp <= 0) { a.alive = false; this.emit({ type: 'death', pos: { ...a.pos }, cause: 'combat' }); }
    if (b.hp <= 0) { b.alive = false; this.emit({ type: 'death', pos: { ...b.pos }, cause: 'combat' }); }
  }
}
