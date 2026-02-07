/**
 * Pixel art color palette.
 * All colors in the game derive from this limited palette
 * for visual consistency.
 */
export const PALETTE = {
  // Water
  deepWater: '#0f3460',
  water: '#1a5276',
  shallowWater: '#2980b9',
  waterHighlight: '#5dade2',
  waterFoam: '#aed6f1',

  // Sand / desert
  sand: '#e8d4a2',
  sandDark: '#d4b87a',
  sandLight: '#f0e6c8',
  desert: '#d4a843',
  desertDark: '#b8922c',

  // Grass
  grassDark: '#2d6b1e',
  grass: '#4a8c3a',
  grassLight: '#6aac5a',
  dryGrass: '#9ca44c',

  // Forest
  treeDark: '#1a4c0c',
  tree: '#2d6b1e',
  treeLight: '#4a8c3a',
  jungleTree: '#1a6b1a',
  jungleTreeDark: '#0d4d0d',

  // Hills / mountains
  hillGrass: '#8c9c5c',
  rock: '#7c7c7c',
  rockDark: '#5c5c5c',
  rockLight: '#9c9c9c',
  snow: '#e8e8f0',
  snowShadow: '#c8c8d8',

  // Tundra
  tundra: '#a8b8a0',
  tundraDark: '#8ca080',

  // Swamp
  swampWater: '#3c5c3c',
  swamp: '#4c6c3c',
  swampDark: '#3c5c2c',

  // Savanna
  savanna: '#b8a848',
  savannaDark: '#a09030',

  // Buildings
  woodWall: '#8c6c3c',
  woodWallDark: '#6c5028',
  woodWallLight: '#a88c5c',
  stoneWall: '#a0a0a0',
  stoneWallDark: '#707070',
  stoneWallLight: '#c0c0c0',
  roofRed: '#a04040',
  roofRedDark: '#803030',
  roofBlue: '#4040a0',
  roofBrown: '#705030',
  roofBrownDark: '#503820',

  // Characters
  skinLight: '#e8c8a0',
  skinMedium: '#d4b088',
  skinDark: '#b08860',
  hairBlack: '#2a2a2a',
  hairBrown: '#5a3a1a',
  hairBlonde: '#c8a848',
  hairRed: '#a04020',
  hairGrey: '#8a8a8a',

  // Clothing
  clothRed: '#c44444',
  clothBlue: '#4444c4',
  clothGreen: '#44a044',
  clothPurple: '#8844a4',
  clothBrown: '#8c6c3c',
  clothWhite: '#d8d8d8',
  clothBlack: '#2a2a2a',
  clothGold: '#c8a848',

  // UI
  uiBackground: '#1a1a2e',
  uiBorder: '#3a3a5e',
  uiText: '#e0d8c8',
  uiHighlight: '#c8a84e',
  uiDanger: '#c44444',
  uiSafe: '#44a044',

  // Misc
  shadow: 'rgba(0,0,0,0.25)',
  roadDirt: '#a09070',
  roadStone: '#b0a898',
  roadHighway: '#c0b8a8',
  fireOrange: '#e87020',
  fireYellow: '#f0c040',
  smoke: 'rgba(80,80,80,0.3)',
} as const;

/** Darken a hex color */
export function darkenColor(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Lighten a hex color */
export function lightenColor(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Convert hex to RGBA string */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
