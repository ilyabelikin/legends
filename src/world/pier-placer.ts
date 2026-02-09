import type { Tile } from "../types/terrain";
import type { Location } from "../types/location";
import { isWater } from "./terrain-generator";

/** Location types that should have piers */
const PIER_LOCATIONS = new Set([
  "fishing_village",
  "port",
  "town",
  "city",
  "castle",
]);

const DIRS_4 = [
  { dx: 0, dy: 1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: -1, dy: 0 },
];
const DIRS_8 = [
  ...DIRS_4,
  { dx: 1, dy: 1 },
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
];

/**
 * Place piers on water tiles adjacent to coastal settlements.
 *
 * A valid pier tile must:
 *  1. Be a water tile (shallow_ocean or deep_ocean)
 *  2. Be adjacent to the settlement (within 2 tiles)
 *  3. Have at least one neighboring water tile it can sail to
 *     (so the player isn't stuck on a dead-end pier)
 *  4. Be connected to a water body of at least 10 tiles
 *     (no piers on tiny ponds)
 *
 * Also ensures island settlements always get a pier.
 */
export function placePiers(
  tiles: Tile[][],
  locations: Map<string, Location>,
  width: number,
  height: number,
): void {
  for (const loc of locations.values()) {
    if (loc.isDestroyed) continue;

    const wantsPier =
      PIER_LOCATIONS.has(loc.type) || isOnIsland(tiles, loc, width, height);
    if (!wantsPier) continue;

    const { x: lx, y: ly } = loc.position;
    let placed = false;

    // Collect candidate water tiles near the settlement (radius 2)
    // Score each by how well-connected it is to open water
    const candidates: { x: number; y: number; score: number; direction: number }[] = [];

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = lx + dx;
        const ny = ly + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const tile = tiles[ny][nx];
        if (!isWater(tile.terrainType)) continue;
        if (tile.features.some((f) => f.type === "pier")) continue; // already has one

        // Must be reachable from the settlement (adjacent to land)
        // Also track which direction the land is (for rendering)
        let touchesLand = false;
        let landDirection = -1;
        for (let i = 0; i < DIRS_4.length; i++) {
          const d = DIRS_4[i];
          const ax = nx + d.dx;
          const ay = ny + d.dy;
          if (ax >= 0 && ax < width && ay >= 0 && ay < height) {
            if (!isWater(tiles[ay][ax].terrainType)) {
              touchesLand = true;
              landDirection = i; // 0=down, 1=right, 2=up, 3=left in tile coords
              break;
            }
          }
        }
        if (!touchesLand) continue;

        // Count neighboring water tiles (connectivity score)
        let waterNeighbors = 0;
        for (const d of DIRS_4) {
          const wx = nx + d.dx;
          const wy = ny + d.dy;
          if (wx >= 0 && wx < width && wy >= 0 && wy < height) {
            if (isWater(tiles[wy][wx].terrainType)) {
              waterNeighbors++;
            }
          }
        }

        // Must connect to at least 1 other water tile (so you can sail away)
        if (waterNeighbors >= 1) {
          // Check water body size - must be at least 10 tiles (no tiny ponds)
          const waterBodySize = getWaterBodySize(tiles, nx, ny, width, height);
          if (waterBodySize < 10) continue;

          // Prefer tiles with more water connections (better sailing access)
          // and closer to the settlement
          const dist = Math.abs(dx) + Math.abs(dy);
          candidates.push({ x: nx, y: ny, score: waterNeighbors * 10 - dist, direction: landDirection });
        }
      }
    }

    // Pick best candidate
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length > 0) {
      const best = candidates[0];
      tiles[best.y][best.x].features.push({ 
        type: "pier", 
        variant: 0,
        direction: best.direction 
      });
      placed = true;
    }
  }
}

/**
 * Check if a settlement is on an island (small landmass not connected
 * to the main continent).
 */
function isOnIsland(
  tiles: Tile[][],
  loc: Location,
  width: number,
  height: number,
): boolean {
  const visited = new Set<string>();
  const queue: { x: number; y: number }[] = [loc.position];
  let count = 0;
  const maxCheck = 200;

  while (queue.length > 0 && count < maxCheck) {
    const pos = queue.shift()!;
    const key = `${pos.x},${pos.y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const tile = tiles[pos.y]?.[pos.x];
    if (!tile || isWater(tile.terrainType)) continue;

    count++;
    for (const d of DIRS_4) {
      const nx = pos.x + d.dx;
      const ny = pos.y + d.dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return count < maxCheck;
}

/**
 * Count the size of the water body connected to a given water tile.
 * Returns the number of water tiles reachable via flood-fill.
 * Stops counting at 100 tiles to avoid checking entire oceans.
 */
function getWaterBodySize(
  tiles: Tile[][],
  startX: number,
  startY: number,
  width: number,
  height: number,
): number {
  const visited = new Set<string>();
  const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];
  let count = 0;
  const maxCheck = 100; // Stop at 100 - we only care about filtering out tiny ponds

  while (queue.length > 0 && count < maxCheck) {
    const pos = queue.shift()!;
    const key = `${pos.x},${pos.y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const tile = tiles[pos.y]?.[pos.x];
    if (!tile || !isWater(tile.terrainType)) continue;

    count++;
    for (const d of DIRS_4) {
      const nx = pos.x + d.dx;
      const ny = pos.y + d.dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const neighborKey = `${nx},${ny}`;
        if (!visited.has(neighborKey)) {
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }

  return count;
}
