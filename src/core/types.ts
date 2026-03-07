export interface HexCoord {
  q: number;
  r: number;
  s: number;
}

export type Sex = 'M' | 'F';

export interface DecodedDNA {
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
  hue: number;
  size: number;
}

export interface EntityState {
  id: number;
  sex: Sex;
  pos: HexCoord;
  dna: number[];
  decoded: DecodedDNA;
  age: number;
  energy: number;
  hp: number;
  generation: number;
  alive: boolean;
}

export interface FoodState {
  id: number;
  pos: HexCoord;
  energy: number;
  respawnTimer: number;
  maxRespawnTimer: number;
  consumed: boolean;
}

export interface SimulationState {
  tick: number;
  entities: EntityState[];
  foods: FoodState[];
  gridRadius: number;
}
