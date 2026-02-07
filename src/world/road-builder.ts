import type { Tile } from '../types/terrain';
import type { Location } from '../types/location';
import { findPath } from '../utils/pathfinding';
import { euclideanDist } from '../utils/math';
import { getMovementCost } from '../utils/movement-cost';

/** Max distance to consider road connections */
const MAX_ROAD_DISTANCE = 40;

/**
 * Build roads between nearby settlements.
 * Uses A* pathfinding to find reasonable paths,
 * then marks tiles along those paths with road levels.
 */
export function buildRoads(
  tiles: Tile[][],
  locations: Map<string, Location>,
  width: number,
  height: number,
): void {
  const locs = Array.from(locations.values()).filter(l =>
    !l.isDestroyed && l.type !== 'dungeon' && l.type !== 'ruins'
  );

  // Find pairs of locations that should be connected
  const connections: { a: Location; b: Location; dist: number }[] = [];

  for (let i = 0; i < locs.length; i++) {
    for (let j = i + 1; j < locs.length; j++) {
      const dist = euclideanDist(locs[i].position, locs[j].position);
      if (dist < MAX_ROAD_DISTANCE) {
        connections.push({ a: locs[i], b: locs[j], dist });
      }
    }
  }

  // Sort by distance (shortest first) and build important roads first
  connections.sort((a, b) => {
    // Prioritize connections between larger settlements
    const sizeA = getLocationImportance(a.a) + getLocationImportance(a.b);
    const sizeB = getLocationImportance(b.a) + getLocationImportance(b.b);
    return (a.dist / sizeA) - (b.dist / sizeB);
  });

  // Build roads for top connections (not all — that would be too many)
  const maxRoads = Math.min(connections.length, locs.length * 2);

  for (let i = 0; i < maxRoads; i++) {
    const conn = connections[i];
    const path = findPath(
      conn.a.position,
      conn.b.position,
      width,
      height,
      (x, y) => getMovementCost(tiles[y][x]),
    );

    if (path.length === 0) continue;

    // Determine road level based on settlement importance
    const importance = getLocationImportance(conn.a) + getLocationImportance(conn.b);
    const roadLevel = importance >= 6 ? 3 : importance >= 3 ? 2 : 1;

    // Mark tiles along path
    for (const pos of path) {
      const tile = tiles[pos.y][pos.x];
      tile.roadLevel = Math.max(tile.roadLevel, roadLevel);
    }
  }
}

/** Get importance score for a location */
function getLocationImportance(loc: Location): number {
  switch (loc.type) {
    case 'city': return 5;
    case 'town': return 4;
    case 'castle': return 4;
    case 'port': return 3;
    case 'village': return 2;
    case 'hamlet': return 1;
    default: return 1;
  }
}
