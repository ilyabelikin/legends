import { clamp } from "../utils/math";

/** Isometric tile dimensions */
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const ELEVATION_HEIGHT = 12;

/** Camera controlling the viewport over the isometric map */
export class Camera {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
  screenWidth: number;
  screenHeight: number;

  private minZoom = 0.25;
  private maxZoom = 3.0;
  private smoothing = 0.35;

  constructor(screenWidth: number, screenHeight: number) {
    this.x = 0;
    this.y = 0;
    this.zoom = 1.0;
    this.targetX = 0;
    this.targetY = 0;
    this.targetZoom = 1.0;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }

  /** Update camera position with smooth interpolation */
  update(): void {
    this.x += (this.targetX - this.x) * this.smoothing;
    this.y += (this.targetY - this.y) * this.smoothing;
    this.zoom += (this.targetZoom - this.zoom) * this.smoothing;
  }

  /** Move camera by screen-space delta */
  pan(dx: number, dy: number): void {
    this.targetX -= dx / this.zoom;
    this.targetY -= dy / this.zoom;
  }

  /** Zoom in/out, centered on screen point */
  zoomAt(factor: number, screenX: number, screenY: number): void {
    const newZoom = clamp(this.targetZoom * factor, this.minZoom, this.maxZoom);
    const zoomRatio = newZoom / this.targetZoom;

    // Adjust position so zoom centers on cursor
    const worldX =
      (screenX - this.screenWidth / 2) / this.targetZoom + this.targetX;
    const worldY =
      (screenY - this.screenHeight / 2) / this.targetZoom + this.targetY;

    this.targetX = worldX - (worldX - this.targetX) / zoomRatio;
    this.targetY = worldY - (worldY - this.targetY) / zoomRatio;
    this.targetZoom = newZoom;
  }

  /** Center camera on a world tile */
  centerOnTile(tileX: number, tileY: number): void {
    const sx = (tileX - tileY) * (TILE_WIDTH / 2);
    const sy = (tileX + tileY) * (TILE_HEIGHT / 2);
    this.targetX = sx;
    this.targetY = sy;
  }

  /** Convert screen coordinates to world pixel coordinates */
  screenToWorld(screenX: number, screenY: number): { wx: number; wy: number } {
    return {
      wx: (screenX - this.screenWidth / 2) / this.zoom + this.x,
      wy: (screenY - this.screenHeight / 2) / this.zoom + this.y,
    };
  }

  /** Convert world pixel coordinates to screen coordinates */
  worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
    return {
      sx: (wx - this.x) * this.zoom + this.screenWidth / 2,
      sy: (wy - this.y) * this.zoom + this.screenHeight / 2,
    };
  }

  /** Convert screen coordinates to tile coordinates */
  screenToTile(screenX: number, screenY: number): { tx: number; ty: number } {
    const { wx, wy } = this.screenToWorld(screenX, screenY);
    const tx = (wx / (TILE_WIDTH / 2) + wy / (TILE_HEIGHT / 2)) / 2;
    const ty = (wy / (TILE_HEIGHT / 2) - wx / (TILE_WIDTH / 2)) / 2;
    return { tx: Math.floor(tx), ty: Math.floor(ty) };
  }

  /** Get visible tile range */
  getVisibleRange(
    worldWidth: number,
    worldHeight: number,
  ): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    const margin = 4;
    const topLeft = this.screenToTile(0, 0);
    const topRight = this.screenToTile(this.screenWidth, 0);
    const bottomLeft = this.screenToTile(0, this.screenHeight);
    const bottomRight = this.screenToTile(this.screenWidth, this.screenHeight);

    return {
      minX: clamp(
        Math.min(topLeft.tx, bottomLeft.tx) - margin,
        0,
        worldWidth - 1,
      ),
      maxX: clamp(
        Math.max(topRight.tx, bottomRight.tx) + margin,
        0,
        worldWidth - 1,
      ),
      minY: clamp(
        Math.min(topLeft.ty, topRight.ty) - margin,
        0,
        worldHeight - 1,
      ),
      maxY: clamp(
        Math.max(bottomLeft.ty, bottomRight.ty) + margin,
        0,
        worldHeight - 1,
      ),
    };
  }

  /** Update screen dimensions */
  resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }
}
