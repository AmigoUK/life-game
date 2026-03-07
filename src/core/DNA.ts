import { DecodedDNA } from './types';
import { DNA_LENGTH, DNA_RANGES } from './constants';

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
    size: map(14),
  };
}

export function crossover(parentA: number[], parentB: number[]): number[] {
  const point = 1 + Math.floor(Math.random() * (DNA_LENGTH - 2));
  const child: number[] = [];
  for (let i = 0; i < DNA_LENGTH; i++) {
    child.push(i < point ? parentA[i] : parentB[i]);
  }
  return child;
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
