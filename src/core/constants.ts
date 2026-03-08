export const DNA_LENGTH = 16;

export const TICK_INTERVAL_MS = 200;
export const MIN_TICK_MS = 50;
export const MAX_TICK_MS = 1000;

// Raw values (0-1) that map through DNA_RANGES to neutral passive defaults
export const PASSIVE_RAW_DEFAULTS: number[] = [
  0.5,   // 0: maxAge → 120
  0.375, // 1: speed → 0.5
  0.5,   // 2: directionBias → 0.5
  0.33,  // 3: visionRange → 2
  0.21,  // 4: attack → ~5
  0.21,  // 5: defense → ~5
  0.375, // 6: maxHP → ~50
  0.25,  // 7: aggression → 0.25
  0.5,   // 8: foodAffinity → 0.5
  0.2,   // 9: fleeSpeed → 0.1
  0.5,   // 10: energyEfficiency → 0.75
  0.0,   // 11: fertilityBonus → 0
  0.0,   // 12: mutationResist → 0
  0.5,   // 13: hue → 180 (never used, always active)
  0.3,   // 14: cooperation → 0.3
  0.25,  // 15: storageCapacity → 25
];
export const ALWAYS_ACTIVE_GENES = new Set([13]); // hue is always active (cosmetic)
export const TARGET_ACTIVE_COUNT = 8;

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
