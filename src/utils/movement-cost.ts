import type { Tile } from '../types/terrain';
import { BIOME_DEFINITIONS } from '../data/biome-data';
import type { BiomeType } from '../types/biome';

/**
 * Shared movement-cost function used by:
 *  - Player pathfinding (game-engine)
 *  - Trade-route pathfinding (trade-engine)
 *  - Road building pathfinding (road-builder)
 *  - NPC travel
 *
 * Roads significantly reduce cost so all actors naturally prefer them.
 *
 *   road level 0 (none)    → full biome cost
 *   road level 1 (path)    → cost × 0.7
 *   road level 2 (road)    → cost × 0.5
 *   road level 3 (highway) → cost × 0.35
 */
export function getMovementCost(tile: Tile): number {
  const terrain = tile.terrainType;
  if (terrain === 'deep_ocean' || terrain === 'shallow_ocean') return Infinity;

  const biomeDef = BIOME_DEFINITIONS[tile.biome as BiomeType];
  if (!biomeDef) return 5;

  let cost = biomeDef.movementCost;

  // Roads reduce cost
  if (tile.roadLevel >= 3)      cost *= 0.35;
  else if (tile.roadLevel >= 2) cost *= 0.5;
  else if (tile.roadLevel >= 1) cost *= 0.7;

  // High elevation adds a small penalty (elevation is 0-14)
  // Mountains (10+) add significant cost
  cost += Math.max(0, (tile.elevation - 8) * 0.15);

  // Floor at 0.5 so roads are always faster than off-road
  return Math.max(0.5, cost);
}

/**
 * Integer movement-point cost for the party
 * (minimum 1 — you always spend at least 1 MP per step).
 */
export function getMovementPointCost(tile: Tile): number {
  return Math.max(1, Math.ceil(getMovementCost(tile)));
}
