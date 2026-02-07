import type { Character, CharacterAction, JobType } from '../types/character';
import type { Creature, CreatureBehavior } from '../types/creature';
import type { World } from '../types/world';
import type { Location } from '../types/location';
import { SeededRandom } from '../utils/random';
import { euclideanDist, manhattanDist } from '../utils/math';

/**
 * AI decision weights — highly configurable.
 * Adjust these to change NPC behavior patterns.
 */
export interface AIConfig {
  /** Weight for seeking food when hungry */
  hungerDrive: number;
  /** Weight for seeking safety when threatened */
  safetyDrive: number;
  /** Weight for social interaction */
  socialDrive: number;
  /** Weight for pursuing ambitions */
  ambitionDrive: number;
  /** Weight for staying at home */
  homeDrive: number;
  /** Weight for job-related actions */
  workDrive: number;
  /** Chance of random exploration */
  wanderlust: number;
  /** How often NPCs consider career changes */
  careerChangeChance: number;
  /** How often NPCs consider becoming adventurers */
  adventurerChance: number;
  /** Marriage consideration rate */
  marriageChance: number;
}

/** Default AI configuration */
export const DEFAULT_AI_CONFIG: AIConfig = {
  hungerDrive: 2.0,
  safetyDrive: 1.5,
  socialDrive: 0.8,
  ambitionDrive: 1.0,
  homeDrive: 1.2,
  workDrive: 1.5,
  wanderlust: 0.05,
  careerChangeChance: 0.005,
  adventurerChance: 0.001,
  marriageChance: 0.01,
};

/** Options for an NPC action decision */
interface ActionOption {
  action: CharacterAction;
  weight: number;
  description: string;
}

/**
 * Make a decision for an NPC character.
 * Uses weighted probabilistic selection based on needs, personality, and context.
 */
export function decideCharacterAction(
  character: Character,
  world: World,
  config: AIConfig,
  rng: SeededRandom,
): CharacterAction {
  if (!character.isAlive) return { type: 'idle' };
  if (character.age < 10) return { type: 'idle' }; // children don't act
  if (character.currentAction?.type === 'traveling' && character.turnsUntilArrival > 0) {
    return character.currentAction; // continue traveling
  }

  const options: ActionOption[] = [];
  const home = character.homeLocationId ? world.locations.get(character.homeLocationId) : null;

  // === WORK ===
  if (home && character.jobType !== 'unemployed' && character.jobType !== 'child' && character.jobType !== 'elder') {
    const workWeight = config.workDrive * (1 - character.personality.curiosity * 0.3);
    options.push({
      action: { type: 'working', buildingType: jobToBuilding(character.jobType) },
      weight: workWeight * (character.needs.purpose < 40 ? 1.5 : 1.0),
      description: 'go to work',
    });
  }

  // === SEEK FOOD ===
  if (character.needs.food < 50) {
    const hungerWeight = config.hungerDrive * (1 - character.needs.food / 100);
    if (home) {
      options.push({
        action: { type: 'trading', locationId: home.id },
        weight: hungerWeight * 2,
        description: 'get food',
      });
    }
  }

  // === SOCIALIZE ===
  if (character.needs.social < 60 && character.relationships.length > 0) {
    const friend = character.relationships.find(r => r.type === 'friend' || r.type === 'spouse');
    if (friend) {
      options.push({
        action: { type: 'socializing', targetId: friend.targetId },
        weight: config.socialDrive * (1 - character.needs.social / 100) * character.personality.kindness,
        description: 'socialize',
      });
    }
  }

  // === REST ===
  if (character.health < character.maxHealth * 0.7) {
    options.push({
      action: { type: 'resting' },
      weight: config.safetyDrive * (1 - character.health / character.maxHealth),
      description: 'rest and recover',
    });
  }

  // === IDLE ===
  options.push({
    action: { type: 'idle' },
    weight: 0.3,
    description: 'do nothing',
  });

  // === EXPLORE (rare) ===
  if (character.personality.curiosity > 0.7 && rng.chance(config.wanderlust)) {
    const nearbyUnexplored = findNearbyUnexplored(character, world);
    if (nearbyUnexplored) {
      options.push({
        action: { type: 'exploring' },
        weight: config.ambitionDrive * character.personality.curiosity,
        description: 'explore nearby areas',
      });
    }
  }

  // === CAREER CHANGE ===
  if (rng.chance(config.careerChangeChance * character.personality.ambition)) {
    if (character.needs.purpose < 30 || character.personality.ambition > 0.8) {
      // Consider becoming a different job
      if (character.personality.courage > 0.7 && character.stats.strength > 6) {
        options.push({
          action: { type: 'idle' }, // will be handled as career change
          weight: config.ambitionDrive * character.personality.ambition * 0.5,
          description: 'change career',
        });
      }
    }
  }

  // === BECOME ADVENTURER (very rare) ===
  if (character.personality.curiosity > 0.8 &&
      character.personality.courage > 0.8 &&
      character.personality.ambition > 0.7 &&
      character.age >= 16 && character.age <= 35 &&
      rng.chance(config.adventurerChance)) {
    options.push({
      action: { type: 'exploring' },
      weight: config.ambitionDrive * 2,
      description: 'become an adventurer',
    });
  }

  // === MARRIAGE ===
  if (!character.relationships.some(r => r.type === 'spouse') &&
      character.age >= 16 && character.age <= 50 &&
      rng.chance(config.marriageChance)) {
    options.push({
      action: { type: 'socializing', targetId: '' }, // target will be found
      weight: config.socialDrive * 0.5,
      description: 'look for partner',
    });
  }

  // Select action using weighted random
  if (options.length === 0) return { type: 'idle' };

  const totalWeight = options.reduce((sum, o) => sum + Math.max(0, o.weight), 0);
  if (totalWeight <= 0) return { type: 'idle' };

  let roll = rng.next() * totalWeight;
  for (const option of options) {
    roll -= Math.max(0, option.weight);
    if (roll <= 0) return option.action;
  }

  return options[options.length - 1].action;
}

/**
 * Decide creature behavior for this turn.
 */
export function decideCreatureAction(
  creature: Creature,
  world: World,
  partyPos: { x: number; y: number },
  rng: SeededRandom,
): { dx: number; dy: number; behavior: CreatureBehavior } {
  const distToParty = manhattanDist(creature.position, partyPos);
  const distToHome = creature.homePosition
    ? manhattanDist(creature.position, creature.homePosition)
    : 0;

  // Dragon: special behavior
  if (creature.type === 'dragon') {
    return decideDragonAction(creature, world, partyPos, distToParty, rng);
  }

  // Bandit: raid nearby settlements or attack party
  if (creature.type === 'bandit') {
    return decideBanditAction(creature, world, partyPos, distToParty, rng);
  }

  // Hostile creatures: attack if close, hunt otherwise
  if (creature.isHostile && distToParty < 4) {
    // Move toward party
    return {
      dx: Math.sign(partyPos.x - creature.position.x),
      dy: Math.sign(partyPos.y - creature.position.y),
      behavior: 'aggressive',
    };
  }

  // Passive creatures: flee if party is close
  if (!creature.isHostile && distToParty < 3) {
    return {
      dx: -Math.sign(partyPos.x - creature.position.x),
      dy: -Math.sign(partyPos.y - creature.position.y),
      behavior: 'fleeing',
    };
  }

  // Territorial: return to home if too far
  if (creature.behavior === 'territorial' && distToHome > creature.wanderRadius) {
    return {
      dx: Math.sign((creature.homePosition?.x ?? 0) - creature.position.x),
      dy: Math.sign((creature.homePosition?.y ?? 0) - creature.position.y),
      behavior: 'territorial',
    };
  }

  // Wander randomly
  if (rng.chance(0.3)) {
    return {
      dx: rng.nextInt(-1, 1),
      dy: rng.nextInt(-1, 1),
      behavior: creature.behavior,
    };
  }

  return { dx: 0, dy: 0, behavior: creature.behavior };
}

/** Dragon-specific AI */
function decideDragonAction(
  creature: Creature,
  world: World,
  partyPos: { x: number; y: number },
  distToParty: number,
  rng: SeededRandom,
): { dx: number; dy: number; behavior: CreatureBehavior } {
  // Dragons occasionally migrate
  if (rng.chance(0.02)) {
    return {
      dx: rng.nextInt(-2, 2),
      dy: rng.nextInt(-2, 2),
      behavior: 'migrating',
    };
  }

  // Dragons attack nearby settlements
  if (rng.chance(0.05)) {
    // Find nearest settlement
    let nearestLoc: Location | null = null;
    let nearestDist = Infinity;
    for (const loc of world.locations.values()) {
      if (loc.isDestroyed) continue;
      const dist = manhattanDist(creature.position, loc.position);
      if (dist < nearestDist && dist < 15) {
        nearestDist = dist;
        nearestLoc = loc;
      }
    }
    if (nearestLoc) {
      return {
        dx: Math.sign(nearestLoc.position.x - creature.position.x),
        dy: Math.sign(nearestLoc.position.y - creature.position.y),
        behavior: 'aggressive',
      };
    }
  }

  // Chase party if close
  if (distToParty < 6) {
    return {
      dx: Math.sign(partyPos.x - creature.position.x),
      dy: Math.sign(partyPos.y - creature.position.y),
      behavior: 'hunting',
    };
  }

  return { dx: 0, dy: 0, behavior: 'territorial' };
}

/** Bandit-specific AI */
function decideBanditAction(
  creature: Creature,
  world: World,
  partyPos: { x: number; y: number },
  distToParty: number,
  rng: SeededRandom,
): { dx: number; dy: number; behavior: CreatureBehavior } {
  // Attack party if close
  if (distToParty < 4) {
    return {
      dx: Math.sign(partyPos.x - creature.position.x),
      dy: Math.sign(partyPos.y - creature.position.y),
      behavior: 'raiding',
    };
  }

  // Lurk near trade routes
  if (rng.chance(0.1)) {
    // Find nearest road tile
    const radius = 5;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = creature.position.x + dx;
        const ny = creature.position.y + dy;
        if (nx >= 0 && nx < world.width && ny >= 0 && ny < world.height) {
          if (world.tiles[ny][nx].roadLevel > 0) {
            return {
              dx: Math.sign(dx),
              dy: Math.sign(dy),
              behavior: 'raiding',
            };
          }
        }
      }
    }
  }

  // Wander
  if (rng.chance(0.3)) {
    return {
      dx: rng.nextInt(-1, 1),
      dy: rng.nextInt(-1, 1),
      behavior: creature.behavior,
    };
  }

  return { dx: 0, dy: 0, behavior: creature.behavior };
}

/** Find nearby unexplored tile for a character */
function findNearbyUnexplored(character: Character, world: World): { x: number; y: number } | null {
  const radius = 5;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = character.position.x + dx;
      const ny = character.position.y + dy;
      if (nx >= 0 && nx < world.width && ny >= 0 && ny < world.height) {
        if (!world.tiles[ny][nx].explored) {
          return { x: nx, y: ny };
        }
      }
    }
  }
  return null;
}

/** Map job type to building type for work action */
function jobToBuilding(job: JobType): string {
  const map: Partial<Record<JobType, string>> = {
    farmer: 'farm_field',
    miner: 'mine_shaft',
    lumberjack: 'sawmill',
    fisher: 'dock',
    blacksmith: 'blacksmith',
    weaver: 'weaver',
    baker: 'bakery',
    brewer: 'brewery',
    tanner: 'tanner',
    hunter: 'hunter_lodge',
    herbalist: 'apothecary',
    soldier: 'barracks',
    guard: 'wall',
    priest: 'church',
    merchant: 'market',
  };
  return map[job] ?? 'house';
}
