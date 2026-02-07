/** Broad item categories */
export type ItemType =
  | 'weapon'
  | 'armor'
  | 'tool'
  | 'consumable'
  | 'material'
  | 'treasure'
  | 'misc';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type ItemCondition = 'pristine' | 'good' | 'worn' | 'damaged' | 'broken';

/** Static item template */
export interface ItemDefinition {
  id: string;
  name: string;
  type: ItemType;
  baseValue: number;
  weight: number;
  durability: number;
  description: string;
  // Combat stats (optional)
  attack?: number;
  defense?: number;
  speed?: number;
  // Tool bonus (optional)
  toolBonus?: { skill: string; bonus: number };
}

/** An enchantment on an item */
export interface Enchantment {
  id: string;
  name: string;
  type: EnchantmentType;
  power: number;             // 1–10
  description: string;
}

export type EnchantmentType =
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'poison'
  | 'holy'
  | 'shadow'
  | 'sharpness'
  | 'protection'
  | 'speed'
  | 'luck';

/** A unique item instance in the game */
export interface Item {
  definitionId: string;
  instanceId: string;
  name: string;              // can be renamed (e.g. "Flamebrand")
  ownerId: string | null;
  condition: ItemCondition;
  rarity: ItemRarity;
  enchantments: Enchantment[];
  attuned: boolean;
  attunedToId: string | null;
  createdBy: string | null;  // character who crafted it
  history: string[];         // notable events
  currentDurability: number;
  maxDurability: number;

  // Inherited from definition, may be modified
  type: ItemType;
  attack: number;
  defense: number;
  speed: number;
  weight: number;
  value: number;             // current market value
}

/** Condition thresholds as fraction of max durability */
export const CONDITION_THRESHOLDS: Record<ItemCondition, number> = {
  pristine: 0.9,
  good: 0.7,
  worn: 0.4,
  damaged: 0.15,
  broken: 0,
};

/** Get condition from durability ratio */
export function getItemCondition(current: number, max: number): ItemCondition {
  const ratio = current / max;
  if (ratio >= 0.9) return 'pristine';
  if (ratio >= 0.7) return 'good';
  if (ratio >= 0.4) return 'worn';
  if (ratio >= 0.15) return 'damaged';
  return 'broken';
}
