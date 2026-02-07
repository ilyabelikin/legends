import type { Position, Tile } from '../types/terrain';
import { getNeighbors4, manhattanDist } from './math';

/** Priority queue entry for A* */
interface PQEntry {
  pos: Position;
  cost: number;
}

/** Simple min-heap priority queue */
class MinHeap {
  private data: PQEntry[] = [];

  get size(): number { return this.data.length; }

  push(entry: PQEntry): void {
    this.data.push(entry);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): PQEntry | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].cost >= this.data[parent].cost) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.data[l].cost < this.data[smallest].cost) smallest = l;
      if (r < n && this.data[r].cost < this.data[smallest].cost) smallest = r;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

/** Key for position map */
function posKey(p: Position): string {
  return `${p.x},${p.y}`;
}

/**
 * A* pathfinding on the world grid.
 * @param start Starting position
 * @param end Target position
 * @param width World width
 * @param height World height
 * @param costFn Function that returns movement cost for a tile (Infinity = impassable)
 * @returns Array of positions from start to end (inclusive), or empty if no path
 */
export function findPath(
  start: Position,
  end: Position,
  width: number,
  height: number,
  costFn: (x: number, y: number) => number,
): Position[] {
  const openSet = new MinHeap();
  const cameFrom = new Map<string, Position>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  const startKey = posKey(start);
  gScore.set(startKey, 0);
  fScore.set(startKey, manhattanDist(start, end));
  openSet.push({ pos: start, cost: fScore.get(startKey)! });

  const closedSet = new Set<string>();

  while (openSet.size > 0) {
    const current = openSet.pop()!;
    const currentKey = posKey(current.pos);

    if (current.pos.x === end.x && current.pos.y === end.y) {
      // Reconstruct path
      const path: Position[] = [];
      let step: Position | undefined = end;
      while (step) {
        path.unshift(step);
        step = cameFrom.get(posKey(step));
      }
      return path;
    }

    if (closedSet.has(currentKey)) continue;
    closedSet.add(currentKey);

    const neighbors = getNeighbors4(current.pos, width, height);
    for (const neighbor of neighbors) {
      const nKey = posKey(neighbor);
      if (closedSet.has(nKey)) continue;

      const moveCost = costFn(neighbor.x, neighbor.y);
      if (moveCost >= Infinity) continue;

      const tentativeG = (gScore.get(currentKey) ?? Infinity) + moveCost;
      const currentG = gScore.get(nKey) ?? Infinity;

      if (tentativeG < currentG) {
        cameFrom.set(nKey, current.pos);
        gScore.set(nKey, tentativeG);
        const f = tentativeG + manhattanDist(neighbor, end);
        fScore.set(nKey, f);
        openSet.push({ pos: neighbor, cost: f });
      }
    }
  }

  return []; // No path found
}

/**
 * Simple flood fill to find connected regions.
 * @param start Starting position
 * @param width World width
 * @param height World height
 * @param passable Function that returns true if a tile can be entered
 * @param maxSize Maximum region size to find
 */
export function floodFill(
  start: Position,
  width: number,
  height: number,
  passable: (x: number, y: number) => boolean,
  maxSize = Infinity,
): Position[] {
  const visited = new Set<string>();
  const result: Position[] = [];
  const queue: Position[] = [start];

  while (queue.length > 0 && result.length < maxSize) {
    const pos = queue.shift()!;
    const key = posKey(pos);
    if (visited.has(key)) continue;
    if (!passable(pos.x, pos.y)) continue;
    visited.add(key);
    result.push(pos);

    for (const n of getNeighbors4(pos, width, height)) {
      if (!visited.has(posKey(n))) {
        queue.push(n);
      }
    }
  }

  return result;
}
