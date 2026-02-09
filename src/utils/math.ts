import type { Position } from "../types/terrain";

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth step (Hermite interpolation) */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Manhattan distance */
export function manhattanDist(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Euclidean distance */
export function euclideanDist(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Chebyshev (chess-king) distance */
export function chebyshevDist(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Map a value from one range to another */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/** Get 4-directional neighbors */
export function getNeighbors4(
  pos: Position,
  width: number,
  height: number,
): Position[] {
  const dirs = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  return dirs
    .map((d) => ({ x: pos.x + d.x, y: pos.y + d.y }))
    .filter((p) => p.x >= 0 && p.x < width && p.y >= 0 && p.y < height);
}

/** Get 8-directional neighbors */
export function getNeighbors8(
  pos: Position,
  width: number,
  height: number,
): Position[] {
  const result: Position[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        result.push({ x: nx, y: ny });
      }
    }
  }
  return result;
}

/** Check if a position is within bounds */
export function inBounds(
  pos: Position,
  width: number,
  height: number,
): boolean {
  return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
}

/** Convert world position to isometric screen coordinates */
export function worldToIso(
  x: number,
  y: number,
  tileWidth: number,
  tileHeight: number,
): { sx: number; sy: number } {
  return {
    sx: (x - y) * (tileWidth / 2),
    sy: (x + y) * (tileHeight / 2),
  };
}

/** Convert isometric screen coordinates to world position */
export function isoToWorld(
  sx: number,
  sy: number,
  tileWidth: number,
  tileHeight: number,
): { x: number; y: number } {
  return {
    x: (sx / (tileWidth / 2) + sy / (tileHeight / 2)) / 2,
    y: (sy / (tileHeight / 2) - sx / (tileWidth / 2)) / 2,
  };
}
