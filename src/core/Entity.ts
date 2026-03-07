import { EntityState, HexCoord, Sex } from './types';
import { generateRandomDNA, decodeDNA } from './DNA';
import { INITIAL_ENERGY } from './constants';

let nextId = 1;

export function createEntity(pos: HexCoord, sex: Sex, dna?: number[], generation = 0, energy?: number): EntityState {
  const finalDna = dna ?? generateRandomDNA();
  const decoded = decodeDNA(finalDna);
  return {
    id: nextId++,
    sex,
    pos,
    dna: finalDna,
    decoded,
    age: 0,
    energy: energy ?? INITIAL_ENERGY,
    hp: decoded.maxHP,
    generation,
    alive: true,
  };
}

export function resetEntityIdCounter(): void {
  nextId = 1;
}
