import type { GameState, EventLogEntry } from '../types/game';
import type { World } from '../types/world';
import type { Location } from '../types/location';
import type { Creature } from '../types/creature';
import type { Country } from '../types/political';
import type { GameEvent } from '../types/event';
import { CREATURE_DEFINITIONS } from '../data/creature-data';
import { SeededRandom, generateId } from '../utils/random';
import { manhattanDist, inBounds } from '../utils/math';
import { isWater } from '../world/terrain-generator';
import { generateCountryName } from '../data/name-data';
import { addToStorage } from '../economy/economy-engine';

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
    loc.type = 'ruins';

    // Scatter residents
    for (const charId of loc.residentIds) {
      const ch = world.characters.get(charId);
      if (ch) {
        ch.homeLocationId = null;
        ch.jobType = 'unemployed';
      }
    }
    loc.residentIds = [];
    loc.garrisonIds = [];

    events.push({
      id: generateId('evt'),
      type: 'settlement_destroyed',
      turn: state.turn,
      title: `${loc.name} has been destroyed!`,
      description: `The settlement of ${loc.name} lies in ruins. Its people have scattered.`,
      locationId: loc.id,
      characterIds: [],
      isResolved: false,
      effects: [],
      severity: 'major',
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
    const hasWood = loc.storage.some(s => s.resourceId === 'wood' && s.quantity > 0);
    const hasStone = loc.storage.some(s => s.resourceId === 'stone' && s.quantity > 0);

    let regen = 0;
    if (hasWorkers) regen += 0.3;
    if (hasWood) regen += 0.2;
    if (hasStone) regen += 0.2;
    if (loc.wallLevel > 0) regen += 0.1 * loc.wallLevel;

    loc.durability = Math.min(100, loc.durability + regen);
  }
}

// ── Hunter Spawning ─────────────────────────────────────

/** Maximum hunters per settlement */
const MAX_HUNTERS_PER_SETTLEMENT = 2;

/**
 * Spawn hunters from settlements with hunter_lodge.
 * Hunters track and kill wild game for meat and hides.
 */
export function spawnHunters(world: World, rng: SeededRandom): void {
  for (const loc of world.locations.values()) {
    if (loc.isDestroyed) continue;

    const hasHunterLodge = loc.buildings.some(b => b.type === 'hunter_lodge' && b.isOperational);
    if (!hasHunterLodge) continue;

    // Count existing hunters for this settlement
    let hunterCount = 0;
    for (const c of world.creatures.values()) {
      if (c.type === 'hunter' && c.homeLocationId === loc.id && c.health > 0) {
        hunterCount++;
      }
    }

    if (hunterCount >= MAX_HUNTERS_PER_SETTLEMENT) continue;

    // Spawn a hunter
    const def = CREATURE_DEFINITIONS['hunter'];
    const packSize = rng.nextInt(def.packSize[0], def.packSize[1]);
    const id = generateId('creature');

    const hunter: Creature = {
      id,
      type: 'hunter',
      name: null,
      position: { ...loc.position },
      health: def.baseHealth * packSize,
      maxHealth: def.baseHealth * packSize,
      attack: def.baseAttack * Math.sqrt(packSize),
      defense: def.baseDefense * Math.sqrt(packSize),
      speed: def.baseSpeed,
      behavior: 'hunting',
      homePosition: { ...loc.position },
      wanderRadius: def.wanderRadius,
      isHostile: false,
      loot: [],
      age: 0,
      lastActionTurn: 0,
      countryId: loc.countryId,
      targetLocationId: null,
      homeLocationId: loc.id,
    };

    world.creatures.set(id, hunter);
  }
}

// ── Guard Spawning ──────────────────────────────────────

/** Maximum guards per settlement */
const MAX_GUARDS_PER_SETTLEMENT = 2;

/**
 * Spawn guard patrols from settlements with barracks/walls.
 * Only spawns if not enough guards already exist for that settlement.
 */
export function spawnGuards(world: World, rng: SeededRandom): void {
  for (const loc of world.locations.values()) {
    if (loc.isDestroyed) continue;

    const hasBarracks = loc.buildings.some(b => b.type === 'barracks' && b.isOperational);
    const hasWalls = loc.buildings.some(b => b.type === 'wall' && b.isOperational);
    if (!hasBarracks && !hasWalls) continue;

    // Count existing guards for this settlement
    let guardCount = 0;
    for (const c of world.creatures.values()) {
      if (c.type === 'guard' && c.homeLocationId === loc.id && c.health > 0) {
        guardCount++;
      }
    }

    const maxGuards = hasBarracks ? MAX_GUARDS_PER_SETTLEMENT : 1;
    if (guardCount >= maxGuards) continue;

    // Spawn a guard patrol
    const def = CREATURE_DEFINITIONS['guard'];
    const packSize = rng.nextInt(def.packSize[0], def.packSize[1]);
    const id = generateId('creature');

    const guard: Creature = {
      id,
      type: 'guard',
      name: null,
      position: { ...loc.position },
      health: def.baseHealth * packSize,
      maxHealth: def.baseHealth * packSize,
      attack: def.baseAttack * Math.sqrt(packSize),
      defense: def.baseDefense * Math.sqrt(packSize),
      speed: def.baseSpeed,
      behavior: 'patrolling',
      homePosition: { ...loc.position },
      wanderRadius: def.wanderRadius,
      isHostile: false,
      loot: [],
      age: 0,
      lastActionTurn: 0,
      countryId: loc.countryId,
      targetLocationId: null,
      homeLocationId: loc.id,
    };

    world.creatures.set(id, guard);
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
    if (relation.type !== 'war') continue;

    const countryA = world.countries.get(relation.countryAId);
    const countryB = world.countries.get(relation.countryBId);
    if (!countryA || !countryB) continue;

    // Each side may spawn an army
    for (const [country, enemy] of [[countryA, countryB], [countryB, countryA]] as [Country, Country][]) {
      // Count existing armies for this country
      let armyCount = 0;
      for (const c of world.creatures.values()) {
        if (c.type === 'army' && c.countryId === country.id && c.health > 0) {
          armyCount++;
        }
      }
      if (armyCount >= MAX_ARMIES_PER_COUNTRY) continue;
      if (!rng.chance(0.03)) continue; // 3% chance per turn to muster an army

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

      const def = CREATURE_DEFINITIONS['army'];
      const packSize = rng.nextInt(def.packSize[0], def.packSize[1]);
      const id = generateId('creature');

      const army: Creature = {
        id,
        type: 'army',
        name: `${country.name} Army`,
        position: { ...capital.position },
        health: def.baseHealth * Math.sqrt(packSize),
        maxHealth: def.baseHealth * Math.sqrt(packSize),
        attack: def.baseAttack * Math.sqrt(packSize),
        defense: def.baseDefense * Math.sqrt(packSize),
        speed: def.baseSpeed,
        behavior: 'marching',
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
        id: generateId('evt'),
        type: 'war_declared',
        turn: state.turn,
        title: `${country.name} musters an army at ${capital.name}!`,
        description: `An army marches from ${capital.name} toward ${targetLoc.name}.`,
        locationId: capital.id,
        characterIds: [],
        isResolved: false,
        effects: [],
        severity: 'major',
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
export function creatureCombatTick(state: GameState, rng: SeededRandom): GameEvent[] {
  const events: GameEvent[] = [];
  const { world } = state;

  const creaturesArray = Array.from(world.creatures.values()).filter(c => c.health > 0);

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
    const guards = group.filter(c => c.type === 'guard' && c.health > 0);
    const threats = group.filter(c =>
      c.health > 0 && (
        c.type === 'bandit' ||
        c.type === 'dragon' ||
        (c.type === 'army' && guards.length > 0 && c.countryId !== guards[0].countryId)
      )
    );

    for (const guard of guards) {
      for (const threat of threats) {
        if (guard.health <= 0 || threat.health <= 0) continue;
        const result = creatureFight(guard, threat, rng);
        if (result) events.push(result);
      }
    }

    // Dragon vs dragon — territorial fights when two dragons meet
    const dragons = group.filter(c => c.type === 'dragon' && c.health > 0);
    for (let i = 0; i < dragons.length; i++) {
      for (let j = i + 1; j < dragons.length; j++) {
        if (dragons[i].health <= 0 || dragons[j].health <= 0) continue;
        const result = creatureFight(dragons[i], dragons[j], rng);
        if (result) events.push(result);
      }
    }

    // Army vs enemy army
    const armies = group.filter(c => c.type === 'army' && c.health > 0);
    for (let i = 0; i < armies.length; i++) {
      for (let j = i + 1; j < armies.length; j++) {
        if (armies[i].countryId === armies[j].countryId) continue; // same side
        if (armies[i].health <= 0 || armies[j].health <= 0) continue;
        const result = creatureFight(armies[i], armies[j], rng);
        if (result) events.push(result);
      }
    }

    // Hunter vs prey (deer, sheep, boar)
    const hunters = group.filter(c => c.type === 'hunter' && c.health > 0);
    const prey = group.filter(c =>
      c.health > 0 && (c.type === 'deer' || c.type === 'sheep' || c.type === 'boar')
    );

    for (const hunter of hunters) {
      for (const animal of prey) {
        if (hunter.health <= 0 || animal.health <= 0) continue;
        const result = creatureFight(hunter, animal, rng);
        if (result && animal.health <= 0) {
          // Transfer animal loot to hunter's home settlement
          const homeLoc = hunter.homeLocationId ? world.locations.get(hunter.homeLocationId) : null;
          if (homeLoc && !homeLoc.isDestroyed) {
            for (const loot of animal.loot) {
              addToStorage(homeLoc, loot.resourceId, loot.quantity, loot.quality);
            }
            events.push({
              id: generateId('evt'),
              type: 'trade', // reusing type
              turn: state.turn,
              title: `Hunters return with game at ${homeLoc.name}`,
              description: `Hunters brought back ${animal.loot.map(l => `${Math.round(l.quantity)} ${l.resourceId}`).join(', ')}.`,
              locationId: homeLoc.id,
              characterIds: [],
              isResolved: false,
              effects: [],
              severity: 'minor',
            });
          }
        }
        if (result) events.push(result);
      }
    }
  }

  // Armies attack settlements they're standing on
  for (const creature of creaturesArray) {
    if (creature.type !== 'army' || creature.health <= 0) continue;

    const tile = world.tiles[creature.position.y]?.[creature.position.x];
    if (!tile?.locationId) continue;

    const loc = world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) continue;

    // Only attack enemy settlements
    if (loc.countryId === creature.countryId) continue;

    const dmg = creature.attack / 10;
    loc.durability = Math.max(0, loc.durability - dmg);
    loc.safety = Math.max(0, loc.safety - 5);
    loc.happiness = Math.max(0, loc.happiness - 3);

    // Army takes some damage from defenders
    const defenseDmg = loc.defenseLevel * 2 + loc.garrisonIds.length;
    creature.health = Math.max(0, creature.health - defenseDmg);

    if (rng.chance(0.1)) {
      events.push({
        id: generateId('evt'),
        type: 'bandit_attack', // reuse type
        turn: state.turn,
        title: `${creature.name ?? 'An army'} attacks ${loc.name}!`,
        description: `Military forces assault ${loc.name}. Durability: ${Math.round(loc.durability)}.`,
        locationId: loc.id,
        characterIds: [],
        isResolved: false,
        effects: [],
        severity: 'major',
      });
    }
  }

  return events;
}

/** Run a fight between two creatures. Returns event or null. */
function creatureFight(a: Creature, b: Creature, rng: SeededRandom): GameEvent | null {
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
      id: generateId('evt'),
      type: 'bandit_attack',
      turn: 0, // will be set by caller
      title: `${winner} defeated ${loser} in combat!`,
      description: `${winner} prevailed against ${loser}.`,
      locationId: null,
      characterIds: [],
      isResolved: false,
      effects: [],
      severity: 'moderate',
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
    if (rel.type === 'war') {
      atWar.add(rel.countryAId);
      atWar.add(rel.countryBId);
    }
  }

  for (const [id, creature] of world.creatures) {
    if (creature.type === 'army' && creature.countryId && !atWar.has(creature.countryId)) {
      world.creatures.delete(id);
    }
  }
}
