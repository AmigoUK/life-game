import { EntityState, HexCoord, Sex } from './types';
import { generateRandomDNA, decodeDNA } from './DNA';

let nextId = 1;

export function createEntity(
  pos: HexCoord,
  sex: Sex,
  dna?: number[],
  generation = 0,
  energy?: number,
  initialEnergy = 60,
  aggressionBias?: [number, number],
): EntityState {
  const finalDna = dna ?? generateRandomDNA(aggressionBias);
  const decoded = decodeDNA(finalDna);
  return {
    id: nextId++,
    sex,
    pos,
    dna: finalDna,
    decoded,
    age: 0,
    energy: energy ?? initialEnergy,
    hp: decoded.maxHP,
    generation,
    alive: true,
    tribeId: null,
    foodStorage: 0,
    lastBirthSeason: -1,
  };
}

export function resetEntityIdCounter(): void {
  nextId = 1;
}
