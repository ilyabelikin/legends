import type { Tile } from './terrain';
import type { Location } from './location';
import type { Character } from './character';
import type { Creature } from './creature';
import type { Country, DiplomaticRelation } from './political';
import type { TradeRoute } from './economy';
import type { Item } from './item';

/** Visual effect for defeated creatures */
export interface BloodSplash {
  x: number;
  y: number;
  offsetX: number; // screen-space offset (e.g., if creature was offset from party)
  offsetY: number; // screen-space offset
  createdTurn: number;
  creatureType: string; // for color variation
}

/** The complete world state */
export interface World {
  width: number;
  height: number;
  seed: number;
  tiles: Tile[][];
  locations: Map<string, Location>;
  characters: Map<string, Character>;
  creatures: Map<string, Creature>;
  countries: Map<string, Country>;
  tradeRoutes: Map<string, TradeRoute>;
  items: Map<string, Item>;
  diplomacy: DiplomaticRelation[];
  bloodSplashes: BloodSplash[];
}
