import type { GameState, EventLogEntry } from "../types/game";
import type { World } from "../types/world";
import type { Location } from "../types/location";
import type { Creature } from "../types/creature";
import type { Character } from "../types/character";
import type { Country } from "../types/political";
import type { GameEvent } from "../types/event";
import { CREATURE_DEFINITIONS } from "../data/creature-data";
import { SeededRandom, generateId } from "../utils/random";
import { manhattanDist, inBounds } from "../utils/math";
import { isWater } from "../world/terrain-generator";
import { generateCountryName } from "../data/name-data";
import { addToStorage } from "../economy/economy-engine";
import { createCharacter } from "../entities/character-factory";

// ── Location Durability & Destruction ───────────────────

/**
 * Check all locations for destruction (durability <= 0).
 * Returns generated events.
 */
export function checkDestruction(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  const { world } = state;

  for (const loc of world.locations.values()) {
    if (loc.isDestroyed) continue;
    if (loc.durability > 0) continue;

    // Destroy the settlement
    loc.isDestroyed = true;
    loc.originalType = loc.type;
    loc.type = "ruins";

    // Scatter residents
    for (const charId of loc.residentIds) {
      const ch = world.characters.get(charId);
      if (ch) {
        ch.homeLocationId = null;
        ch.jobType = "unemployed";
      }
    }
    loc.residentIds = [];
    loc.garrisonIds = [];

    events.push({
      id: generateId("evt"),
      type: "settlement_destroyed",
      turn: state.turn,
      title: `${loc.name} has been destroyed!`,
      description: `The settlement of ${loc.name} lies in ruins. Its people have scattered.`,
      locationId: loc.id,
      characterIds: [],
      isResolved: false,
      effects: [],
      severity: "major",
    });
  }

  return events;
}

/**
 * Tick burning status and regenerate durability.
 * Burning locations lose durability each turn until the fire goes out.
 * Non-burning locations slowly regenerate if they have workers and materials.
 */
export function tickBurningAndRegen(world: World): void {
  for (const loc of world.locations.values()) {
    if (loc.isDestroyed) continue;

    // === Burning: ongoing fire damage ===
    if (loc.burningTurns > 0) {
      loc.burningTurns--;
      loc.durability = Math.max(0, loc.durability - 5);
      loc.happiness = Math.max(0, loc.happiness - 5);

      // Fire damages random buildings
      for (const building of loc.buildings) {
        if (Math.random() < 0.15) {
          building.condition = Math.max(0, building.condition - 10);
          if (building.condition <= 0) building.isOperational = false;
        }
      }
      continue; // no regen while burning
    }

    // === Regen (only when not burning) ===
    if (loc.durability >= 100) continue;

    const hasWorkers = loc.residentIds.length >= 2;
    const hasWood = loc.storage.some(
      (s) => s.resourceId === "wood" && s.quantity > 0,
    );
    const hasStone = loc.storage.some(
      (s) => s.resourceId === "stone" && s.quantity > 0,
    );

    let regen = 0;
    if (hasWorkers) regen += 0.3;
    if (hasWood) regen += 0.2;
    if (hasStone) regen += 0.2;
    if (loc.wallLevel > 0) regen += 0.1 * loc.wallLevel;

    loc.durability = Math.min(100, loc.durability + regen);
  }
}

// ── Builder Spawning ────────────────────────────────────

/**
 * Spawn builders from major cities to rebuild ruins.
 * Builders travel to nearby destroyed settlements and restore them.
 */
export function spawnBuilders(world: World, rng: SeededRandom): void {
  // Find ruins that need rebuilding
  const ruins = Array.from(world.locations.values()).filter(
    (l) => l.isDestroyed && l.type === "ruins",
  );
  if (ruins.length === 0) return;

  // Find major cities that can send builders
  const majorCities = Array.from(world.locations.values()).filter(
    (l) =>
      !l.isDestroyed &&
      (l.type === "city" || l.type === "town") &&
      l.residentIds.length >= 10,
  );

  for (const ruin of ruins) {
    // Check if a builder is already assigned to this ruin
    const hasBuilder = Array.from(world.creatures.values()).some(
      (c) => c.type === "builder" && c.targetLocationId === ruin.id,
    );
    if (hasBuilder) continue;

    // Find nearest major city
    let nearestCity: Location | null = null;
    let nearestDist = Infinity;
    for (const city of majorCities) {
      const dist = manhattanDist(city.position, ruin.position);
      if (dist < nearestDist && dist < 40) {
        nearestDist = dist;
        nearestCity = city;
      }
    }

    if (nearestCity && rng.chance(0.15)) {
      // Spawn a builder team
      const def = CREATURE_DEFINITIONS["builder"];
      const id = generateId("creature");
      const builder: Creature = {
        id,
        type: "builder",
        name: `${nearestCity.name} Builders`,
        position: { ...nearestCity.position },
        health: def.baseHealth,
        maxHealth: def.baseHealth,
        attack: def.baseAttack,
        defense: def.baseDefense,
        speed: def.baseSpeed,
        behavior: "patrolling",
        homePosition: { ...nearestCity.position },
        homeLocationId: nearestCity.id,
        targetLocationId: ruin.id,
        wanderRadius: def.wanderRadius,
        isHostile: false,
        loot: [],
        age: 0,
        lastActionTurn: 0,
        countryId: nearestCity.countryId,
      };
      world.creatures.set(id, builder);
    }
  }
}

// ── Hunter Spawning ─────────────────────────────────────

/** Maximum hunters per settlement */
const MAX_HUNTERS_PER_SETTLEMENT = 2;

/** Chance for hunter to spawn each check (15% instead of 100%) */
const HUNTER_SPAWN_CHANCE = 0.15;

/**
 * Send hunters from settlements with hunter_lodge on duty.
 * Hunters are actual Characters from the population who go hunting.
 */
export function spawnHunters(world: World, rng: SeededRandom): void {
  for (const loc of world.locations.values()) {
    if (loc.isDestroyed) continue;

    const hasHunterLodge = loc.buildings.some(
      (b) => b.type === "hunter_lodge" && b.isOperational,
    );
    if (!hasHunterLodge) continue;

    // Count existing hunters on duty for this settlement
    let hunterCount = 0;
    for (const charId of loc.residentIds) {
      const char = world.characters.get(charId);
      if (char && char.jobType === "hunter" && char.onDuty && char.isAlive) {
        hunterCount++;
      }
    }

    if (hunterCount >= MAX_HUNTERS_PER_SETTLEMENT) continue;

    // Only send hunters with a certain chance (makes hunters rarer)
    if (!rng.chance(HUNTER_SPAWN_CHANCE)) continue;

    // Find an available hunter Character or create one
    let hunter: Character | null = null;

    // First, try to find an existing hunter who's not on duty
    for (const charId of loc.residentIds) {
      const char = world.characters.get(charId);
      if (
        char &&
        char.jobType === "hunter" &&
        !char.onDuty &&
        char.isAlive &&
        char.age >= 16
      ) {
        hunter = char;
        break;
      }
    }

    // If no hunter available, try to recruit an unemployed person or create a new hunter
    if (!hunter) {
      // Check if we can recruit someone or if we need to add to population
      if (loc.residentIds.length < loc.populationCapacity) {
        // Create a new hunter Character and add to population
        hunter = createCharacter(rng, loc.position, loc.id, "hunter");
        world.characters.set(hunter.id, hunter);
        loc.residentIds.push(hunter.id);
      }
    }

    if (!hunter) continue;

    // Send the hunter on duty
    const def = CREATURE_DEFINITIONS["hunter"];
    hunter.onDuty = true;
    hunter.dutyWanderRadius = def.wanderRadius;
    hunter.turnsOnDuty = 0;
    hunter.currentAction = { type: "working", buildingType: "hunter_lodge" };
  }
}

// ── Hunter Despawning ───────────────────────────────────

/** Turns without prey before hunter returns home */
const HUNTER_IDLE_RETURN_TURNS = 20;

/**
 * Return hunters to their homes if they haven't found prey for too long.
 * They go back to being regular settlement residents.
 */
export function despawnIdleHunters(world: World): void {
  for (const char of world.characters.values()) {
    if (char.jobType !== "hunter" || !char.onDuty) continue;
    if (!char.isAlive) continue;

    // Check if hunter has been idle too long without finding prey
    if (char.turnsOnDuty >= HUNTER_IDLE_RETURN_TURNS) {
      // Check recent success - if turnsOnDuty is high and they're far from home, call them back
      const homeLoc = char.homeLocationId
        ? world.locations.get(char.homeLocationId)
        : null;
      if (homeLoc) {
        const distFromHome = manhattanDist(char.position, homeLoc.position);
        // If they've been out for 20+ turns, return home
        if (distFromHome < 3) {
          // Close to home - end duty
          char.onDuty = false;
          char.turnsOnDuty = 0;
          char.position = { ...homeLoc.position };
          char.currentAction = { type: "idle" };
        }
      }
    }
  }
}

// ── Guard Spawning ──────────────────────────────────────

/** Maximum guards per settlement */
const MAX_GUARDS_PER_SETTLEMENT = 2;

/**
 * Send guards from settlements with barracks/walls on patrol.
 * Guards are actual Characters from the population who patrol the area.
 */
export function spawnGuards(world: World, rng: SeededRandom): void {
  for (const loc of world.locations.values()) {
    if (loc.isDestroyed) continue;

    const hasBarracks = loc.buildings.some(
      (b) => b.type === "barracks" && b.isOperational,
    );
    const hasWalls = loc.buildings.some(
      (b) => b.type === "wall" && b.isOperational,
    );
    if (!hasBarracks && !hasWalls) continue;

    // Count existing guards on patrol for this settlement
    let guardCount = 0;
    for (const charId of loc.residentIds) {
      const char = world.characters.get(charId);
      if (char && char.jobType === "guard" && char.onDuty && char.isAlive) {
        guardCount++;
      }
    }

    // Also count guards in garrison
    for (const charId of loc.garrisonIds) {
      const char = world.characters.get(charId);
      if (char && char.jobType === "guard" && char.onDuty && char.isAlive) {
        guardCount++;
      }
    }

    const maxGuards = hasBarracks ? MAX_GUARDS_PER_SETTLEMENT : 1;
    if (guardCount >= maxGuards) continue;

    // Find an available guard Character or create one
    let guard: Character | null = null;

    // First, try to find an existing guard who's not on duty
    for (const charId of [...loc.residentIds, ...loc.garrisonIds]) {
      const char = world.characters.get(charId);
      if (
        char &&
        char.jobType === "guard" &&
        !char.onDuty &&
        char.isAlive &&
        char.age >= 18
      ) {
        guard = char;
        break;
      }
    }

    // If no guard available, try to recruit a soldier or create a new guard
    if (!guard) {
      for (const charId of [...loc.residentIds, ...loc.garrisonIds]) {
        const char = world.characters.get(charId);
        if (
          char &&
          char.jobType === "soldier" &&
          !char.onDuty &&
          char.isAlive &&
          char.age >= 18
        ) {
          guard = char;
          break;
        }
      }
    }

    // If still no guard, create a new one if there's room
    if (!guard) {
      if (
        loc.residentIds.length + loc.garrisonIds.length <
        loc.populationCapacity
      ) {
        guard = createCharacter(rng, loc.position, loc.id, "guard");
        world.characters.set(guard.id, guard);
        loc.garrisonIds.push(guard.id); // Guards go in garrison, not residents
      }
    }

    if (!guard) continue;

    // Send the guard on patrol
    const def = CREATURE_DEFINITIONS["guard"];
    guard.onDuty = true;
    guard.dutyWanderRadius = def.wanderRadius;
    guard.turnsOnDuty = 0;
    guard.currentAction = { type: "working", buildingType: "barracks" };
  }
}

// ── Army Spawning (War) ─────────────────────────────────

/** Max armies per country */
const MAX_ARMIES_PER_COUNTRY = 2;

/**
 * Spawn armies for countries at war.
 * Armies form at the capital and march toward enemy settlements.
 */
export function spawnArmies(state: GameState, rng: SeededRandom): GameEvent[] {
  const events: GameEvent[] = [];
  const { world } = state;

  for (const relation of world.diplomacy) {
    if (relation.type !== "war") continue;

    const countryA = world.countries.get(relation.countryAId);
    const countryB = world.countries.get(relation.countryBId);
    if (!countryA || !countryB) continue;

    // Each side may spawn an army
    for (const [country, enemy] of [
      [countryA, countryB],
      [countryB, countryA],
    ] as [Country, Country][]) {
      // Count existing armies for this country
      let armyCount = 0;
      for (const c of world.creatures.values()) {
        if (c.type === "army" && c.countryId === country.id && c.health > 0) {
          armyCount++;
        }
      }
      if (armyCount >= MAX_ARMIES_PER_COUNTRY) continue;
      if (!rng.chance(0.08)) continue; // 8% chance per turn to muster an army

      const capital = world.locations.get(country.capitalLocationId);
      if (!capital || capital.isDestroyed) continue;

      // Find nearest enemy settlement to target
      let targetLoc: Location | null = null;
      let targetDist = Infinity;
      for (const locId of enemy.locationIds) {
        const loc = world.locations.get(locId);
        if (!loc || loc.isDestroyed) continue;
        const dist = manhattanDist(capital.position, loc.position);
        if (dist < targetDist) {
          targetDist = dist;
          targetLoc = loc;
        }
      }

      if (!targetLoc) continue;

      const def = CREATURE_DEFINITIONS["army"];
      const packSize = rng.nextInt(def.packSize[0], def.packSize[1]);
      const id = generateId("creature");

      const army: Creature = {
        id,
        type: "army",
        name: `${country.name} Army`,
        position: { ...capital.position },
        health: def.baseHealth * Math.sqrt(packSize),
        maxHealth: def.baseHealth * Math.sqrt(packSize),
        attack: def.baseAttack * Math.sqrt(packSize),
        defense: def.baseDefense * Math.sqrt(packSize),
        speed: def.baseSpeed,
        behavior: "marching",
        homePosition: { ...capital.position },
        wanderRadius: 60,
        isHostile: false, // not hostile to player
        loot: [],
        age: 0,
        lastActionTurn: 0,
        countryId: country.id,
        targetLocationId: targetLoc.id,
        homeLocationId: capital.id,
      };

      world.creatures.set(id, army);

      events.push({
        id: generateId("evt"),
        type: "war_declared",
        turn: state.turn,
        title: `${country.name} musters an army at ${capital.name}!`,
        description: `An army marches from ${capital.name} toward ${targetLoc.name}.`,
        locationId: capital.id,
        characterIds: [],
        isResolved: false,
        effects: [],
        severity: "major",
      });
    }
  }

  return events;
}

// ── Creature vs Creature Combat ─────────────────────────

/**
 * Check for combat between opposing creatures on the same tile.
 * Guards fight bandits. Armies fight enemy armies and attack settlements.
 */
export function creatureCombatTick(
  state: GameState,
  rng: SeededRandom,
): GameEvent[] {
  const events: GameEvent[] = [];
  const { world } = state;

  const creaturesArray = Array.from(world.creatures.values()).filter(
    (c) => c.health > 0,
  );

  // Group by tile
  const byTile = new Map<string, Creature[]>();
  for (const c of creaturesArray) {
    const key = `${c.position.x},${c.position.y}`;
    if (!byTile.has(key)) byTile.set(key, []);
    byTile.get(key)!.push(c);
  }

  for (const [, group] of byTile) {
    if (group.length < 2) continue;

    // Guards vs hostile creatures (bandits, dragons, enemy armies)
    const guards = group.filter((c) => c.type === "guard" && c.health > 0);
    const threats = group.filter(
      (c) =>
        c.health > 0 &&
        (c.type === "bandit" ||
          c.type === "dragon" ||
          (c.type === "army" &&
            guards.length > 0 &&
            c.countryId !== guards[0].countryId)),
    );

    for (const guard of guards) {
      for (const threat of threats) {
        if (guard.health <= 0 || threat.health <= 0) continue;
        const result = creatureFight(guard, threat, rng);
        if (result) events.push(result);
      }
    }

    // Dragon vs dragon — territorial fights when two dragons meet
    const dragons = group.filter((c) => c.type === "dragon" && c.health > 0);
    for (let i = 0; i < dragons.length; i++) {
      for (let j = i + 1; j < dragons.length; j++) {
        if (dragons[i].health <= 0 || dragons[j].health <= 0) continue;
        const result = creatureFight(dragons[i], dragons[j], rng);
        if (result) events.push(result);
      }
    }

    // Army vs enemy army
    const armies = group.filter((c) => c.type === "army" && c.health > 0);
    for (let i = 0; i < armies.length; i++) {
      for (let j = i + 1; j < armies.length; j++) {
        if (armies[i].countryId === armies[j].countryId) continue; // same side
        if (armies[i].health <= 0 || armies[j].health <= 0) continue;
        const result = creatureFight(armies[i], armies[j], rng);
        if (result) events.push(result);
      }
    }

    // Hunter vs prey (deer, sheep, boar)
    const hunters = group.filter((c) => c.type === "hunter" && c.health > 0);
    const prey = group.filter(
      (c) =>
        c.health > 0 &&
        (c.type === "deer" || c.type === "sheep" || c.type === "boar"),
    );

    for (const hunter of hunters) {
      for (const animal of prey) {
        if (hunter.health <= 0 || animal.health <= 0) continue;
        const result = creatureFight(hunter, animal, rng);
        if (result && animal.health <= 0) {
          // Transfer animal loot to hunter's home settlement
          const homeLoc = hunter.homeLocationId
            ? world.locations.get(hunter.homeLocationId)
            : null;
          if (homeLoc && !homeLoc.isDestroyed) {
            for (const loot of animal.loot) {
              addToStorage(
                homeLoc,
                loot.resourceId,
                loot.quantity,
                loot.quality,
              );
            }
            events.push({
              id: generateId("evt"),
              type: "trade", // reusing type
              turn: state.turn,
              title: `Hunters return with game at ${homeLoc.name}`,
              description: `Hunters brought back ${animal.loot.map((l) => `${Math.round(l.quantity)} ${l.resourceId}`).join(", ")}.`,
              locationId: homeLoc.id,
              characterIds: [],
              isResolved: false,
              effects: [],
              severity: "minor",
            });
          }
        }
        if (result) events.push(result);
      }
    }
  }

  // Armies attack settlements they're standing on
  for (const creature of creaturesArray) {
    if (creature.type !== "army" || creature.health <= 0) continue;

    const tile = world.tiles[creature.position.y]?.[creature.position.x];
    if (!tile?.locationId) continue;

    const loc = world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) continue;

    // Only attack enemy settlements
    if (loc.countryId === creature.countryId) continue;

    const dmg = creature.attack / 10;
    const oldDurability = loc.durability;
    loc.durability = Math.max(0, loc.durability - dmg);
    loc.safety = Math.max(0, loc.safety - 5);
    loc.happiness = Math.max(0, loc.happiness - 3);

    // Army takes some damage from defenders
    const defenseDmg = loc.defenseLevel * 2 + loc.garrisonIds.length;
    creature.health = Math.max(0, creature.health - defenseDmg);

    // === CONQUEST: Settlement captured when durability falls below 20 ===
    if (oldDurability > 20 && loc.durability <= 20 && creature.countryId) {
      const attackingCountry = world.countries.get(creature.countryId);
      const defendingCountry = loc.countryId
        ? world.countries.get(loc.countryId)
        : null;

      if (attackingCountry) {
        // Transfer settlement to conquering country
        if (defendingCountry) {
          defendingCountry.locationIds = defendingCountry.locationIds.filter(
            (id) => id !== loc.id,
          );
        }

        const oldCountryName = defendingCountry?.name ?? "independent";
        const wasCapital =
          defendingCountry && defendingCountry.capitalLocationId === loc.id;

        loc.countryId = attackingCountry.id;
        attackingCountry.locationIds.push(loc.id);

        // If the capital was conquered, defending country needs a new capital
        if (
          wasCapital &&
          defendingCountry &&
          defendingCountry.locationIds.length > 0
        ) {
          // Pick the largest remaining settlement as new capital
          let newCapital: Location | null = null;
          let maxSize = 0;
          for (const locId of defendingCountry.locationIds) {
            const candidateLoc = world.locations.get(locId);
            if (
              candidateLoc &&
              !candidateLoc.isDestroyed &&
              candidateLoc.size > maxSize
            ) {
              newCapital = candidateLoc;
              maxSize = candidateLoc.size;
            }
          }
          if (newCapital) {
            defendingCountry.capitalLocationId = newCapital.id;
          }
        }

        // Reduce happiness and safety after conquest
        loc.happiness = Math.max(20, loc.happiness - 30);
        loc.safety = Math.max(10, loc.safety - 20);

        // Garrison becomes part of the conquering army (absorbed)
        loc.garrisonIds = [];

        events.push({
          id: generateId("evt"),
          type: "war_declared", // reuse type
          turn: state.turn,
          title: `${loc.name} falls to ${attackingCountry.name}!`,
          description: `${loc.name} has been conquered by ${attackingCountry.name} forces. The settlement now flies ${attackingCountry.name}'s banner. Former allegiance: ${oldCountryName}.`,
          locationId: loc.id,
          characterIds: [],
          isResolved: false,
          effects: [],
          severity: "major",
        });
      }
    }
    // Regular attack event (occasional reports)
    else if (rng.chance(0.1)) {
      events.push({
        id: generateId("evt"),
        type: "bandit_attack", // reuse type
        turn: state.turn,
        title: `${creature.name ?? "An army"} attacks ${loc.name}!`,
        description: `Military forces assault ${loc.name}. Durability: ${Math.round(loc.durability)}.`,
        locationId: loc.id,
        characterIds: [],
        isResolved: false,
        effects: [],
        severity: "major",
      });
    }
  }

  return events;
}

/** Run a fight between two creatures. Returns event or null. */
function creatureFight(
  a: Creature,
  b: Creature,
  rng: SeededRandom,
): GameEvent | null {
  const rounds = 5;
  for (let r = 0; r < rounds; r++) {
    const aDmg = Math.max(1, a.attack - b.defense + rng.nextInt(-2, 2));
    b.health -= aDmg;
    if (b.health <= 0) break;

    const bDmg = Math.max(1, b.attack - a.defense + rng.nextInt(-2, 2));
    a.health -= bDmg;
    if (a.health <= 0) break;
  }

  const aLabel = a.name ?? a.type;
  const bLabel = b.name ?? b.type;

  if (a.health <= 0 || b.health <= 0) {
    const winner = a.health > 0 ? aLabel : bLabel;
    const loser = a.health > 0 ? bLabel : aLabel;
    return {
      id: generateId("evt"),
      type: "bandit_attack",
      turn: 0, // will be set by caller
      title: `${winner} defeated ${loser} in combat!`,
      description: `${winner} prevailed against ${loser}.`,
      locationId: null,
      characterIds: [],
      isResolved: false,
      effects: [],
      severity: "moderate",
    };
  }

  return null;
}

// ── Disband Armies After Peace ───────────────────────────

/**
 * Disband armies whose countries are no longer at war.
 */
export function disbandPeacetimeArmies(world: World): void {
  const atWar = new Set<string>();
  for (const rel of world.diplomacy) {
    if (rel.type === "war") {
      atWar.add(rel.countryAId);
      atWar.add(rel.countryBId);
    }
  }

  for (const [id, creature] of world.creatures) {
    if (
      creature.type === "army" &&
      creature.countryId &&
      !atWar.has(creature.countryId)
    ) {
      world.creatures.delete(id);
    }
  }
}
