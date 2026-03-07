import { FoodState, HexCoord } from './types';
import { FOOD_ENERGY, FOOD_RESPAWN_TICKS } from './constants';

let nextFoodId = 1;

export function createFood(pos: HexCoord): FoodState {
  return {
    id: nextFoodId++,
    pos,
    energy: FOOD_ENERGY,
    respawnTimer: 0,
    consumed: false,
  };
}

export function consumeFood(food: FoodState): number {
  food.consumed = true;
  food.respawnTimer = FOOD_RESPAWN_TICKS;
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
