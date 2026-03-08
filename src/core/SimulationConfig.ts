export interface SimulationConfig {
  gridRadius: number;
  initialPopulation: number;
  initialFoodCount: number;
  foodEnergy: number;
  foodRespawnTicks: number;
  energyPerTick: number;
  reproductionEnergyCost: number;
  initialEnergy: number;
  childEnergy: number;
  mutationChance: number;
  mutationAmount: number;
  maxEnergy: number;
  maxSpeed: number;
  hungerSlowdown: boolean;
  environmentalEvents: boolean;
  tribesEnabled: boolean;
  maxTribeSize: number;
  aggressionBias?: [number, number];
}

export const DEFAULT_CONFIG: SimulationConfig = {
  gridRadius: 12,
  initialPopulation: 30,
  initialFoodCount: 40,
  foodEnergy: 30,
  foodRespawnTicks: 80,
  energyPerTick: 0.5,
  reproductionEnergyCost: 40,
  initialEnergy: 60,
  childEnergy: 50,
  mutationChance: 0.05,
  mutationAmount: 0.15,
  maxEnergy: 150,
  maxSpeed: 1.0,
  hungerSlowdown: true,
  environmentalEvents: false,
  tribesEnabled: false,
  maxTribeSize: 6,
};

export const SCENARIO_PRESETS: Record<string, Partial<SimulationConfig>> = {
  'Default': {},
  'Scarce Resources': {
    initialFoodCount: 15,
    foodRespawnTicks: 160,
    foodEnergy: 20,
  },
  'Overpopulation': {
    initialPopulation: 80,
    initialFoodCount: 20,
  },
  'Predator World': {
    aggressionBias: [0.6, 1.0],
  },
  'Peaceful Garden': {
    initialFoodCount: 100,
    foodEnergy: 50,
    foodRespawnTicks: 30,
    aggressionBias: [0, 0.2],
  },
  'Speed Evolution': {
    gridRadius: 6,
    initialPopulation: 20,
    initialFoodCount: 12,
    mutationChance: 0.12,
    mutationAmount: 0.25,
  },
  'Survival Mode': {
    energyPerTick: 1.0,
    foodEnergy: 15,
    reproductionEnergyCost: 60,
    initialEnergy: 40,
  },
  'Tribal World': {
    tribesEnabled: true,
    initialPopulation: 40,
    aggressionBias: [0.3, 0.8],
  },
};

export function buildConfig(preset: Partial<SimulationConfig> = {}): SimulationConfig {
  return { ...DEFAULT_CONFIG, ...preset };
}
