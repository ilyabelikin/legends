import type { Tile } from '../types/terrain';
import type { Creature, CreatureType } from '../types/creature';
import { CREATURE_DEFINITIONS } from '../data/creature-data';
import { generateDragonName } from '../data/name-data';
import { SeededRandom, generateId } from '../utils/random';
import { isWater } from './terrain-generator';

/** Maximum creatures to spawn */
const MAX_CREATURE_GROUPS = 60;

/** Minimum distance between creature groups */
const MIN_CREATURE_DISTANCE = 5;

/**
 * Spawn creatures throughout the world based on biome suitability.
 */
export function spawnCreatures(
  tiles: Tile[][],
  width: number,
  height: number,
  rng: SeededRandom,
): Map<string, Creature> {
  const creatures = new Map<string, Creature>();
  const spawnPoints: { x: number; y: number }[] = [];

  // Collect valid spawn points by biome
  const biomeCreatureMap: Record<string, CreatureType[]> = {};
  for (const [type, def] of Object.entries(CREATURE_DEFINITIONS)) {
    for (const biome of def.preferredBiomes) {
      if (!biomeCreatureMap[biome]) biomeCreatureMap[biome] = [];
      biomeCreatureMap[biome].push(type as CreatureType);
    }
  }

  let attempts = 0;
  const maxAttempts = MAX_CREATURE_GROUPS * 10;

  while (spawnPoints.length < MAX_CREATURE_GROUPS && attempts < maxAttempts) {
    attempts++;
    const x = rng.nextInt(0, width - 1);
    const y = rng.nextInt(0, height - 1);
    const tile = tiles[y][x];

    // Can't spawn in water or on settlements
    if (isWater(tile.terrainType)) continue;
    if (tile.locationId) continue;

    // Check distance from other spawn points
    const tooClose = spawnPoints.some(sp =>
      Math.abs(sp.x - x) + Math.abs(sp.y - y) < MIN_CREATURE_DISTANCE
    );
    if (tooClose) continue;

    // What creatures can spawn here?
    const eligible = biomeCreatureMap[tile.biome] || [];
    if (eligible.length === 0) continue;

    // Pick a creature type
    const creatureType = rng.pick(eligible);
    const def = CREATURE_DEFINITIONS[creatureType];

    // Don't spawn too many dragons
    if (creatureType === 'dragon') {
      const dragonCount = Array.from(creatures.values()).filter(c => c.type === 'dragon').length;
      if (dragonCount >= 3) continue;
      if (!rng.chance(0.15)) continue;
    }

    // Don't spawn too many bandits
    if (creatureType === 'bandit') {
      const banditCount = Array.from(creatures.values()).filter(c => c.type === 'bandit').length;
      if (banditCount >= 8) continue;
      if (!rng.chance(0.3)) continue;
    }

    // Spawn a group
    const packSize = rng.nextInt(def.packSize[0], def.packSize[1]);
    const groupId = generateId('creature');

    // Create the main creature (represents the group)
    const creature: Creature = {
      id: groupId,
      type: creatureType,
      name: creatureType === 'dragon' ? generateDragonName(rng) : null,
      position: { x, y },
      health: def.baseHealth * packSize * (0.8 + rng.next() * 0.4),
      maxHealth: def.baseHealth * packSize,
      attack: def.baseAttack * Math.sqrt(packSize),
      defense: def.baseDefense * Math.sqrt(packSize),
      speed: def.baseSpeed,
      behavior: def.defaultBehavior,
      homePosition: { x, y },
      wanderRadius: def.wanderRadius,
      isHostile: def.hostile,
      loot: [],
      age: 0,
      lastActionTurn: 0,
    };

    // Generate loot
    for (const lootEntry of def.lootTable) {
      if (rng.chance(lootEntry.chance)) {
        creature.loot.push({
          resourceId: lootEntry.resourceId,
          quantity: rng.nextInt(lootEntry.quantity[0], lootEntry.quantity[1]) * packSize,
          quality: 0.5 + rng.next() * 0.5,
          age: 0,
        });
      }
    }

    creatures.set(groupId, creature);
    spawnPoints.push({ x, y });
  }

  // Guarantee at least 2 dragons exist — find mountain tiles and place them
  const dragonCount = Array.from(creatures.values()).filter(c => c.type === 'dragon').length;
  const dragonsNeeded = Math.max(0, 2 - dragonCount);
  if (dragonsNeeded > 0) {
    const dragonDef = CREATURE_DEFINITIONS['dragon'];
    let placed = 0;
    for (let attempt = 0; attempt < 500 && placed < dragonsNeeded; attempt++) {
      const x = rng.nextInt(0, width - 1);
      const y = rng.nextInt(0, height - 1);
      const tile = tiles[y][x];
      if (isWater(tile.terrainType)) continue;
      if (tile.locationId) continue;
      if (tile.biome !== 'mountain' && tile.biome !== 'snow_mountain' && tile.biome !== 'hills') continue;

      const id = generateId('creature');
      const dragon: Creature = {
        id,
        type: 'dragon',
        name: generateDragonName(rng),
        position: { x, y },
        health: dragonDef.baseHealth * (0.9 + rng.next() * 0.3),
        maxHealth: dragonDef.baseHealth,
        attack: dragonDef.baseAttack,
        defense: dragonDef.baseDefense,
        speed: dragonDef.baseSpeed,
        behavior: 'territorial',
        homePosition: { x, y },
        wanderRadius: 20,
        isHostile: true,
        loot: [
          { resourceId: 'gold_ore', quantity: rng.nextInt(10, 30), quality: 0.8, age: 0 },
        ],
        age: 0,
        lastActionTurn: 0,
      };
      creatures.set(id, dragon);
      spawnPoints.push({ x, y });
      placed++;
    }
  }

  return creatures;
}
