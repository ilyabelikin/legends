import { PALETTE } from '../palette';
import type { CreatureType } from '../../types/creature';

/** Cache for entity sprites */
const entityCache = new Map<string, OffscreenCanvas>();

/** Get party sprite */
export function getPartySprite(): OffscreenCanvas {
  const key = 'party';
  const cached = entityCache.get(key);
  if (cached) return cached;

  const canvas = new OffscreenCanvas(16, 24);
  const ctx = canvas.getContext('2d')!;
  drawAdventurer(ctx, 8, 20);

  entityCache.set(key, canvas);
  return canvas;
}

/** Get creature sprite */
export function getCreatureSprite(type: CreatureType): OffscreenCanvas {
  const key = `creature_${type}`;
  const cached = entityCache.get(key);
  if (cached) return cached;

  const canvas = new OffscreenCanvas(16, 20);
  const ctx = canvas.getContext('2d')!;

  switch (type) {
    case 'wolf': drawWolf(ctx, 8, 16); break;
    case 'bear': drawBear(ctx, 8, 16); break;
    case 'deer': drawDeer(ctx, 8, 16); break;
    case 'sheep': drawSheep(ctx, 8, 16); break;
    case 'boar': drawBoar(ctx, 8, 16); break;
    case 'dragon': drawDragon(ctx, 8, 12); break;
    case 'bandit': drawBandit(ctx, 8, 16); break;
    case 'guard': drawGuard(ctx, 8, 16); break;
    case 'army': drawArmy(ctx, 8, 16); break;
    case 'trader': drawTrader(ctx, 8, 16); break;
  }

  entityCache.set(key, canvas);
  return canvas;
}

/** Draw the player's adventurer character */
function drawAdventurer(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Legs
  ctx.fillStyle = PALETTE.clothBrown;
  ctx.fillRect(x - 2, y - 4, 2, 4);
  ctx.fillRect(x + 1, y - 4, 2, 4);
  // Body
  ctx.fillStyle = PALETTE.clothBlue;
  ctx.fillRect(x - 3, y - 9, 7, 5);
  // Arms
  ctx.fillRect(x - 4, y - 8, 1, 4);
  ctx.fillRect(x + 4, y - 8, 1, 4);
  // Head
  ctx.fillStyle = PALETTE.skinLight;
  ctx.fillRect(x - 2, y - 13, 5, 4);
  // Hair
  ctx.fillStyle = PALETTE.hairBrown;
  ctx.fillRect(x - 2, y - 14, 5, 2);
  // Eyes
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x - 1, y - 12, 1, 1);
  ctx.fillRect(x + 1, y - 12, 1, 1);
  // Weapon (sword on back)
  ctx.fillStyle = '#a0a0a0';
  ctx.fillRect(x + 4, y - 14, 1, 8);
  ctx.fillStyle = PALETTE.clothGold;
  ctx.fillRect(x + 3, y - 7, 3, 1);
  // Cape
  ctx.fillStyle = PALETTE.clothRed;
  ctx.fillRect(x - 3, y - 9, 2, 6);
}

function drawWolf(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#6a6a6a';
  // Body
  ctx.fillRect(x - 4, y - 4, 8, 3);
  // Head
  ctx.fillRect(x + 3, y - 6, 4, 3);
  // Ears
  ctx.fillRect(x + 4, y - 7, 1, 1);
  ctx.fillRect(x + 6, y - 7, 1, 1);
  // Legs
  ctx.fillRect(x - 3, y - 1, 1, 2);
  ctx.fillRect(x - 1, y - 1, 1, 2);
  ctx.fillRect(x + 2, y - 1, 1, 2);
  ctx.fillRect(x + 4, y - 1, 1, 2);
  // Tail
  ctx.fillRect(x - 5, y - 5, 2, 1);
  // Eye
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(x + 5, y - 5, 1, 1);
}

function drawBear(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#5a3a1a';
  // Body
  ctx.fillRect(x - 5, y - 5, 10, 4);
  // Head
  ctx.fillRect(x + 4, y - 7, 4, 4);
  // Ears
  ctx.fillRect(x + 4, y - 8, 1, 1);
  ctx.fillRect(x + 7, y - 8, 1, 1);
  // Legs
  ctx.fillRect(x - 4, y - 1, 2, 2);
  ctx.fillRect(x + 1, y - 1, 2, 2);
  // Eye
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + 6, y - 6, 1, 1);
}

function drawDeer(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#a07040';
  // Body
  ctx.fillRect(x - 4, y - 5, 8, 3);
  // Head
  ctx.fillRect(x + 3, y - 8, 3, 3);
  // Antlers
  ctx.fillStyle = '#7c6c4c';
  ctx.fillRect(x + 3, y - 10, 1, 2);
  ctx.fillRect(x + 5, y - 10, 1, 2);
  ctx.fillRect(x + 2, y - 10, 1, 1);
  ctx.fillRect(x + 6, y - 10, 1, 1);
  // Legs
  ctx.fillStyle = '#a07040';
  ctx.fillRect(x - 3, y - 2, 1, 3);
  ctx.fillRect(x - 1, y - 2, 1, 3);
  ctx.fillRect(x + 2, y - 2, 1, 3);
  ctx.fillRect(x + 4, y - 2, 1, 3);
  // Eye
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + 4, y - 7, 1, 1);
}

function drawSheep(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#e0d8c8';
  // Wool body
  ctx.fillRect(x - 3, y - 5, 7, 4);
  ctx.fillRect(x - 2, y - 6, 5, 1);
  // Head
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x + 3, y - 5, 2, 2);
  // Legs
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(x - 2, y - 1, 1, 2);
  ctx.fillRect(x + 1, y - 1, 1, 2);
}

function drawBoar(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#5a4030';
  // Body
  ctx.fillRect(x - 4, y - 4, 8, 3);
  // Head
  ctx.fillRect(x + 3, y - 5, 3, 3);
  // Tusks
  ctx.fillStyle = '#e0d0b0';
  ctx.fillRect(x + 6, y - 4, 1, 1);
  // Legs
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x - 3, y - 1, 1, 2);
  ctx.fillRect(x + 2, y - 1, 1, 2);
}

function drawDragon(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Wings
  ctx.fillStyle = '#8a2020';
  ctx.fillRect(x - 7, y - 6, 5, 3);
  ctx.fillRect(x + 3, y - 6, 5, 3);
  ctx.fillRect(x - 6, y - 8, 3, 2);
  ctx.fillRect(x + 4, y - 8, 3, 2);
  // Body
  ctx.fillStyle = '#c44444';
  ctx.fillRect(x - 4, y - 3, 9, 4);
  // Head
  ctx.fillRect(x + 4, y - 5, 4, 3);
  // Tail
  ctx.fillRect(x - 6, y - 2, 3, 2);
  ctx.fillRect(x - 7, y - 1, 2, 1);
  // Eye
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(x + 6, y - 4, 1, 1);
  // Fire breath
  ctx.fillStyle = PALETTE.fireOrange;
  ctx.fillRect(x + 8, y - 4, 2, 1);
  ctx.fillStyle = PALETTE.fireYellow;
  ctx.fillRect(x + 8, y - 5, 1, 1);
  // Horns
  ctx.fillStyle = '#3a1a1a';
  ctx.fillRect(x + 4, y - 6, 1, 1);
  ctx.fillRect(x + 6, y - 6, 1, 1);
  // Legs
  ctx.fillStyle = '#a03030';
  ctx.fillRect(x - 2, y + 1, 2, 2);
  ctx.fillRect(x + 2, y + 1, 2, 2);
}

function drawBandit(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Legs
  ctx.fillStyle = '#3a3a2a';
  ctx.fillRect(x - 2, y - 4, 2, 4);
  ctx.fillRect(x + 1, y - 4, 2, 4);
  // Body
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(x - 3, y - 9, 7, 5);
  // Head
  ctx.fillStyle = PALETTE.skinMedium;
  ctx.fillRect(x - 2, y - 12, 5, 3);
  // Hood
  ctx.fillStyle = '#2a2a1a';
  ctx.fillRect(x - 2, y - 13, 5, 2);
  ctx.fillRect(x - 3, y - 12, 1, 2);
  // Mask
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x - 1, y - 10, 3, 1);
  // Weapon
  ctx.fillStyle = '#a0a0a0';
  ctx.fillRect(x + 4, y - 10, 1, 6);
}

function drawTrader(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Donkey/mule
  ctx.fillStyle = '#8a7a6a';
  ctx.fillRect(x - 5, y - 3, 7, 3);
  ctx.fillRect(x - 6, y - 5, 3, 2); // head
  ctx.fillStyle = '#6a5a4a';
  ctx.fillRect(x - 4, y, 1, 2); // legs
  ctx.fillRect(x, y, 1, 2);
  // Pack/cargo on back
  ctx.fillStyle = '#7a5a30';
  ctx.fillRect(x - 4, y - 6, 6, 3);
  ctx.fillStyle = '#8a6a40';
  ctx.fillRect(x - 3, y - 7, 4, 1);
  // Merchant walking beside
  ctx.fillStyle = PALETTE.clothBrown;
  ctx.fillRect(x + 3, y - 8, 5, 4);
  ctx.fillStyle = PALETTE.skinLight;
  ctx.fillRect(x + 4, y - 10, 3, 2);
  ctx.fillStyle = PALETTE.hairBrown;
  ctx.fillRect(x + 4, y - 11, 3, 1);
  // Legs
  ctx.fillStyle = PALETTE.clothBrown;
  ctx.fillRect(x + 4, y - 4, 1, 3);
  ctx.fillRect(x + 6, y - 4, 1, 3);
}

function drawGuard(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Legs
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(x - 2, y - 4, 2, 4);
  ctx.fillRect(x + 1, y - 4, 2, 4);
  // Body — chainmail
  ctx.fillStyle = '#8888a0';
  ctx.fillRect(x - 3, y - 9, 7, 5);
  ctx.fillStyle = '#707088';
  ctx.fillRect(x - 3, y - 9, 2, 5);
  // Head
  ctx.fillStyle = PALETTE.skinLight;
  ctx.fillRect(x - 2, y - 12, 5, 3);
  // Helmet
  ctx.fillStyle = '#a0a0b0';
  ctx.fillRect(x - 2, y - 14, 5, 2);
  ctx.fillRect(x - 1, y - 15, 3, 1);
  // Spear
  ctx.fillStyle = '#7a5a30';
  ctx.fillRect(x + 4, y - 16, 1, 12);
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(x + 3, y - 17, 3, 2);
  // Shield
  ctx.fillStyle = '#4444a0';
  ctx.fillRect(x - 4, y - 9, 2, 4);
  ctx.fillStyle = '#333880';
  ctx.fillRect(x - 4, y - 8, 2, 2);
}

function drawArmy(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Multiple soldiers — 3 overlapping figures
  for (let i = -1; i <= 1; i++) {
    const ox = i * 3;
    const oy = Math.abs(i);
    // Legs
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(x + ox - 1, y - 3 + oy, 1, 3);
    ctx.fillRect(x + ox + 1, y - 3 + oy, 1, 3);
    // Body
    ctx.fillStyle = '#707088';
    ctx.fillRect(x + ox - 2, y - 7 + oy, 5, 4);
    // Head + helmet
    ctx.fillStyle = '#a0a0b0';
    ctx.fillRect(x + ox - 1, y - 9 + oy, 3, 2);
    // Spear
    ctx.fillStyle = '#7a5a30';
    ctx.fillRect(x + ox + 2, y - 12 + oy, 1, 8);
  }
  // Banner in the middle
  ctx.fillStyle = '#c44444'; // default red, will be drawn over by renderer with country color
  ctx.fillRect(x - 1, y - 14, 4, 3);
  ctx.fillStyle = '#7a5a30';
  ctx.fillRect(x - 2, y - 15, 1, 12);
}

/** Get road sprite element */
export function getRoadSprite(level: number): OffscreenCanvas {
  const key = `road_${level}`;
  const cached = entityCache.get(key);
  if (cached) return cached;

  const canvas = new OffscreenCanvas(64, 32);
  const ctx = canvas.getContext('2d')!;

  const color = level >= 3 ? PALETTE.roadHighway
    : level >= 2 ? PALETTE.roadStone
    : PALETTE.roadDirt;

  ctx.fillStyle = color;
  // Draw road as line through tile center
  ctx.fillRect(28, 12, 8, 8);

  entityCache.set(key, canvas);
  return canvas;
}

/** Clear entity sprite cache */
export function clearEntityCache(): void {
  entityCache.clear();
}
