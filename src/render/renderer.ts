import type { GameState } from '../types/game';
import type { World } from '../types/world';
import type { Tile } from '../types/terrain';
import type { Location } from '../types/location';
import type { Creature } from '../types/creature';
import { Camera, TILE_WIDTH, TILE_HEIGHT, ELEVATION_HEIGHT } from './camera';
import { getTerrainSprite, type TerrainLayer } from './sprites/terrain-sprites';
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
  private currentState: GameState | null = null;

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
    this.currentState = state; // Store for helper methods
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

    // Pass 1: Ground (elevation walls + diamond + texture) — back-to-front
    for (let y = range.minY; y <= range.maxY; y++) {
      for (let x = range.minX; x <= range.maxX; x++) {
        this.renderTileLayer(ctx, world.tiles[y][x], season, 'ground');
      }
    }

    // Pass 2: Roads + piers + working sites (on top of ground, below trees)
    for (let y = range.minY; y <= range.maxY; y++) {
      for (let x = range.minX; x <= range.maxX; x++) {
        const tile = world.tiles[y][x];
        if (!tile.explored) continue;

        const sx = (x - y) * (TILE_WIDTH / 2);
        const sy = (x + y) * (TILE_HEIGHT / 2);
        const elevOffset = Math.floor(tile.elevation * 5) * ELEVATION_HEIGHT;

        if (tile.roadLevel > 0) {
          this.renderRoad(ctx, tile, sx, sy - elevOffset, world);
        }
        if (tile.features.some(f => f.type === 'pier')) {
          this.renderPier(ctx, sx, sy - elevOffset);
        }
      }
    }
    this.renderWorkingSites(ctx, world, range);

    // Pass 3: Vegetation (trees, bushes) — on top of roads
    for (let y = range.minY; y <= range.maxY; y++) {
      for (let x = range.minX; x <= range.maxX; x++) {
        this.renderTileLayer(ctx, world.tiles[y][x], season, 'vegetation');
      }
    }

    // Render locations (only on explored tiles)
    for (let y = range.minY; y <= range.maxY; y++) {
      for (let x = range.minX; x <= range.maxX; x++) {
        const tile = world.tiles[y][x];
        if (tile.locationId && tile.explored) {
          const loc = world.locations.get(tile.locationId);
          if (loc) {
            const countryColor = world.countries.get(loc.countryId ?? '')?.color ?? null;
            this.renderLocation(ctx, loc, countryColor, tile.elevation);

            // Burning overlay when on fire
            if (!loc.isDestroyed && loc.burningTurns > 0) {
              this.renderBurning(ctx, tile, loc.burningTurns);
            }
            // Smoke for destroyed or recently burned settlements
            if (loc.isDestroyed || (!loc.isDestroyed && loc.durability < 20)) {
              this.renderSmoke(ctx, tile);
            }
          }
        }
      }
    }

    // Calculate combat animation offsets and rotations
    const combatAnim = state.combatAnimation;
    let partyCombatOffset = { x: 0, y: 0 };
    let enemyCombatOffset = { x: 0, y: 0 };
    let partyRotation = 0;
    let enemyRotation = 0;
    
    if (combatAnim && combatAnim.active) {
      const elapsed = Date.now() - combatAnim.startTime;
      const progress = Math.min(elapsed / combatAnim.duration, 1);
      
      // Oscillate back and forth (sine wave)
      const oscillation = Math.sin(progress * Math.PI * 2 * combatAnim.rounds);
      const amplitude = 2; // pixels to move side-to-side (reduced for subtlety)
      
      partyCombatOffset = { x: oscillation * amplitude, y: 0 };
      enemyCombatOffset = { x: -oscillation * amplitude, y: 0 }; // opposite direction
      
      // Add rotation/leaning (tilt back and forth)
      const rotationAmplitude = 0.15; // radians (~8.5 degrees)
      partyRotation = oscillation * rotationAmplitude;
      enemyRotation = -oscillation * rotationAmplitude; // opposite lean
      
      // Clean up animation when done
      if (progress >= 1) {
        // Remove dead enemies after animation
        const enemy = world.creatures.get(combatAnim.enemyId);
        if (enemy && enemy.health <= 0) {
          // Calculate offset if creature was on same tile as party
          let offsetX = 0;
          let offsetY = 0;
          if (enemy.position.x === party.position.x && enemy.position.y === party.position.y) {
            offsetX = 12;
            offsetY = 6;
          }
          
          // Add blood splash before removing creature
          world.bloodSplashes.push({
            x: enemy.position.x,
            y: enemy.position.y,
            offsetX,
            offsetY,
            createdTurn: state.turn,
            creatureType: enemy.type
          });
          world.creatures.delete(combatAnim.enemyId);
        }
        state.combatAnimation = null;
      }
    }

    // Render creatures (only on visible tiles)
    for (const creature of world.creatures.values()) {
      const { x, y } = creature.position;
      if (x >= range.minX && x <= range.maxX && y >= range.minY && y <= range.maxY) {
        const tile = world.tiles[y][x];
        if (tile.visible) {
          // Apply combat offset and rotation if this creature is in combat
          const offset = (combatAnim && combatAnim.enemyId === creature.id) ? enemyCombatOffset : { x: 0, y: 0 };
          const rot = (combatAnim && combatAnim.enemyId === creature.id) ? enemyRotation : 0;
          this.renderCreature(ctx, creature, tile.elevation, party.position, offset, rot);
        }
      }
    }

    // Render player party
    const partyOffset = combatAnim ? partyCombatOffset : { x: 0, y: 0 };
    const partyRot = combatAnim ? partyRotation : 0;
    this.renderParty(ctx, party.position.x, party.position.y,
      world.tiles[party.position.y]?.[party.position.x]?.elevation ?? 0.3,
      party.isSailing, partyOffset, partyRot);

    // Render selection highlight
    if (state.selectedTile) {
      this.renderSelectionHighlight(ctx, state.selectedTile.x, state.selectedTile.y,
        world.tiles[state.selectedTile.y]?.[state.selectedTile.x]?.elevation ?? 0.3);
    }

    // Render blood splashes
    this.renderBloodSplashes(ctx, world, state.turn, range);

    // Render country borders and names
    this.renderCountryBorders(ctx, world, range);
    this.renderCountryNames(ctx, state);

    // Render smooth fog of war (in world space, on top of everything)
    this.renderFogOfWar(ctx, state, range);

    ctx.restore();

    // Render minimap
    this.renderMinimap(ctx, state);
  }

  /** Render one layer (ground or vegetation) of a terrain tile */
  private renderTileLayer(
    ctx: CanvasRenderingContext2D,
    tile: Tile,
    season: Season,
    layer: TerrainLayer,
  ): void {
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
      layer,
    );

    const drawX = sx - TILE_WIDTH / 2;
    const drawY = sy - sprite.height + TILE_HEIGHT / 2;

    ctx.drawImage(sprite, drawX, drawY);
  }

  /**
   * Render road on tile — draws isometric line segments toward
   * each neighboring road tile, smoothly interpolating elevation
   * so roads follow the terrain instead of jumping between heights.
   */
  /**
   * Render road on tile — soft curved segments with transparency
   * so they look like natural dirt/stone tracks.
   */
  private renderRoad(
    ctx: CanvasRenderingContext2D,
    tile: Tile,
    sx: number,
    sy: number,
    world: GameState['world'],
  ): void {
    const level = tile.roadLevel;

    // Semi-transparent earthy colours
    const color = level >= 3 ? 'rgba(180,170,155,0.6)'
      : level >= 2 ? 'rgba(150,135,115,0.55)'
      : 'rgba(130,110,80,0.45)';
    const lineW = level >= 3 ? 5 : level >= 2 ? 4 : 3;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const thisElev = Math.floor(tile.elevation * 5) * ELEVATION_HEIGHT;

    // Deterministic wobble per tile so curves are consistent across frames
    const wobble = ((tile.x * 7 + tile.y * 13) % 5) - 2; // -2 to +2

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
        const neighborElev = Math.floor(neighbor.elevation * 5) * ELEVATION_HEIGHT;
        const midElev = (thisElev + neighborElev) / 2;
        const elevDelta = midElev - thisElev;

        const halfX = dir.isoX / 2;
        const halfY = dir.isoY / 2;

        // Control point offset perpendicular to the direction for a gentle curve
        const perpX = -dir.isoY * 0.08 + wobble * 0.4;
        const perpY =  dir.isoX * 0.08 + wobble * 0.3;

        const endX = sx + halfX;
        const endY = sy + halfY - elevDelta;
        const cpX = sx + halfX * 0.5 + perpX;
        const cpY = sy + halfY * 0.5 - elevDelta * 0.5 + perpY;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.stroke();
        hasConnection = true;
      }
    }

    if (!hasConnection) {
      ctx.fillStyle = color;
      const r = lineW / 2;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Render farm fields, mine entrances, and lumber stumps on tiles
   * adjacent to settlements that have those buildings.
   */
  private renderWorkingSites(
    ctx: CanvasRenderingContext2D,
    world: GameState['world'],
    range: { minX: number; maxX: number; minY: number; maxY: number },
  ): void {
    for (const loc of world.locations.values()) {
      if (loc.isDestroyed) continue;
      const { x: lx, y: ly } = loc.position;

      // Check what buildings this settlement has
      const hasFarms = loc.buildings.some(b => b.type === 'farm_field' && b.isOperational);
      const hasMines = loc.buildings.some(b => b.type === 'mine_shaft' && b.isOperational);
      const hasSawmill = loc.buildings.some(b => (b.type === 'sawmill' || b.type === 'hunter_lodge') && b.isOperational);

      if (!hasFarms && !hasMines && !hasSawmill) continue;

      // Farm field count determines how many adjacent tiles get fields
      const farmCount = loc.buildings.filter(b => b.type === 'farm_field').length;
      const mineCount = loc.buildings.filter(b => b.type === 'mine_shaft').length;

      // Deterministic pattern of adjacent tiles for this location
      const adjacents = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
      ];

      let farmsPlaced = 0;
      let minesPlaced = 0;

      for (const adj of adjacents) {
        const nx = lx + adj.dx;
        const ny = ly + adj.dy;
        if (nx < range.minX || nx > range.maxX || ny < range.minY || ny > range.maxY) continue;
        if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;

        const tile = world.tiles[ny][nx];
        if (!tile.explored) continue;
        if (tile.locationId) continue; // don't draw on other settlements
        if (tile.terrainType === 'deep_ocean' || tile.terrainType === 'shallow_ocean') continue;

        const sx = (nx - ny) * (TILE_WIDTH / 2);
        const sy = (nx + ny) * (TILE_HEIGHT / 2);
        const elevOffset = Math.floor(tile.elevation * 5) * ELEVATION_HEIGHT;
        const cy = sy - elevOffset;

        // Draw farm fields on grassland/savanna adjacent tiles
        if (hasFarms && farmsPlaced < farmCount &&
            (tile.biome === 'grassland' || tile.biome === 'savanna' || tile.biome === 'forest')) {
          this.drawFieldOverlay(ctx, sx, cy);
          farmsPlaced++;
          continue;
        }

        // Draw mine entrance on hills/mountain adjacent tiles
        if (hasMines && minesPlaced < mineCount &&
            (tile.biome === 'hills' || tile.biome === 'mountain')) {
          this.drawMineOverlay(ctx, sx, cy);
          minesPlaced++;
          continue;
        }

        // Draw lumber stumps on forest adjacent tiles
        if (hasSawmill &&
            (tile.biome === 'forest' || tile.biome === 'dense_forest')) {
          this.drawStumpOverlay(ctx, sx, cy);
        }
      }
    }
  }

  /** Draw crop field rows on a tile — isometric diagonal rows */
  private drawFieldOverlay(ctx: CanvasRenderingContext2D, sx: number, cy: number): void {
    // Plowed earth — isometric rows running NE-SW across the diamond
    const rows = 7;
    const rowSpacing = TILE_HEIGHT / (rows + 1);

    for (let i = 1; i <= rows; i++) {
      const ry = cy - TILE_HEIGHT / 2 + i * rowSpacing;
      // Width of diamond at this y-offset
      const t = Math.abs(ry - cy) / (TILE_HEIGHT / 2);
      const halfW = (TILE_WIDTH / 2) * (1 - t) * 0.75;
      if (halfW < 2) continue;

      // Soil row
      ctx.fillStyle = i % 2 === 0 ? 'rgba(138,112,64,0.5)' : 'rgba(110,90,50,0.45)';
      ctx.fillRect(sx - halfW, ry, halfW * 2, 1);

      // Crop row (green/wheat alternating)
      ctx.fillStyle = i % 2 === 0 ? 'rgba(104,160,48,0.6)' : 'rgba(200,176,64,0.55)';
      ctx.fillRect(sx - halfW + 2, ry - 1, halfW * 2 - 4, 1);
    }
  }

  /** Draw mine entrance on a tile */
  private drawMineOverlay(ctx: CanvasRenderingContext2D, sx: number, cy: number): void {
    // Dark entrance
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(sx - 5, cy - 4, 10, 6);
    // Wooden frame
    ctx.fillStyle = '#6a4a20';
    ctx.fillRect(sx - 6, cy - 5, 12, 2);
    ctx.fillRect(sx - 6, cy - 5, 2, 8);
    ctx.fillRect(sx + 4, cy - 5, 2, 8);
    // Ore pile
    ctx.fillStyle = '#7a6a5a';
    ctx.fillRect(sx + 7, cy - 1, 4, 2);
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(sx + 8, cy - 2, 2, 1);
    // Cart track
    ctx.fillStyle = '#5a4a30';
    ctx.fillRect(sx - 2, cy + 2, 8, 1);
  }

  /** Draw lumber stumps on a tile */
  private drawStumpOverlay(ctx: CanvasRenderingContext2D, sx: number, cy: number): void {
    // Tree stumps
    ctx.fillStyle = '#6a5028';
    ctx.fillRect(sx - 6, cy, 4, 3);
    ctx.fillRect(sx + 4, cy - 2, 3, 3);
    // Log pile
    ctx.fillStyle = '#7a5a30';
    ctx.fillRect(sx - 2, cy + 1, 6, 2);
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(sx - 1, cy, 4, 1);
  }

  /** Render fire overlay on a burning settlement */
  private renderBurning(ctx: CanvasRenderingContext2D, tile: Tile, burningTurns: number): void {
    const sx = (tile.x - tile.y) * (TILE_WIDTH / 2);
    const sy = (tile.x + tile.y) * (TILE_HEIGHT / 2);
    const elevOffset = Math.floor(tile.elevation * 5) * ELEVATION_HEIGHT;
    const intensity = Math.min(1, burningTurns / 3); // stronger fire with more turns

    const t = this.animationTime * 4;
    const flicker = Math.sin(t) * 0.3 + 0.7;

    // Fire glow
    ctx.fillStyle = `rgba(255,100,20,${(0.4 * intensity * flicker).toFixed(2)})`;
    ctx.fillRect(sx - 12, sy - elevOffset - 22, 24, 14);

    // Fire particles — more when burning hotter
    const particleCount = Math.ceil(intensity * 5);
    for (let i = 0; i < particleCount; i++) {
      const fx = sx - 8 + i * 5 + Math.sin(t + i * 2.3) * 3;
      const fy = sy - elevOffset - 28 - i * 3 + Math.cos(t + i * 1.7) * 2;
      ctx.fillStyle = `rgba(255,200,40,${(0.6 * intensity * flicker).toFixed(2)})`;
      ctx.fillRect(fx, fy, 3, 4);
      ctx.fillStyle = `rgba(255,60,10,${(0.5 * intensity).toFixed(2)})`;
      ctx.fillRect(fx + 1, fy + 3, 2, 2);
    }

    // Embers rising
    for (let i = 0; i < 3; i++) {
      const ex = sx - 4 + i * 4 + Math.sin(t * 1.5 + i * 3) * 5;
      const ey = sy - elevOffset - 35 - ((t * 8 + i * 12) % 20);
      const ea = Math.max(0, 0.5 - ((t + i * 2) % 4) * 0.15);
      ctx.fillStyle = `rgba(255,180,50,${ea.toFixed(2)})`;
      ctx.fillRect(ex, ey, 1, 1);
    }
  }

  /** Render drifting smoke on ruins */
  private renderSmoke(ctx: CanvasRenderingContext2D, tile: Tile): void {
    const sx = (tile.x - tile.y) * (TILE_WIDTH / 2);
    const sy = (tile.x + tile.y) * (TILE_HEIGHT / 2);
    const elevOffset = Math.floor(tile.elevation * 5) * ELEVATION_HEIGHT;
    const t = this.animationTime * 2;

    for (let i = 0; i < 4; i++) {
      const smokeX = sx - 8 + i * 5 + Math.sin(t + i * 1.5) * 3;
      const smokeY = sy - elevOffset - 30 - (t * 2 + i * 8) % 20;
      const alpha = Math.max(0, 0.25 - ((t + i * 3) % 5) * 0.05);
      ctx.fillStyle = `rgba(80,70,60,${alpha.toFixed(2)})`;
      ctx.fillRect(smokeX, smokeY, 4, 3);
    }
  }

  /** Render a pier with a small boat on a water tile */
  private renderPier(ctx: CanvasRenderingContext2D, sx: number, cy: number): void {
    // Wooden pier planks
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(sx - 8, cy - 2, 16, 4);
    ctx.fillStyle = '#7a5a2a';
    ctx.fillRect(sx - 6, cy - 1, 12, 2);
    // Support posts
    ctx.fillStyle = '#5a4020';
    ctx.fillRect(sx - 7, cy + 2, 2, 4);
    ctx.fillRect(sx + 5, cy + 2, 2, 4);
    // Small boat moored at pier
    ctx.fillStyle = '#6a5030';
    ctx.fillRect(sx - 5, cy + 5, 10, 3);
    ctx.fillStyle = '#8a7040';
    ctx.fillRect(sx - 4, cy + 5, 8, 2);
    // Mast
    ctx.fillStyle = '#5a4020';
    ctx.fillRect(sx, cy + 1, 1, 5);
    // Sail
    ctx.fillStyle = '#d8d0c0';
    ctx.fillRect(sx + 1, cy + 1, 3, 3);
    ctx.fillStyle = '#c8c0b0';
    ctx.fillRect(sx + 1, cy + 2, 2, 2);
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

    const sprite = getBuildingSprite(loc.type, loc.size, countryColor, loc.originalType);
    ctx.drawImage(sprite, sx - 24, sy - elevOffset - 40);

    // Location name label — dimmed for ruins
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    const label = loc.isDestroyed ? `${loc.name} (ruins)` : loc.name;
    
    // Add dark background for better readability on bright backgrounds
    const textMetrics = ctx.measureText(label);
    const textWidth = textMetrics.width;
    const textHeight = 7; // font size
    const padding = 2;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(
      sx - textWidth / 2 - padding,
      sy - elevOffset - 42 - textHeight + 1,
      textWidth + padding * 2,
      textHeight + padding
    );
    
    // Text on top
    ctx.fillStyle = loc.isDestroyed ? '#b0a090' : PALETTE.uiText;
    ctx.fillText(label, sx, sy - elevOffset - 42);
  }

  /** Render a creature */
  private renderCreature(
    ctx: CanvasRenderingContext2D,
    creature: Creature,
    elevation: number,
    partyPos: { x: number; y: number },
    combatOffset: { x: number; y: number } = { x: 0, y: 0 },
    rotation: number = 0
  ): void {
    const { x, y } = creature.position;
    let sx = (x - y) * (TILE_WIDTH / 2);
    let sy = (x + y) * (TILE_HEIGHT / 2);
    const elevOffset = Math.floor(elevation * 5) * ELEVATION_HEIGHT;

    // If creature is on the same tile as the party, offset it slightly to keep it visible
    if (creature.position.x === partyPos.x && creature.position.y === partyPos.y) {
      // Offset to the bottom-right corner of the tile
      sx += 12;
      sy += 6;
    }

    // Apply combat animation offset
    sx += combatOffset.x;
    sy += combatOffset.y;

    const sprite = getCreatureSprite(creature.type);
    
    // Apply rotation if in combat
    if (rotation !== 0) {
      ctx.save();
      ctx.translate(sx, sy - elevOffset - 8); // center of sprite
      ctx.rotate(rotation);
      ctx.drawImage(sprite, -8, -8);
      
      // Draw country-colored helmet for guards/armies
      if ((creature.type === 'guard' || creature.type === 'army') && creature.countryId) {
        const country = this.getCountry(creature.countryId);
        if (country) {
          this.drawColoredHelmet(ctx, 0, 0, country.color, creature.type);
        }
      }
      
      ctx.restore();
    } else {
      ctx.drawImage(sprite, sx - 8, sy - elevOffset - 16);
      
      // Draw country-colored helmet for guards/armies
      if ((creature.type === 'guard' || creature.type === 'army') && creature.countryId) {
        const country = this.getCountry(creature.countryId);
        if (country) {
          this.drawColoredHelmet(ctx, sx, sy - elevOffset - 16, country.color, creature.type);
        }
      }
    }
  }
  
  /** Draw a colored helmet overlay for military units */
  private drawColoredHelmet(ctx: CanvasRenderingContext2D, sx: number, sy: number, color: string, type: 'guard' | 'army'): void {
    if (type === 'guard') {
      // Guard helmet (single unit)
      ctx.fillStyle = color;
      ctx.fillRect(sx - 2 + 8, sy + 2, 5, 2);
      ctx.fillRect(sx - 1 + 8, sy + 1, 3, 1);
    } else if (type === 'army') {
      // Army helmets (multiple units)
      for (let i = -1; i <= 1; i++) {
        const ox = i * 3;
        const oy = Math.abs(i);
        ctx.fillStyle = color;
        ctx.fillRect(sx + ox - 1 + 8, sy + 7 + oy, 3, 2);
      }
      // Army banner flag
      ctx.fillStyle = color;
      ctx.fillRect(sx - 1 + 8, sy + 1, 4, 3);
    }
  }
  
  /** Helper to get country from world */
  private getCountry(countryId: string) {
    // Access through the current state that's being rendered
    const state = this.currentState;
    if (!state) return null;
    return state.world.countries.get(countryId);
  }

  /** Render the player party */
  private renderParty(ctx: CanvasRenderingContext2D, px: number, py: number, elevation: number, isSailing = false, combatOffset: { x: number; y: number } = { x: 0, y: 0 }, rotation: number = 0): void {
    let sx = (px - py) * (TILE_WIDTH / 2);
    let sy = (px + py) * (TILE_HEIGHT / 2);
    const elevOffset = Math.floor(elevation * 5) * ELEVATION_HEIGHT;

    // Apply combat animation offset
    sx += combatOffset.x;
    sy += combatOffset.y;

    // Pulsing glow
    const pulse = Math.sin(this.animationTime * 3) * 0.3 + 0.7;
    ctx.fillStyle = hexToRgba(PALETTE.uiHighlight, pulse * 0.3);
    this.fillIsoDiamond(ctx, sx, sy - elevOffset, TILE_WIDTH + 4, TILE_HEIGHT + 2);

    if (isSailing) {
      // Draw boat underneath the party
      this.drawPartyBoat(ctx, sx, sy - elevOffset);
    }

    // Party sprite (riding on top of boat when sailing)
    const sprite = getPartySprite();
    const yOff = isSailing ? -16 : -20; // sit lower in the boat
    
    // Apply rotation if in combat
    if (rotation !== 0) {
      ctx.save();
      ctx.translate(sx, sy - elevOffset + yOff + 12); // center of sprite
      ctx.rotate(rotation);
      ctx.drawImage(sprite, -8, -12);
      ctx.restore();
    } else {
      ctx.drawImage(sprite, sx - 8, sy - elevOffset + yOff);
    }
  }

  /** Draw a boat sprite for when the party is sailing */
  private drawPartyBoat(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
    // Hull
    ctx.fillStyle = '#6a4a28';
    ctx.beginPath();
    ctx.moveTo(sx - 14, sy - 2);
    ctx.lineTo(sx - 10, sy + 4);
    ctx.lineTo(sx + 10, sy + 4);
    ctx.lineTo(sx + 14, sy - 2);
    ctx.closePath();
    ctx.fill();
    // Deck
    ctx.fillStyle = '#8a6a38';
    ctx.fillRect(sx - 10, sy - 3, 20, 3);
    // Keel bottom
    ctx.fillStyle = '#5a3a18';
    ctx.fillRect(sx - 8, sy + 3, 16, 2);
    // Mast
    ctx.fillStyle = '#5a4020';
    ctx.fillRect(sx - 1, sy - 18, 2, 16);
    // Sail
    ctx.fillStyle = '#e0d8c8';
    ctx.beginPath();
    ctx.moveTo(sx + 1, sy - 17);
    ctx.lineTo(sx + 12, sy - 10);
    ctx.lineTo(sx + 1, sy - 4);
    ctx.closePath();
    ctx.fill();
    // Sail shadow
    ctx.fillStyle = '#c8c0b0';
    ctx.beginPath();
    ctx.moveTo(sx + 1, sy - 12);
    ctx.lineTo(sx + 8, sy - 8);
    ctx.lineTo(sx + 1, sy - 4);
    ctx.closePath();
    ctx.fill();
    // Gentle bobbing wave line
    const bob = Math.sin(this.animationTime * 2) * 1;
    ctx.strokeStyle = 'rgba(90,170,220,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 16, sy + 5 + bob);
    ctx.quadraticCurveTo(sx, sy + 3 + bob, sx + 16, sy + 5 + bob);
    ctx.stroke();
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

    // Cache bounds for click detection
    this.minimapBounds = { x: mmX, y: mmY, size: mmSize };
  }

  /** Minimap screen bounds (updated each frame) */
  private minimapBounds = { x: 0, y: 0, size: 0 };

  /**
   * If screenX/screenY is inside the minimap, returns the tile coordinates.
   * Otherwise returns null.
   */
  handleMinimapClick(screenX: number, screenY: number, worldWidth: number, worldHeight: number): { tx: number; ty: number } | null {
    const { x, y, size } = this.minimapBounds;
    if (size === 0) return null;
    if (screenX < x || screenX > x + size || screenY < y || screenY > y + size) return null;

    const tx = Math.floor(((screenX - x) / size) * worldWidth);
    const ty = Math.floor(((screenY - y) / size) * worldHeight);
    return { tx, ty };
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

  /** Render blood splashes that fade over time */
  private renderBloodSplashes(
    ctx: CanvasRenderingContext2D,
    world: World,
    currentTurn: number,
    range: { minX: number; maxX: number; minY: number; maxY: number }
  ): void {
    const FADE_DURATION = 10; // turns before blood fully fades
    
    for (const splash of world.bloodSplashes) {
      const { x, y, offsetX, offsetY, createdTurn } = splash;
      
      // Skip if outside visible range
      if (x < range.minX || x > range.maxX || y < range.minY || y > range.maxY) continue;
      
      const tile = world.tiles[y]?.[x];
      if (!tile || !tile.visible) continue;
      
      const age = currentTurn - createdTurn;
      if (age >= FADE_DURATION) continue; // fully faded
      
      let sx = (x - y) * (TILE_WIDTH / 2);
      let sy = (x + y) * (TILE_HEIGHT / 2);
      const elevOffset = Math.floor(tile.elevation * 5) * ELEVATION_HEIGHT;
      
      // Apply stored offset (if creature was offset from party when killed)
      sx += offsetX;
      sy += offsetY;
      
      // Fade out over time
      const opacity = Math.max(0, 1 - (age / FADE_DURATION));
      
      // Draw blood splash (dark red irregular shape)
      ctx.fillStyle = `rgba(100, 20, 20, ${opacity * 0.7})`;
      
      // Draw several overlapping circles to create a splash effect
      const baseRadius = 4;
      ctx.globalAlpha = opacity * 0.7;
      
      // Main splash
      ctx.beginPath();
      ctx.arc(sx, sy - elevOffset, baseRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Splatter drops
      ctx.beginPath();
      ctx.arc(sx - 3, sy - elevOffset - 2, baseRadius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(sx + 2, sy - elevOffset + 2, baseRadius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(sx + 4, sy - elevOffset - 1, baseRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.globalAlpha = 1;
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
