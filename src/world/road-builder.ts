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
