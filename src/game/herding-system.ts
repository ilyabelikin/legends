import type { World } from "../types/world";
import type { Character } from "../types/character";
import type { Creature } from "../types/creature";
import type { GameEvent } from "../types/event";
import { manhattanDist } from "../utils/math";
import { SeededRandom, generateId } from "../utils/random";
import { CREATURE_DEFINITIONS } from "../data/creature-data";
import { addToStorage } from "../economy/economy-engine";

/**
 * Herding system for shepherds who gather, protect, and raise sheep.
 */

/** Maximum sheep per shepherd */
const MAX_HERD_SIZE = 12;

/** Wool production interval (turns) */
const WOOL_PRODUCTION_INTERVAL = 5;

/** Breeding cooldown (turns) */
const BREEDING_COOLDOWN = 15;

/**
 * Shepherds gather nearby wild sheep into their herd.
 * Wild sheep within 8 tiles can be claimed if shepherd has capacity.
 */
export function tickShepherdGathering(
  world: World,
  rng: SeededRandom,
): GameEvent[] {
  const events: GameEvent[] = [];

  for (const char of world.characters.values()) {
    if (!char.isAlive || char.jobType !== "shepherd") continue;
    // Initialize herdedCreatureIds if missing (for backward compatibility)
    if (!char.herdedCreatureIds) char.herdedCreatureIds = [];
    if (char.herdedCreatureIds.length >= MAX_HERD_SIZE) continue;

    // Find nearby wild sheep
    for (const creature of world.creatures.values()) {
      if (creature.type !== "sheep") continue;
      if (creature.ownerId) continue; // already herded
      if (creature.health <= 0) continue;

      const dist = manhattanDist(char.position, creature.position);
      if (dist > 8) continue;

      // Claim this sheep
      creature.ownerId = char.id;
      char.herdedCreatureIds.push(creature.id);

      // Initialize herding data
      creature.lastWoolProduction = 0;
      creature.breedingCooldown = rng.nextInt(0, BREEDING_COOLDOWN);
      creature.behavior = "passive";
      creature.homePosition = { ...char.position };

      if (char.homeLocationId) {
        const loc = world.locations.get(char.homeLocationId);
        if (loc && !loc.isDestroyed) {
          events.push({
            id: generateId("evt"),
            type: "trade",
            turn: 0,
            title: `${char.name} gathered sheep at ${loc.name}`,
            description: `Shepherd ${char.name} added a sheep to their flock.`,
            locationId: loc.id,
            characterIds: [char.id],
            isResolved: false,
            effects: [],
            severity: "minor",
          });
        }
      }

      break; // Only gather one per turn
    }
  }

  return events;
}

/**
 * Herded sheep follow their shepherd and stay near them.
 */
export function tickHerdMovement(world: World): void {
  for (const char of world.characters.values()) {
    if (!char.isAlive || char.jobType !== "shepherd") continue;
    // Initialize herdedCreatureIds if missing (for backward compatibility)
    if (!char.herdedCreatureIds) char.herdedCreatureIds = [];
    if (char.herdedCreatureIds.length === 0) continue;

    for (const creatureId of char.herdedCreatureIds) {
      const sheep = world.creatures.get(creatureId);
      if (!sheep || sheep.health <= 0) continue;

      const dist = manhattanDist(sheep.position, char.position);

      // Sheep try to stay within 3 tiles of their shepherd
      if (dist > 3) {
        const dx = Math.sign(char.position.x - sheep.position.x);
        const dy = Math.sign(char.position.y - sheep.position.y);
        sheep.position.x += dx;
        sheep.position.y += dy;
      } else if (dist > 1 && Math.random() < 0.3) {
        // Occasionally move closer
        const dx = Math.sign(char.position.x - sheep.position.x);
        const dy = Math.sign(char.position.y - sheep.position.y);
        sheep.position.x += dx;
        sheep.position.y += dy;
      }

      sheep.homePosition = { ...char.position };
    }
  }
}

/**
 * Herded sheep produce wool periodically.
 * Wool is added to the shepherd's home settlement storage.
 */
export function tickWoolProduction(world: World, turn: number): GameEvent[] {
  const events: GameEvent[] = [];

  for (const char of world.characters.values()) {
    if (!char.isAlive || char.jobType !== "shepherd") continue;
    if (!char.homeLocationId) continue;
    // Initialize herdedCreatureIds if missing (for backward compatibility)
    if (!char.herdedCreatureIds) char.herdedCreatureIds = [];
    if (char.herdedCreatureIds.length === 0) continue;

    const loc = world.locations.get(char.homeLocationId);
    if (!loc || loc.isDestroyed) continue;

    let woolProduced = 0;

    for (const creatureId of char.herdedCreatureIds) {
      const sheep = world.creatures.get(creatureId);
      if (!sheep || sheep.health <= 0) continue;

      const lastProduction = sheep.lastWoolProduction ?? 0;
      if (turn - lastProduction >= WOOL_PRODUCTION_INTERVAL) {
        // Produce wool
        const woolAmount = 1 + Math.random() * 0.5;
        addToStorage(loc, "wool", woolAmount, 0.7);
        sheep.lastWoolProduction = turn;
        woolProduced += woolAmount;
      }
    }

    if (woolProduced > 0) {
      events.push({
        id: generateId("evt"),
        type: "trade",
        turn,
        title: `Wool produced at ${loc.name}`,
        description: `${char.name}'s flock produced ${woolProduced.toFixed(1)} wool.`,
        locationId: loc.id,
        characterIds: [char.id],
        isResolved: false,
        effects: [],
        severity: "minor",
      });
    }
  }

  return events;
}

/**
 * Herded sheep breed and multiply over time.
 * Requires at least 2 sheep, and sheep must be off breeding cooldown.
 */
export function tickSheepBreeding(
  world: World,
  turn: number,
  rng: SeededRandom,
): GameEvent[] {
  const events: GameEvent[] = [];

  for (const char of world.characters.values()) {
    if (!char.isAlive || char.jobType !== "shepherd") continue;
    // Initialize herdedCreatureIds if missing (for backward compatibility)
    if (!char.herdedCreatureIds) char.herdedCreatureIds = [];
    if (char.herdedCreatureIds.length < 2) continue;
    if (char.herdedCreatureIds.length >= MAX_HERD_SIZE) continue;

    // Find two sheep ready to breed
    const breedableSheep: Creature[] = [];
    for (const creatureId of char.herdedCreatureIds) {
      const sheep = world.creatures.get(creatureId);
      if (!sheep || sheep.health <= 0) continue;

      const cooldown = sheep.breedingCooldown ?? 0;
      if (cooldown <= 0) {
        breedableSheep.push(sheep);
        if (breedableSheep.length >= 2) break;
      }
    }

    if (breedableSheep.length >= 2) {
      // Breeding chance 20% per turn when conditions are met
      if (rng.chance(0.2)) {
        // Create a new lamb
        const def = CREATURE_DEFINITIONS["sheep"];
        const lambId = generateId("creature");

        const lamb: Creature = {
          id: lambId,
          type: "sheep",
          name: null,
          position: { ...char.position },
          health: def.baseHealth * 0.5, // lambs start smaller
          maxHealth: def.baseHealth,
          attack: def.baseAttack,
          defense: def.baseDefense,
          speed: def.baseSpeed,
          behavior: "passive",
          homePosition: { ...char.position },
          wanderRadius: 3,
          isHostile: false,
          loot: [
            { resourceId: "wool", quantity: 0.5, quality: 0.5, age: 0 },
            { resourceId: "meat", quantity: 0.5, quality: 0.5, age: 0 },
          ],
          age: 0,
          lastActionTurn: turn,
          countryId: null,
          targetLocationId: null,
          homeLocationId: char.homeLocationId,
          ownerId: char.id,
          lastWoolProduction: turn,
          breedingCooldown: BREEDING_COOLDOWN,
        };

        world.creatures.set(lambId, lamb);
        char.herdedCreatureIds.push(lambId);

        // Set breeding cooldowns on parents
        breedableSheep[0].breedingCooldown = BREEDING_COOLDOWN;
        breedableSheep[1].breedingCooldown = BREEDING_COOLDOWN;

        if (char.homeLocationId) {
          const loc = world.locations.get(char.homeLocationId);
          if (loc && !loc.isDestroyed) {
            events.push({
              id: generateId("evt"),
              type: "trade",
              turn,
              title: `Lamb born at ${loc.name}`,
              description: `${char.name}'s flock grew by one!`,
              locationId: loc.id,
              characterIds: [char.id],
              isResolved: false,
              effects: [],
              severity: "minor",
            });
          }
        }
      }
    }

    // Decrement breeding cooldowns
    for (const creatureId of char.herdedCreatureIds) {
      const sheep = world.creatures.get(creatureId);
      if (
        sheep &&
        sheep.breedingCooldown !== undefined &&
        sheep.breedingCooldown > 0
      ) {
        sheep.breedingCooldown--;
      }
    }
  }

  return events;
}

/**
 * Remove dead sheep from herds and clean up orphaned sheep.
 */
export function tickHerdCleanup(world: World): void {
  for (const char of world.characters.values()) {
    // Initialize herdedCreatureIds if missing (for backward compatibility)
    if (!char.herdedCreatureIds) char.herdedCreatureIds = [];
    if (char.herdedCreatureIds.length === 0) continue;

    // Remove dead sheep from herd
    char.herdedCreatureIds = char.herdedCreatureIds.filter((id) => {
      const sheep = world.creatures.get(id);
      return sheep && sheep.health > 0;
    });
  }

  // Release sheep whose shepherd died
  for (const creature of world.creatures.values()) {
    if (creature.ownerId) {
      const owner = world.characters.get(creature.ownerId);
      if (!owner || !owner.isAlive) {
        creature.ownerId = null;
        creature.behavior = "passive";
      }
    }
  }
}
