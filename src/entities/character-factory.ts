import type { Character, Gender, JobType, Personality, CharacterStats, CharacterNeeds } from '../types/character';
import type { Location } from '../types/location';
import { SeededRandom, generateId } from '../utils/random';
import { generateCharacterName } from '../data/name-data';

/** Job distribution weights for settlement types */
const JOB_WEIGHTS: Record<string, [JobType, number][]> = {
  homestead: [['farmer', 5], ['hunter', 2], ['unemployed', 1]],
  hamlet: [['farmer', 5], ['hunter', 2], ['miner', 1], ['lumberjack', 2], ['unemployed', 1]],
  village: [['farmer', 4], ['hunter', 2], ['blacksmith', 1], ['baker', 1], ['weaver', 1], ['merchant', 1], ['guard', 1], ['priest', 0.5], ['unemployed', 1]],
  town: [['farmer', 3], ['hunter', 1], ['blacksmith', 2], ['baker', 1], ['weaver', 1], ['brewer', 1], ['tanner', 1], ['merchant', 2], ['soldier', 2], ['guard', 2], ['scholar', 0.5], ['priest', 1], ['herbalist', 1], ['unemployed', 1]],
  city: [['farmer', 2], ['blacksmith', 2], ['baker', 2], ['weaver', 2], ['brewer', 1], ['tanner', 1], ['merchant', 3], ['soldier', 3], ['guard', 3], ['scholar', 1], ['priest', 1], ['herbalist', 1], ['noble', 0.5], ['unemployed', 1]],
  mine: [['miner', 5], ['farmer', 1], ['unemployed', 1]],
  farm: [['farmer', 6], ['unemployed', 1]],
  lumber_camp: [['lumberjack', 5], ['farmer', 1], ['unemployed', 1]],
  fishing_village: [['fisher', 5], ['farmer', 1], ['merchant', 1], ['unemployed', 1]],
  port: [['fisher', 3], ['merchant', 3], ['soldier', 1], ['guard', 2], ['baker', 1], ['unemployed', 1]],
  castle: [['soldier', 4], ['guard', 3], ['noble', 1], ['unemployed', 2], ['blacksmith', 1]],
};

/** Population targets for location types */
const POPULATION_TARGETS: Record<string, [number, number]> = {
  homestead: [4, 8],
  hamlet: [15, 30],
  village: [40, 80],
  town: [100, 200],
  city: [200, 400],
  mine: [10, 25],
  farm: [6, 15],
  lumber_camp: [8, 20],
  fishing_village: [20, 40],
  port: [60, 120],
  castle: [40, 100],
};

/** Create a single character */
export function createCharacter(
  rng: SeededRandom,
  position: { x: number; y: number },
  homeLocationId: string | null,
  jobType: JobType = 'unemployed',
): Character {
  const gender: Gender = rng.chance(0.5) ? 'male' : 'female';
  const name = generateCharacterName(rng, gender);
  const age = generateAge(rng, jobType);
  const stats = generateStats(rng, jobType);
  const personality = generatePersonality(rng);

  const character: Character = {
    id: generateId('ch'),
    name,
    age,
    gender,
    position: { ...position },
    homeLocationId,
    jobType,

    health: 50 + stats.endurance * 5,
    maxHealth: 50 + stats.endurance * 5,
    stats,
    needs: {
      food: 70 + rng.nextInt(-10, 10),
      shelter: homeLocationId ? 80 : 30,
      safety: 60 + rng.nextInt(-10, 10),
      social: 50 + rng.nextInt(-10, 10),
      purpose: jobType !== 'unemployed' ? 60 : 30,
    },
    personality,
    relationships: [],
    skills: generateSkills(rng, jobType),
    inventory: [],
    gold: rng.nextInt(0, 20),
    equippedWeapon: null,
    equippedArmor: null,

    isAlive: true,
    currentAction: null,
    destination: null,
    turnsUntilArrival: 0,
    
    onDuty: false,
    dutyWanderRadius: 0,
    turnsOnDuty: 0,

    title: null,
    lordId: null,
    vassalIds: [],
    ownedLocationIds: [],
    knownLocationIds: homeLocationId ? [homeLocationId] : [],
    flags: {},
    herdedCreatureIds: [],
  };

  return character;
}

/** Generate appropriate age for a job */
function generateAge(rng: SeededRandom, job: JobType): number {
  if (job === 'child') return rng.nextInt(0, 14);
  if (job === 'elder') return rng.nextInt(55, 75);
  if (job === 'noble') return rng.nextInt(25, 55);
  if (job === 'soldier' || job === 'guard') return rng.nextInt(18, 40);
  if (job === 'scholar' || job === 'priest') return rng.nextInt(25, 60);
  return rng.nextInt(16, 50);
}

/** Generate base stats influenced by job */
function generateStats(rng: SeededRandom, job: JobType): CharacterStats {
  const base = () => rng.nextInt(3, 8);
  const stats: CharacterStats = {
    strength: base(),
    dexterity: base(),
    intelligence: base(),
    charisma: base(),
    endurance: base(),
  };

  // Job bonuses
  switch (job) {
    case 'farmer': stats.strength += 2; stats.endurance += 2; break;
    case 'miner': stats.strength += 3; stats.endurance += 2; break;
    case 'shepherd': stats.endurance += 2; stats.charisma += 1; break;
    case 'blacksmith': stats.strength += 3; stats.dexterity += 1; break;
    case 'soldier': stats.strength += 2; stats.dexterity += 2; stats.endurance += 2; break;
    case 'hunter': stats.dexterity += 3; stats.endurance += 1; break;
    case 'merchant': stats.charisma += 3; stats.intelligence += 1; break;
    case 'scholar': stats.intelligence += 4; break;
    case 'noble': stats.charisma += 2; stats.intelligence += 2; break;
    case 'adventurer': stats.strength += 1; stats.dexterity += 1; stats.endurance += 1; stats.charisma += 1; break;
  }

  return stats;
}

/** Generate personality traits */
function generatePersonality(rng: SeededRandom): Personality {
  return {
    ambition: rng.next(),
    courage: rng.next(),
    greed: rng.next(),
    loyalty: rng.next(),
    kindness: rng.next(),
    curiosity: rng.next(),
  };
}

/** Generate skill levels for a job */
function generateSkills(rng: SeededRandom, job: JobType): Record<string, number> {
  const skills: Record<string, number> = {};

  // Everyone has basic skills
  skills['combat'] = rng.nextInt(1, 15);
  skills['survival'] = rng.nextInt(5, 20);

  // Job-specific skills
  switch (job) {
    case 'farmer':
      skills['farming'] = rng.nextInt(20, 60);
      skills['cooking'] = rng.nextInt(10, 30);
      break;
    case 'miner':
      skills['mining'] = rng.nextInt(20, 60);
      break;
    case 'lumberjack':
      skills['woodworking'] = rng.nextInt(20, 60);
      break;
    case 'fisher':
      skills['fishing'] = rng.nextInt(20, 60);
      break;
    case 'blacksmith':
      skills['blacksmithing'] = rng.nextInt(25, 65);
      skills['smelting'] = rng.nextInt(15, 40);
      break;
    case 'weaver':
      skills['weaving'] = rng.nextInt(25, 60);
      break;
    case 'baker':
      skills['cooking'] = rng.nextInt(25, 60);
      break;
    case 'brewer':
      skills['brewing'] = rng.nextInt(25, 60);
      break;
    case 'tanner':
      skills['leatherworking'] = rng.nextInt(25, 60);
      break;
    case 'merchant':
      skills['trading'] = rng.nextInt(25, 65);
      skills['persuasion'] = rng.nextInt(15, 40);
      break;
    case 'soldier':
    case 'guard':
      skills['combat'] = rng.nextInt(30, 70);
      skills['tactics'] = rng.nextInt(10, 30);
      break;
    case 'hunter':
      skills['hunting'] = rng.nextInt(25, 60);
      skills['combat'] = rng.nextInt(15, 40);
      skills['survival'] = rng.nextInt(20, 50);
      break;
    case 'herbalist':
      skills['herbalism'] = rng.nextInt(25, 60);
      break;
    case 'scholar':
      skills['lore'] = rng.nextInt(30, 70);
      break;
    case 'priest':
      skills['healing'] = rng.nextInt(20, 50);
      skills['persuasion'] = rng.nextInt(15, 40);
      break;
    case 'noble':
      skills['tactics'] = rng.nextInt(15, 40);
      skills['persuasion'] = rng.nextInt(20, 50);
      skills['trading'] = rng.nextInt(10, 30);
      break;
    case 'adventurer':
      skills['combat'] = rng.nextInt(20, 50);
      skills['survival'] = rng.nextInt(20, 50);
      skills['lore'] = rng.nextInt(10, 30);
      break;
  }

  return skills;
}

/**
 * Populate all locations with characters.
 * Creates families, assigns jobs, and builds social relationships.
 */
export function populateWorld(
  locations: Map<string, Location>,
  rng: SeededRandom,
): Map<string, Character> {
  const characters = new Map<string, Character>();

  for (const location of locations.values()) {
    if (location.isDestroyed) continue;

    const popTarget = POPULATION_TARGETS[location.type] ?? [2, 6];
    const targetPop = rng.nextInt(popTarget[0], popTarget[1]);

    const jobWeights = JOB_WEIGHTS[location.type] ?? [['farmer', 3], ['unemployed', 2]];

    // Create families
    let created = 0;
    while (created < targetPop) {
      // Create a family unit
      const familySize = Math.min(rng.nextInt(1, 4), targetPop - created);

      // Head of household
      const job = rng.weightedPick(jobWeights);
      const head = createCharacter(rng, location.position, location.id, job);
      head.age = rng.nextInt(25, 50);
      head.gold = rng.nextInt(5, 40);
      characters.set(head.id, head);
      location.residentIds.push(head.id);
      created++;

      if (familySize >= 2) {
        // Spouse
        const spouseGender: Gender = head.gender === 'male' ? 'female' : 'male';
        const spouseJob = rng.weightedPick(jobWeights);
        const spouse = createCharacter(rng, location.position, location.id, spouseJob);
        spouse.gender = spouseGender;
        spouse.name = generateCharacterName(rng, spouseGender);
        spouse.age = head.age + rng.nextInt(-5, 5);
        characters.set(spouse.id, spouse);
        location.residentIds.push(spouse.id);
        created++;

        // Marriage relationship
        head.relationships.push({ targetId: spouse.id, type: 'spouse', strength: 60 + rng.nextInt(0, 30) });
        spouse.relationships.push({ targetId: head.id, type: 'spouse', strength: 60 + rng.nextInt(0, 30) });

        // Children
        for (let c = 2; c < familySize && created < targetPop; c++) {
          const childAge = rng.nextInt(1, Math.max(1, head.age - 18));
          const childGender: Gender = rng.chance(0.5) ? 'male' : 'female';
          const childJob: JobType = childAge < 15 ? 'child' : rng.weightedPick(jobWeights);
          const child = createCharacter(rng, location.position, location.id, childJob);
          child.gender = childGender;
          child.name = generateCharacterName(rng, childGender);
          child.age = childAge;
          characters.set(child.id, child);
          location.residentIds.push(child.id);
          created++;

          // Parent-child relationships
          head.relationships.push({ targetId: child.id, type: 'child', strength: 70 + rng.nextInt(0, 20) });
          child.relationships.push({ targetId: head.id, type: 'parent', strength: 60 + rng.nextInt(0, 30) });
          spouse.relationships.push({ targetId: child.id, type: 'child', strength: 70 + rng.nextInt(0, 20) });
          child.relationships.push({ targetId: spouse.id, type: 'parent', strength: 60 + rng.nextInt(0, 30) });
        }
      }
    }

    // Assign workers to buildings
    assignWorkers(location, characters, rng);

    // Add some inter-resident friendships and rivalries
    const residentIds = [...location.residentIds];
    for (let i = 0; i < Math.min(5, residentIds.length); i++) {
      const a = characters.get(rng.pick(residentIds));
      const b = characters.get(rng.pick(residentIds));
      if (a && b && a.id !== b.id) {
        const existing = a.relationships.find(r => r.targetId === b.id);
        if (!existing) {
          if (rng.chance(0.7)) {
            a.relationships.push({ targetId: b.id, type: 'friend', strength: rng.nextInt(20, 60) });
            b.relationships.push({ targetId: a.id, type: 'friend', strength: rng.nextInt(20, 60) });
          } else {
            a.relationships.push({ targetId: b.id, type: 'rival', strength: rng.nextInt(-40, -10) });
            b.relationships.push({ targetId: a.id, type: 'rival', strength: rng.nextInt(-40, -10) });
          }
        }
      }
    }
  }

  return characters;
}

/** Assign workers to production buildings */
function assignWorkers(
  location: Location,
  characters: Map<string, Character>,
  rng: SeededRandom,
): void {
  const buildingJobMap: Record<string, JobType[]> = {
    farm_field: ['farmer'],
    mine_shaft: ['miner'],
    sawmill: ['lumberjack'],
    blacksmith: ['blacksmith'],
    weaponsmith: ['blacksmith', 'soldier'],
    armorer: ['blacksmith'],
    bakery: ['baker'],
    brewery: ['brewer'],
    weaver: ['weaver'],
    tanner: ['tanner'],
    dock: ['fisher'],
    apothecary: ['herbalist'],
    hunter_lodge: ['hunter'],
    barracks: ['soldier'],
    church: ['priest'],
    market: ['merchant'],
  };

  for (const building of location.buildings) {
    if (building.workerId) continue;
    const validJobs = buildingJobMap[building.type];
    if (!validJobs) continue;

    // Find a matching worker among residents
    for (const resId of location.residentIds) {
      const ch = characters.get(resId);
      if (!ch) continue;
      if (validJobs.includes(ch.jobType) && !isAssignedToBuilding(ch.id, location)) {
        building.workerId = ch.id;
        break;
      }
    }
  }
}

function isAssignedToBuilding(charId: string, location: Location): boolean {
  return location.buildings.some(b => b.workerId === charId);
}
