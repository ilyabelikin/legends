import type { Tile } from '../types/terrain';
import type { Location, LocationType } from '../types/location';
import { findPath } from '../utils/pathfinding';
import { euclideanDist } from '../utils/math';
import { getMovementCost } from '../utils/movement-cost';

/**
 * Build roads between settlements.
 *
 * Strategy:
 *  1. Build a minimum spanning tree (Kruskal's) so every settlement
 *     is reachable — this gives the sparsest connected network.
 *  2. Add a handful of extra "trade highway" links between major
 *     settlements (towns, cities, ports, castles) that aren't
 *     already directly connected.
 *  3. Small locations (homesteads, farms, lumber camps) only get
 *     the single MST link — no extra roads.
 */
export function buildRoads(
  tiles: Tile[][],
  locations: Map<string, Location>,
  width: number,
  height: number,
): void {
  const locs = Array.from(locations.values()).filter(l =>
    !l.isDestroyed && l.type !== 'dungeon' && l.type !== 'ruins'
      && l.type !== 'dragon_lair' && l.type !== 'bandit_camp'
  );

  if (locs.length < 2) return;

  // Index locations for union-find
  const idxMap = new Map<string, number>();
  locs.forEach((l, i) => idxMap.set(l.id, i));

  // ── 1. Collect all candidate edges sorted by weighted distance ──

  const edges: { a: number; b: number; dist: number; importance: number }[] = [];
  const MAX_EDGE_DIST = 30;

  for (let i = 0; i < locs.length; i++) {
    for (let j = i + 1; j < locs.length; j++) {
      const dist = euclideanDist(locs[i].position, locs[j].position);
      if (dist > MAX_EDGE_DIST) continue;
      const importance = getImportance(locs[i].type) + getImportance(locs[j].type);
      edges.push({ a: i, b: j, dist, importance });
    }
  }

  // Sort: prefer short distances between important settlements
  edges.sort((a, b) => (a.dist / a.importance) - (b.dist / b.importance));

  // ── 2. Kruskal's MST — ensures connectivity with minimal roads ──

  const parent = locs.map((_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a: number, b: number): boolean {
    const ra = find(a), rb = find(b);
    if (ra === rb) return false;
    parent[ra] = rb;
    return true;
  }

  const mstEdges: typeof edges = [];
  for (const edge of edges) {
    if (union(edge.a, edge.b)) {
      mstEdges.push(edge);
      if (mstEdges.length === locs.length - 1) break;
    }
  }

  // ── 3. Add a few extra highways between major settlements ──

  const majorTypes = new Set<LocationType>(['town', 'city', 'castle', 'port']);
  const connected = new Set(mstEdges.map(e => `${e.a}-${e.b}`));
  const extraEdges: typeof edges = [];
  const maxExtras = Math.max(2, Math.floor(locs.length / 10));

  for (const edge of edges) {
    if (extraEdges.length >= maxExtras) break;
    const key = `${edge.a}-${edge.b}`;
    if (connected.has(key)) continue;
    // Only add extras between major settlements
    if (!majorTypes.has(locs[edge.a].type) || !majorTypes.has(locs[edge.b].type)) continue;
    if (edge.dist > 20) continue;
    extraEdges.push(edge);
    connected.add(key);
  }

  // ── 4. Pathfind and mark tiles for each road ──

  const allEdges = [...mstEdges, ...extraEdges];

  for (const edge of allEdges) {
    const locA = locs[edge.a];
    const locB = locs[edge.b];

    const path = findPath(
      locA.position,
      locB.position,
      width,
      height,
      (x, y) => getMovementCost(tiles[y][x]),
    );

    if (path.length === 0) continue;

    // Road level: highways between major settlements, paths for small ones
    const importance = edge.importance;
    const roadLevel = importance >= 6 ? 3 : importance >= 4 ? 2 : 1;

    for (const pos of path) {
      tiles[pos.y][pos.x].roadLevel = Math.max(tiles[pos.y][pos.x].roadLevel, roadLevel);
    }
  }
  
  // ── 5. Post-process: merge parallel/adjacent roads to avoid grid patterns ──
  mergeParallelRoads(tiles, width, height);
}

/**
 * Merge or remove redundant parallel roads that are too close together.
 * This prevents ugly grid patterns from forming.
 */
function mergeParallelRoads(tiles: Tile[][], width: number, height: number): void {
  // Pass 1: Remove roads that create parallel segments within 1-2 tiles of each other
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tile = tiles[y][x];
      if (tile.roadLevel === 0 || tile.roadLevel >= 3) continue; // Keep highways
      
      // Check if this road segment runs parallel to another nearby road
      // Horizontal road check
      const isHorizontal = (tiles[y][x - 1].roadLevel > 0 || tiles[y][x + 1].roadLevel > 0);
      const isVertical = (tiles[y - 1][x].roadLevel > 0 || tiles[y + 1][x].roadLevel > 0);
      
      if (isHorizontal) {
        // Check for parallel horizontal road 1-2 tiles above or below
        for (let offset = 1; offset <= 2; offset++) {
          if (y + offset < height) {
            const parallelAbove = tiles[y + offset][x].roadLevel > 0 &&
              (tiles[y + offset][x - 1]?.roadLevel > 0 || tiles[y + offset][x + 1]?.roadLevel > 0);
            if (parallelAbove && tile.roadLevel <= tiles[y + offset][x].roadLevel) {
              tile.roadLevel = 0; // Remove this road, keep the other
              break;
            }
          }
          if (y - offset >= 0) {
            const parallelBelow = tiles[y - offset][x].roadLevel > 0 &&
              (tiles[y - offset][x - 1]?.roadLevel > 0 || tiles[y - offset][x + 1]?.roadLevel > 0);
            if (parallelBelow && tile.roadLevel < tiles[y - offset][x].roadLevel) {
              tile.roadLevel = 0; // Remove this road, keep the higher level one
              break;
            }
          }
        }
      }
      
      if (isVertical && tile.roadLevel > 0) {
        // Check for parallel vertical road 1-2 tiles left or right
        for (let offset = 1; offset <= 2; offset++) {
          if (x + offset < width) {
            const parallelRight = tiles[y][x + offset].roadLevel > 0 &&
              (tiles[y - 1]?.[x + offset]?.roadLevel > 0 || tiles[y + 1]?.[x + offset]?.roadLevel > 0);
            if (parallelRight && tile.roadLevel <= tiles[y][x + offset].roadLevel) {
              tile.roadLevel = 0;
              break;
            }
          }
          if (x - offset >= 0) {
            const parallelLeft = tiles[y][x - offset].roadLevel > 0 &&
              (tiles[y - 1]?.[x - offset]?.roadLevel > 0 || tiles[y + 1]?.[x - offset]?.roadLevel > 0);
            if (parallelLeft && tile.roadLevel < tiles[y][x - offset].roadLevel) {
              tile.roadLevel = 0;
              break;
            }
          }
        }
      }
    }
  }
  
  // Pass 2: Clean up orphaned road segments (single tiles with no continuation)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tile = tiles[y][x];
      if (tile.roadLevel === 0) continue;
      
      // Count road neighbors (orthogonal only)
      const roadNeighbors = 
        (tiles[y - 1][x].roadLevel > 0 ? 1 : 0) +
        (tiles[y + 1][x].roadLevel > 0 ? 1 : 0) +
        (tiles[y][x - 1].roadLevel > 0 ? 1 : 0) +
        (tiles[y][x + 1].roadLevel > 0 ? 1 : 0);
      
      // Remove isolated road tiles or dead ends that seem unnecessary
      if (roadNeighbors === 0) {
        tile.roadLevel = 0;
      }
    }
  }
}

/** Importance score — determines road priority and level */
function getImportance(type: LocationType): number {
  switch (type) {
    case 'city':            return 5;
    case 'town':            return 4;
    case 'castle':          return 4;
    case 'port':            return 3;
    case 'village':         return 2;
    case 'fishing_village': return 2;
    case 'hamlet':          return 1;
    case 'mine':            return 1;
    case 'farm':            return 1;
    case 'lumber_camp':     return 1;
    case 'homestead':       return 1;
    default:                return 0;
  }
}
