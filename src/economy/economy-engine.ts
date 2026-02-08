import type { World } from '../types/world';
import type { Location } from '../types/location';
import type { ResourceStack, StorageType } from '../types/resource';
import type { ProductionRecipe } from '../types/economy';
import type { Season } from '../types/season';
import { PRODUCTION_RECIPES, getRecipesForBuilding } from '../data/production-data';
import { RESOURCE_DEFINITIONS } from '../data/resource-data';
import { BIOME_DEFINITIONS } from '../data/biome-data';
import type { BiomeType } from '../types/biome';
import { SeededRandom } from '../utils/random';

/**
 * Run one economy tick for all locations in the world.
 * Handles production, consumption, spoilage, and growth.
 */
export function tickEconomy(world: World, season: Season, rng: SeededRandom): string[] {
  const logs: string[] = [];

  for (const location of world.locations.values()) {
    if (location.isDestroyed) continue;

    // 1. Run production
    const prodLogs = tickProduction(location, world, season, rng);
    logs.push(...prodLogs);

    // 2. Consume food for population
    tickConsumption(location, world);

    // 3. Spoilage
    tickSpoilage(location);

    // 4. Replenish natural resources nearby
    tickResourceReplenishment(location, world);

    // 5. Update market prices
    updateMarketPrices(location);

    // 6. Growth / decline
    tickGrowth(location, world, rng, logs);
  }

  return logs;
}

/** Run production for a location */
function tickProduction(
  loc: Location,
  world: World,
  season: Season,
  rng: SeededRandom,
): string[] {
  const logs: string[] = [];
  const tile = world.tiles[loc.position.y]?.[loc.position.x];
  const biomeDef = tile ? BIOME_DEFINITIONS[tile.biome as BiomeType] : null;

  // Seasonal multiplier
  const seasonMult = season === 'winter'
    ? (biomeDef?.seasonalEffects.winter.productionMultiplier ?? 0.5)
    : (biomeDef?.seasonalEffects.summer.productionMultiplier ?? 1.0);

  for (const building of loc.buildings) {
    if (!building.isOperational || !building.workerId) continue;

    // Find appropriate recipe
    const recipes = getRecipesForBuilding(building.type);
    if (recipes.length === 0) continue;

    // Use first recipe with available inputs
    for (const recipe of recipes) {
      const worker = world.characters.get(building.workerId);
      if (!worker || !worker.isAlive) continue;

      // Check skill
      const skillLevel = worker.skills[recipe.skillRequired] ?? 0;
      if (skillLevel < recipe.minimumSkillLevel) continue;

      // Check inputs
      if (!hasInputs(loc, recipe)) continue;

      // Find/create production site
      let site = loc.productionSites.find(
        ps => ps.buildingType === building.type && ps.recipeId === recipe.id
      );
      if (!site) {
        site = {
          buildingType: building.type,
          recipeId: recipe.id,
          workerId: building.workerId,
          progress: 0,
          efficiency: 0.5,
          isActive: true,
        };
        loc.productionSites.push(site);
      }

      // Calculate efficiency
      const skillBonus = Math.min(skillLevel / 100, 0.5);
      site.efficiency = (0.5 + skillBonus) * seasonMult;

      // Advance progress
      site.progress += site.efficiency * (100 / recipe.duration);

      if (site.progress >= 100) {
        // Complete production
        consumeInputs(loc, recipe);
        produceOutputs(loc, recipe, skillLevel, rng);
        site.progress = 0;

        // Improve worker skill
        if (worker.skills[recipe.skillRequired] !== undefined) {
          worker.skills[recipe.skillRequired] = Math.min(100,
            (worker.skills[recipe.skillRequired] ?? 0) + rng.nextFloat(0.1, 0.5));
        }

        logs.push(`${loc.name}: Produced ${recipe.outputs.map(o => o.quantity + ' ' + o.resourceId).join(', ')}`);
      }

      break; // Only one recipe per building per tick
    }
  }

  return logs;
}

/** Check if location has required inputs for a recipe */
function hasInputs(loc: Location, recipe: ProductionRecipe): boolean {
  for (const input of recipe.inputs) {
    const available = loc.storage
      .filter(s => s.resourceId === input.resourceId)
      .reduce((sum, s) => sum + s.quantity, 0);
    if (available < input.quantity) return false;
  }
  return true;
}

/** Consume recipe inputs from location storage */
function consumeInputs(loc: Location, recipe: ProductionRecipe): void {
  for (const input of recipe.inputs) {
    let remaining = input.quantity;
    for (let i = loc.storage.length - 1; i >= 0 && remaining > 0; i--) {
      if (loc.storage[i].resourceId === input.resourceId) {
        const take = Math.min(remaining, loc.storage[i].quantity);
        loc.storage[i].quantity -= take;
        remaining -= take;
        if (loc.storage[i].quantity <= 0) {
          loc.storage.splice(i, 1);
        }
      }
    }
  }
}

/** Add recipe outputs to location storage */
function produceOutputs(
  loc: Location,
  recipe: ProductionRecipe,
  skillLevel: number,
  rng: SeededRandom,
): void {
  for (const output of recipe.outputs) {
    const qualityBonus = skillLevel / 200; // up to 0.5 bonus from skill
    const quality = Math.min(1, output.baseQuality + qualityBonus + rng.nextFloat(-0.1, 0.1));

    addToStorage(loc, output.resourceId, output.quantity, quality);
  }
}

/** Add resources to location storage */
export function addToStorage(
  loc: Location,
  resourceId: string,
  quantity: number,
  quality: number = 0.7,
): void {
  const def = RESOURCE_DEFINITIONS[resourceId];
  if (!def) return;

  // Check storage capacity
  const currentStorage = loc.storage
    .filter(s => RESOURCE_DEFINITIONS[s.resourceId]?.storageRequirement === def.storageRequirement)
    .reduce((sum, s) => sum + s.quantity, 0);
  const capacity = loc.storageCapacity[def.storageRequirement] ?? 0;
  const spaceLeft = Math.max(0, capacity - currentStorage);
  const actualQuantity = Math.min(quantity, spaceLeft);

  if (actualQuantity <= 0) return;

  // Try to merge with existing stack
  const existing = loc.storage.find(
    s => s.resourceId === resourceId && s.quantity < def.stackSize
  );

  if (existing) {
    const canAdd = Math.min(actualQuantity, def.stackSize - existing.quantity);
    existing.quantity = Math.round(existing.quantity + canAdd);
    existing.quality = Math.round(((existing.quality + quality) / 2) * 100) / 100;
    if (canAdd < actualQuantity) {
      loc.storage.push({
        resourceId,
        quantity: Math.round(actualQuantity - canAdd),
        quality,
        age: 0,
      });
    }
  } else {
    loc.storage.push({
      resourceId,
      quantity: actualQuantity,
      quality,
      age: 0,
    });
  }
}

/**
 * Consumption rates by location type.
 * Larger settlements consume more and can't produce all their own food —
 * they depend on trade from villages, farms, and fishing villages.
 */
const CONSUMPTION_RATE: Partial<Record<string, number>> = {
  city: 0.5,        // cities eat a LOT — need constant supply
  town: 0.4,        // towns eat heavily
  castle: 0.4,      // garrisons need feeding
  port: 0.35,
  village: 0.3,
  hamlet: 0.25,
  homestead: 0.2,
  farm: 0.15,       // farms mostly feed themselves
  fishing_village: 0.2,
  mine: 0.3,        // miners eat well
  lumber_camp: 0.25,
};

/** Additional non-food goods consumed by larger settlements per turn */
const GOODS_CONSUMPTION: Partial<Record<string, { resourceId: string; rate: number }[]>> = {
  city: [
    { resourceId: 'tools', rate: 0.1 },
    { resourceId: 'fabric', rate: 0.05 },
    { resourceId: 'ale', rate: 0.1 },
  ],
  town: [
    { resourceId: 'tools', rate: 0.05 },
    { resourceId: 'ale', rate: 0.05 },
  ],
  castle: [
    { resourceId: 'weapons', rate: 0.03 },
    { resourceId: 'armor', rate: 0.02 },
    { resourceId: 'ale', rate: 0.05 },
  ],
};

/** Consume food and goods. Returns food satisfaction 0-1. */
function tickConsumption(loc: Location, world: World): void {
  const popCount = loc.residentIds.length;
  if (popCount === 0) return;

  const rate = CONSUMPTION_RATE[loc.type] ?? 0.3;
  const foodNeeded = popCount * rate;
  let foodConsumed = 0;

  // Consume food — wealthier locations prefer meat, poorer locations prefer cheaper foods
  // Cities, castles, ports: wealthy citizens prefer meat, fish, exotic foods
  // Villages, hamlets, farms: common folk prefer bread, berries, basic foods
  const wealthyLocations = ['city', 'castle', 'port', 'town'];
  const foodPriority = wealthyLocations.includes(loc.type)
    ? ['meat', 'exotic_fruit', 'fish', 'bread', 'berries', 'wheat']  // wealthy prefer meat first
    : ['bread', 'berries', 'wheat', 'fish', 'meat', 'exotic_fruit']; // common folk prefer cheap food first

  for (const foodId of foodPriority) {
    if (foodConsumed >= foodNeeded) break;

    for (let i = loc.storage.length - 1; i >= 0; i--) {
      if (foodConsumed >= foodNeeded) break;
      if (loc.storage[i].resourceId === foodId) {
        const reserve = 2;
        const available = Math.max(0, loc.storage[i].quantity - reserve);
        if (available <= 0) continue;

        const take = Math.min(foodNeeded - foodConsumed, available);
        loc.storage[i].quantity -= take;
        foodConsumed += take;
        if (loc.storage[i].quantity <= 0) {
          loc.storage.splice(i, 1);
        }
      }
    }
  }

  // Consume non-food goods (tools, ale, weapons for castles, etc.)
  const goodsNeeds = GOODS_CONSUMPTION[loc.type];
  if (goodsNeeds) {
    for (const need of goodsNeeds) {
      for (let i = loc.storage.length - 1; i >= 0; i--) {
        if (loc.storage[i].resourceId === need.resourceId && loc.storage[i].quantity > 1) {
          loc.storage[i].quantity -= need.rate;
          if (loc.storage[i].quantity <= 0) loc.storage.splice(i, 1);
          break;
        }
      }
    }
  }

  // Food satisfaction drives happiness AND starvation
  const satisfaction = foodNeeded > 0 ? Math.min(1, foodConsumed / foodNeeded) : 1;
  loc.happiness = Math.max(0, Math.min(100,
    loc.happiness + (satisfaction > 0.8 ? 1 : satisfaction > 0.5 ? 0 : -3)
  ));

  // Track starvation: if satisfaction is very low, people leave or die
  if (satisfaction < 0.3 && popCount > 1) {
    // Remove 1 resident (they leave to find food)
    const leaverId = loc.residentIds.pop();
    if (leaverId) {
      const ch = world.characters.get(leaverId);
      if (ch) {
        ch.homeLocationId = null;
        ch.jobType = 'unemployed';
        ch.needs.food = 0;
      }
    }
    loc.prosperity = Math.max(0, loc.prosperity - 2);
  }

  // Update character food needs
  for (const charId of loc.residentIds) {
    const ch = world.characters.get(charId);
    if (ch) {
      ch.needs.food = Math.min(100, satisfaction * 80 + 10);
    }
  }
}

/** Apply spoilage to stored resources */
function tickSpoilage(loc: Location): void {
  for (let i = loc.storage.length - 1; i >= 0; i--) {
    const stack = loc.storage[i];
    stack.age++;
    const def = RESOURCE_DEFINITIONS[stack.resourceId];
    if (def && def.spoilRate > 0) {
      const spoiled = Math.ceil(stack.quantity * def.spoilRate);
      stack.quantity -= spoiled;
      if (stack.quantity <= 0) {
        loc.storage.splice(i, 1);
      }
    }
  }
}

/** Replenish nearby natural resource deposits */
function tickResourceReplenishment(loc: Location, world: World): void {
  const radius = 3;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = loc.position.x + dx;
      const ny = loc.position.y + dy;
      if (nx >= 0 && nx < world.width && ny >= 0 && ny < world.height) {
        const deposit = world.tiles[ny][nx].resourceDeposit;
        if (deposit && deposit.replenishRate > 0) {
          deposit.amount = Math.round(
            Math.min(deposit.maxAmount, deposit.amount + deposit.replenishRate) * 10
          ) / 10; // round to 1 decimal place
        }
      }
    }
  }
}

/**
 * Update market prices based on supply scarcity.
 * Prices follow a curve: abundant stock → cheap, scarce stock → expensive.
 *
 *   qty >= 20  → 0.5× base (surplus — very cheap)
 *   qty ~10    → 1.0× base (normal)
 *   qty ~5     → 2.0× base (getting scarce)
 *   qty ~2     → 4.0× base (rare — premium)
 *   qty  1     → 6.0× base (last unit — very expensive)
 */
function updateMarketPrices(loc: Location): void {
  // Track total quantity per resource
  const totals = new Map<string, number>();
  for (const stack of loc.storage) {
    totals.set(stack.resourceId, (totals.get(stack.resourceId) ?? 0) + stack.quantity);
  }

  for (const [resourceId, quantity] of totals) {
    const def = RESOURCE_DEFINITIONS[resourceId];
    if (!def) continue;

    const multiplier = getScarcityMultiplier(quantity);
    loc.marketPrices[resourceId] = Math.max(1, Math.round(def.baseValue * multiplier));
  }
}

/** Scarcity price curve — fewer goods = higher price */
function getScarcityMultiplier(quantity: number): number {
  if (quantity <= 0) return 10;
  if (quantity <= 1) return 6;
  if (quantity <= 3) return 4;
  if (quantity <= 5) return 2.5;
  if (quantity <= 10) return 1.5;
  if (quantity <= 20) return 1.0;
  if (quantity <= 40) return 0.75;
  return 0.5;
}

/** Tick location growth or decline */
function tickGrowth(loc: Location, world: World, rng: SeededRandom, logs: string[]): void {
  // Growth factors
  let growthDelta = 0;

  // Positive: food surplus, high prosperity, trade routes
  const foodTypes = ['bread', 'meat', 'fish', 'wheat', 'berries'];
  const foodStock = loc.storage
    .filter(s => foodTypes.includes(s.resourceId))
    .reduce((sum, s) => sum + s.quantity, 0);

  if (foodStock > loc.residentIds.length * 2) growthDelta += 2;
  if (loc.prosperity > 60) growthDelta += 1;
  if (loc.tradeRouteIds.length > 0) growthDelta += 1;
  if (loc.happiness > 70) growthDelta += 1;

  // Negative: low safety, no food, low happiness
  if (loc.safety < 30) growthDelta -= 2;
  if (foodStock < loc.residentIds.length) growthDelta -= 2;
  if (loc.happiness < 30) growthDelta -= 1;

  loc.growthPoints = Math.max(0, loc.growthPoints + growthDelta);

  // Prosperity tends toward equilibrium
  const targetProsperity = 30 + (foodStock > 0 ? 20 : 0) + (loc.safety > 50 ? 15 : 0) + (loc.happiness > 50 ? 15 : 0);
  loc.prosperity += Math.sign(targetProsperity - loc.prosperity) * 0.5;
  loc.prosperity = Math.max(0, Math.min(100, loc.prosperity));
}
