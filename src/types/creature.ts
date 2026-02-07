import type { ResourceStack } from './resource';

/** Types of creatures in the world */
export type CreatureType =
  | 'wolf'
  | 'bear'
  | 'deer'
  | 'sheep'
  | 'boar'
  | 'dragon'
  | 'bandit';

/** Behavior patterns for creatures */
export type CreatureBehavior =
  | 'passive'
  | 'territorial'
  | 'aggressive'
  | 'fleeing'
  | 'migrating'
  | 'hunting'
  | 'raiding';

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
