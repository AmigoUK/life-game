export interface Tribe {
  id: number;
  color: string;
  memberIds: Set<number>;
  name: string;
}

const TEAM_NAMES = [
  'Real Madrid', 'Barcelona', 'Liverpool', 'Bayern Munich', 'Manchester City',
  'Juventus', 'Paris SG', 'Ajax', 'AC Milan', 'Inter Milan',
  'Chelsea', 'Arsenal', 'Dortmund', 'Atletico', 'Porto',
  'Benfica', 'Marseille', 'Roma', 'Napoli', 'Tottenham',
  'Celtic', 'Rangers', 'Feyenoord', 'PSV', 'Sporting',
  'Sevilla', 'Valencia', 'Lazio', 'Monaco', 'Lyon',
];

function shuffleArray(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class TribeRegistry {
  tribes = new Map<number, Tribe>();
  entityTribe = new Map<number, number>();
  private nextTribeId = 1;
  private availableNames: string[] = [];
  private usedNames = new Set<string>();

  constructor() {
    this.availableNames = shuffleArray(TEAM_NAMES);
  }

  private generateColor(tribeId: number): string {
    const hue = (tribeId * 137.508) % 360;
    return `hsl(${hue.toFixed(1)}, 70%, 55%)`;
  }

  private assignName(tribeId: number): string {
    if (this.availableNames.length > 0) {
      const name = this.availableNames.pop()!;
      this.usedNames.add(name);
      return name;
    }
    return `Team ${tribeId}`;
  }

  private recycleName(name: string): void {
    if (this.usedNames.has(name)) {
      this.usedNames.delete(name);
      this.availableNames.push(name);
    }
  }

  getTribe(entityId: number): Tribe | undefined {
    const tribeId = this.entityTribe.get(entityId);
    if (tribeId === undefined) return undefined;
    return this.tribes.get(tribeId);
  }

  areTribemates(idA: number, idB: number): boolean {
    const tA = this.entityTribe.get(idA);
    const tB = this.entityTribe.get(idB);
    return tA !== undefined && tA === tB;
  }

  formTribe(entityA: { id: number; tribeId: number | null }, entityB: { id: number; tribeId: number | null }): Tribe {
    const id = this.nextTribeId++;
    const tribe: Tribe = {
      id,
      color: this.generateColor(id),
      memberIds: new Set([entityA.id, entityB.id]),
      name: this.assignName(id),
    };
    this.tribes.set(id, tribe);
    this.entityTribe.set(entityA.id, id);
    this.entityTribe.set(entityB.id, id);
    entityA.tribeId = id;
    entityB.tribeId = id;
    return tribe;
  }

  joinTribe(entity: { id: number; tribeId: number | null }, tribeId: number): void {
    const tribe = this.tribes.get(tribeId);
    if (!tribe) return;
    tribe.memberIds.add(entity.id);
    this.entityTribe.set(entity.id, tribeId);
    entity.tribeId = tribeId;
  }

  removeMember(entity: { id: number; tribeId: number | null }): void {
    const tribeId = this.entityTribe.get(entity.id);
    if (tribeId === undefined) return;
    const tribe = this.tribes.get(tribeId);
    if (tribe) {
      tribe.memberIds.delete(entity.id);
      if (tribe.memberIds.size < 2) {
        // Dissolve: remove remaining member
        for (const memberId of tribe.memberIds) {
          this.entityTribe.delete(memberId);
        }
        this.recycleName(tribe.name);
        this.tribes.delete(tribeId);
      }
    }
    this.entityTribe.delete(entity.id);
    entity.tribeId = null;
  }

  getTribeColor(entityId: number): string | null {
    const tribe = this.getTribe(entityId);
    return tribe ? tribe.color : null;
  }

  cleanup(entityLookup: Map<number, { id: number; tribeId: number | null }>): void {
    for (const [tribeId, tribe] of this.tribes) {
      if (tribe.memberIds.size < 2) {
        for (const memberId of tribe.memberIds) {
          this.entityTribe.delete(memberId);
          const e = entityLookup.get(memberId);
          if (e) e.tribeId = null;
        }
        this.recycleName(tribe.name);
        this.tribes.delete(tribeId);
      }
    }
  }

  reset(): void {
    this.tribes.clear();
    this.entityTribe.clear();
    this.nextTribeId = 1;
    this.availableNames = shuffleArray(TEAM_NAMES);
    this.usedNames.clear();
  }
}
