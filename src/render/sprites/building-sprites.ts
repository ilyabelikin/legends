import { PALETTE } from '../palette';
import type { LocationType } from '../../types/location';

/** Cache for building sprites */
const buildingCache = new Map<string, OffscreenCanvas>();

/** Get a building sprite for a location type */
export function getBuildingSprite(
  locationType: LocationType,
  size: number,
  countryColor: string | null,
): OffscreenCanvas {
  const key = `${locationType}_${size}_${countryColor ?? 'none'}`;
  const cached = buildingCache.get(key);
  if (cached) return cached;

  const sprite = createBuildingSprite(locationType, size, countryColor);
  buildingCache.set(key, sprite);
  return sprite;
}

/** Create a building sprite */
function createBuildingSprite(
  type: LocationType,
  size: number,
  countryColor: string | null,
): OffscreenCanvas {
  const canvas = new OffscreenCanvas(48, 48);
  const ctx = canvas.getContext('2d')!;

  switch (type) {
    case 'homestead':
      drawSmallHouse(ctx, 24, 36);
      break;
    case 'hamlet':
      drawSmallHouse(ctx, 18, 36);
      drawSmallHouse(ctx, 30, 36);
      break;
    case 'village':
      drawHouse(ctx, 16, 36);
      drawHouse(ctx, 30, 36);
      drawSmallHouse(ctx, 24, 30);
      break;
    case 'town':
      drawTownBuildings(ctx, countryColor);
      break;
    case 'city':
      drawCityBuildings(ctx, countryColor);
      break;
    case 'castle':
      drawCastle(ctx, countryColor);
      break;
    case 'mine':
      drawMine(ctx);
      break;
    case 'farm':
      drawFarm(ctx);
      break;
    case 'lumber_camp':
      drawLumberCamp(ctx);
      break;
    case 'fishing_village':
      drawFishingVillage(ctx);
      break;
    case 'port':
      drawPort(ctx, countryColor);
      break;
    case 'dungeon':
      drawDungeon(ctx);
      break;
    case 'ruins':
      drawRuins(ctx);
      break;
    case 'dragon_lair':
      drawDragonLair(ctx);
      break;
    case 'bandit_camp':
      drawBanditCamp(ctx);
      break;
    case 'monastery':
      drawMonastery(ctx);
      break;
    default:
      drawSmallHouse(ctx, 24, 36);
  }

  // Draw country flag if applicable
  if (countryColor && ['town', 'city', 'castle', 'port'].includes(type)) {
    drawFlag(ctx, 10, 8, countryColor);
  }

  return canvas;
}

function drawSmallHouse(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Walls
  ctx.fillStyle = PALETTE.woodWall;
  ctx.fillRect(x - 4, y - 6, 8, 6);
  // Dark side
  ctx.fillStyle = PALETTE.woodWallDark;
  ctx.fillRect(x - 4, y - 6, 2, 6);
  // Roof
  ctx.fillStyle = PALETTE.roofBrown;
  ctx.fillRect(x - 5, y - 9, 10, 3);
  ctx.fillRect(x - 4, y - 10, 8, 1);
  // Window
  ctx.fillStyle = '#f0e0a0';
  ctx.fillRect(x, y - 5, 2, 2);
}

function drawHouse(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Walls
  ctx.fillStyle = PALETTE.woodWall;
  ctx.fillRect(x - 5, y - 8, 10, 8);
  ctx.fillStyle = PALETTE.woodWallDark;
  ctx.fillRect(x - 5, y - 8, 2, 8);
  // Roof
  ctx.fillStyle = PALETTE.roofRed;
  ctx.fillRect(x - 6, y - 11, 12, 3);
  ctx.fillRect(x - 5, y - 12, 10, 1);
  // Window
  ctx.fillStyle = '#f0e0a0';
  ctx.fillRect(x - 2, y - 6, 2, 2);
  ctx.fillRect(x + 1, y - 6, 2, 2);
  // Door
  ctx.fillStyle = PALETTE.woodWallDark;
  ctx.fillRect(x - 1, y - 3, 3, 3);
}

function drawTownBuildings(ctx: OffscreenCanvasRenderingContext2D, color: string | null): void {
  // Multiple buildings
  drawHouse(ctx, 12, 40);
  drawHouse(ctx, 28, 40);
  drawHouse(ctx, 36, 40);
  // Taller center building
  ctx.fillStyle = PALETTE.stoneWall;
  ctx.fillRect(18, 18, 12, 16);
  ctx.fillStyle = PALETTE.stoneWallDark;
  ctx.fillRect(18, 18, 3, 16);
  ctx.fillStyle = PALETTE.roofRedDark;
  ctx.fillRect(17, 14, 14, 4);
  ctx.fillRect(18, 12, 12, 2);
  // Tower
  ctx.fillStyle = PALETTE.stoneWall;
  ctx.fillRect(22, 6, 5, 8);
  ctx.fillStyle = PALETTE.roofRed;
  ctx.fillRect(21, 4, 7, 3);
  ctx.fillRect(22, 3, 5, 1);
}

function drawCityBuildings(ctx: OffscreenCanvasRenderingContext2D, color: string | null): void {
  drawTownBuildings(ctx, color);
  // Extra buildings
  drawSmallHouse(ctx, 6, 40);
  drawSmallHouse(ctx, 42, 40);
  // Walls
  ctx.fillStyle = PALETTE.stoneWallDark;
  ctx.fillRect(2, 34, 2, 8);
  ctx.fillRect(44, 34, 2, 8);
  ctx.fillRect(2, 42, 44, 2);
}

function drawCastle(ctx: OffscreenCanvasRenderingContext2D, color: string | null): void {
  // Base wall
  ctx.fillStyle = PALETTE.stoneWall;
  ctx.fillRect(8, 20, 32, 20);
  ctx.fillStyle = PALETTE.stoneWallDark;
  ctx.fillRect(8, 20, 4, 20);

  // Left tower
  ctx.fillStyle = PALETTE.stoneWall;
  ctx.fillRect(6, 10, 8, 14);
  ctx.fillStyle = PALETTE.stoneWallDark;
  ctx.fillRect(6, 10, 2, 14);
  // Battlements
  ctx.fillRect(6, 8, 2, 3);
  ctx.fillRect(10, 8, 2, 3);

  // Right tower
  ctx.fillStyle = PALETTE.stoneWall;
  ctx.fillRect(34, 10, 8, 14);
  ctx.fillStyle = PALETTE.stoneWallDark;
  ctx.fillRect(34, 10, 2, 14);
  ctx.fillRect(34, 8, 2, 3);
  ctx.fillRect(38, 8, 2, 3);

  // Keep
  ctx.fillStyle = PALETTE.stoneWallLight;
  ctx.fillRect(18, 8, 12, 18);
  ctx.fillStyle = PALETTE.stoneWallDark;
  ctx.fillRect(18, 8, 3, 18);
  ctx.fillStyle = PALETTE.roofRed;
  ctx.fillRect(17, 4, 14, 4);
  ctx.fillRect(19, 2, 10, 2);

  // Gate
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(21, 32, 6, 8);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(22, 32, 4, 7);
}

function drawMine(ctx: OffscreenCanvasRenderingContext2D): void {
  // Mine entrance
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(16, 28, 16, 12);
  // Arch
  ctx.fillStyle = PALETTE.woodWall;
  ctx.fillRect(15, 26, 18, 3);
  ctx.fillRect(15, 26, 3, 14);
  ctx.fillRect(30, 26, 3, 14);
  // Cart track
  ctx.fillStyle = PALETTE.woodWallDark;
  ctx.fillRect(20, 38, 8, 2);
  // Small shack
  drawSmallHouse(ctx, 36, 36);
}

function drawFarm(ctx: OffscreenCanvasRenderingContext2D): void {
  drawSmallHouse(ctx, 12, 30);
  // Fields
  ctx.fillStyle = '#a08840';
  ctx.fillRect(22, 28, 20, 12);
  // Crop rows
  ctx.fillStyle = '#60a030';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(24, 29 + i * 3, 16, 1);
  }
}

function drawLumberCamp(ctx: OffscreenCanvasRenderingContext2D): void {
  drawSmallHouse(ctx, 24, 36);
  // Log pile
  ctx.fillStyle = PALETTE.woodWallDark;
  ctx.fillRect(8, 34, 10, 3);
  ctx.fillRect(9, 32, 8, 2);
  // Stump
  ctx.fillStyle = '#6c5028';
  ctx.fillRect(36, 36, 4, 3);
}

function drawFishingVillage(ctx: OffscreenCanvasRenderingContext2D): void {
  drawSmallHouse(ctx, 16, 32);
  drawSmallHouse(ctx, 30, 32);
  // Dock
  ctx.fillStyle = PALETTE.woodWall;
  ctx.fillRect(20, 36, 12, 2);
  ctx.fillRect(24, 38, 4, 6);
}

function drawPort(ctx: OffscreenCanvasRenderingContext2D, color: string | null): void {
  drawHouse(ctx, 16, 34);
  drawHouse(ctx, 32, 34);
  // Dock
  ctx.fillStyle = PALETTE.woodWall;
  ctx.fillRect(10, 38, 28, 3);
  ctx.fillRect(18, 41, 4, 5);
  ctx.fillRect(30, 41, 4, 5);
  // Warehouse
  ctx.fillStyle = PALETTE.stoneWall;
  ctx.fillRect(22, 24, 10, 8);
  ctx.fillStyle = PALETTE.roofBrown;
  ctx.fillRect(21, 22, 12, 3);
}

function drawDungeon(ctx: OffscreenCanvasRenderingContext2D): void {
  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(18, 30, 12, 10);
  ctx.fillStyle = '#4a4a5a';
  ctx.fillRect(17, 28, 14, 3);
  // Skulls/decoration
  ctx.fillStyle = '#e0d0b0';
  ctx.fillRect(22, 34, 4, 3);
  ctx.fillRect(23, 33, 2, 1);
}

function drawRuins(ctx: OffscreenCanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.stoneWallDark;
  // Broken walls
  ctx.fillRect(12, 30, 4, 8);
  ctx.fillRect(20, 28, 3, 10);
  ctx.fillRect(30, 32, 5, 6);
  ctx.fillRect(14, 36, 20, 2);
  // Rubble
  ctx.fillStyle = '#8a8a7a';
  ctx.fillRect(16, 34, 3, 2);
  ctx.fillRect(26, 35, 4, 2);
}

function drawDragonLair(ctx: OffscreenCanvasRenderingContext2D): void {
  // Cave entrance
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(14, 24, 20, 16);
  ctx.fillStyle = PALETTE.rockDark;
  ctx.fillRect(12, 22, 24, 4);
  ctx.fillRect(14, 20, 20, 3);
  // Treasure glint
  ctx.fillStyle = PALETTE.clothGold;
  ctx.fillRect(20, 36, 2, 2);
  ctx.fillRect(26, 35, 3, 2);
  // Fire glow
  ctx.fillStyle = PALETTE.fireOrange;
  ctx.fillRect(22, 30, 4, 2);
  ctx.fillStyle = PALETTE.fireYellow;
  ctx.fillRect(23, 29, 2, 1);
}

function drawBanditCamp(ctx: OffscreenCanvasRenderingContext2D): void {
  // Tents
  ctx.fillStyle = '#7c6c4c';
  ctx.fillRect(12, 28, 10, 8);
  ctx.fillRect(11, 26, 12, 3);
  ctx.fillRect(28, 30, 8, 6);
  ctx.fillRect(27, 28, 10, 3);
  // Campfire
  ctx.fillStyle = PALETTE.fireOrange;
  ctx.fillRect(22, 34, 3, 2);
  ctx.fillStyle = PALETTE.fireYellow;
  ctx.fillRect(23, 33, 1, 1);
}

function drawMonastery(ctx: OffscreenCanvasRenderingContext2D): void {
  // Main building
  ctx.fillStyle = PALETTE.stoneWallLight;
  ctx.fillRect(14, 18, 20, 20);
  ctx.fillStyle = PALETTE.stoneWallDark;
  ctx.fillRect(14, 18, 4, 20);
  // Roof
  ctx.fillStyle = PALETTE.roofBlue;
  ctx.fillRect(13, 14, 22, 4);
  ctx.fillRect(15, 12, 18, 2);
  // Bell tower
  ctx.fillStyle = PALETTE.stoneWallLight;
  ctx.fillRect(21, 4, 6, 10);
  ctx.fillStyle = PALETTE.roofBlue;
  ctx.fillRect(20, 2, 8, 3);
  // Cross
  ctx.fillStyle = PALETTE.clothGold;
  ctx.fillRect(23, 0, 2, 3);
  ctx.fillRect(22, 1, 4, 1);
}

function drawFlag(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, color: string): void {
  // Pole
  ctx.fillStyle = PALETTE.woodWallDark;
  ctx.fillRect(x, y, 1, 10);
  // Flag
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y, 6, 4);
  ctx.fillRect(x + 1, y + 4, 5, 1);
}

/** Clear building sprite cache */
export function clearBuildingCache(): void {
  buildingCache.clear();
}
