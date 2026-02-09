/** Types of events that can occur in the world */
export type EventType =
  | "bandit_attack"
  | "dragon_sighting"
  | "dragon_attack"
  | "war_declared"
  | "peace_treaty"
  | "alliance_formed"
  | "plague"
  | "famine"
  | "bountiful_harvest"
  | "festival"
  | "mine_discovered"
  | "ruin_found"
  | "merchant_caravan"
  | "birth"
  | "death"
  | "marriage"
  | "coronation"
  | "rebellion"
  | "monster_migration"
  | "trade_route_raided"
  | "settlement_destroyed"
  | "settlement_founded"
  | "hero_emerged"
  | "natural_disaster";

/** An event in the game world */
export interface GameEvent {
  id: string;
  type: EventType;
  turn: number;
  title: string;
  description: string;
  locationId: string | null;
  characterIds: string[];
  isResolved: boolean;
  effects: EventEffect[];
  severity: EventSeverity;
}

export type EventSeverity = "minor" | "moderate" | "major" | "catastrophic";

/**
 * How far news of an event spreads from its origin (in tiles).
 * The party must be at a settlement within this range to hear about it,
 * unless they witnessed it directly.
 */
export const EVENT_SPREAD_RADIUS: Record<EventSeverity, number> = {
  minor: 0, // only at the settlement itself (births, small trades)
  moderate: 15, // nearby region (bandit raids, harvests)
  major: 50, // wide spread (dragon attacks, famines, wars)
  catastrophic: 999, // entire world (plagues, war declarations)
};

/** A single effect of an event */
export interface EventEffect {
  type: EventEffectType;
  targetId: string;
  targetType: "character" | "location" | "country" | "creature";
  value: number;
  description: string;
}

export type EventEffectType =
  | "damage"
  | "heal"
  | "gold_change"
  | "resource_change"
  | "reputation_change"
  | "population_change"
  | "defense_change"
  | "prosperity_change"
  | "happiness_change"
  | "destroy";
