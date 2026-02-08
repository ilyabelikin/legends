import type { ResourceStack } from './resource';

/** Types of creatures in the world */
export type CreatureType =
  | 'wolf'
  | 'bear'
  | 'deer'
  | 'sheep'
  | 'boar'
  | 'dragon'
  | 'bandit'
  | 'guard'
  | 'army'
  | 'trader'
  | 'hunter';

/** Behavior patterns for creatures */
export type CreatureBehavior =
  | 'passive'
  | 'territorial'
  | 'aggressive'
  | 'fleeing'
  | 'migrating'
  | 'hunting'
  | 'raiding'
  | 'patrolling'
  | 'marching'
  | 'trading';

/** A creature in the game world */
export interface Creature {
  id: string;
  type: CreatureType;
  name: string | null;       // named creatures (legendary dragons, etc.)
  position: { x: number; y: number };
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  speed: number;
  behavior: CreatureBehavior;
  homePosition: { x: number; y: number } | null;
  wanderRadius: number;
  isHostile: boolean;
  loot: ResourceStack[];
  age: number;               // turns alive
  lastActionTurn: number;
  /** Country this creature belongs to (guards, armies) */
  countryId: string | null;
  /** Location this creature is targeting (armies marching to attack) */
  targetLocationId: string | null;
  /** Settlement that spawned this creature (guards) */
  homeLocationId: string | null;
  /** Path to follow (for traders, using trade routes) */
  path?: { x: number; y: number }[];
  /** Current progress along path (for traders) */
  pathProgress?: number;
  /** Direction along path (for traders, 1 = forward, -1 = backward) */
  pathDirection?: 1 | -1;
  /** Shepherd who owns this creature (for herded sheep) */
  ownerId?: string | null;
  /** Last turn wool was produced (for sheep) */
  lastWoolProduction?: number;
  /** Breeding cooldown (turns until can breed again) */
  breedingCooldown?: number;
}

/** Static definition for a creature type */
export interface CreatureDefinition {
  type: CreatureType;
  name: string;
  baseHealth: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  defaultBehavior: CreatureBehavior;
  hostile: boolean;
  wanderRadius: number;
  preferredBiomes: string[];
  packSize: [number, number];   // min, max group size
  lootTable: { resourceId: string; chance: number; quantity: [number, number] }[];
  description: string;
}
