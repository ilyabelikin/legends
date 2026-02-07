/**
 * Seedable pseudo-random number generator using mulberry32 algorithm.
 * Deterministic — same seed always produces same sequence.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns a float in [min, max) */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Pick a random element from an array */
  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }

  /** Shuffle an array in-place (Fisher-Yates) */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /** Returns true with given probability */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Weighted random pick: items is array of [value, weight] */
  weightedPick<T>(items: [T, number][]): T {
    const totalWeight = items.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.next() * totalWeight;
    for (const [value, weight] of items) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return items[items.length - 1][0];
  }

  /** Gaussian (normal) distribution using Box-Muller */
  gaussian(mean = 0, stddev = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stddev + mean;
  }

  /** Create a new SeededRandom derived from this one */
  fork(): SeededRandom {
    return new SeededRandom(this.nextInt(0, 2147483647));
  }
}

/** Generate a unique ID */
let idCounter = 0;
export function generateId(prefix = ''): string {
  idCounter++;
  return `${prefix}${prefix ? '_' : ''}${idCounter.toString(36)}_${Date.now().toString(36)}`;
}

/** Reset ID counter (for deterministic testing) */
export function resetIdCounter(): void {
  idCounter = 0;
}
