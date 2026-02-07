/** All supported biome types */
export type BiomeType =
  | 'ocean'
  | 'beach'
  | 'desert'
  | 'grassland'
  | 'forest'
  | 'dense_forest'
  | 'jungle'
  | 'hills'
  | 'mountain'
  | 'snow_mountain'
  | 'tundra'
  | 'swamp'
  | 'savanna';

/** Static definition of a biome */
export interface BiomeDefinition {
  type: BiomeType;
  name: string;
  description: string;
  movementCost: number;       // turns to cross
  elevationRange: [number, number];
  moistureRange: [number, number];
  temperatureRange: [number, number];
  baseColor: string;          // hex color for rendering
  vegetationDensity: number;  // default vegetation 0–1
  possibleResources: string[];
  dangerLevel: number;        // 0–1
  canBuildSettlement: boolean;
  seasonalEffects: {
    winter: { movementMultiplier: number; productionMultiplier: number };
    summer: { movementMultiplier: number; productionMultiplier: number };
  };
}
