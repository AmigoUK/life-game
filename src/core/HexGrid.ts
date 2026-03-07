import { HexCoord } from './types';

const HEX_DIRECTIONS: HexCoord[] = [
  { q: 1, r: -1, s: 0 },
  { q: 1, r: 0, s: -1 },
  { q: 0, r: 1, s: -1 },
  { q: -1, r: 1, s: 0 },
  { q: -1, r: 0, s: 1 },
  { q: 0, r: -1, s: 1 },
];

export class HexGrid {
  readonly radius: number;
  private cells: HexCoord[] = [];

  constructor(radius: number) {
    this.radius = radius;
    this.generateCells();
  }

  private generateCells(): void {
    for (let q = -this.radius; q <= this.radius; q++) {
      const r1 = Math.max(-this.radius, -q - this.radius);
      const r2 = Math.min(this.radius, -q + this.radius);
      for (let r = r1; r <= r2; r++) {
        this.cells.push({ q, r, s: -q - r });
      }
    }
  }

  getCells(): readonly HexCoord[] {
    return this.cells;
  }

  cellCount(): number {
    return this.cells.length;
  }

  isValid(coord: HexCoord): boolean {
    return Math.max(Math.abs(coord.q), Math.abs(coord.r), Math.abs(coord.s)) <= this.radius;
  }

  neighbors(coord: HexCoord): HexCoord[] {
    const result: HexCoord[] = [];
    for (const dir of HEX_DIRECTIONS) {
      const n: HexCoord = { q: coord.q + dir.q, r: coord.r + dir.r, s: coord.s + dir.s };
      if (this.isValid(n)) result.push(n);
    }
    return result;
  }

  static distance(a: HexCoord, b: HexCoord): number {
    return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
  }

  static add(a: HexCoord, b: HexCoord): HexCoord {
    return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s };
  }

  static equals(a: HexCoord, b: HexCoord): boolean {
    return a.q === b.q && a.r === b.r;
  }

  hexInRange(center: HexCoord, range: number): HexCoord[] {
    const results: HexCoord[] = [];
    for (const cell of this.cells) {
      if (HexGrid.distance(center, cell) <= range && !HexGrid.equals(center, cell)) {
        results.push(cell);
      }
    }
    return results;
  }

  randomCell(): HexCoord {
    return this.cells[Math.floor(Math.random() * this.cells.length)];
  }

  stepToward(from: HexCoord, to: HexCoord): HexCoord {
    if (HexGrid.equals(from, to)) return from;

    let best: HexCoord = from;
    let bestDist = HexGrid.distance(from, to);

    for (const n of this.neighbors(from)) {
      const d = HexGrid.distance(n, to);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    return best;
  }

  stepAwayFrom(from: HexCoord, threat: HexCoord): HexCoord {
    let best: HexCoord = from;
    let bestDist = HexGrid.distance(from, threat);

    for (const n of this.neighbors(from)) {
      const d = HexGrid.distance(n, threat);
      if (d > bestDist) {
        bestDist = d;
        best = n;
      }
    }
    return best;
  }

  randomNeighborOrStay(coord: HexCoord): HexCoord {
    const ns = this.neighbors(coord);
    if (ns.length === 0) return coord;
    return ns[Math.floor(Math.random() * ns.length)];
  }

  // Flat-top hex: pixel coordinates from cube coords
  hexToPixel(coord: HexCoord, size: number, cx: number, cy: number): { x: number; y: number } {
    const x = size * (3 / 2 * coord.q);
    const y = size * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r);
    return { x: cx + x, y: cy + y };
  }
}
