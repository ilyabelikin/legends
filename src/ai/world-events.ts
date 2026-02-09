import type { World } from "../types/world";
import type { GameEvent, EventType, EventSeverity } from "../types/event";
import type { Season } from "../types/season";
import type { Location } from "../types/location";
import type { Character } from "../types/character";
import { SeededRandom, generateId } from "../utils/random";
import { euclideanDist, manhattanDist } from "../utils/math";

/**
 * Generate world events for the current turn.
 * Emergent situations arise from world state, not random rolls alone.
 */
export function generateWorldEvents(
  world: World,
  turn: number,
  season: Season,
  rng: SeededRandom,
): GameEvent[] {
  const events: GameEvent[] = [];

  // === DRAGON ATTACKS ===
  for (const creature of world.creatures.values()) {
    if (creature.type !== "dragon") continue;
    if (!rng.chance(0.03)) continue;

    // Find nearest settlement
    let nearest: Location | null = null;
    let nearestDist = Infinity;
    for (const loc of world.locations.values()) {
      if (loc.isDestroyed) continue;
      const dist = manhattanDist(creature.position, loc.position);
      if (dist < nearestDist && dist < 10) {
        nearestDist = dist;
        nearest = loc;
      }
    }

    if (nearest) {
      events.push(
        createEvent(
          "dragon_attack",
          turn,
          `${creature.name ?? "A dragon"} attacks ${nearest.name}!`,
          `The fearsome ${creature.name ?? "dragon"} descends upon ${nearest.name}, breathing fire and destruction.`,
          nearest.id,
          [],
          "major",
        ),
      );

      // Set on fire — burns for 3 turns, dealing ongoing durability damage
      nearest.burningTurns = Math.max(nearest.burningTurns, 3);
      nearest.durability = Math.max(0, nearest.durability - rng.nextInt(8, 15));
      nearest.defenseLevel = Math.max(0, nearest.defenseLevel - 2);
      nearest.safety = Math.max(0, nearest.safety - 30);
      nearest.happiness = Math.max(0, nearest.happiness - 20);
      nearest.prosperity = Math.max(0, nearest.prosperity - 15);

      // Damage buildings from initial strike
      for (const building of nearest.buildings) {
        if (rng.chance(0.3)) {
          building.condition = Math.max(
            0,
            building.condition - rng.nextInt(20, 50),
          );
          if (building.condition <= 0) building.isOperational = false;
        }
      }

      // Dragon is satisfied — return to lair for a while
      creature.attackCooldown = rng.nextInt(20, 40);
    }
  }

  // === BANDIT RAIDS ===
  for (const creature of world.creatures.values()) {
    if (creature.type !== "bandit") continue;
    if (!rng.chance(0.05)) continue;

    // Find nearest small settlement
    for (const loc of world.locations.values()) {
      if (loc.isDestroyed) continue;
      const dist = manhattanDist(creature.position, loc.position);
      if (dist < 5 && loc.defenseLevel < 3 && loc.garrisonIds.length < 3) {
        events.push(
          createEvent(
            "bandit_attack",
            turn,
            `Bandits raid ${loc.name}!`,
            `A group of bandits attacks the poorly defended ${loc.name}, stealing goods and terrorizing residents.`,
            loc.id,
            [],
            "moderate",
          ),
        );

        // Steal resources and damage durability
        const stolen = Math.min(loc.storage.length, rng.nextInt(1, 3));
        for (let i = 0; i < stolen && loc.storage.length > 0; i++) {
          const idx = rng.nextInt(0, loc.storage.length - 1);
          loc.storage.splice(idx, 1);
        }
        loc.durability = Math.max(0, loc.durability - rng.nextInt(3, 8));
        loc.safety = Math.max(0, loc.safety - 15);
        break;
      }
    }
  }

  // === WAR DECLARATIONS ===
  if (rng.chance(0.015)) {
    const countries = Array.from(world.countries.values());
    for (const relation of world.diplomacy) {
      if (relation.type === "rivalry" && relation.strength < -40) {
        if (rng.chance(0.2)) {
          const countryA = world.countries.get(relation.countryAId);
          const countryB = world.countries.get(relation.countryBId);
          if (countryA && countryB) {
            relation.type = "war";
            countryA.enemies.push(countryB.id);
            countryB.enemies.push(countryA.id);

            events.push(
              createEvent(
                "war_declared",
                turn,
                `${countryA.name} declares war on ${countryB.name}!`,
                `Tensions between ${countryA.name} and ${countryB.name} have erupted into open war. Border settlements prepare for conflict.`,
                null,
                [countryA.leaderId, countryB.leaderId],
                "catastrophic",
              ),
            );
          }
        }
      }
    }
  }

  // === PEACE TREATIES ===
  for (const relation of world.diplomacy) {
    if (relation.type === "war" && turn - relation.startedTurn > 50) {
      if (rng.chance(0.02)) {
        relation.type = "truce";
        relation.strength = 0;
        const countryA = world.countries.get(relation.countryAId);
        const countryB = world.countries.get(relation.countryBId);
        if (countryA && countryB) {
          countryA.enemies = countryA.enemies.filter(
            (id) => id !== countryB.id,
          );
          countryB.enemies = countryB.enemies.filter(
            (id) => id !== countryA.id,
          );

          events.push(
            createEvent(
              "peace_treaty",
              turn,
              `${countryA.name} and ${countryB.name} sign a peace treaty`,
              `After long conflict, ${countryA.name} and ${countryB.name} agree to a truce.`,
              null,
              [countryA.leaderId, countryB.leaderId],
              "major",
            ),
          );
        }
      }
    }
  }

  // === SEASONAL EVENTS ===
  if (season === "autumn" && rng.chance(0.02)) {
    // Bountiful harvest
    const farmLocs = Array.from(world.locations.values()).filter(
      (l) =>
        !l.isDestroyed &&
        (l.type === "farm" || l.type === "village" || l.type === "hamlet"),
    );
    if (farmLocs.length > 0) {
      const loc = rng.pick(farmLocs);
      events.push(
        createEvent(
          "bountiful_harvest",
          turn,
          `Bountiful harvest in ${loc.name}!`,
          `The farmers of ${loc.name} celebrate an exceptional harvest this season.`,
          loc.id,
          [],
          "minor",
        ),
      );
      loc.prosperity = Math.min(100, loc.prosperity + 10);
      loc.happiness = Math.min(100, loc.happiness + 10);
    }
  }

  if (season === "winter" && rng.chance(0.01)) {
    // Famine
    const vulnLocs = Array.from(world.locations.values()).filter(
      (l) =>
        !l.isDestroyed &&
        l.residentIds.length > 5 &&
        l.storage
          .filter((s) =>
            ["wheat", "bread", "meat", "fish"].includes(s.resourceId),
          )
          .reduce((sum, s) => sum + s.quantity, 0) < l.residentIds.length,
    );
    if (vulnLocs.length > 0) {
      const loc = rng.pick(vulnLocs);
      events.push(
        createEvent(
          "famine",
          turn,
          `Famine strikes ${loc.name}!`,
          `Food stores run dangerously low in ${loc.name}. The people cry out for relief.`,
          loc.id,
          [],
          "major",
        ),
      );
      loc.happiness = Math.max(0, loc.happiness - 20);
      loc.prosperity = Math.max(0, loc.prosperity - 10);
    }
  }

  // === PLAGUE (rare) ===
  if (rng.chance(0.002)) {
    const denseLocs = Array.from(world.locations.values()).filter(
      (l) => !l.isDestroyed && l.residentIds.length > 15,
    );
    if (denseLocs.length > 0) {
      const loc = rng.pick(denseLocs);
      events.push(
        createEvent(
          "plague",
          turn,
          `Plague breaks out in ${loc.name}!`,
          `A terrible sickness spreads through ${loc.name}. Many fall ill.`,
          loc.id,
          [],
          "catastrophic",
        ),
      );
      // Kill some residents
      const deaths = Math.floor(
        loc.residentIds.length * rng.nextFloat(0.1, 0.3),
      );
      for (let i = 0; i < deaths && loc.residentIds.length > 2; i++) {
        const charId = loc.residentIds.pop()!;
        const ch = world.characters.get(charId);
        if (ch) ch.isAlive = false;
      }
      loc.happiness = Math.max(0, loc.happiness - 30);
    }
  }

  // === BIRTHS ===
  for (const loc of world.locations.values()) {
    if (loc.isDestroyed) continue;
    if (loc.residentIds.length >= loc.populationCapacity) continue;

    // Find married couples
    for (const charId of loc.residentIds) {
      const ch = world.characters.get(charId);
      if (!ch || !ch.isAlive || ch.age < 18 || ch.age > 45) continue;
      const spouse = ch.relationships.find((r) => r.type === "spouse");
      if (!spouse) continue;
      const spouseChar = world.characters.get(spouse.targetId);
      if (!spouseChar || !spouseChar.isAlive) continue;

      if (rng.chance(0.003)) {
        events.push(
          createEvent(
            "birth",
            turn,
            `A child is born in ${loc.name}`,
            `${ch.name} and ${spouseChar.name} welcome a new child.`,
            loc.id,
            [ch.id, spouseChar.id],
            "minor",
          ),
        );
        break; // max 1 birth per location per turn
      }
    }
  }

  // === MONSTER MIGRATION (seasonal) ===
  if ((season === "autumn" || season === "spring") && rng.chance(0.01)) {
    events.push(
      createEvent(
        "monster_migration",
        turn,
        "Creatures are migrating!",
        `Packs of wild beasts are on the move as the seasons change. Travelers beware!`,
        null,
        [],
        "moderate",
      ),
    );
  }

  return events;
}

/** Helper to create an event */
function createEvent(
  type: EventType,
  turn: number,
  title: string,
  description: string,
  locationId: string | null,
  characterIds: string[],
  severity: EventSeverity,
): GameEvent {
  return {
    id: generateId("evt"),
    type,
    turn,
    title,
    description,
    locationId,
    characterIds,
    isResolved: false,
    effects: [],
    severity,
  };
}
