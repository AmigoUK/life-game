export const DNA_LENGTH = 16;

export const TICK_INTERVAL_MS = 200;
export const MIN_TICK_MS = 50;
export const MAX_TICK_MS = 1000;

export const DNA_RANGES: [number, number][] = [
  [80, 160],    // 0: maxAge
  [0.2, 1.0],   // 1: speed
  [0, 1],       // 2: directionBias
  [1, 4],       // 3: visionRange
  [1, 20],      // 4: attack
  [1, 20],      // 5: defense
  [20, 100],    // 6: maxHP
  [0, 1],       // 7: aggression
  [0, 1],       // 8: foodAffinity
  [0, 0.5],     // 9: fleeSpeed
  [0.5, 1.0],   // 10: energyEfficiency
  [0, 0.5],     // 11: fertilityBonus
  [0, 0.5],     // 12: mutationResist
  [0, 360],     // 13: hue (cosmetic)
  [0, 1],       // 14: cooperation
  [0, 100],     // 15: storageCapacity
];
