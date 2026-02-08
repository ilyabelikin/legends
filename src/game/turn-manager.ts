import type { GameState, EventLogEntry } from '../types/game';
import type { Character } from '../types/character';
import type { Season, Weather } from '../types/season';
import { getSeasonFromTurn, WEATHER_PROBABILITIES } from '../types/season';
import { tickEconomy } from '../economy/economy-engine';
import { executeTrades, establishTradeRoutes, updateRouteDanger, spawnTraders } from '../economy/trade-engine';
import { decideCharacterAction, decideCreatureAction, DEFAULT_AI_CONFIG } from '../ai/decision-engine';
import { generateWorldEvents } from '../ai/world-events';
import { checkDirectWitness } from './news-system';
import { checkDestruction, tickBurningAndRegen, spawnGuards, spawnHunters, spawnArmies, creatureCombatTick, disbandPeacetimeArmies } from './military-system';
import { tickShepherdGathering, tickHerdMovement, tickWoolProduction, tickSheepBreeding, tickHerdCleanup } from './herding-system';
import { SeededRandom } from '../utils/random';
import { isWater } from '../world/terrain-generator';
import { clearTerrainSpriteCache } from '../render/sprites/terrain-sprites';
import { inBounds } from '../utils/math';

/** Visibility radius around the party */
const PARTY_VISION_RADIUS = 6;

/**
 * Advance the game by one turn.
 * This is the main simulation step: all NPCs act, economy ticks, events fire.
 */
export function advanceTurn(state: GameState): void {
  const rng = new SeededRandom(state.world.seed + state.turn * 31337);

  state.turn++;

  // Update season
  const newSeason = getSeasonFromTurn(state.turn);
  if (newSeason !== state.season) {
    state.season = newSeason;
    clearTerrainSpriteCache(); // re-render with new season colors
    addLog(state, `Season changes to ${newSeason}.`, 'system');
  }

  // Update weather
  state.weather = rollWeather(state.season, rng);

  // === 1. Economy tick (silent — party learns about trade via settlements) ===
  tickEconomy(state.world, state.season, rng.fork());

  // === 2. Trade ===
  if (state.turn % 5 === 0) {
    executeTrades(state.world, state.turn, rng.fork());
  }
  if (state.turn % 20 === 0) {
    establishTradeRoutes(state.world, rng.fork());
    updateRouteDanger(state.world);
    spawnTraders(state.world, rng.fork());
  }

  // === 3. NPC decisions and actions ===
  tickCharacters(state, rng.fork());

  // === 4. Creature actions ===
  tickCreatures(state, rng.fork());

  // === 5. World events ===
  const events = generateWorldEvents(state.world, state.turn, state.season, rng.fork());
  for (const event of events) {
    state.activeEvents.push(event);
    state.worldEvents.push(event);

    // Only show in log if the party directly witnesses it (close enough to see/hear)
    if (checkDirectWitness(state, event)) {
      state.knownEventIds.add(event.id);
      addLog(state, event.title, severityToLogType(event.severity), event.locationId ?? undefined);
    }
  }

  // Prune old world events (older than 80 turns) to save memory
  if (state.worldEvents.length > 300) {
    state.worldEvents = state.worldEvents.filter(e => state.turn - e.turn < 80);
  }

  // === 6. Herding: shepherds gather, move, breed sheep, produce wool ===
  const gatherEvents = tickShepherdGathering(state.world, rng.fork());
  for (const evt of gatherEvents) {
    evt.turn = state.turn;
    state.worldEvents.push(evt);
    if (checkDirectWitness(state, evt)) {
      state.knownEventIds.add(evt.id);
      addLog(state, evt.title, 'trade', evt.locationId ?? undefined);
    }
  }

  tickHerdMovement(state.world);

  const woolEvents = tickWoolProduction(state.world, state.turn);
  for (const evt of woolEvents) {
    state.worldEvents.push(evt);
    if (checkDirectWitness(state, evt)) {
      state.knownEventIds.add(evt.id);
      addLog(state, evt.title, 'trade', evt.locationId ?? undefined);
    }
  }

  if (state.turn % 3 === 0) {
    const breedEvents = tickSheepBreeding(state.world, state.turn, rng.fork());
    for (const evt of breedEvents) {
      state.worldEvents.push(evt);
      if (checkDirectWitness(state, evt)) {
        state.knownEventIds.add(evt.id);
        addLog(state, evt.title, 'info', evt.locationId ?? undefined);
      }
    }
  }

  tickHerdCleanup(state.world);

  // === 7. Military: guards, hunters, armies, creature combat, destruction ===
  if (state.turn % 10 === 0) {
    spawnGuards(state.world, rng.fork());
    spawnHunters(state.world, rng.fork());
  }
  if (state.turn % 5 === 0) {
    const armyEvents = spawnArmies(state, rng.fork());
    for (const evt of armyEvents) {
      state.worldEvents.push(evt);
      if (checkDirectWitness(state, evt)) {
        state.knownEventIds.add(evt.id);
        addLog(state, evt.title, severityToLogType(evt.severity), evt.locationId ?? undefined);
      }
    }
  }

  const combatEvents = creatureCombatTick(state, rng.fork());
  for (const evt of combatEvents) {
    evt.turn = state.turn;
    state.worldEvents.push(evt);
    if (checkDirectWitness(state, evt)) {
      state.knownEventIds.add(evt.id);
      addLog(state, evt.title, 'combat', evt.locationId ?? undefined);
    }
  }

  tickBurningAndRegen(state.world);
  const destructionEvents = checkDestruction(state);
  for (const evt of destructionEvents) {
    state.activeEvents.push(evt);
    state.worldEvents.push(evt);
    if (checkDirectWitness(state, evt)) {
      state.knownEventIds.add(evt.id);
      addLog(state, evt.title, 'danger', evt.locationId ?? undefined);
    }
  }

  disbandPeacetimeArmies(state.world);

  // === 7. Update visibility ===
  updateVisibility(state);

  // === 8. Age characters yearly ===
  if (state.turn % 360 === 0) {
    ageCharacters(state.world);
  }

  // === 9. Restore party action points ===
  console.log(`[Turn ${state.turn}] Before restore: AP = ${state.party.actionPoints}`);
  state.party.maxActionPoints = 6;
  state.party.actionPoints = state.party.maxActionPoints;
  console.log(`[Turn ${state.turn}] After restore: AP = ${state.party.actionPoints}`);

  // === 10. Prune old events ===
  state.activeEvents = state.activeEvents.filter(e =>
    !e.isResolved && state.turn - e.turn < 50
  );
}

/** Process all NPC characters */
function tickCharacters(state: GameState, rng: SeededRandom): void {
  const world = state.world;
  // Process in batches to be efficient
  for (const character of world.characters.values()) {
    if (!character.isAlive) continue;
    if (state.party.members.some(m => m.id === character.id)) continue; // skip party members

    // Decide action
    const action = decideCharacterAction(character, world, DEFAULT_AI_CONFIG, rng);
    character.currentAction = action;

    // Execute action
    executeCharacterAction(character, action, state, rng);

    // Decay needs over time
    character.needs.food = Math.max(0, character.needs.food - 0.5);
    character.needs.social = Math.max(0, character.needs.social - 0.3);
    character.needs.purpose = Math.max(0, character.needs.purpose - 0.2);

    // Working restores purpose
    if (action.type === 'working') {
      character.needs.purpose = Math.min(100, character.needs.purpose + 3);
    }
    // Socializing restores social
    if (action.type === 'socializing') {
      character.needs.social = Math.min(100, character.needs.social + 5);
    }
    // Resting restores health
    if (action.type === 'resting') {
      character.health = Math.min(character.maxHealth, character.health + 5);
    }
  }
}

/** Execute a character's decided action */
function executeCharacterAction(
  character: Character,
  action: Character['currentAction'],
  state: GameState,
  rng: SeededRandom,
): void {
  if (!action) return;

  switch (action.type) {
    case 'traveling':
      if (character.turnsUntilArrival > 0) {
        character.turnsUntilArrival--;
        if (character.turnsUntilArrival <= 0 && character.destination) {
          character.position = { ...character.destination };
          character.destination = null;
        }
      }
      break;

    case 'working':
      // Production is handled by economy engine
      break;

    case 'idle':
      // Natural health regen when idle
      character.health = Math.min(character.maxHealth, character.health + 1);
      break;

    default:
      break;
  }
}

/** Process all creatures */
function tickCreatures(state: GameState, rng: SeededRandom): void {
  const world = state.world;

  for (const creature of world.creatures.values()) {
    if (creature.health <= 0) continue;

    const { dx, dy, behavior } = decideCreatureAction(
      creature, world, state.party.position, rng
    );
    creature.behavior = behavior;

    // Move creature
    const newX = creature.position.x + dx;
    const newY = creature.position.y + dy;
    if (inBounds({ x: newX, y: newY }, world.width, world.height)) {
      const tile = world.tiles[newY][newX];
      if (!isWater(tile.terrainType)) {
        creature.position.x = newX;
        creature.position.y = newY;
      }
    }

    creature.lastActionTurn = state.turn;
    creature.age++;
  }

  // Check for creatures that moved onto the party's position — initiate combat
  checkCreaturePartyCollision(state, rng);

  // Remove dead creatures
  for (const [id, creature] of world.creatures) {
    if (creature.health <= 0) {
      world.creatures.delete(id);
    }
  }
}

/** Check if any hostile creatures moved onto the party's position and run combat */
function checkCreaturePartyCollision(state: GameState, rng: SeededRandom): void {
  const { party, world } = state;
  const leader = party.members[0];
  if (!leader) return;

  const partyAttack = (leader.stats.strength + (leader.equippedWeapon?.attack ?? 0)) * 2;
  const partyDefense = leader.stats.endurance + (leader.equippedArmor?.defense ?? 0);

  for (const creature of world.creatures.values()) {
    if (creature.health <= 0) continue;
    if (!creature.isHostile) continue;

    // Check if creature is on the same tile as the party
    if (creature.position.x === party.position.x && creature.position.y === party.position.y) {
      const label = creature.name ?? creature.type;

      let partyHP = leader.health;
      let creatureHP = creature.health;
      let totalDmgDealt = 0;
      let totalDmgTaken = 0;
      let rounds = 0;

      while (partyHP > 0 && creatureHP > 0 && rounds < 20) {
        rounds++;
        // Party attacks
        const partyDmg = Math.max(1, partyAttack - creature.defense + rng.nextInt(-2, 2));
        creatureHP -= partyDmg;
        totalDmgDealt += partyDmg;

        // Creature attacks
        if (creatureHP > 0) {
          const creatureDmg = Math.max(1, creature.attack - partyDefense + rng.nextInt(-2, 2));
          partyHP -= creatureDmg;
          totalDmgTaken += creatureDmg;
        }
      }

      // Write back HP
      creature.health = Math.max(0, creatureHP);
      leader.health = Math.max(1, partyHP);

      // Start combat animation
      state.combatAnimation = {
        active: true,
        partyPos: { ...state.party.position },
        enemyPos: { ...creature.position },
        enemyId: creature.id,
        startTime: Date.now(),
        duration: rounds * 400,
        rounds: rounds
      };

      // Log result
      if (creature.health <= 0) {
        state.eventLog.push({
          turn: state.turn,
          message: `${label} attacked! You defeated it (${rounds} rounds, dealt ${Math.round(totalDmgDealt)} dmg).`,
          type: 'combat',
          locationId: null,
        });
        // Collect loot into party inventory
        for (const loot of creature.loot) {
          // Try to stack with existing
          const existing = state.party.inventory.find(s => s.resourceId === loot.resourceId && Math.abs(s.quality - loot.quality) < 0.1);
          if (existing) {
            existing.quantity += loot.quantity;
          } else {
            state.party.inventory.push({ resourceId: loot.resourceId, quantity: loot.quantity, quality: loot.quality, age: 0 });
          }
          
          state.eventLog.push({
            turn: state.turn,
            message: `Obtained ${(Math.round(loot.quantity * 10) / 10).toFixed(1)} ${loot.resourceId}.`,
            type: 'info',
            locationId: null,
          });
        }
        // XP gain
        leader.skills['combat'] = Math.min(100, (leader.skills['combat'] ?? 0) + 3);
        // Remove creature after animation completes (handled in renderer)
      } else {
        state.eventLog.push({
          turn: state.turn,
          message: `${label} attacked! Fought for ${rounds} rounds — dealt ${Math.round(totalDmgDealt)} dmg, took ${Math.round(totalDmgTaken)}.`,
          type: 'combat',
          locationId: null,
        });
        // Still gain some XP for surviving
        leader.skills['combat'] = Math.min(100, (leader.skills['combat'] ?? 0) + 1);
      }
    }
  }
}

/** Update tile visibility around the party */
function updateVisibility(state: GameState): void {
  const { world, party } = state;
  const { x: px, y: py } = party.position;

  // Clear current visibility
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      world.tiles[y][x].visible = false;
    }
  }

  // Set visible around party
  for (let dy = -PARTY_VISION_RADIUS; dy <= PARTY_VISION_RADIUS; dy++) {
    for (let dx = -PARTY_VISION_RADIUS; dx <= PARTY_VISION_RADIUS; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > PARTY_VISION_RADIUS) continue;
      const nx = px + dx;
      const ny = py + dy;
      if (nx >= 0 && nx < world.width && ny >= 0 && ny < world.height) {
        world.tiles[ny][nx].visible = true;
        world.tiles[ny][nx].explored = true;
      }
    }
  }
}

/** Roll weather for the turn */
function rollWeather(season: Season, rng: SeededRandom): Weather {
  const probs = WEATHER_PROBABILITIES[season];
  const entries = Object.entries(probs) as [Weather, number][];
  return rng.weightedPick(entries);
}

/** Age all characters by one year */
function ageCharacters(world: GameState['world']): void {
  for (const ch of world.characters.values()) {
    if (!ch.isAlive) continue;
    ch.age++;
    // Natural death from old age
    if (ch.age > 65 && Math.random() < (ch.age - 65) * 0.05) {
      ch.isAlive = false;
    }
    // Children grow up
    if (ch.age >= 15 && ch.jobType === 'child') {
      ch.jobType = 'unemployed';
    }
  }
}

/** Add a log entry */
function addLog(state: GameState, message: string, type: EventLogEntry['type'], locationId?: string): void {
  state.eventLog.push({
    turn: state.turn,
    message,
    type,
    locationId,
  });
  // Keep log manageable
  if (state.eventLog.length > 200) {
    state.eventLog = state.eventLog.slice(-150);
  }
}

function severityToLogType(severity: string): EventLogEntry['type'] {
  switch (severity) {
    case 'catastrophic': return 'danger';
    case 'major': return 'danger';
    case 'moderate': return 'info';
    default: return 'info';
  }
}
