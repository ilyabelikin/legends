import type { ResourceStack, StorageType } from './resource';

/** All location type classifications */
export type LocationType =
  | 'homestead'
  | 'hamlet'
  | 'village'
  | 'town'
  | 'city'
  | 'castle'
  | 'mine'
  | 'farm'
  | 'lumber_camp'
  | 'fishing_village'
  | 'port'
  | 'dungeon'
  | 'ruins'
  | 'dragon_lair'
  | 'bandit_camp'
  | 'monastery';

/** Types of buildings that can exist in locations */
export type BuildingType =
  | 'house'
  | 'farm_field'
  | 'mine_shaft'
  | 'sawmill'
  | 'smelter'
  | 'blacksmith'
  | 'weaponsmith'
  | 'armorer'
  | 'bakery'
  | 'brewery'
  | 'weaver'
  | 'tanner'
  | 'market'
  | 'warehouse'
  | 'barracks'
  | 'wall'
  | 'church'
  | 'tavern'
  | 'guild_hall'
  | 'castle_keep'
  | 'stable'
  | 'dock'
  | 'apothecary'
  | 'hunter_lodge';

/** A building within a location */
export interface Building {
  type: BuildingType;
  level: number;             // 1–3
  condition: number;         // 0–100
  workerId: string | null;
  isOperational: boolean;
}

/** A production site that converts resources */
export interface ProductionSite {
  buildingType: BuildingType;
  recipeId: string;
  workerId: string | null;
  progress: number;          // 0–100
  efficiency: number;        // 0–1 (affected by skill, tools, happiness)
  isActive: boolean;
}

/** A location in the game world */
export interface Location {
  id: string;
  name: string;
  type: LocationType;
  position: { x: number; y: number };
  size: number;              // abstract importance/size metric

  // Population
  populationCapacity: number;
  residentIds: string[];

  // Infrastructure
  buildings: Building[];
  productionSites: ProductionSite[];

  // Economy
  storage: ResourceStack[];
  storageCapacity: Record<StorageType, number>;
  tradeRouteIds: string[];
  marketPrices: Record<string, number>;  // resourceId → current price

  // Defense
  defenseLevel: number;
  wallLevel: number;
  garrisonIds: string[];

  // Political
  ownerId: string | null;
  countryId: string | null;

  // State metrics
  prosperity: number;        // 0–100
  safety: number;            // 0–100
  happiness: number;         // 0–100

  // Lifecycle
  foundedTurn: number;
  isDestroyed: boolean;
  growthPoints: number;      // accumulates toward next tier
  durability: number;        // 0–100, settlement HP — 0 = destroyed
  originalType: LocationType | null; // what it was before being destroyed
}

/** Thresholds for location growth */
export const LOCATION_GROWTH_THRESHOLDS: Record<LocationType, number> = {
  homestead: 50,
  hamlet: 150,
  village: 400,
  town: 1000,
  city: Infinity,
  castle: Infinity,
  mine: Infinity,
  farm: Infinity,
  lumber_camp: Infinity,
  fishing_village: 200,
  port: Infinity,
  dungeon: Infinity,
  ruins: Infinity,
  dragon_lair: Infinity,
  bandit_camp: Infinity,
  monastery: Infinity,
};

/** What a location type can grow into */
export const LOCATION_GROWTH_PATH: Partial<Record<LocationType, LocationType>> = {
  homestead: 'hamlet',
  hamlet: 'village',
  village: 'town',
  town: 'city',
  fishing_village: 'port',
};
