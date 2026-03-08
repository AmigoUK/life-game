import { EntityState, FoodState, HexCoord } from './types';
import { HexGrid } from './HexGrid';
import { createEntity, resetEntityIdCounter, resetNamePools, recycleName } from './Entity';
import { createFood, consumeFood, tickFood, resetFoodIdCounter } from './Food';
import { crossover, mutate, crossoverActivation, mutateActivation } from './DNA';
import { SimulationConfig } from './SimulationConfig';
import { EnvironmentEvents } from './EnvironmentEvents';
import { TribeRegistry } from './Tribe';
import { SeasonManager } from './Seasons';

export type DeathCause = 'starvation' | 'age' | 'combat';
export type SimEvent = {
  type: 'death' | 'reproduce' | 'combat';
  pos: HexCoord;
  cause?: DeathCause;
  parentIds?: [number, number];
  entityId?: number;
};

export class SimulationEngine {
  grid: HexGrid;
  entities: EntityState[] = [];
  foods: FoodState[] = [];
  tickCount = 0;
  config: SimulationConfig;
  envEvents = new EnvironmentEvents();
  tribeRegistry = new TribeRegistry();
  tribeKills = new Map<number, number>();
  tribeFoodShared = new Map<number, number>();
  seasonManager: SeasonManager | null = null;
  private eventListeners: ((event: SimEvent) => void)[] = [];
  private bannerCallback: ((text: string) => void) | null = null;

  onEvent(listener: (event: SimEvent) => void): void {
    this.eventListeners.push(listener);
  }

  private emit(event: SimEvent): void {
    for (const l of this.eventListeners) l(event);
  }

  onBanner(cb: (text: string) => void): void {
    this.bannerCallback = cb;
  }

  constructor(config: SimulationConfig) {
    this.config = config;
    this.grid = new HexGrid(config.gridRadius);
    if (config.seasonsEnabled) {
      this.seasonManager = new SeasonManager(config.seasonLength);
    }
    this.init();
  }

  init(): void {
    resetEntityIdCounter();
    resetNamePools();
    resetFoodIdCounter();
    this.entities = [];
    this.foods = [];
    this.tickCount = 0;
    this.envEvents.reset();
    this.tribeRegistry.reset();
    this.seasonManager?.reset();
    this.tribeKills.clear();
    this.tribeFoodShared.clear();

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

    // Season tick
    if (this.config.seasonsEnabled && this.seasonManager) {
      const { changed, state } = this.seasonManager.tick();
      if (changed) {
        this.bannerCallback?.(`${state.current} — Year ${state.year}`);
        if (state.current === 'spring') {
          const springBonus = Math.ceil(cfg.initialFoodCount * 0.25);
          for (let i = 0; i < springBonus; i++) {
            this.foods.push(createFood(this.grid.randomCell(), cfg.foodEnergy));
          }
        }
      }
    }

    // Phase 1: Aging and energy drain
    for (const e of this.entities) {
      if (!e.alive) continue;
      e.age++;
      e.energy -= cfg.energyPerTick * e.decoded.energyEfficiency;
      if (e.energy <= 0 && e.foodStorage > 0) {
        const deficit = -e.energy;
        // Metabolic cost: efficient entities recover more from storage
        const conversionRate = 0.5 + 0.5 * e.decoded.energyEfficiency;
        const storageNeeded = Math.min(deficit / conversionRate, e.foodStorage);
        e.foodStorage -= storageNeeded;
        e.energy += storageNeeded * conversionRate;
      }
      // Metabolic reserve: stored food passively recovers energy each tick
      if (e.foodStorage > 0 && e.energy > 0) {
        const recovery = Math.min(1, e.foodStorage * 0.02) * e.decoded.energyEfficiency;
        e.foodStorage -= recovery;
        e.energy += recovery;
      }
      if (e.age > e.decoded.maxAge || e.energy <= 0) {
        const cause: DeathCause = e.energy <= 0 ? 'starvation' : 'age';
        e.alive = false;
        this.emit({ type: 'death', pos: { ...e.pos }, cause, entityId: e.id });
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

    // Phase 3: Food consumption (with tribe sharing)
    const respawnTicks = this.envEvents.isDroughtActive()
      ? cfg.foodRespawnTicks * 2
      : cfg.foodRespawnTicks;
    for (const e of this.entities) {
      if (!e.alive) continue;
      for (const food of this.foods) {
        if (!food.consumed && HexGrid.equals(e.pos, food.pos)) {
          const gained = consumeFood(food, respawnTicks);

          if (cfg.tribesEnabled && e.tribeId !== null) {
            const shareRatio = e.decoded.cooperation * 0.3;
            const kept = gained * (1 - shareRatio);
            const shared = gained * shareRatio;

            const newKeptEnergy = e.energy + kept;
            if (newKeptEnergy > cfg.maxEnergy) {
              e.energy = cfg.maxEnergy;
              const overflow = newKeptEnergy - cfg.maxEnergy;
              e.foodStorage = Math.min(e.foodStorage + overflow, e.decoded.storageCapacity);
            } else {
              e.energy = newKeptEnergy;
            }

            const tribe = this.tribeRegistry.getTribe(e.id);
            if (tribe && shared > 0) {
              const nearbyMates = this.entities.filter(m =>
                m.alive && m.id !== e.id && tribe.memberIds.has(m.id) &&
                HexGrid.distance(e.pos, m.pos) <= 2
              );
              if (nearbyMates.length > 0) {
                const perMate = shared / nearbyMates.length;
                for (const mate of nearbyMates) {
                  const newMateEnergy = mate.energy + perMate;
                  if (newMateEnergy > cfg.maxEnergy) {
                    mate.energy = cfg.maxEnergy;
                    const overflow = newMateEnergy - cfg.maxEnergy;
                    mate.foodStorage = Math.min(mate.foodStorage + overflow, mate.decoded.storageCapacity);
                  } else {
                    mate.energy = newMateEnergy;
                  }
                }
                this.tribeFoodShared.set(e.tribeId!, (this.tribeFoodShared.get(e.tribeId!) ?? 0) + shared);
              } else {
                const newSharedEnergy = e.energy + shared;
                if (newSharedEnergy > cfg.maxEnergy) {
                  e.energy = cfg.maxEnergy;
                  const overflow = newSharedEnergy - cfg.maxEnergy;
                  e.foodStorage = Math.min(e.foodStorage + overflow, e.decoded.storageCapacity);
                } else {
                  e.energy = newSharedEnergy;
                }
              }
            }
          } else {
            const newEnergy = e.energy + gained;
            if (newEnergy > cfg.maxEnergy) {
              e.energy = cfg.maxEnergy;
              const overflow = newEnergy - cfg.maxEnergy;
              e.foodStorage = Math.min(e.foodStorage + overflow, e.decoded.storageCapacity);
            } else {
              e.energy = newEnergy;
            }
          }
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

        const dist = HexGrid.distance(a.pos, b.pos);

        // Reproduction: adjacent hex (distance <= 1); Combat: same hex only
        if (a.sex !== b.sex) {
          if (dist > 1) continue;
        } else {
          if (dist > 0) continue;
        }

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

    // Phase 4b: Tribe bonding & drift
    if (cfg.tribesEnabled) {
      this.tickTribes();
    }

    // Phase 5: Food respawn (slowed during winter, not frozen)
    const isWinter = this.config.seasonsEnabled && this.seasonManager?.isWinter();
    if (isWinter) {
      // Winter: food respawns at half rate (tick every other tick)
      if (this.tickCount % 2 === 0) {
        for (const food of this.foods) {
          tickFood(food);
        }
      }
    } else {
      for (const food of this.foods) {
        tickFood(food);
      }
    }

    // Dynamic food spawning: prevent food deserts
    const availableFood = this.foods.filter(f => !f.consumed).length;
    const foodThreshold = Math.floor(cfg.initialFoodCount * 0.3);
    if (availableFood < foodThreshold) {
      const toSpawn = Math.min(2, cfg.initialFoodCount - this.foods.length);
      for (let i = 0; i < toSpawn; i++) {
        this.foods.push(createFood(this.grid.randomCell(), cfg.foodEnergy));
      }
    }

    // Emergency food for near-extinct populations
    const aliveCount = this.entities.filter(e => e.alive).length;
    if (aliveCount > 0 && aliveCount < 5 && this.tickCount % 10 === 0) {
      this.foods.push(createFood(this.grid.randomCell(), cfg.foodEnergy));
    }

    // Phase 6: Cleanup dead
    for (const e of this.entities) {
      if (!e.alive) {
        recycleName(e.name, e.sex);
        if (cfg.tribesEnabled && e.tribeId !== null) {
          this.tribeRegistry.removeMember(e);
        }
      }
    }
    this.entities = this.entities.filter(e => e.alive);

    // Phase 7: Environmental events
    if (cfg.environmentalEvents) {
      this.envEvents.tick(
        this.tickCount,
        this.entities,
        this.foods,
        this.grid,
        cfg.foodEnergy,
        (text) => this.bannerCallback?.(text),
      );
    }
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
        // Double-step flee: high fleeSpeed entities escape faster
        if (e.decoded.fleeSpeed >= 0.3) {
          e.pos = this.grid.stepAwayFrom(e.pos, nearest.pos);
        }
      }
      return;
    }

    const wellFed = e.energy > this.config.maxEnergy * 0.7;
    const seekFood = wellFed ? false : (Math.random() < e.decoded.foodAffinity || e.energy < 30);

    if (seekFood) {
      const nearbyFood = this.foods.filter(f =>
        !f.consumed && visibleCells.some(c => HexGrid.equals(c, f.pos))
      );
      if (nearbyFood.length > 0) {
        let target: HexCoord;
        // High vision entities use food-density scan for smarter foraging
        if (e.decoded.visionRange >= 3 && nearbyFood.length > 1) {
          const neighbors = this.grid.neighbors(e.pos);
          let bestDir = nearbyFood[0].pos;
          let bestScore = -1;
          for (const n of neighbors) {
            let score = 0;
            for (const f of nearbyFood) {
              if (HexGrid.distance(n, f.pos) < HexGrid.distance(e.pos, f.pos)) score++;
            }
            if (score > bestScore) { bestScore = score; bestDir = n; }
          }
          target = bestDir;
        } else {
          const closest = nearbyFood.reduce((best, f) =>
            HexGrid.distance(e.pos, f.pos) < HexGrid.distance(e.pos, best.pos) ? f : best
          );
          target = closest.pos;
        }
        // Direction accuracy: low directionBias may stumble
        if (Math.random() > e.decoded.directionBias * 0.5 + 0.5) {
          e.pos = this.grid.randomNeighborOrStay(e.pos);
        } else {
          e.pos = this.grid.stepToward(e.pos, target);
        }
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
        // Direction accuracy for mate-seeking too
        if (Math.random() > e.decoded.directionBias * 0.5 + 0.5) {
          e.pos = this.grid.randomNeighborOrStay(e.pos);
        } else {
          e.pos = this.grid.stepToward(e.pos, closest.pos);
        }
        return;
      }
    }

    // Social cohesion: move toward tribe centroid
    if (this.config.tribesEnabled && e.tribeId !== null) {
      const tribe = this.tribeRegistry.getTribe(e.id);
      if (tribe && tribe.memberIds.size > 1) {
        let cq = 0, cr = 0, cs = 0, count = 0;
        for (const mId of tribe.memberIds) {
          if (mId === e.id) continue;
          const mate = this.entities.find(en => en.id === mId && en.alive);
          if (mate) {
            cq += mate.pos.q; cr += mate.pos.r; cs += mate.pos.s;
            count++;
          }
        }
        if (count > 0) {
          const centroid: HexCoord = {
            q: Math.round(cq / count),
            r: Math.round(cr / count),
            s: Math.round(cs / count),
          };
          // Fix rounding: q+r+s must equal 0
          const rq = cq / count, rr = cr / count, rs = cs / count;
          const dq = Math.abs(centroid.q - rq);
          const dr = Math.abs(centroid.r - rr);
          const ds = Math.abs(centroid.s - rs);
          if (dq > dr && dq > ds) centroid.q = -centroid.r - centroid.s;
          else if (dr > ds) centroid.r = -centroid.q - centroid.s;
          else centroid.s = -centroid.q - centroid.r;

          if (HexGrid.distance(e.pos, centroid) > 1 && Math.random() < e.decoded.cooperation * 0.4) {
            e.pos = this.grid.stepToward(e.pos, centroid);
            return;
          }
        }
      }
    }

    if (Math.random() > e.decoded.directionBias) {
      e.pos = this.grid.randomNeighborOrStay(e.pos);
    }
  }

  private tryReproduce(a: EntityState, b: EntityState): void {
    const cfg = this.config;

    // Gestation cooldown: female must wait N ticks between births
    const female = a.sex === 'F' ? a : b;
    if (female.lastBirthTick >= 0 && this.tickCount - female.lastBirthTick < cfg.gestationCooldown) return;

    const costA = cfg.reproductionEnergyCost * (1 - a.decoded.fertilityBonus);
    const costB = cfg.reproductionEnergyCost * (1 - b.decoded.fertilityBonus);

    if (a.energy < costA || b.energy < costB) return;

    a.energy -= costA;
    b.energy -= costB;

    const { child: childDnaRaw, crossoverPoint } = crossover(a.dna, b.dna);
    const childDna = mutate(childDnaRaw, a.decoded.mutationResist, b.decoded.mutationResist, cfg.mutationChance, cfg.mutationAmount);

    // Inherit activation pattern using same crossover point, then mutate
    let childActivation = crossoverActivation(a.geneActive, b.geneActive, crossoverPoint);
    childActivation = mutateActivation(childActivation);

    const childSex = Math.random() < 0.5 ? 'M' as const : 'F' as const;
    const childGen = Math.max(a.generation, b.generation) + 1;

    const child = createEntity(
      { ...a.pos },
      childSex,
      childDna,
      childGen,
      cfg.childEnergy,
      cfg.initialEnergy,
      undefined,
      childActivation,
    );

    this.entities.push(child);
    this.emit({ type: 'reproduce', pos: { ...a.pos }, parentIds: [a.id, b.id] });

    female.lastBirthTick = this.tickCount;
  }

  private handleSameSexEncounter(a: EntityState, b: EntityState): void {
    const aFights = a.decoded.aggression > 0.5;
    const bFights = b.decoded.aggression > 0.5;

    if (!aFights && !bFights) return;

    if (aFights && !bFights) {
      if (this.config.tribesEnabled && this.hasTribalDefense(b)) {
        // Stand ground — escalate to combat
        this.emit({ type: 'combat', pos: { ...a.pos } });
        this.resolveCombat(a, b);
        return;
      }
      b.pos = this.grid.stepAwayFrom(b.pos, a.pos);
      return;
    }
    if (!aFights && bFights) {
      if (this.config.tribesEnabled && this.hasTribalDefense(a)) {
        this.emit({ type: 'combat', pos: { ...a.pos } });
        this.resolveCombat(a, b);
        return;
      }
      a.pos = this.grid.stepAwayFrom(a.pos, b.pos);
      return;
    }

    this.emit({ type: 'combat', pos: { ...a.pos } });
    this.resolveCombat(a, b);
  }

  private resolveCombat(a: EntityState, b: EntityState): void {
    let aAttack = a.decoded.attack;
    let bAttack = b.decoded.attack;

    if (this.config.tribesEnabled) {
      aAttack += this.getAllyBonus(a);
      bAttack += this.getAllyBonus(b);
    }

    const aDmg = aAttack * Math.random();
    const bDef = b.decoded.defense * Math.random();
    const aNet = Math.max(0, aDmg - bDef);

    const bDmg = bAttack * Math.random();
    const aDef = a.decoded.defense * Math.random();
    const bNet = Math.max(0, bDmg - aDef);

    b.hp -= aNet;
    a.hp -= bNet;

    if (a.hp <= 0) {
      a.alive = false;
      this.emit({ type: 'death', pos: { ...a.pos }, cause: 'combat', entityId: a.id });
      if (b.tribeId !== null) {
        this.tribeKills.set(b.tribeId, (this.tribeKills.get(b.tribeId) ?? 0) + 1);
      }
    }
    if (b.hp <= 0) {
      b.alive = false;
      this.emit({ type: 'death', pos: { ...b.pos }, cause: 'combat', entityId: b.id });
      if (a.tribeId !== null) {
        this.tribeKills.set(a.tribeId, (this.tribeKills.get(a.tribeId) ?? 0) + 1);
      }
    }
  }

  private tickTribes(): void {
    const alive = this.entities.filter(e => e.alive);
    const maxSize = this.config.maxTribeSize;

    // Tribe bonding
    for (const e of alive) {
      if (e.tribeId !== null) continue;
      if (e.decoded.cooperation <= 0.4) continue;

      const neighbors = alive.filter(n =>
        n.id !== e.id && n.decoded.cooperation > 0.4 &&
        HexGrid.distance(e.pos, n.pos) <= 1
      );

      for (const n of neighbors) {
        if (n.tribeId !== null) {
          const tribe = this.tribeRegistry.tribes.get(n.tribeId);
          if (tribe && tribe.memberIds.size < maxSize) {
            this.tribeRegistry.joinTribe(e, n.tribeId);
            break;
          }
        } else {
          this.tribeRegistry.formTribe(e, n);
          break;
        }
      }
    }

    // Tribe drift: dissolve if all members > 3 hexes from every other
    for (const [, tribe] of this.tribeRegistry.tribes) {
      const members = [...tribe.memberIds]
        .map(id => alive.find(e => e.id === id))
        .filter((e): e is EntityState => e !== undefined);

      if (members.length < 2) continue;

      let allFar = true;
      outer: for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          if (HexGrid.distance(members[i].pos, members[j].pos) <= 3) {
            allFar = false;
            break outer;
          }
        }
      }
      if (allFar) {
        for (const m of members) {
          this.tribeRegistry.removeMember(m);
        }
      }
    }

    // Voluntary leave: low cooperation entities may leave
    for (const e of alive) {
      if (e.tribeId === null) continue;
      if (e.decoded.cooperation < 0.25 && Math.random() < 0.05) {
        this.tribeRegistry.removeMember(e);
      }
    }
  }

  private hasTribalDefense(e: EntityState): boolean {
    if (e.tribeId === null) return false;
    const tribe = this.tribeRegistry.getTribe(e.id);
    if (!tribe) return false;
    const nearbyMates = this.entities.filter(m =>
      m.alive && m.id !== e.id && tribe.memberIds.has(m.id) &&
      HexGrid.distance(e.pos, m.pos) <= e.decoded.visionRange
    );
    return nearbyMates.length >= 2;
  }

  private getAllyBonus(e: EntityState): number {
    if (e.tribeId === null) return 0;
    const tribe = this.tribeRegistry.getTribe(e.id);
    if (!tribe) return 0;
    let bonus = 0;
    for (const mId of tribe.memberIds) {
      if (mId === e.id) continue;
      const ally = this.entities.find(en => en.id === mId && en.alive);
      if (ally && HexGrid.distance(e.pos, ally.pos) <= ally.decoded.visionRange) {
        bonus += ally.decoded.attack * 0.3 * ally.decoded.cooperation;
      }
    }
    return bonus;
  }
}
