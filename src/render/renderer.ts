import type { GameState } from '../types/game';
import type { Tile } from '../types/terrain';
import type { Location } from '../types/location';
import type { Creature } from '../types/creature';
import { Camera, TILE_WIDTH, TILE_HEIGHT, ELEVATION_HEIGHT } from './camera';
import { getTerrainSprite } from './sprites/terrain-sprites';
import { getBuildingSprite } from './sprites/building-sprites';
import { getPartySprite, getCreatureSprite } from './sprites/entity-sprites';
import { PALETTE, hexToRgba } from './palette';
import type { BiomeType } from '../types/biome';
import type { Season } from '../types/season';

/** Main game renderer */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  camera: Camera;
  private animationTime = 0;
  private minimapCanvas: OffscreenCanvas | null = null;
  private minimapDirty = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = new Camera(canvas.width, canvas.height);

    // Pixel-perfect rendering
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Resize to fill container */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement!;
    this.canvas.width = parent.clientWidth * dpr;
    this.canvas.height = parent.clientHeight * dpr;
    this.canvas.style.width = `${parent.clientWidth}px`;
    this.canvas.style.height = `${parent.clientHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.camera.resize(parent.clientWidth, parent.clientHeight);
  }

  /** Main render frame */
  render(state: GameState, deltaTime: number): void {
    this.animationTime += deltaTime;
    this.camera.update();

    const ctx = this.ctx;
    const { world, party, season } = state;

    // Clear
    ctx.fillStyle = PALETTE.deepWater;
    ctx.fillRect(0, 0, this.camera.screenWidth, this.camera.screenHeight);

    // Save state for camera transform
    ctx.save();
    ctx.translate(
      this.camera.screenWidth / 2 - this.camera.x * this.camera.zoom,
      this.camera.screenHeight / 2 - this.camera.y * this.camera.zoom,
    );
    ctx.scale(this.camera.zoom, this.camera.zoom);

    // Get visible tile range
    const range = this.camera.getVisibleRange(world.width, world.height);

    // Render tiles back-to-front (painter's algorithm)
    for (let y = range.minY; y <= range.maxY; y++) {
      for (let x = range.minX; x <= range.maxX; x++) {
        const tile = world.tiles[y][x];
        this.renderTile(ctx, tile, season, state);
      }
    }

    // Render locations (only on explored tiles)
    for (let y = range.minY; y <= range.maxY; y++) {
      for (let x = range.minX; x <= range.maxX; x++) {
        const tile = world.tiles[y][x];
        if (tile.locationId && tile.explored) {
          const loc = world.locations.get(tile.locationId);
          if (loc && !loc.isDestroyed) {
            this.renderLocation(ctx, loc, world.countries.get(loc.countryId ?? '')?.color ?? null, tile.elevation);
          }
        }
      }
    }

    // Render creatures (only on visible tiles)
    for (const creature of world.creatures.values()) {
      const { x, y } = creature.position;
      if (x >= range.minX && x <= range.maxX && y >= range.minY && y <= range.maxY) {
        const tile = world.tiles[y][x];
        if (tile.visible) {
          this.renderCreature(ctx, creature, tile.elevation);
        }
      }
    }

    // Render player party
    this.renderParty(ctx, party.position.x, party.position.y,
      world.tiles[party.position.y]?.[party.position.x]?.elevation ?? 0.3);

    // Render selection highlight
    if (state.selectedTile) {
      this.renderSelectionHighlight(ctx, state.selectedTile.x, state.selectedTile.y,
        world.tiles[state.selectedTile.y]?.[state.selectedTile.x]?.elevation ?? 0.3);
    }

    // Render country borders and names
    this.renderCountryBorders(ctx, world, range);
    this.renderCountryNames(ctx, state);

    // Render smooth fog of war (in world space, on top of everything)
    this.renderFogOfWar(ctx, state, range);

    ctx.restore();

    // Render minimap
    this.renderMinimap(ctx, state);
  }

  /** Render a single terrain tile */
  private renderTile(
    ctx: CanvasRenderingContext2D,
    tile: Tile,
    season: Season,
    state: GameState,
  ): void {
    // Don't render terrain for unexplored tiles — fog covers them completely
    if (!tile.explored) return;

    const { x, y } = tile;
    const sx = (x - y) * (TILE_WIDTH / 2);
    const sy = (x + y) * (TILE_HEIGHT / 2);

    const sprite = getTerrainSprite(
      tile.biome as BiomeType,
      tile.elevation,
      (x * 7 + y * 13) % 8,
      season,
      tile.vegetation,
    );

    const elevOffset = Math.floor(tile.elevation * 5) * ELEVATION_HEIGHT;
    const drawX = sx - TILE_WIDTH / 2;
    const drawY = sy - sprite.height + TILE_HEIGHT / 2;

    ctx.drawImage(sprite, drawX, drawY);

    // Road overlay (at the elevated diamond position)
    if (tile.roadLevel > 0) {
      this.renderRoad(ctx, tile, sx, sy - elevOffset, state.world);
    }
  }

  /**
   * Render road on tile — draws isometric line segments toward
   * each neighboring road tile, smoothly interpolating elevation
   * so roads follow the terrain instead of jumping between heights.
   */
  private renderRoad(
    ctx: CanvasRenderingContext2D,
    tile: Tile,
    sx: number,
    sy: number,
    world: GameState['world'],
  ): void {
    const level = tile.roadLevel;
    const color = level >= 3 ? PALETTE.roadHighway
      : level >= 2 ? PALETTE.roadStone
      : PALETTE.roadDirt;
    const lineW = level >= 3 ? 4 : level >= 2 ? 3 : 2;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';

    const thisElev = Math.floor(tile.elevation * 5) * ELEVATION_HEIGHT;

    // 4-directional neighbor offsets and their flat isometric deltas
    const dirs: { dx: number; dy: number; isoX: number; isoY: number }[] = [
      { dx:  1, dy:  0, isoX:  TILE_WIDTH / 2, isoY:  TILE_HEIGHT / 2 },
      { dx: -1, dy:  0, isoX: -TILE_WIDTH / 2, isoY: -TILE_HEIGHT / 2 },
      { dx:  0, dy:  1, isoX: -TILE_WIDTH / 2, isoY:  TILE_HEIGHT / 2 },
      { dx:  0, dy: -1, isoX:  TILE_WIDTH / 2, isoY: -TILE_HEIGHT / 2 },
    ];

    let hasConnection = false;

    for (const dir of dirs) {
      const nx = tile.x + dir.dx;
      const ny = tile.y + dir.dy;
      if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;

      const neighbor = world.tiles[ny][nx];
      if (neighbor.roadLevel > 0 || neighbor.locationId) {
        // The midpoint's elevation is the average of both tiles
        const neighborElev = Math.floor(neighbor.elevation * 5) * ELEVATION_HEIGHT;
        const midElev = (thisElev + neighborElev) / 2;

        // Flat isometric half-step
        const halfX = dir.isoX / 2;
        const halfY = dir.isoY / 2;

        // Adjust the endpoint Y by the elevation difference at the midpoint
        // sy already has thisElev baked in, so offset by (midElev - thisElev)
        const elevDelta = midElev - thisElev;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + halfX, sy + halfY - elevDelta);
        ctx.stroke();
        hasConnection = true;
      }
    }

    if (!hasConnection) {
      ctx.fillStyle = color;
      ctx.fillRect(sx - lineW / 2, sy - lineW / 2, lineW, lineW);
    }
  }

  /** Render a location (settlement) */
  private renderLocation(
    ctx: CanvasRenderingContext2D,
    loc: Location,
    countryColor: string | null,
    elevation: number,
  ): void {
    const { x, y } = loc.position;
    const sx = (x - y) * (TILE_WIDTH / 2);
    const sy = (x + y) * (TILE_HEIGHT / 2);
    const elevOffset = Math.floor(elevation * 5) * ELEVATION_HEIGHT;

    const sprite = getBuildingSprite(loc.type, loc.size, countryColor);
    ctx.drawImage(sprite, sx - 24, sy - elevOffset - 40);

    // Location name label
    ctx.fillStyle = PALETTE.uiText;
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(loc.name, sx, sy - elevOffset - 42);
  }

  /** Render a creature */
  private renderCreature(ctx: CanvasRenderingContext2D, creature: Creature, elevation: number): void {
    const { x, y } = creature.position;
    const sx = (x - y) * (TILE_WIDTH / 2);
    const sy = (x + y) * (TILE_HEIGHT / 2);
    const elevOffset = Math.floor(elevation * 5) * ELEVATION_HEIGHT;

    const sprite = getCreatureSprite(creature.type);
    ctx.drawImage(sprite, sx - 8, sy - elevOffset - 16);
  }

  /** Render the player party */
  private renderParty(ctx: CanvasRenderingContext2D, px: number, py: number, elevation: number): void {
    const sx = (px - py) * (TILE_WIDTH / 2);
    const sy = (px + py) * (TILE_HEIGHT / 2);
    const elevOffset = Math.floor(elevation * 5) * ELEVATION_HEIGHT;

    // Pulsing glow
    const pulse = Math.sin(this.animationTime * 3) * 0.3 + 0.7;
    ctx.fillStyle = hexToRgba(PALETTE.uiHighlight, pulse * 0.3);
    this.fillIsoDiamond(ctx, sx, sy - elevOffset, TILE_WIDTH + 4, TILE_HEIGHT + 2);

    // Party sprite
    const sprite = getPartySprite();
    ctx.drawImage(sprite, sx - 8, sy - elevOffset - 20);
  }

  /** Render selection highlight on a tile */
  private renderSelectionHighlight(ctx: CanvasRenderingContext2D, tx: number, ty: number, elevation: number): void {
    const sx = (tx - ty) * (TILE_WIDTH / 2);
    const sy = (tx + ty) * (TILE_HEIGHT / 2);
    const elevOffset = Math.floor(elevation * 5) * ELEVATION_HEIGHT;

    ctx.strokeStyle = PALETTE.uiHighlight;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy - elevOffset - TILE_HEIGHT / 2);
    ctx.lineTo(sx + TILE_WIDTH / 2, sy - elevOffset);
    ctx.lineTo(sx, sy - elevOffset + TILE_HEIGHT / 2);
    ctx.lineTo(sx - TILE_WIDTH / 2, sy - elevOffset);
    ctx.closePath();
    ctx.stroke();
  }

  /** Render country borders */
  private renderCountryBorders(
    ctx: CanvasRenderingContext2D,
    world: GameState['world'],
    range: { minX: number; maxX: number; minY: number; maxY: number },
  ): void {
    for (let y = range.minY; y <= range.maxY; y++) {
      for (let x = range.minX; x <= range.maxX; x++) {
        const tile = world.tiles[y][x];
        if (!tile.locationId) continue;
        const loc = world.locations.get(tile.locationId);
        if (!loc?.countryId) continue;
        const country = world.countries.get(loc.countryId);
        if (!country) continue;

        const sx = (x - y) * (TILE_WIDTH / 2);
        const sy = (x + y) * (TILE_HEIGHT / 2);
        const elevOffset = Math.floor(tile.elevation * 5) * ELEVATION_HEIGHT;

        ctx.strokeStyle = hexToRgba(country.color, 0.4);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy - elevOffset - TILE_HEIGHT / 2);
        ctx.lineTo(sx + TILE_WIDTH / 2, sy - elevOffset);
        ctx.lineTo(sx, sy - elevOffset + TILE_HEIGHT / 2);
        ctx.lineTo(sx - TILE_WIDTH / 2, sy - elevOffset);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  /** Render country names at their capital locations */
  private renderCountryNames(ctx: CanvasRenderingContext2D, state: GameState): void {
    const { world } = state;

    for (const country of world.countries.values()) {
      const capital = world.locations.get(country.capitalLocationId);
      if (!capital) continue;

      // Only show name if the capital tile is explored
      const tile = world.tiles[capital.position.y]?.[capital.position.x];
      if (!tile || !tile.explored) continue;

      const { x, y } = capital.position;
      const sx = (x - y) * (TILE_WIDTH / 2);
      const sy = (x + y) * (TILE_HEIGHT / 2);
      const elevOffset = Math.floor(tile.elevation * 5) * ELEVATION_HEIGHT;

      // Draw country name with a subtle shadow
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(country.name, sx + 1, sy - elevOffset - 55 + 1);

      // Text in country color
      ctx.fillStyle = country.color;
      ctx.fillText(country.name, sx, sy - elevOffset - 55);
    }
  }

  /** Render minimap */
  private renderMinimap(ctx: CanvasRenderingContext2D, state: GameState): void {
    const mmSize = 160;
    const mmX = this.camera.screenWidth - mmSize - 12;
    const mmY = 12;

    // Generate minimap image if needed
    if (this.minimapDirty || !this.minimapCanvas) {
      this.minimapCanvas = this.generateMinimapImage(state);
      this.minimapDirty = false;
    }

    // Background
    ctx.fillStyle = 'rgba(10,10,20,0.8)';
    ctx.fillRect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4);
    ctx.strokeStyle = PALETTE.uiBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4);

    ctx.drawImage(this.minimapCanvas, mmX, mmY, mmSize, mmSize);

    // Camera viewport indicator
    const scaleX = mmSize / state.world.width;
    const scaleY = mmSize / state.world.height;
    const range = this.camera.getVisibleRange(state.world.width, state.world.height);
    ctx.strokeStyle = PALETTE.uiHighlight;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mmX + range.minX * scaleX,
      mmY + range.minY * scaleY,
      (range.maxX - range.minX) * scaleX,
      (range.maxY - range.minY) * scaleY,
    );

    // Party position
    const px = mmX + state.party.position.x * scaleX;
    const py = mmY + state.party.position.y * scaleY;
    ctx.fillStyle = PALETTE.uiHighlight;
    ctx.fillRect(px - 2, py - 2, 4, 4);
  }

  /** Generate minimap as offscreen canvas */
  private generateMinimapImage(state: GameState): OffscreenCanvas {
    const { world } = state;
    const canvas = new OffscreenCanvas(world.width, world.height);
    const ctx = canvas.getContext('2d')!;

    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.tiles[y][x];
        ctx.fillStyle = getMinimapColor(tile);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Draw locations as bright dots
    for (const loc of world.locations.values()) {
      if (loc.isDestroyed) continue;
      const country = world.countries.get(loc.countryId ?? '');
      ctx.fillStyle = country?.color ?? '#ffffff';
      ctx.fillRect(loc.position.x - 1, loc.position.y - 1, 3, 3);
    }

    return canvas;
  }

  /** Mark minimap as needing regeneration */
  invalidateMinimap(): void {
    this.minimapDirty = true;
  }

  /**
   * Smooth fog of war — per-tile isometric diamonds with alpha values
   * that are averaged with neighbours so edges blend continuously.
   * Slightly oversized diamonds overlap to eliminate seams.
   */
  private renderFogOfWar(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    range: { minX: number; maxX: number; minY: number; maxY: number },
  ): void {
    const { world, party } = state;
    const px = party.position.x;
    const py = party.position.y;
    const visionR = 6;

    // Pre-compute raw alpha for each tile in range
    const rw = range.maxX - range.minX + 1;
    const rh = range.maxY - range.minY + 1;
    const rawAlpha = new Float32Array(rw * rh);

    for (let ty = range.minY; ty <= range.maxY; ty++) {
      for (let tx = range.minX; tx <= range.maxX; tx++) {
        const tile = world.tiles[ty][tx];
        const dx = tx - px;
        const dy = ty - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let a: number;
        if (!tile.explored) {
          a = 0.86;
        } else if (tile.visible) {
          // Soft fade at vision edge
          a = Math.max(0, Math.min(1, (dist - visionR + 2) / 2.5)) * 0.4;
        } else {
          a = 0.48;
        }
        rawAlpha[(ty - range.minY) * rw + (tx - range.minX)] = a;
      }
    }

    // Smoothed alpha: average each tile with its 8 neighbours
    const smooth = new Float32Array(rw * rh);
    for (let ly = 0; ly < rh; ly++) {
      for (let lx = 0; lx < rw; lx++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = lx + dx;
            const ny = ly + dy;
            if (nx >= 0 && nx < rw && ny >= 0 && ny < rh) {
              sum += rawAlpha[ny * rw + nx];
              count++;
            }
          }
        }
        smooth[ly * rw + lx] = sum / count;
      }
    }

    // Draw slightly oversized diamonds so they overlap and hide seams
    const ow = TILE_WIDTH + 4;
    const oh = TILE_HEIGHT + 4;

    for (let ty = range.minY; ty <= range.maxY; ty++) {
      for (let tx = range.minX; tx <= range.maxX; tx++) {
        const alpha = smooth[(ty - range.minY) * rw + (tx - range.minX)];
        if (alpha < 0.01) continue; // fully clear — skip

        const sx = (tx - ty) * (TILE_WIDTH / 2);
        const sy = (tx + ty) * (TILE_HEIGHT / 2);
        const elevOffset = Math.floor(world.tiles[ty][tx].elevation * 5) * ELEVATION_HEIGHT;
        const cy = sy - elevOffset;

        ctx.fillStyle = `rgba(10,10,18,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(sx,        cy - oh / 2);
        ctx.lineTo(sx + ow / 2, cy);
        ctx.lineTo(sx,        cy + oh / 2);
        ctx.lineTo(sx - ow / 2, cy);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /** Fill an isometric diamond shape */
  private fillIsoDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
    ctx.fill();
  }
}

/** Get color for minimap pixel */
function getMinimapColor(tile: Tile): string {
  if (tile.locationId) return '#ffffff';
  if (tile.roadLevel > 0) return PALETTE.roadDirt;

  switch (tile.biome) {
    case 'ocean': return PALETTE.deepWater;
    case 'beach': return PALETTE.sand;
    case 'desert': return PALETTE.desert;
    case 'grassland': return PALETTE.grass;
    case 'forest': return PALETTE.tree;
    case 'dense_forest': return PALETTE.treeDark;
    case 'jungle': return PALETTE.jungleTree;
    case 'hills': return PALETTE.hillGrass;
    case 'mountain': return PALETTE.rock;
    case 'snow_mountain': return PALETTE.snow;
    case 'tundra': return PALETTE.tundra;
    case 'swamp': return PALETTE.swamp;
    case 'savanna': return PALETTE.savanna;
    default: return PALETTE.grass;
  }
}
