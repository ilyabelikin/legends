/** Terrain elevation classification */
export type TerrainType =
  | 'deep_ocean'
  | 'shallow_ocean'
  | 'coast'
  | 'lowland'
  | 'highland'
  | 'mountain'
  | 'peak';

/** A single tile in the world grid */
export interface Tile {
  x: number;
  y: number;
  elevation: number;      // 0–1 normalized
  moisture: number;       // 0–1 normalized
  temperature: number;    // 0–1 normalized (0=cold, 1=hot)
  terrainType: TerrainType;
  biome: string;          // BiomeType id
  vegetation: number;     // 0–1 density
  features: TileFeature[];
  resourceDeposit: ResourceDeposit | null;
  locationId: string | null;
  roadLevel: number;      // 0=none, 1=path, 2=road, 3=highway
  explored: boolean;
  visible: boolean;
  riverFlow: number;      // 0=none, positive=has river
}

/** A special feature on a tile */
export interface TileFeature {
  type: TileFeatureType;
  variant: number;
}

export type TileFeatureType =
  | 'rock'
  | 'river'
  | 'lake'
  | 'ruins'
  | 'dungeon_entrance'
  | 'oasis'
  | 'hot_spring'
  | 'pier';

/** Natural resource deposit at a tile */
export interface ResourceDeposit {
  resourceId: string;
  amount: number;
  maxAmount: number;
  replenishRate: number;  // per turn, 0 = non-renewable
}

/** Simple 2D position */
export interface Position {
  x: number;
  y: number;
}
