import { DecodedDNA } from './types';
import { DNA_LENGTH, DNA_RANGES, PASSIVE_RAW_DEFAULTS, ALWAYS_ACTIVE_GENES, TARGET_ACTIVE_COUNT } from './constants';

export function generateRandomDNA(aggressionBias?: [number, number]): number[] {
  return Array.from({ length: DNA_LENGTH }, (_, i) => {
    if (i === 7 && aggressionBias) {
      const [min, max] = aggressionBias;
      return min + Math.random() * (max - min);
    }
    return Math.random();
  });
}

export function decodeDNA(dna: number[]): DecodedDNA {
  const map = (index: number): number => {
    const [min, max] = DNA_RANGES[index];
    return min + dna[index] * (max - min);
  };

  return {
    maxAge: Math.round(map(0)),
    speed: map(1),
    directionBias: map(2),
    visionRange: Math.round(map(3)),
    attack: map(4),
    defense: map(5),
    maxHP: Math.round(map(6)),
    aggression: map(7),
    foodAffinity: map(8),
    fleeSpeed: map(9),
    energyEfficiency: map(10),
    fertilityBonus: map(11),
    mutationResist: map(12),
    hue: map(13),
    cooperation: map(14),
    storageCapacity: Math.round(map(15)),
  };
}

export function decodeExpressedDNA(dna: number[], geneActive: boolean[]): DecodedDNA {
  const map = (index: number): number => {
    const raw = geneActive[index] ? dna[index] : PASSIVE_RAW_DEFAULTS[index];
    const [min, max] = DNA_RANGES[index];
    return min + raw * (max - min);
  };

  return {
    maxAge: Math.round(map(0)),
    speed: map(1),
    directionBias: map(2),
    visionRange: Math.round(map(3)),
    attack: map(4),
    defense: map(5),
    maxHP: Math.round(map(6)),
    aggression: map(7),
    foodAffinity: map(8),
    fleeSpeed: map(9),
    energyEfficiency: map(10),
    fertilityBonus: map(11),
    mutationResist: map(12),
    hue: map(13),
    cooperation: map(14),
    storageCapacity: Math.round(map(15)),
  };
}

export function generateGeneActivation(): boolean[] {
  const activation = new Array(DNA_LENGTH).fill(false);
  // Hue is always active
  for (const idx of ALWAYS_ACTIVE_GENES) {
    activation[idx] = true;
  }
  // Pick 7 more random genes to be active (total 8)
  const candidates: number[] = [];
  for (let i = 0; i < DNA_LENGTH; i++) {
    if (!ALWAYS_ACTIVE_GENES.has(i)) candidates.push(i);
  }
  // Fisher-Yates shuffle then take first 7
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const needed = TARGET_ACTIVE_COUNT - ALWAYS_ACTIVE_GENES.size;
  for (let i = 0; i < needed; i++) {
    activation[candidates[i]] = true;
  }
  return activation;
}

function normalizeActivation(activation: boolean[]): boolean[] {
  const result = [...activation];
  // Ensure always-active genes are active
  for (const idx of ALWAYS_ACTIVE_GENES) {
    result[idx] = true;
  }
  let count = result.filter(Boolean).length;
  // Collect flippable indices (non-always-active)
  const activeFlippable: number[] = [];
  const passiveFlippable: number[] = [];
  for (let i = 0; i < result.length; i++) {
    if (ALWAYS_ACTIVE_GENES.has(i)) continue;
    if (result[i]) activeFlippable.push(i);
    else passiveFlippable.push(i);
  }
  // Randomly deactivate excess or activate deficit
  while (count > TARGET_ACTIVE_COUNT && activeFlippable.length > 0) {
    const idx = Math.floor(Math.random() * activeFlippable.length);
    result[activeFlippable[idx]] = false;
    activeFlippable.splice(idx, 1);
    count--;
  }
  while (count < TARGET_ACTIVE_COUNT && passiveFlippable.length > 0) {
    const idx = Math.floor(Math.random() * passiveFlippable.length);
    result[passiveFlippable[idx]] = true;
    passiveFlippable.splice(idx, 1);
    count++;
  }
  return result;
}

export function crossoverActivation(parentA: boolean[], parentB: boolean[], crossoverPoint: number): boolean[] {
  const child: boolean[] = [];
  for (let i = 0; i < DNA_LENGTH; i++) {
    child.push(i < crossoverPoint ? parentA[i] : parentB[i]);
  }
  return normalizeActivation(child);
}

export function mutateActivation(activation: boolean[], chance = 0.05): boolean[] {
  const result = [...activation];
  for (let i = 0; i < result.length; i++) {
    if (ALWAYS_ACTIVE_GENES.has(i)) continue;
    if (Math.random() < chance) {
      result[i] = !result[i];
    }
  }
  return normalizeActivation(result);
}

export function crossover(parentA: number[], parentB: number[]): { child: number[]; crossoverPoint: number } {
  const point = 1 + Math.floor(Math.random() * (DNA_LENGTH - 2));
  const child: number[] = [];
  for (let i = 0; i < DNA_LENGTH; i++) {
    child.push(i < point ? parentA[i] : parentB[i]);
  }
  return { child, crossoverPoint: point };
}

export function mutate(
  dna: number[],
  parentResistA: number,
  parentResistB: number,
  mutationChance: number,
  mutationAmount: number,
): number[] {
  const avgResist = (parentResistA + parentResistB) / 2;
  const effectiveChance = mutationChance * (1 - avgResist);

  return dna.map(gene => {
    if (Math.random() < effectiveChance) {
      const delta = (Math.random() * 2 - 1) * mutationAmount;
      return Math.max(0, Math.min(1, gene + delta));
    }
    return gene;
  });
}
