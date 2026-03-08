export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

const SEASON_COLORS: Record<Season, string> = {
  spring: '#66bb6a',
  summer: '#ffd54f',
  autumn: '#ff8a65',
  winter: '#90caf9',
};

export interface SeasonState {
  current: Season;
  tickInSeason: number;
  seasonIndex: number;
  year: number;
  totalSeasonsPassed: number;
}

export class SeasonManager {
  private seasonLength: number;
  private tickInSeason = 0;
  private seasonIndex = 0;
  private year = 1;
  private totalSeasonsPassed = 0;

  constructor(seasonLength: number) {
    this.seasonLength = seasonLength;
  }

  tick(): { changed: boolean; state: SeasonState } {
    this.tickInSeason++;
    let changed = false;

    if (this.tickInSeason > this.seasonLength) {
      this.tickInSeason = 1;
      this.totalSeasonsPassed++;
      this.seasonIndex = (this.seasonIndex + 1) % 4;
      if (this.seasonIndex === 0) {
        this.year++;
      }
      changed = true;
    }

    return { changed, state: this.getState() };
  }

  getState(): SeasonState {
    return {
      current: SEASON_ORDER[this.seasonIndex],
      tickInSeason: this.tickInSeason,
      seasonIndex: this.seasonIndex,
      year: this.year,
      totalSeasonsPassed: this.totalSeasonsPassed,
    };
  }

  isWinter(): boolean {
    return this.seasonIndex === 3;
  }

  getLabel(): string {
    const s = SEASON_ORDER[this.seasonIndex];
    const name = s.charAt(0).toUpperCase() + s.slice(1);
    return `${name} Y${this.year} (${this.tickInSeason}/${this.seasonLength})`;
  }

  getColor(): string {
    return SEASON_COLORS[SEASON_ORDER[this.seasonIndex]];
  }

  reset(): void {
    this.tickInSeason = 0;
    this.seasonIndex = 0;
    this.year = 1;
    this.totalSeasonsPassed = 0;
  }
}
