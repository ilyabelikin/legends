import type { BiomeType } from '../types/biome';
import type { TerrainType } from '../types/terrain';
import { isWater } from './terrain-generator';

/**
 * Assign biomes based on elevation, moisture, and temperature.
 * Uses a decision tree approach for clear, predictable biome placement.
 */
export function assignBiomes(
  width: number,
  height: number,
  elevation: number[][],
  moisture: number[][],
  temperature: number[][],
  terrainTypes: TerrainType[][],
): BiomeType[][] {
  const biomes: BiomeType[][] = [];

  for (let y = 0; y < height; y++) {
    biomes[y] = [];
    for (let x = 0; x < width; x++) {
      biomes[y][x] = classifyBiome(
        elevation[y][x],
        moisture[y][x],
        temperature[y][x],
        terrainTypes[y][x],
      );
    }
  }

  return biomes;
}

/** Classify a single tile into a biome */
function classifyBiome(
  elev: number,
  moist: number,
  temp: number,
  terrain: TerrainType,
): BiomeType {
  // Water biomes
  if (isWater(terrain)) return 'ocean';

  // Coast / beach
  if (terrain === 'coast') {
    if (temp > 0.6 && moist < 0.3) return 'desert';
    return 'beach';
  }

  // High mountains
  if (terrain === 'peak') return 'snow_mountain';
  if (terrain === 'mountain') {
    if (temp < 0.3) return 'snow_mountain';
    return 'mountain';
  }

  // Highland
  if (terrain === 'highland') {
    return 'hills';
  }

  // Lowland biomes — classified by temperature and moisture
  // Cold biomes
  if (temp < 0.2) {
    return 'tundra';
  }

  // Hot + dry = desert
  if (temp > 0.65 && moist < 0.2) {
    return 'desert';
  }

  // Hot + moderate moisture = savanna
  if (temp > 0.6 && moist < 0.4) {
    return 'savanna';
  }

  // Hot + wet = jungle
  if (temp > 0.7 && moist > 0.7) {
    return 'jungle';
  }

  // Wet lowland
  if (moist > 0.75 && elev < 0.38) {
    return 'swamp';
  }

  // Very wet + moderate temp = dense forest
  if (moist > 0.65) {
    return 'dense_forest';
  }

  // Moderate moisture + moderate temp = forest
  if (moist > 0.4) {
    return 'forest';
  }

  // Everything else = grassland
  return 'grassland';
}
