import type { Tile, TerrainType } from '../types/terrain';
import type { World } from '../types/world';
import type { BiomeType } from '../types/biome';
import { SeededRandom } from '../utils/random';
import { generateElevation, generateTemperature, classifyTerrain } from './terrain-generator';
import { generateMoisture } from './moisture-generator';
import { assignBiomes } from './biome-generator';
import { placeResources } from './resource-placer';
import { placeSettlements } from './settlement-placer';
import { buildRoads } from './road-builder';
import { placePiers } from './pier-placer';
import { populateWorld } from '../entities/character-factory';
import { spawnCreatures } from './creature-spawner';
import { generatePolitics as generatePoliticsLayer } from './political-generator';
import { BIOME_DEFINITIONS } from '../data/biome-data';

/** World generation configuration */
export interface WorldGenConfig {
  width: number;
  height: number;
  seed: number;
}

/** Default config */
export const DEFAULT_WORLD_CONFIG: WorldGenConfig = {
  width: 256,
  height: 256,
  seed: Date.now(),
};

/** Progress callback for loading screen */
export type ProgressCallback = (phase: string, progress: number) => void;

/**
 * Generate a complete world, layer by layer.
 * This is the main entry point for world creation.
 */
export function generateWorld(
  config: WorldGenConfig = DEFAULT_WORLD_CONFIG,
  onProgress?: ProgressCallback,
): World {
  const { width, height, seed } = config;
  const rng = new SeededRandom(seed);

  onProgress?.('Shaping continents...', 0.05);

  // Layer 1: Elevation
  const elevation = generateElevation(width, height, rng.fork());

  onProgress?.('Classifying terrain...', 0.15);

  // Classify terrain types
  const terrainTypes: TerrainType[][] = [];
  for (let y = 0; y < height; y++) {
    terrainTypes[y] = [];
    for (let x = 0; x < width; x++) {
      terrainTypes[y][x] = classifyTerrain(elevation[y][x]);
    }
  }

  onProgress?.('Simulating climate...', 0.25);

  // Layer 2: Temperature
  const temperature = generateTemperature(width, height, elevation, rng.fork());

  // Layer 3: Moisture
  const moisture = generateMoisture(width, height, elevation, terrainTypes, rng.fork());

  onProgress?.('Growing biomes...', 0.35);

  // Layer 4: Biomes
  const biomes = assignBiomes(width, height, elevation, moisture, temperature, terrainTypes);

  // Layer 5: Create tile objects
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      const biomeDef = BIOME_DEFINITIONS[biomes[y][x]];
      tiles[y][x] = {
        x,
        y,
        elevation: elevation[y][x],
        moisture: moisture[y][x],
        temperature: temperature[y][x],
        terrainType: terrainTypes[y][x],
        biome: biomes[y][x],
        vegetation: (biomeDef?.vegetationDensity ?? 0) * (0.7 + rng.next() * 0.3),
        features: [],
        resourceDeposit: null,
        locationId: null,
        roadLevel: 0,
        explored: false,
        visible: false,
        riverFlow: 0,
      };
    }
  }

  onProgress?.('Scattering resources...', 0.45);

  // Layer 6: Resources
  placeResources(tiles, width, height, rng.fork());

  onProgress?.('Founding settlements...', 0.55);

  // Layer 7: Settlements
  const locations = placeSettlements(tiles, width, height, rng.fork());

  onProgress?.('Building roads and piers...', 0.65);

  // Layer 8: Roads and piers
  buildRoads(tiles, locations, width, height);
  placePiers(tiles, locations, width, height);

  onProgress?.('Populating the world...', 0.75);

  // Layer 9: Characters
  const characters = populateWorld(locations, rng.fork());

  onProgress?.('Spawning creatures...', 0.82);

  // Layer 10: Creatures
  const creatures = spawnCreatures(tiles, width, height, rng.fork());

  onProgress?.('Establishing kingdoms...', 0.90);

  // Layer 11: Politics
  const { countries, diplomacy } = generatePoliticsLayer(locations, characters, rng.fork());

  onProgress?.('World complete!', 1.0);

  return {
    width,
    height,
    seed,
    tiles,
    locations,
    characters,
    creatures,
    countries,
    tradeRoutes: new Map(),
    items: new Map(),
    diplomacy,
  };
}
