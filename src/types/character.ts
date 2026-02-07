import type { Item } from './item';

export type Gender = 'male' | 'female';

/** All job types a character can hold */
export type JobType =
  | 'farmer'
  | 'miner'
  | 'lumberjack'
  | 'fisher'
  | 'blacksmith'
  | 'weaver'
  | 'baker'
  | 'brewer'
  | 'tanner'
  | 'merchant'
  | 'soldier'
  | 'guard'
  | 'hunter'
  | 'herbalist'
  | 'scholar'
  | 'priest'
  | 'noble'
  | 'adventurer'
  | 'unemployed'
  | 'child'
  | 'elder';

/** Types of social relationships between characters */
export type RelationshipType =
  | 'spouse'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'lord'
  | 'vassal'
  | 'master'
  | 'apprentice'
  | 'friend'
  | 'rival'
  | 'enemy'
  | 'employer'
  | 'employee';

/** A single relationship link */
export interface Relationship {
  targetId: string;
  type: RelationshipType;
  strength: number;          // -100 to 100
}

/** Character needs — each 0–100 */
export interface CharacterNeeds {
  food: number;
  shelter: number;
  safety: number;
  social: number;
  purpose: number;
}

/** Character personality traits — each 0–1 */
export interface Personality {
  ambition: number;
  courage: number;
  greed: number;
  loyalty: number;
  kindness: number;
  curiosity: number;
}

/** Core character stats */
export interface CharacterStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  charisma: number;
  endurance: number;
}

/** A character in the game world */
export interface Character {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  position: { x: number; y: number };
  homeLocationId: string | null;
  jobType: JobType;

  // Combat stats
  health: number;
  maxHealth: number;
  stats: CharacterStats;

  // Needs & personality
  needs: CharacterNeeds;
  personality: Personality;

  // Social
  relationships: Relationship[];

  // Skills (skill name → level 0–100)
  skills: Record<string, number>;

  // Possessions
  inventory: Item[];
  gold: number;
  equippedWeapon: Item | null;
  equippedArmor: Item | null;

  // State
  isAlive: boolean;
  currentAction: CharacterAction | null;
  destination: { x: number; y: number } | null;
  turnsUntilArrival: number;

  // Feudal
  title: string | null;
  lordId: string | null;
  vassalIds: string[];
  ownedLocationIds: string[];

  // Memory & flags
  knownLocationIds: string[];
  flags: Record<string, boolean>;
}

/** Possible character actions */
export type CharacterAction =
  | { type: 'idle' }
  | { type: 'working'; buildingType: string }
  | { type: 'traveling'; to: { x: number; y: number } }
  | { type: 'trading'; locationId: string }
  | { type: 'fighting'; targetId: string }
  | { type: 'resting' }
  | { type: 'socializing'; targetId: string }
  | { type: 'exploring' };
