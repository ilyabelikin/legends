import type { BuildingType } from './location';
import type { ResourceStack } from './resource';

/** A recipe for producing goods */
export interface ProductionRecipe {
  id: string;
  name: string;
  buildingType: BuildingType;
  inputs: { resourceId: string; quantity: number }[];
  outputs: { resourceId: string; quantity: number; baseQuality: number }[];
  duration: number;          // turns to complete
  skillRequired: string;     // skill name
  minimumSkillLevel: number;
  description: string;
}

/** Transport capacity types */
export type TransportType = 'hauling' | 'cart' | 'horse_cart' | 'ship';

/** Capacities per transport type (weight units) */
export const TRANSPORT_CAPACITY: Record<TransportType, number> = {
  hauling: 20,
  cart: 80,
  horse_cart: 200,
  ship: 1000,
};

/** Speed multiplier per transport type */
export const TRANSPORT_SPEED: Record<TransportType, number> = {
  hauling: 0.5,
  cart: 0.8,
  horse_cart: 1.2,
  ship: 1.5,
};

/** A trade route between two locations */
export interface TradeRoute {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  path: { x: number; y: number }[];
  distance: number;
  transportType: TransportType;
  goods: ResourceStack[];
  merchantId: string | null;
  isActive: boolean;
  dangerLevel: number;       // 0–1 (affects bandit attacks)
  lastUsedTurn: number;
}

/** A market listing at a location */
export interface MarketListing {
  resourceId: string;
  quantity: number;
  price: number;
  sellerId: string;
}
