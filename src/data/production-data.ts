import type { ProductionRecipe } from '../types/economy';

/** All production recipes in the game */
export const PRODUCTION_RECIPES: ProductionRecipe[] = [
  // Wood → Lumber (Sawmill)
  {
    id: 'saw_lumber',
    name: 'Saw Lumber',
    buildingType: 'sawmill',
    inputs: [{ resourceId: 'wood', quantity: 3 }],
    outputs: [{ resourceId: 'lumber', quantity: 2, baseQuality: 0.7 }],
    duration: 2,
    skillRequired: 'woodworking',
    minimumSkillLevel: 5,
    description: 'Mill raw wood into usable lumber planks.',
  },

  // Iron Ore + Coal → Iron Ingot (Smelter)
  {
    id: 'smelt_iron',
    name: 'Smelt Iron',
    buildingType: 'smelter',
    inputs: [
      { resourceId: 'iron_ore', quantity: 2 },
      { resourceId: 'coal', quantity: 1 },
    ],
    outputs: [{ resourceId: 'iron_ingot', quantity: 1, baseQuality: 0.6 }],
    duration: 3,
    skillRequired: 'smelting',
    minimumSkillLevel: 10,
    description: 'Smelt iron ore into ingots.',
  },

  // Gold Ore + Coal → Gold Ingot (Smelter)
  {
    id: 'smelt_gold',
    name: 'Smelt Gold',
    buildingType: 'smelter',
    inputs: [
      { resourceId: 'gold_ore', quantity: 2 },
      { resourceId: 'coal', quantity: 1 },
    ],
    outputs: [{ resourceId: 'gold_ingot', quantity: 1, baseQuality: 0.7 }],
    duration: 4,
    skillRequired: 'smelting',
    minimumSkillLevel: 20,
    description: 'Smelt gold ore into precious ingots.',
  },

  // Wheat → Bread (Bakery)
  {
    id: 'bake_bread',
    name: 'Bake Bread',
    buildingType: 'bakery',
    inputs: [{ resourceId: 'wheat', quantity: 3 }],
    outputs: [{ resourceId: 'bread', quantity: 4, baseQuality: 0.7 }],
    duration: 1,
    skillRequired: 'cooking',
    minimumSkillLevel: 5,
    description: 'Bake nutritious bread from wheat.',
  },

  // Wool → Fabric (Weaver)
  {
    id: 'weave_fabric',
    name: 'Weave Fabric',
    buildingType: 'weaver',
    inputs: [{ resourceId: 'wool', quantity: 3 }],
    outputs: [{ resourceId: 'fabric', quantity: 2, baseQuality: 0.6 }],
    duration: 3,
    skillRequired: 'weaving',
    minimumSkillLevel: 10,
    description: 'Weave wool into usable fabric.',
  },

  // Hides → Leather (Tanner)
  {
    id: 'tan_leather',
    name: 'Tan Leather',
    buildingType: 'tanner',
    inputs: [{ resourceId: 'hides', quantity: 2 }],
    outputs: [{ resourceId: 'leather', quantity: 2, baseQuality: 0.6 }],
    duration: 3,
    skillRequired: 'leatherworking',
    minimumSkillLevel: 10,
    description: 'Tan raw hides into leather.',
  },

  // Iron Ingot → Tools (Blacksmith)
  {
    id: 'forge_tools',
    name: 'Forge Tools',
    buildingType: 'blacksmith',
    inputs: [
      { resourceId: 'iron_ingot', quantity: 1 },
      { resourceId: 'wood', quantity: 1 },
    ],
    outputs: [{ resourceId: 'tools', quantity: 2, baseQuality: 0.6 }],
    duration: 2,
    skillRequired: 'blacksmithing',
    minimumSkillLevel: 15,
    description: 'Forge iron and wood into useful tools.',
  },

  // Iron Ingot → Weapons (Weaponsmith)
  {
    id: 'forge_weapons',
    name: 'Forge Weapons',
    buildingType: 'weaponsmith',
    inputs: [
      { resourceId: 'iron_ingot', quantity: 2 },
      { resourceId: 'leather', quantity: 1 },
    ],
    outputs: [{ resourceId: 'weapons', quantity: 1, baseQuality: 0.5 }],
    duration: 4,
    skillRequired: 'weaponsmithing',
    minimumSkillLevel: 20,
    description: 'Forge deadly iron weapons.',
  },

  // Iron Ingot + Leather → Armor (Armorer)
  {
    id: 'craft_armor',
    name: 'Craft Armor',
    buildingType: 'armorer',
    inputs: [
      { resourceId: 'iron_ingot', quantity: 3 },
      { resourceId: 'leather', quantity: 2 },
    ],
    outputs: [{ resourceId: 'armor', quantity: 1, baseQuality: 0.5 }],
    duration: 5,
    skillRequired: 'armoring',
    minimumSkillLevel: 25,
    description: 'Craft protective armor from iron and leather.',
  },

  // Wheat + Herbs → Ale (Brewery)
  {
    id: 'brew_ale',
    name: 'Brew Ale',
    buildingType: 'brewery',
    inputs: [
      { resourceId: 'wheat', quantity: 3 },
      { resourceId: 'herbs', quantity: 1 },
    ],
    outputs: [{ resourceId: 'ale', quantity: 3, baseQuality: 0.6 }],
    duration: 3,
    skillRequired: 'brewing',
    minimumSkillLevel: 10,
    description: 'Brew hearty ale from wheat and herbs.',
  },

  // Herbs → Medicine (Apothecary)
  {
    id: 'make_medicine',
    name: 'Make Medicine',
    buildingType: 'apothecary',
    inputs: [{ resourceId: 'herbs', quantity: 2 }],
    outputs: [{ resourceId: 'medicine', quantity: 1, baseQuality: 0.5 }],
    duration: 2,
    skillRequired: 'herbalism',
    minimumSkillLevel: 15,
    description: 'Prepare medicinal remedies.',
  },

  // Sheep → Wool + Meat (Farm)
  {
    id: 'shear_sheep',
    name: 'Shear Sheep',
    buildingType: 'farm_field',
    inputs: [{ resourceId: 'sheep', quantity: 1 }],
    outputs: [
      { resourceId: 'wool', quantity: 3, baseQuality: 0.7 },
      { resourceId: 'meat', quantity: 1, baseQuality: 0.7 },
    ],
    duration: 2,
    skillRequired: 'farming',
    minimumSkillLevel: 5,
    description: 'Shear wool from sheep.',
  },

  // Deer → Meat + Hides (Hunter Lodge)
  {
    id: 'butcher_deer',
    name: 'Process Deer',
    buildingType: 'hunter_lodge',
    inputs: [{ resourceId: 'deer', quantity: 1 }],
    outputs: [
      { resourceId: 'meat', quantity: 3, baseQuality: 0.7 },
      { resourceId: 'hides', quantity: 2, baseQuality: 0.7 },
    ],
    duration: 1,
    skillRequired: 'hunting',
    minimumSkillLevel: 5,
    description: 'Butcher deer for meat and hides.',
  },

  // Farm wheat production
  {
    id: 'farm_wheat',
    name: 'Farm Wheat',
    buildingType: 'farm_field',
    inputs: [],
    outputs: [{ resourceId: 'wheat', quantity: 4, baseQuality: 0.7 }],
    duration: 5,
    skillRequired: 'farming',
    minimumSkillLevel: 0,
    description: 'Grow and harvest wheat.',
  },

  // Mine iron
  {
    id: 'mine_iron',
    name: 'Mine Iron Ore',
    buildingType: 'mine_shaft',
    inputs: [],
    outputs: [{ resourceId: 'iron_ore', quantity: 2, baseQuality: 0.6 }],
    duration: 3,
    skillRequired: 'mining',
    minimumSkillLevel: 5,
    description: 'Extract iron ore from the earth.',
  },

  // Mine gold
  {
    id: 'mine_gold',
    name: 'Mine Gold Ore',
    buildingType: 'mine_shaft',
    inputs: [],
    outputs: [{ resourceId: 'gold_ore', quantity: 1, baseQuality: 0.5 }],
    duration: 4,
    skillRequired: 'mining',
    minimumSkillLevel: 15,
    description: 'Extract precious gold ore.',
  },

  // Mine coal
  {
    id: 'mine_coal',
    name: 'Mine Coal',
    buildingType: 'mine_shaft',
    inputs: [],
    outputs: [{ resourceId: 'coal', quantity: 3, baseQuality: 0.8 }],
    duration: 2,
    skillRequired: 'mining',
    minimumSkillLevel: 0,
    description: 'Extract coal from the mines.',
  },

  // Mine stone
  {
    id: 'quarry_stone',
    name: 'Quarry Stone',
    buildingType: 'mine_shaft',
    inputs: [],
    outputs: [{ resourceId: 'stone', quantity: 3, baseQuality: 0.8 }],
    duration: 2,
    skillRequired: 'mining',
    minimumSkillLevel: 0,
    description: 'Quarry stone blocks.',
  },

  // Fishing
  {
    id: 'catch_fish',
    name: 'Catch Fish',
    buildingType: 'dock',
    inputs: [],
    outputs: [{ resourceId: 'fish', quantity: 4, baseQuality: 0.8 }],
    duration: 1,
    skillRequired: 'fishing',
    minimumSkillLevel: 0,
    description: 'Catch fresh fish.',
  },

  // Logging
  {
    id: 'chop_wood',
    name: 'Chop Wood',
    buildingType: 'hunter_lodge',
    inputs: [],
    outputs: [{ resourceId: 'wood', quantity: 3, baseQuality: 0.8 }],
    duration: 2,
    skillRequired: 'woodworking',
    minimumSkillLevel: 0,
    description: 'Fell trees and collect wood.',
  },

  // Gather herbs
  {
    id: 'gather_herbs',
    name: 'Gather Herbs',
    buildingType: 'apothecary',
    inputs: [],
    outputs: [{ resourceId: 'herbs', quantity: 2, baseQuality: 0.6 }],
    duration: 2,
    skillRequired: 'herbalism',
    minimumSkillLevel: 0,
    description: 'Gather medicinal herbs from the wild.',
  },
];

/** Lookup recipe by ID */
export function getRecipe(id: string): ProductionRecipe | undefined {
  return PRODUCTION_RECIPES.find(r => r.id === id);
}

/** Get all recipes for a building type */
export function getRecipesForBuilding(buildingType: string): ProductionRecipe[] {
  return PRODUCTION_RECIPES.filter(r => r.buildingType === buildingType);
}
