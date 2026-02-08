import { PALETTE } from '../palette';

/** Cache for item sprites */
const itemCache = new Map<string, OffscreenCanvas>();

/** Get sprite for a resource/item */
export function getItemSprite(resourceId: string): OffscreenCanvas {
  const cached = itemCache.get(resourceId);
  if (cached) return cached;

  const canvas = new OffscreenCanvas(16, 16);
  const ctx = canvas.getContext('2d')!;

  switch (resourceId) {
    // Food items
    case 'bread': drawBread(ctx, 8, 8); break;
    case 'meat': drawMeat(ctx, 8, 8); break;
    case 'fish': drawFish(ctx, 8, 8); break;
    case 'berries': drawBerries(ctx, 8, 8); break;
    case 'exotic_fruit': drawExoticFruit(ctx, 8, 8); break;
    
    // Raw materials
    case 'wheat': drawWheat(ctx, 8, 8); break;
    case 'wood': drawWood(ctx, 8, 8); break;
    case 'stone': drawStone(ctx, 8, 8); break;
    case 'iron_ore': drawIronOre(ctx, 8, 8); break;
    case 'coal': drawCoal(ctx, 8, 8); break;
    case 'gold_ore': drawGoldOre(ctx, 8, 8); break;
    case 'copper_ore': drawCopperOre(ctx, 8, 8); break;
    case 'clay': drawClay(ctx, 8, 8); break;
    case 'salt': drawSalt(ctx, 8, 8); break;
    
    // Processed materials
    case 'iron': drawIron(ctx, 8, 8); break;
    case 'steel': drawSteel(ctx, 8, 8); break;
    case 'copper': drawCopper(ctx, 8, 8); break;
    case 'gold': drawGold(ctx, 8, 8); break;
    case 'lumber': drawLumber(ctx, 8, 8); break;
    case 'planks': drawPlanks(ctx, 8, 8); break;
    case 'bricks': drawBricks(ctx, 8, 8); break;
    
    // Textiles
    case 'wool': drawWool(ctx, 8, 8); break;
    case 'cloth': drawCloth(ctx, 8, 8); break;
    case 'hides': drawHides(ctx, 8, 8); break;
    case 'leather': drawLeather(ctx, 8, 8); break;
    
    // Luxury goods
    case 'wine': drawWine(ctx, 8, 8); break;
    case 'jewelry': drawJewelry(ctx, 8, 8); break;
    case 'silk': drawSilk(ctx, 8, 8); break;
    case 'spices': drawSpices(ctx, 8, 8); break;
    
    // Tools & Weapons
    case 'tools': drawTools(ctx, 8, 8); break;
    case 'weapons': drawWeapons(ctx, 8, 8); break;
    
    default: drawGenericItem(ctx, 8, 8); break;
  }

  itemCache.set(resourceId, canvas);
  return canvas;
}

// ── Food Items ──────────────────────────────────────────

function drawBread(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Loaf shape
  ctx.fillStyle = '#d4a574';
  ctx.fillRect(x - 4, y - 2, 8, 4);
  ctx.fillRect(x - 3, y - 3, 6, 1);
  // Crust details
  ctx.fillStyle = '#a67c52';
  ctx.fillRect(x - 4, y + 1, 1, 1);
  ctx.fillRect(x + 3, y + 1, 1, 1);
  ctx.fillRect(x - 2, y - 3, 1, 1);
  ctx.fillRect(x + 1, y - 3, 1, 1);
}

function drawMeat(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Meat chunk
  ctx.fillStyle = '#c85050';
  ctx.fillRect(x - 3, y - 3, 6, 6);
  ctx.fillRect(x - 4, y - 2, 1, 4);
  ctx.fillRect(x + 3, y - 1, 1, 2);
  // Fat/marbling
  ctx.fillStyle = '#f0d0d0';
  ctx.fillRect(x - 2, y - 1, 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, 1);
  // Bone
  ctx.fillStyle = '#e8e8d0';
  ctx.fillRect(x - 5, y, 2, 2);
  ctx.fillRect(x - 6, y, 1, 1);
  ctx.fillRect(x - 6, y + 1, 1, 1);
}

function drawFish(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Body
  ctx.fillStyle = '#8090b0';
  ctx.fillRect(x - 4, y - 1, 6, 3);
  ctx.fillRect(x - 5, y, 1, 1);
  // Tail
  ctx.fillRect(x + 2, y - 2, 2, 1);
  ctx.fillRect(x + 2, y + 2, 2, 1);
  // Eye
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x - 4, y, 1, 1);
  // Scales
  ctx.fillStyle = '#a0b0c8';
  ctx.fillRect(x - 2, y, 1, 1);
  ctx.fillRect(x, y + 1, 1, 1);
}

function drawBerries(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Berry cluster
  ctx.fillStyle = '#a03060';
  ctx.fillRect(x - 2, y - 1, 2, 2);
  ctx.fillRect(x, y - 2, 2, 2);
  ctx.fillRect(x - 1, y, 2, 2);
  ctx.fillRect(x + 1, y + 1, 2, 2);
  // Highlights
  ctx.fillStyle = '#d05080';
  ctx.fillRect(x - 1, y - 1, 1, 1);
  ctx.fillRect(x + 1, y - 1, 1, 1);
  ctx.fillRect(x, y + 1, 1, 1);
  // Stem
  ctx.fillStyle = '#508040';
  ctx.fillRect(x, y - 3, 1, 2);
}

function drawExoticFruit(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Fruit body
  ctx.fillStyle = '#f08030';
  ctx.fillRect(x - 3, y - 2, 6, 5);
  ctx.fillRect(x - 2, y - 3, 4, 1);
  // Pattern
  ctx.fillStyle = '#f0a050';
  ctx.fillRect(x - 2, y - 1, 2, 2);
  ctx.fillRect(x + 1, y + 1, 2, 1);
  // Leaf
  ctx.fillStyle = '#40a040';
  ctx.fillRect(x - 1, y - 4, 3, 2);
}

// ── Raw Materials ──────────────────────────────────────

function drawWheat(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Stalks
  ctx.fillStyle = '#d4b070';
  ctx.fillRect(x - 3, y - 3, 1, 6);
  ctx.fillRect(x - 1, y - 4, 1, 7);
  ctx.fillRect(x + 1, y - 3, 1, 6);
  ctx.fillRect(x + 3, y - 2, 1, 5);
  // Grain heads
  ctx.fillStyle = '#e8c878';
  ctx.fillRect(x - 4, y - 4, 2, 2);
  ctx.fillRect(x - 2, y - 5, 2, 2);
  ctx.fillRect(x, y - 4, 2, 2);
  ctx.fillRect(x + 2, y - 3, 2, 2);
}

function drawWood(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Log
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(x - 4, y - 2, 8, 4);
  // End grain
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(x + 3, y - 2, 1, 4);
  // Rings
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x - 3, y - 1, 6, 1);
  ctx.fillRect(x - 2, y + 1, 4, 1);
  // Bark texture
  ctx.fillRect(x - 4, y - 1, 1, 1);
  ctx.fillRect(x - 4, y + 1, 1, 1);
}

function drawStone(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Rock shape
  ctx.fillStyle = '#808080';
  ctx.fillRect(x - 3, y - 2, 6, 4);
  ctx.fillRect(x - 4, y - 1, 1, 2);
  ctx.fillRect(x + 3, y, 1, 1);
  // Highlights
  ctx.fillStyle = '#a0a0a0';
  ctx.fillRect(x - 2, y - 2, 2, 1);
  ctx.fillRect(x + 1, y - 1, 1, 1);
  // Shadows
  ctx.fillStyle = '#606060';
  ctx.fillRect(x - 3, y + 1, 3, 1);
  ctx.fillRect(x + 2, y + 1, 1, 1);
}

function drawIronOre(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Stone base
  ctx.fillStyle = '#706060';
  ctx.fillRect(x - 3, y - 2, 6, 4);
  ctx.fillRect(x - 4, y - 1, 1, 2);
  // Iron veins
  ctx.fillStyle = '#b87030';
  ctx.fillRect(x - 2, y - 1, 2, 1);
  ctx.fillRect(x + 1, y, 2, 1);
  ctx.fillRect(x - 1, y + 1, 1, 1);
}

function drawCoal(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Coal chunks
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x - 3, y - 2, 3, 3);
  ctx.fillRect(x, y - 1, 3, 3);
  ctx.fillRect(x - 2, y, 2, 2);
  // Shine
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(x - 2, y - 1, 1, 1);
  ctx.fillRect(x + 1, y, 1, 1);
}

function drawGoldOre(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Stone base
  ctx.fillStyle = '#706050';
  ctx.fillRect(x - 3, y - 2, 6, 4);
  // Gold veins
  ctx.fillStyle = '#d4a020';
  ctx.fillRect(x - 2, y - 1, 3, 1);
  ctx.fillRect(x, y, 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, 1);
  // Gold highlights
  ctx.fillStyle = '#f0c840';
  ctx.fillRect(x - 1, y - 1, 1, 1);
  ctx.fillRect(x + 1, y, 1, 1);
}

function drawCopperOre(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Stone base
  ctx.fillStyle = '#605850';
  ctx.fillRect(x - 3, y - 2, 6, 4);
  // Copper veins
  ctx.fillStyle = '#b86040';
  ctx.fillRect(x - 2, y - 1, 2, 1);
  ctx.fillRect(x + 1, y, 2, 1);
  ctx.fillRect(x - 1, y + 1, 2, 1);
}

function drawClay(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Clay lump
  ctx.fillStyle = '#a07860';
  ctx.fillRect(x - 3, y - 2, 6, 4);
  ctx.fillRect(x - 4, y - 1, 1, 2);
  ctx.fillRect(x + 3, y, 1, 1);
  // Texture
  ctx.fillStyle = '#907050';
  ctx.fillRect(x - 2, y, 3, 1);
  ctx.fillRect(x + 1, y - 1, 1, 1);
}

function drawSalt(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Salt crystals
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(x - 3, y - 1, 3, 3);
  ctx.fillRect(x, y - 2, 3, 3);
  ctx.fillRect(x - 2, y, 2, 2);
  // Crystal facets
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 2, y, 1, 1);
  ctx.fillRect(x + 1, y - 1, 1, 1);
  // Shadows
  ctx.fillStyle = '#d0d0d0';
  ctx.fillRect(x - 3, y + 1, 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, 1);
}

// ── Processed Materials ──────────────────────────────────

function drawIron(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Iron bar
  ctx.fillStyle = '#a0a0a8';
  ctx.fillRect(x - 4, y - 1, 8, 3);
  // Shine
  ctx.fillStyle = '#c8c8d0';
  ctx.fillRect(x - 3, y - 1, 5, 1);
  // Shadow
  ctx.fillStyle = '#707078';
  ctx.fillRect(x - 3, y + 1, 6, 1);
}

function drawSteel(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Steel bar
  ctx.fillStyle = '#b0b0c0';
  ctx.fillRect(x - 4, y - 1, 8, 3);
  // Strong shine
  ctx.fillStyle = '#e0e0f0';
  ctx.fillRect(x - 2, y - 1, 4, 1);
  // Shadow
  ctx.fillStyle = '#808090';
  ctx.fillRect(x - 3, y + 1, 6, 1);
}

function drawCopper(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Copper bar
  ctx.fillStyle = '#c87850';
  ctx.fillRect(x - 4, y - 1, 8, 3);
  // Shine
  ctx.fillStyle = '#e89870';
  ctx.fillRect(x - 3, y - 1, 5, 1);
  // Shadow
  ctx.fillStyle = '#a05030';
  ctx.fillRect(x - 3, y + 1, 6, 1);
}

function drawGold(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Gold bar
  ctx.fillStyle = '#e8b830';
  ctx.fillRect(x - 4, y - 1, 8, 3);
  // Shine
  ctx.fillStyle = '#f8d850';
  ctx.fillRect(x - 3, y - 1, 5, 1);
  // Shadow
  ctx.fillStyle = '#c09010';
  ctx.fillRect(x - 3, y + 1, 6, 1);
}

function drawLumber(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Cut log
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(x - 4, y - 2, 8, 4);
  // Cut marks
  ctx.fillStyle = '#aa8a6a';
  ctx.fillRect(x - 3, y - 2, 6, 1);
  ctx.fillRect(x - 3, y + 1, 6, 1);
  // Grain
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(x - 2, y - 1, 1, 2);
  ctx.fillRect(x + 1, y, 1, 1);
}

function drawPlanks(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Plank stack
  ctx.fillStyle = '#9a7a5a';
  ctx.fillRect(x - 4, y - 2, 8, 1);
  ctx.fillRect(x - 4, y, 8, 1);
  ctx.fillRect(x - 4, y + 2, 8, 1);
  // Grain lines
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(x - 2, y - 2, 4, 1);
  ctx.fillRect(x - 3, y, 5, 1);
  ctx.fillRect(x - 1, y + 2, 3, 1);
}

function drawBricks(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Brick pattern
  ctx.fillStyle = '#a86050';
  ctx.fillRect(x - 4, y - 3, 3, 2);
  ctx.fillRect(x - 1, y - 3, 3, 2);
  ctx.fillRect(x + 2, y - 3, 2, 2);
  ctx.fillRect(x - 4, y - 1, 2, 2);
  ctx.fillRect(x - 2, y - 1, 3, 2);
  ctx.fillRect(x + 1, y - 1, 3, 2);
  // Mortar lines
  ctx.fillStyle = '#d0c8c0';
  ctx.fillRect(x - 4, y - 1, 8, 1);
  ctx.fillRect(x - 1, y - 3, 1, 2);
  ctx.fillRect(x + 2, y - 3, 1, 2);
  ctx.fillRect(x - 2, y - 1, 1, 2);
  ctx.fillRect(x + 1, y - 1, 1, 2);
}

// ── Textiles ────────────────────────────────────────────

function drawWool(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Wool bundle
  ctx.fillStyle = '#f0f0e8';
  ctx.fillRect(x - 3, y - 2, 6, 4);
  ctx.fillRect(x - 4, y - 1, 1, 2);
  ctx.fillRect(x + 3, y, 1, 1);
  // Fluffy texture
  ctx.fillStyle = '#e8e8d8';
  ctx.fillRect(x - 2, y - 2, 1, 1);
  ctx.fillRect(x, y - 2, 1, 1);
  ctx.fillRect(x + 2, y - 1, 1, 1);
  ctx.fillRect(x - 1, y, 2, 1);
  ctx.fillRect(x - 3, y + 1, 2, 1);
  ctx.fillRect(x + 1, y + 1, 2, 1);
}

function drawCloth(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Folded cloth
  ctx.fillStyle = '#d0c8b0';
  ctx.fillRect(x - 4, y - 2, 8, 4);
  // Folds
  ctx.fillStyle = '#b0a890';
  ctx.fillRect(x - 3, y - 1, 1, 3);
  ctx.fillRect(x - 1, y - 2, 1, 4);
  ctx.fillRect(x + 1, y - 1, 1, 3);
  ctx.fillRect(x + 3, y, 1, 2);
  // Highlights
  ctx.fillStyle = '#e8e0c8';
  ctx.fillRect(x - 2, y - 2, 1, 1);
  ctx.fillRect(x, y - 2, 1, 1);
  ctx.fillRect(x + 2, y - 1, 1, 1);
}

function drawHides(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Animal hide
  ctx.fillStyle = '#9a7860';
  ctx.fillRect(x - 4, y - 3, 7, 6);
  ctx.fillRect(x - 5, y - 2, 1, 4);
  ctx.fillRect(x + 3, y - 1, 1, 2);
  // Fur texture
  ctx.fillStyle = '#8a6850';
  ctx.fillRect(x - 3, y - 2, 5, 1);
  ctx.fillRect(x - 2, y, 3, 1);
  ctx.fillRect(x - 3, y + 2, 4, 1);
  // Dark spots
  ctx.fillStyle = '#6a4830';
  ctx.fillRect(x - 2, y - 1, 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, 1);
}

function drawLeather(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Leather sheet
  ctx.fillStyle = '#8a5a3a';
  ctx.fillRect(x - 4, y - 2, 8, 4);
  // Stitching
  ctx.fillStyle = '#6a3a1a';
  ctx.fillRect(x - 3, y - 2, 1, 1);
  ctx.fillRect(x - 1, y - 2, 1, 1);
  ctx.fillRect(x + 1, y - 2, 1, 1);
  ctx.fillRect(x + 3, y - 2, 1, 1);
  ctx.fillRect(x - 3, y + 1, 1, 1);
  ctx.fillRect(x - 1, y + 1, 1, 1);
  ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillRect(x + 3, y + 1, 1, 1);
}

// ── Luxury Goods ────────────────────────────────────────

function drawWine(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Bottle
  ctx.fillStyle = '#304030';
  ctx.fillRect(x - 2, y - 4, 4, 6);
  // Neck
  ctx.fillRect(x - 1, y - 5, 2, 2);
  // Cork
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(x - 1, y - 6, 2, 1);
  // Label
  ctx.fillStyle = '#e8d8c0';
  ctx.fillRect(x - 2, y - 2, 4, 2);
  // Shine
  ctx.fillStyle = '#507050';
  ctx.fillRect(x - 1, y - 3, 1, 2);
}

function drawJewelry(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Gold band
  ctx.fillStyle = '#e8b830';
  ctx.fillRect(x - 3, y, 6, 1);
  ctx.fillRect(x - 3, y - 1, 1, 1);
  ctx.fillRect(x + 2, y - 1, 1, 1);
  ctx.fillRect(x - 3, y + 1, 1, 1);
  ctx.fillRect(x + 2, y + 1, 1, 1);
  // Gem
  ctx.fillStyle = '#3080c8';
  ctx.fillRect(x - 1, y - 2, 2, 2);
  // Gem shine
  ctx.fillStyle = '#60a8f0';
  ctx.fillRect(x - 1, y - 2, 1, 1);
}

function drawSilk(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Silk fabric
  ctx.fillStyle = '#d870a0';
  ctx.fillRect(x - 4, y - 2, 8, 4);
  // Shimmer
  ctx.fillStyle = '#f090c0';
  ctx.fillRect(x - 3, y - 2, 2, 1);
  ctx.fillRect(x, y - 1, 3, 1);
  ctx.fillRect(x - 2, y, 2, 1);
  ctx.fillRect(x + 1, y + 1, 2, 1);
  // Folds
  ctx.fillStyle = '#b85080';
  ctx.fillRect(x - 1, y - 2, 1, 4);
  ctx.fillRect(x + 2, y - 1, 1, 3);
}

function drawSpices(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Sack
  ctx.fillStyle = '#a08060';
  ctx.fillRect(x - 3, y - 1, 6, 3);
  ctx.fillRect(x - 2, y - 2, 4, 1);
  // Tie
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(x - 1, y - 3, 2, 2);
  // Spice powder leaking
  ctx.fillStyle = '#d08030';
  ctx.fillRect(x - 2, y + 2, 1, 1);
  ctx.fillRect(x + 1, y + 2, 1, 1);
  ctx.fillStyle = '#e89840';
  ctx.fillRect(x - 1, y + 1, 1, 1);
  ctx.fillRect(x, y + 2, 1, 1);
}

// ── Tools & Weapons ──────────────────────────────────────

function drawTools(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Hammer head
  ctx.fillStyle = '#808080';
  ctx.fillRect(x - 3, y - 1, 4, 2);
  // Handle
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(x + 1, y - 3, 1, 5);
  // Pickaxe
  ctx.fillStyle = '#909090';
  ctx.fillRect(x - 5, y + 1, 3, 1);
  ctx.fillRect(x - 4, y, 1, 1);
}

function drawWeapons(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Sword blade
  ctx.fillStyle = '#b0b0c0';
  ctx.fillRect(x - 1, y - 5, 2, 6);
  ctx.fillRect(x, y - 6, 1, 1);
  // Hilt
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(x - 1, y + 1, 2, 2);
  // Crossguard
  ctx.fillStyle = '#c0a060';
  ctx.fillRect(x - 3, y + 1, 6, 1);
}

// ── Generic ──────────────────────────────────────────────

function drawGenericItem(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
  // Generic box/package
  ctx.fillStyle = '#8a7a6a';
  ctx.fillRect(x - 3, y - 2, 6, 4);
  ctx.fillStyle = '#6a5a4a';
  ctx.fillRect(x - 2, y - 1, 4, 1);
  ctx.fillRect(x - 1, y - 2, 1, 4);
  // Question mark
  ctx.fillStyle = '#c0b0a0';
  ctx.fillRect(x, y - 1, 1, 1);
  ctx.fillRect(x, y + 1, 1, 1);
}
