import { FoodState, HexCoord } from './types';

let nextFoodId = 1;

export function createFood(pos: HexCoord, energy: number): FoodState {
  return {
    id: nextFoodId++,
    pos,
    energy,
    respawnTimer: 0,
    maxRespawnTimer: 0,
    consumed: false,
  };
}

export function consumeFood(food: FoodState, respawnTicks: number): number {
  food.consumed = true;
  food.respawnTimer = respawnTicks;
  food.maxRespawnTimer = respawnTicks;
  return food.energy;
}

export function tickFood(food: FoodState): void {
  if (food.consumed) {
    food.respawnTimer--;
    if (food.respawnTimer <= 0) {
      food.consumed = false;
    }
  }
}

export function resetFoodIdCounter(): void {
  nextFoodId = 1;
}
