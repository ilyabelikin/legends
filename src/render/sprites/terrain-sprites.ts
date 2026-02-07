import { PALETTE, darkenColor, lightenColor } from '../palette';
import { TILE_WIDTH, TILE_HEIGHT, ELEVATION_HEIGHT } from '../camera';
import type { BiomeType } from '../../types/biome';
import type { Season } from '../../types/season';

/** Cache for terrain sprites */
const spriteCache = new Map<string, OffscreenCanvas>();

/** Get or create a terrain sprite for a biome */
export function getTerrainSprite(
  biome: BiomeType,
  elevation: number,
  variant: number,
  season: Season,
  vegetation: number,
): OffscreenCanvas {
  // Quantize values to reduce unique cache entries (max ~3000 sprites)
  const elevKey = Math.round(elevation * 5);
  const vegKey = Math.round(vegetation * 3);
  const key = `${biome}_${elevKey}_${variant}_${season}_${vegKey}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const sprite = createTerrainSprite(biome, elevation, variant, season, vegetation);
  spriteCache.set(key, sprite);
  return sprite;
}

/** Create an isometric terrain tile sprite */
function createTerrainSprite(
  biome: BiomeType,
  elevation: number,
  variant: number,
  season: Season,
  vegetation: number,
): OffscreenCanvas {
  const elevPx = Math.floor(elevation * 5) * ELEVATION_HEIGHT;
  const totalHeight = TILE_HEIGHT + elevPx + 40; // extra for vegetation
  const canvas = new OffscreenCanvas(TILE_WIDTH + 2, totalHeight);
  const ctx = canvas.getContext('2d')!;

  const colors = getBiomeColors(biome, season);
  const baseY = totalHeight - TILE_HEIGHT - elevPx;

  // Draw elevation side (left face)
  if (elevPx > 0) {
    drawElevationSide(ctx, baseY + TILE_HEIGHT / 2, elevPx, colors.sideDark, colors.sideLight);
  }

  // Draw top diamond
  drawIsoDiamond(ctx, TILE_WIDTH / 2 + 1, baseY + TILE_HEIGHT / 2, TILE_WIDTH, TILE_HEIGHT, colors.top);

  // Add terrain texture
  addTerrainTexture(ctx, TILE_WIDTH / 2 + 1, baseY + TILE_HEIGHT / 2, biome, variant, colors);

  // Draw vegetation
  if (vegetation > 0.1 && biome !== 'ocean' && biome !== 'beach' && biome !== 'desert') {
    drawVegetation(ctx, TILE_WIDTH / 2 + 1, baseY, biome, vegetation, season, variant);
  }

  // Water animation hint (shimmering)
  if (biome === 'ocean') {
    addWaterEffect(ctx, TILE_WIDTH / 2 + 1, baseY + TILE_HEIGHT / 2, variant);
  }

  return canvas;
}

/** Get colors for a biome with seasonal variation */
function getBiomeColors(biome: BiomeType, season: Season): {
  top: string; sideDark: string; sideLight: string; accent: string
} {
  let top: string;
  let accent: string;

  switch (biome) {
    case 'ocean':
      top = season === 'winter' ? PALETTE.deepWater : PALETTE.water;
      accent = PALETTE.waterHighlight;
      break;
    case 'beach':
      top = PALETTE.sand;
      accent = PALETTE.sandDark;
      break;
    case 'desert':
      top = PALETTE.desert;
      accent = PALETTE.desertDark;
      break;
    case 'grassland':
      top = season === 'winter' ? PALETTE.dryGrass
        : season === 'autumn' ? '#8ca04c'
        : PALETTE.grass;
      accent = PALETTE.grassLight;
      break;
    case 'forest':
    case 'dense_forest':
      top = season === 'winter' ? '#5c7c4c'
        : season === 'autumn' ? '#a07030'
        : PALETTE.grassDark;
      accent = PALETTE.treeLight;
      break;
    case 'jungle':
      top = PALETTE.jungleTree;
      accent = PALETTE.jungleTreeDark;
      break;
    case 'hills':
      top = season === 'winter' ? PALETTE.snowShadow : PALETTE.hillGrass;
      accent = PALETTE.rock;
      break;
    case 'mountain':
      top = PALETTE.rock;
      accent = PALETTE.rockDark;
      break;
    case 'snow_mountain':
      top = PALETTE.snow;
      accent = PALETTE.snowShadow;
      break;
    case 'tundra':
      top = season === 'winter' ? PALETTE.snow : PALETTE.tundra;
      accent = PALETTE.tundraDark;
      break;
    case 'swamp':
      top = PALETTE.swamp;
      accent = PALETTE.swampWater;
      break;
    case 'savanna':
      top = season === 'winter' ? PALETTE.dryGrass : PALETTE.savanna;
      accent = PALETTE.savannaDark;
      break;
    default:
      top = PALETTE.grass;
      accent = PALETTE.grassDark;
  }

  return {
    top,
    sideDark: darkenColor(top, 40),
    sideLight: darkenColor(top, 20),
    accent,
  };
}

/** Draw an isometric diamond (top face of tile) */
function drawIsoDiamond(
  ctx: OffscreenCanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);      // top
  ctx.lineTo(cx + w / 2, cy);      // right
  ctx.lineTo(cx, cy + h / 2);      // bottom
  ctx.lineTo(cx - w / 2, cy);      // left
  ctx.closePath();
  ctx.fill();
}

/** Draw elevation sides */
function drawElevationSide(
  ctx: OffscreenCanvasRenderingContext2D,
  topY: number,
  height: number,
  darkColor: string,
  lightColor: string,
): void {
  const cx = TILE_WIDTH / 2 + 1;

  // Left face
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.moveTo(cx - TILE_WIDTH / 2, topY);
  ctx.lineTo(cx, topY + TILE_HEIGHT / 2);
  ctx.lineTo(cx, topY + TILE_HEIGHT / 2 + height);
  ctx.lineTo(cx - TILE_WIDTH / 2, topY + height);
  ctx.closePath();
  ctx.fill();

  // Right face
  ctx.fillStyle = lightColor;
  ctx.beginPath();
  ctx.moveTo(cx + TILE_WIDTH / 2, topY);
  ctx.lineTo(cx, topY + TILE_HEIGHT / 2);
  ctx.lineTo(cx, topY + TILE_HEIGHT / 2 + height);
  ctx.lineTo(cx + TILE_WIDTH / 2, topY + height);
  ctx.closePath();
  ctx.fill();
}

/** Add pixel-art texture patterns on the tile surface */
function addTerrainTexture(
  ctx: OffscreenCanvasRenderingContext2D,
  cx: number, cy: number,
  biome: BiomeType,
  variant: number,
  colors: { top: string; accent: string },
): void {
  // Use a deterministic pattern based on variant
  const rng = simpleHash(variant);
  ctx.fillStyle = colors.accent;

  if (biome === 'grassland' || biome === 'savanna') {
    // Small grass tufts
    for (let i = 0; i < 6; i++) {
      const ox = ((rng * (i + 1) * 7) % 40) - 20;
      const oy = ((rng * (i + 1) * 11) % 20) - 10;
      if (isInsideDiamond(ox, oy, TILE_WIDTH - 8, TILE_HEIGHT - 4)) {
        ctx.fillRect(cx + ox, cy + oy, 2, 1);
      }
    }
  } else if (biome === 'desert') {
    // Sand ripples
    for (let i = 0; i < 4; i++) {
      const ox = ((rng * (i + 1) * 13) % 30) - 15;
      const oy = ((rng * (i + 1) * 17) % 14) - 7;
      if (isInsideDiamond(ox, oy, TILE_WIDTH - 12, TILE_HEIGHT - 6)) {
        ctx.fillRect(cx + ox, cy + oy, 4, 1);
      }
    }
  } else if (biome === 'mountain' || biome === 'snow_mountain') {
    // Rocky texture
    for (let i = 0; i < 5; i++) {
      const ox = ((rng * (i + 1) * 9) % 36) - 18;
      const oy = ((rng * (i + 1) * 13) % 16) - 8;
      if (isInsideDiamond(ox, oy, TILE_WIDTH - 10, TILE_HEIGHT - 5)) {
        ctx.fillRect(cx + ox, cy + oy, 3, 2);
      }
    }
  } else if (biome === 'swamp') {
    // Water puddles
    ctx.fillStyle = PALETTE.swampWater;
    for (let i = 0; i < 3; i++) {
      const ox = ((rng * (i + 1) * 11) % 30) - 15;
      const oy = ((rng * (i + 1) * 7) % 12) - 6;
      if (isInsideDiamond(ox, oy, TILE_WIDTH - 16, TILE_HEIGHT - 8)) {
        ctx.fillRect(cx + ox, cy + oy, 5, 2);
      }
    }
  }
}

/** Draw vegetation (trees, bushes) on top of tile */
function drawVegetation(
  ctx: OffscreenCanvasRenderingContext2D,
  cx: number, baseY: number,
  biome: BiomeType,
  density: number,
  season: Season,
  variant: number,
): void {
  const treeCount = Math.floor(density * 4);
  const rng = simpleHash(variant + 1000);

  for (let i = 0; i < treeCount; i++) {
    const ox = ((rng * (i + 1) * 7) % 30) - 15;
    const oy = ((rng * (i + 1) * 11) % 14) - 7;

    if (!isInsideDiamond(ox, oy, TILE_WIDTH - 20, TILE_HEIGHT - 10)) continue;

    const treeX = cx + ox;
    const treeY = baseY + oy + TILE_HEIGHT / 2;

    if (biome === 'jungle' || biome === 'dense_forest') {
      drawLargeTree(ctx, treeX, treeY, season, biome === 'jungle');
    } else if (biome === 'forest') {
      drawTree(ctx, treeX, treeY, season);
    } else {
      drawBush(ctx, treeX, treeY, season);
    }
  }
}

/** Draw a small pixel-art tree */
function drawTree(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, season: Season): void {
  // Trunk
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x, y - 4, 2, 5);

  // Foliage — dark base with lighter highlight layer
  let baseColor: string;
  let highlightColor: string;
  if (season === 'autumn') {
    baseColor = '#a85820';
    highlightColor = '#c87838';
  } else if (season === 'winter') {
    baseColor = '#4a6840';
    highlightColor = '#5c7c50';
  } else {
    baseColor = PALETTE.tree;
    highlightColor = PALETTE.treeLight;
  }

  // Dark base
  ctx.fillStyle = baseColor;
  ctx.fillRect(x - 2, y - 8, 6, 3);
  ctx.fillRect(x - 1, y - 10, 4, 2);
  ctx.fillRect(x, y - 11, 2, 1);

  // Light highlight (top-right)
  ctx.fillStyle = highlightColor;
  ctx.fillRect(x, y - 10, 3, 1);
  ctx.fillRect(x + 1, y - 8, 2, 1);
}

/** Draw a large tree (for dense forests / jungles) */
function drawLargeTree(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, season: Season, isJungle: boolean): void {
  // Trunk
  ctx.fillStyle = isJungle ? '#3a2a0a' : '#4a2a10';
  ctx.fillRect(x, y - 6, 3, 7);

  // Foliage — dark base
  let baseColor: string;
  let midColor: string;
  let highlightColor: string;
  if (isJungle) {
    baseColor = PALETTE.jungleTreeDark;
    midColor = PALETTE.jungleTree;
    highlightColor = '#18881a';
  } else if (season === 'autumn') {
    baseColor = '#8a4818';
    midColor = '#a86020';
    highlightColor = '#c08030';
  } else if (season === 'winter') {
    baseColor = '#3a5430';
    midColor = '#4a6840';
    highlightColor = '#587850';
  } else {
    baseColor = PALETTE.treeDark;
    midColor = PALETTE.tree;
    highlightColor = PALETTE.treeLight;
  }

  // Shadow layer (bottom-left)
  ctx.fillStyle = baseColor;
  ctx.fillRect(x - 3, y - 10, 9, 4);
  ctx.fillRect(x - 2, y - 13, 7, 3);

  // Mid layer
  ctx.fillStyle = midColor;
  ctx.fillRect(x - 2, y - 12, 6, 3);
  ctx.fillRect(x - 1, y - 15, 5, 2);

  // Highlight (top-right)
  ctx.fillStyle = highlightColor;
  ctx.fillRect(x, y - 14, 3, 2);
  ctx.fillRect(x + 1, y - 10, 3, 1);
  ctx.fillRect(x, y - 16, 3, 1);
}

/** Draw a bush */
function drawBush(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, season: Season): void {
  // Base
  ctx.fillStyle = season === 'winter' ? '#5a6848' : PALETTE.treeLight;
  ctx.fillRect(x - 1, y - 3, 4, 2);
  // Highlight
  ctx.fillStyle = season === 'winter' ? '#6c7c58' : PALETTE.treeHighlight;
  ctx.fillRect(x, y - 4, 2, 1);
  ctx.fillRect(x + 1, y - 3, 1, 1);
}

/** Water shimmer effect */
function addWaterEffect(
  ctx: OffscreenCanvasRenderingContext2D,
  cx: number, cy: number,
  variant: number,
): void {
  ctx.fillStyle = PALETTE.waterHighlight;
  const rng = simpleHash(variant + 5000);
  for (let i = 0; i < 3; i++) {
    const ox = ((rng * (i + 1) * 7) % 24) - 12;
    const oy = ((rng * (i + 1) * 11) % 10) - 5;
    if (isInsideDiamond(ox, oy, TILE_WIDTH - 16, TILE_HEIGHT - 8)) {
      ctx.fillRect(cx + ox, cy + oy, 3, 1);
    }
  }
}

/** Check if a point is inside an isometric diamond */
function isInsideDiamond(ox: number, oy: number, w: number, h: number): boolean {
  return (Math.abs(ox) / (w / 2) + Math.abs(oy) / (h / 2)) <= 1;
}

/** Simple integer hash for deterministic patterns */
function simpleHash(n: number): number {
  n = ((n >> 16) ^ n) * 0x45d9f3b;
  n = ((n >> 16) ^ n) * 0x45d9f3b;
  n = (n >> 16) ^ n;
  return Math.abs(n);
}

/** Clear the sprite cache (e.g. on season change) */
export function clearTerrainSpriteCache(): void {
  spriteCache.clear();
}
