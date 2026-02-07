import type { TerrainType } from '../types/terrain';
import { SimplexNoise } from '../utils/simplex-noise';
import { SeededRandom } from '../utils/random';
import { clamp } from '../utils/math';

/** Elevation thresholds for terrain classification */
const TERRAIN_THRESHOLDS: { max: number; type: TerrainType }[] = [
  { max: 0.22, type: 'deep_ocean' },
  { max: 0.30, type: 'shallow_ocean' },
  { max: 0.33, type: 'coast' },
  { max: 0.50, type: 'lowland' },
  { max: 0.65, type: 'highland' },
  { max: 0.82, type: 'mountain' },
  { max: 1.00, type: 'peak' },
];

/** Classify elevation into terrain type */
export function classifyTerrain(elevation: number): TerrainType {
  for (const threshold of TERRAIN_THRESHOLDS) {
    if (elevation <= threshold.max) return threshold.type;
  }
  return 'peak';
}

/** Check if terrain is water */
export function isWater(type: TerrainType): boolean {
  return type === 'deep_ocean' || type === 'shallow_ocean';
}

/** Check if terrain is land */
export function isLand(type: TerrainType): boolean {
  return !isWater(type);
}

/** Generate the elevation map for the world */
export function generateElevation(
  width: number,
  height: number,
  rng: SeededRandom,
): number[][] {
  const noise = new SimplexNoise(rng);
  const noise2 = new SimplexNoise(rng.fork());
  const elevation: number[][] = [];

  for (let y = 0; y < height; y++) {
    elevation[y] = [];
    for (let x = 0; x < width; x++) {
      // Normalize coordinates
      const nx = x / width;
      const ny = y / height;

      // Multi-octave noise for continent shapes
      let e = 0;
      e += 1.00 * noise.noise2D(nx * 3, ny * 3);
      e += 0.50 * noise.noise2D(nx * 6, ny * 6);
      e += 0.25 * noise.noise2D(nx * 12, ny * 12);
      e += 0.12 * noise.noise2D(nx * 24, ny * 24);
      e = e / (1.0 + 0.5 + 0.25 + 0.12);

      // Add ridge noise for mountain ranges
      const ridge = noise2.ridgeNoise(nx * 4, ny * 4, 4, 2.0, 0.5);

      // Blend
      e = e * 0.7 + ridge * 0.3;

      // Map from [-1,1] to [0,1]
      e = (e + 1) / 2;

      // Apply island mask — create multiple landmasses
      const cx = nx - 0.5;
      const cy = ny - 0.5;
      const distFromCenter = Math.sqrt(cx * cx + cy * cy) * 2;

      // Use noise to create irregular coastline
      const coastNoise = noise.noise2D(nx * 2, ny * 2) * 0.15;
      const mask = 1 - Math.pow(clamp(distFromCenter + coastNoise, 0, 1), 1.8);

      e = e * mask;

      // Add secondary continent
      const cx2 = nx - 0.25;
      const cy2 = ny - 0.7;
      const dist2 = Math.sqrt(cx2 * cx2 + cy2 * cy2) * 3;
      const mask2 = 1 - Math.pow(clamp(dist2, 0, 1), 2);
      const secondaryContinent = noise.fbm(nx * 4 + 10, ny * 4 + 10, 4) * 0.5 + 0.5;
      e = Math.max(e, secondaryContinent * mask2 * 0.7);

      // Third island chain
      const cx3 = nx - 0.75;
      const cy3 = ny - 0.3;
      const dist3 = Math.sqrt(cx3 * cx3 + cy3 * cy3) * 4;
      const mask3 = 1 - Math.pow(clamp(dist3, 0, 1), 2.5);
      const islandNoise = noise.fbm(nx * 5 + 20, ny * 5 + 20, 3) * 0.5 + 0.5;
      e = Math.max(e, islandNoise * mask3 * 0.55);

      elevation[y][x] = clamp(e, 0, 1);
    }
  }

  return elevation;
}

/** Generate temperature map (based on latitude and elevation) */
export function generateTemperature(
  width: number,
  height: number,
  elevation: number[][],
  rng: SeededRandom,
): number[][] {
  const noise = new SimplexNoise(rng);
  const temperature: number[][] = [];

  for (let y = 0; y < height; y++) {
    temperature[y] = [];
    for (let x = 0; x < width; x++) {
      // Base temperature from latitude (warmest at equator = center)
      const ny = y / height;
      const latitudeTemp = 1 - Math.abs(ny - 0.5) * 2;

      // Reduce temperature at high elevation
      const elevEffect = Math.max(0, elevation[y][x] - 0.5) * 1.5;

      // Add some noise variation
      const nx = x / width;
      const tempNoise = noise.noise2D(nx * 4, ny * 4) * 0.15;

      const temp = latitudeTemp - elevEffect + tempNoise;
      temperature[y][x] = clamp(temp, 0, 1);
    }
  }

  return temperature;
}
