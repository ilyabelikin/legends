import { SimplexNoise } from '../utils/simplex-noise';
import { SeededRandom } from '../utils/random';
import { clamp } from '../utils/math';
import { isWater } from './terrain-generator';
import type { TerrainType } from '../types/terrain';

/**
 * Generate moisture map.
 * Moisture is higher near water, in low-lying areas,
 * and varies with noise for natural-looking biomes.
 */
export function generateMoisture(
  width: number,
  height: number,
  elevation: number[][],
  terrainTypes: TerrainType[][],
  rng: SeededRandom,
): number[][] {
  const noise = new SimplexNoise(rng);
  const moisture: number[][] = [];

  // First pass: compute distance from water
  const waterDist = computeWaterDistance(width, height, terrainTypes);

  for (let y = 0; y < height; y++) {
    moisture[y] = [];
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;

      // Base moisture from noise
      let m = 0;
      m += 1.0 * noise.noise2D(nx * 3, ny * 3);
      m += 0.5 * noise.noise2D(nx * 6, ny * 6);
      m += 0.25 * noise.noise2D(nx * 12, ny * 12);
      m = m / (1.0 + 0.5 + 0.25);
      m = (m + 1) / 2; // map to 0–1

      // Increase moisture near water
      const wd = waterDist[y][x];
      const waterInfluence = Math.max(0, 1 - wd / 15);
      m = m * 0.6 + waterInfluence * 0.4;

      // Lower elevation tends to hold more moisture
      const elevEffect = (1 - elevation[y][x]) * 0.2;
      m += elevEffect;

      moisture[y][x] = clamp(m, 0, 1);
    }
  }

  return moisture;
}

/**
 * BFS to compute distance from nearest water tile.
 * Returns a 2D array of distances.
 */
function computeWaterDistance(
  width: number,
  height: number,
  terrainTypes: TerrainType[][],
): number[][] {
  const dist: number[][] = Array.from({ length: height },
    () => new Array(width).fill(Infinity));
  const queue: [number, number][] = [];

  // Seed with all water tiles
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isWater(terrainTypes[y][x])) {
        dist[y][x] = 0;
        queue.push([x, y]);
      }
    }
  }

  // BFS
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  let qi = 0;
  while (qi < queue.length) {
    const [cx, cy] = queue[qi++];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const newDist = dist[cy][cx] + 1;
        if (newDist < dist[ny][nx]) {
          dist[ny][nx] = newDist;
          queue.push([nx, ny]);
        }
      }
    }
  }

  return dist;
}
