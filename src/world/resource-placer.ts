import type { Tile, ResourceDeposit } from '../types/terrain';
import type { BiomeType } from '../types/biome';
import { BIOME_DEFINITIONS } from '../data/biome-data';
import { RESOURCE_DEFINITIONS } from '../data/resource-data';
import { SeededRandom } from '../utils/random';

/** Resource placement configuration */
interface ResourcePlacementConfig {
  resourceId: string;
  biomes: BiomeType[];
  chance: number;       // probability per eligible tile
  amountRange: [number, number];
  replenishRate: number;
}

/** Configs for natural resource deposits */
const RESOURCE_PLACEMENTS: ResourcePlacementConfig[] = [
  // Forests
  { resourceId: 'wood', biomes: ['forest', 'dense_forest', 'jungle'], chance: 0.4, amountRange: [50, 200], replenishRate: 0.5 },
  { resourceId: 'deer', biomes: ['forest', 'dense_forest', 'grassland'], chance: 0.15, amountRange: [5, 20], replenishRate: 0.1 },
  { resourceId: 'berries', biomes: ['forest', 'dense_forest'], chance: 0.2, amountRange: [10, 40], replenishRate: 0.3 },
  { resourceId: 'herbs', biomes: ['forest', 'swamp', 'grassland'], chance: 0.15, amountRange: [5, 20], replenishRate: 0.2 },
  { resourceId: 'rare_herbs', biomes: ['dense_forest', 'jungle', 'swamp'], chance: 0.05, amountRange: [2, 8], replenishRate: 0.05 },

  // Grasslands
  { resourceId: 'wheat', biomes: ['grassland', 'savanna'], chance: 0.3, amountRange: [20, 60], replenishRate: 0 },
  { resourceId: 'sheep', biomes: ['grassland', 'hills', 'savanna'], chance: 0.15, amountRange: [5, 20], replenishRate: 0.1 },

  // Mountains / hills
  { resourceId: 'iron_ore', biomes: ['mountain', 'hills'], chance: 0.25, amountRange: [30, 150], replenishRate: 0 },
  { resourceId: 'gold_ore', biomes: ['mountain', 'desert'], chance: 0.08, amountRange: [10, 60], replenishRate: 0 },
  { resourceId: 'coal', biomes: ['mountain', 'hills'], chance: 0.2, amountRange: [40, 120], replenishRate: 0 },
  { resourceId: 'stone', biomes: ['mountain', 'hills', 'tundra', 'snow_mountain'], chance: 0.3, amountRange: [50, 200], replenishRate: 0 },

  // Coastal / water
  { resourceId: 'fish', biomes: ['beach'], chance: 0.4, amountRange: [30, 80], replenishRate: 0.5 },
  { resourceId: 'salt', biomes: ['beach', 'desert'], chance: 0.1, amountRange: [20, 60], replenishRate: 0 },

  // Jungle / tropical
  { resourceId: 'exotic_fruit', biomes: ['jungle'], chance: 0.2, amountRange: [10, 30], replenishRate: 0.3 },
];

/**
 * Place resource deposits on tiles based on biome.
 * Each tile gets at most one resource deposit (the richest one).
 */
export function placeResources(
  tiles: Tile[][],
  width: number,
  height: number,
  rng: SeededRandom,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x];
      const biome = tile.biome as BiomeType;

      // Find eligible resource placements
      const eligible = RESOURCE_PLACEMENTS.filter(rp => rp.biomes.includes(biome));

      let bestDeposit: ResourceDeposit | null = null;
      let bestValue = 0;

      for (const placement of eligible) {
        if (rng.chance(placement.chance)) {
          const amount = rng.nextInt(placement.amountRange[0], placement.amountRange[1]);
          const def = RESOURCE_DEFINITIONS[placement.resourceId];
          const value = amount * (def?.baseValue ?? 1);
          if (value > bestValue) {
            bestValue = value;
            bestDeposit = {
              resourceId: placement.resourceId,
              amount,
              maxAmount: amount,
              replenishRate: placement.replenishRate,
            };
          }
        }
      }

      tile.resourceDeposit = bestDeposit;
    }
  }
}

/** Count total resources by type in the world */
export function countResources(tiles: Tile[][], width: number, height: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dep = tiles[y][x].resourceDeposit;
      if (dep) {
        counts[dep.resourceId] = (counts[dep.resourceId] || 0) + dep.amount;
      }
    }
  }
  return counts;
}
