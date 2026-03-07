import { EntityState, FoodState } from './types';
import { createFood } from './Food';
import { HexGrid } from './HexGrid';

export type EventType = 'drought' | 'food_boom' | 'plague';

export interface ActiveEvent {
  type: EventType;
  remaining: number;
  label: string;
}

export class EnvironmentEvents {
  private activeEvents: ActiveEvent[] = [];
  private ticksSinceLastEvent = 0;

  getActiveEvents(): ActiveEvent[] {
    return this.activeEvents;
  }

  tick(
    _tickCount: number,
    entities: EntityState[],
    foods: FoodState[],
    grid: HexGrid,
    foodEnergy: number,
    onBanner: (text: string) => void,
  ): void {
    this.ticksSinceLastEvent++;

    // Try to trigger new events
    if (this.ticksSinceLastEvent > 300 && this.activeEvents.length === 0) {
      const roll = Math.random();
      if (roll < 0.002) {
        this.startEvent('drought', 100, 'Drought! Food respawns slower', onBanner);
      } else if (roll < 0.004) {
        this.startEvent('food_boom', 80, 'Food Boom! Extra food appears', onBanner);
        this.spawnExtraFood(foods, grid, foodEnergy, 20);
      } else if (roll < 0.005) {
        this.startEvent('plague', 1, 'Plague! All entities lose 15 HP', onBanner);
        this.applyPlague(entities);
      }
    }

    // Tick active events
    for (const evt of this.activeEvents) {
      evt.remaining--;
      if (evt.type === 'food_boom' && evt.remaining % 20 === 0 && evt.remaining > 0) {
        this.spawnExtraFood(foods, grid, foodEnergy, 5);
      }
    }
    this.activeEvents = this.activeEvents.filter(e => e.remaining > 0);
  }

  isDroughtActive(): boolean {
    return this.activeEvents.some(e => e.type === 'drought');
  }

  reset(): void {
    this.activeEvents = [];
    this.ticksSinceLastEvent = 0;
  }

  private startEvent(type: EventType, duration: number, label: string, onBanner: (text: string) => void): void {
    this.activeEvents.push({ type, remaining: duration, label });
    this.ticksSinceLastEvent = 0;
    onBanner(label);
  }

  private spawnExtraFood(foods: FoodState[], grid: HexGrid, energy: number, count: number): void {
    for (let i = 0; i < count; i++) {
      foods.push(createFood(grid.randomCell(), energy));
    }
  }

  private applyPlague(entities: EntityState[]): void {
    for (const e of entities) {
      if (!e.alive) continue;
      e.hp -= 15;
      if (e.hp <= 0) {
        e.alive = false;
      }
    }
  }
}
