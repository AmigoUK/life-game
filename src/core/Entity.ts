import { EntityState, HexCoord, Sex } from './types';
import { generateRandomDNA, decodeDNA } from './DNA';

let nextId = 1;

const MALE_NAMES = [
  'Pelé', 'Maradona', 'Messi', 'Ronaldo', 'Zidane', 'Beckham', 'Ronaldinho', 'Cruyff',
  'Platini', 'Müller', 'Eusébio', 'Puskas', 'Neymar', 'Mbappé', 'Haaland', 'Lewandowski',
  'Modric', 'Iniesta', 'Xavi', 'Pirlo', 'Buffon', 'Maldini', 'Beckenbauer', 'Ramos',
  'Henry', 'Bergkamp', 'Van Basten', 'Romario', 'Rivaldo', 'Kaka', 'Rooney', 'Gerrard',
  'Lampard', 'Totti', 'Del Piero', 'Baggio', 'Cantona', 'Figo', 'Raúl', 'Shevchenko',
  'Drogba', "Eto'o", 'Suárez', 'Agüero', 'De Bruyne', 'Salah', 'Hazard', 'Ibrahimovic',
  'Vieira', 'Scholes',
];

const FEMALE_NAMES = [
  'Beyoncé', 'Adele', 'Whitney', 'Madonna', 'Rihanna', 'Shakira', 'Celine', 'Aretha',
  'Mariah', 'Taylor', 'Billie', 'Ariana', 'Lady Gaga', 'Cher', 'Tina', 'Diana',
  'Dolly', 'Bjork', 'Amy', 'Alicia', 'Pink', 'Sia', 'Dua Lipa', 'Selena',
  'Lana', 'Florence', 'Ellie', 'Demi', 'Miley', 'Katy', 'Nicki', 'Lizzo',
  'Halsey', 'Lorde', 'Sade', 'Erykah', 'Lauryn', 'Janet', 'Gloria', 'Tori',
  'Alanis', 'Gwen', 'Fergie', 'Kylie', 'Annie', 'Dusty', 'Roberta', 'Nina',
  'Ella', 'Etta',
];

function shuffleArray(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let availableMaleNames: string[] = shuffleArray(MALE_NAMES);
let usedMaleNames = new Set<string>();
let availableFemaleNames: string[] = shuffleArray(FEMALE_NAMES);
let usedFemaleNames = new Set<string>();

function assignName(id: number, sex: Sex): string {
  const available = sex === 'M' ? availableMaleNames : availableFemaleNames;
  const used = sex === 'M' ? usedMaleNames : usedFemaleNames;
  if (available.length > 0) {
    const name = available.pop()!;
    used.add(name);
    return name;
  }
  return `Entity #${id}`;
}

export function recycleName(name: string, sex: Sex): void {
  const used = sex === 'M' ? usedMaleNames : usedFemaleNames;
  const available = sex === 'M' ? availableMaleNames : availableFemaleNames;
  if (used.has(name)) {
    used.delete(name);
    available.push(name);
  }
}

export function resetNamePools(): void {
  availableMaleNames = shuffleArray(MALE_NAMES);
  usedMaleNames.clear();
  availableFemaleNames = shuffleArray(FEMALE_NAMES);
  usedFemaleNames.clear();
}

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
  const id = nextId++;
  return {
    id,
    sex,
    name: assignName(id, sex),
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
    lastBirthTick: -1,
  };
}

export function resetEntityIdCounter(): void {
  nextId = 1;
}
