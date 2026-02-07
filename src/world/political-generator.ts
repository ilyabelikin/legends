import type { Location } from '../types/location';
import type { Character } from '../types/character';
import type { Country, DiplomaticRelation } from '../types/political';
import { SeededRandom, generateId } from '../utils/random';
import { euclideanDist } from '../utils/math';
import { generateCountryName, generateCharacterName } from '../data/name-data';

/** Colors for countries on the map */
const COUNTRY_COLORS = [
  '#c44444', '#4444c4', '#44c444', '#c4c444', '#c444c4',
  '#44c4c4', '#c48844', '#8844c4', '#44c488', '#c44488',
];

/**
 * Generate political structure: countries, lords, and feudal relations.
 * This groups nearby settlements into countries, assigns rulers and lords.
 */
export function generatePolitics(
  locations: Map<string, Location>,
  characters: Map<string, Character>,
  rng: SeededRandom,
): { countries: Map<string, Country>; diplomacy: DiplomaticRelation[] } {
  const countries = new Map<string, Country>();
  const diplomacy: DiplomaticRelation[] = [];

  // Find the largest settlements to be country capitals
  const settlements = Array.from(locations.values())
    .filter(l => !l.isDestroyed && isGovernableLoc(l.type))
    .sort((a, b) => getLocationWeight(b.type) - getLocationWeight(a.type));

  // Top settlements become country capitals
  const numCountries = Math.min(
    Math.max(2, Math.floor(settlements.length / 8)),
    COUNTRY_COLORS.length,
  );
  const capitals = settlements.slice(0, numCountries);

  // Create a country for each capital
  for (let i = 0; i < capitals.length; i++) {
    const capital = capitals[i];
    const countryId = generateId('country');
    const countryName = generateCountryName(rng);

    // Find or create a ruler character
    const ruler = findOrCreateRuler(capital, characters, rng);

    const country: Country = {
      id: countryId,
      name: countryName,
      color: COUNTRY_COLORS[i % COUNTRY_COLORS.length],
      leaderId: ruler.id,
      capitalLocationId: capital.id,
      locationIds: [capital.id],
      alliances: [],
      enemies: [],
      vassalIds: [],
      treasury: rng.nextInt(200, 800),
      taxRate: rng.nextFloat(0.05, 0.2),
      militaryStrength: 0,
      reputation: rng.nextInt(-10, 30),
      foundedTurn: 0,
    };

    countries.set(countryId, country);
    capital.countryId = countryId;
    capital.ownerId = ruler.id;
    ruler.ownedLocationIds.push(capital.id);
    ruler.title = 'King';
  }

  // Assign remaining settlements to nearest country
  const countryList = Array.from(countries.values());
  for (const loc of settlements) {
    if (loc.countryId) continue;

    // Find nearest capital
    let nearestCountry: Country | null = null;
    let nearestDist = Infinity;

    for (const country of countryList) {
      const capital = locations.get(country.capitalLocationId);
      if (!capital) continue;
      const dist = euclideanDist(loc.position, capital.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestCountry = country;
      }
    }

    if (nearestCountry && nearestDist < 50) {
      loc.countryId = nearestCountry.id;
      nearestCountry.locationIds.push(loc.id);

      // Assign a local lord from residents
      const lord = findOrCreateLord(loc, characters, rng);
      if (lord) {
        lord.lordId = nearestCountry.leaderId;
        lord.title = loc.type === 'town' ? 'Baron' : 'Lord';
        nearestCountry.vassalIds.push(lord.id);
        loc.ownerId = lord.id;
        lord.ownedLocationIds.push(loc.id);

        // Add feudal relationship
        const ruler = characters.get(nearestCountry.leaderId);
        if (ruler) {
          lord.relationships.push({
            targetId: ruler.id,
            type: 'lord',
            strength: 50 + rng.nextInt(-20, 20),
          });
          ruler.relationships.push({
            targetId: lord.id,
            type: 'vassal',
            strength: 30 + rng.nextInt(-20, 20),
          });
        }
      }
    }
  }

  // Generate diplomatic relations between countries
  for (let i = 0; i < countryList.length; i++) {
    for (let j = i + 1; j < countryList.length; j++) {
      const capA = locations.get(countryList[i].capitalLocationId);
      const capB = locations.get(countryList[j].capitalLocationId);
      if (!capA || !capB) continue;

      const dist = euclideanDist(capA.position, capB.position);
      let relationType: DiplomaticRelation['type'] = 'neutral';
      let strength = 0;

      if (dist < 30) {
        // Neighbors: could be allies or rivals
        if (rng.chance(0.3)) {
          relationType = 'alliance';
          strength = rng.nextInt(20, 60);
          countryList[i].alliances.push(countryList[j].id);
          countryList[j].alliances.push(countryList[i].id);
        } else if (rng.chance(0.3)) {
          relationType = 'rivalry';
          strength = rng.nextInt(-60, -20);
          countryList[i].enemies.push(countryList[j].id);
          countryList[j].enemies.push(countryList[i].id);
        } else {
          relationType = 'trade_agreement';
          strength = rng.nextInt(5, 30);
        }
      }

      diplomacy.push({
        countryAId: countryList[i].id,
        countryBId: countryList[j].id,
        type: relationType,
        strength,
        startedTurn: 0,
      });
    }
  }

  // Calculate military strength
  for (const country of countryList) {
    country.militaryStrength = calculateMilitaryStrength(country, locations, characters);
  }

  return { countries, diplomacy };
}

function isGovernableLoc(type: string): boolean {
  return ['homestead', 'hamlet', 'village', 'town', 'city', 'castle',
    'farm', 'mine', 'lumber_camp', 'fishing_village', 'port'].includes(type);
}

function getLocationWeight(type: string): number {
  const weights: Record<string, number> = {
    city: 10, town: 8, castle: 7, port: 6, village: 4,
    hamlet: 2, homestead: 1, mine: 2, farm: 1, lumber_camp: 1,
    fishing_village: 2,
  };
  return weights[type] ?? 0;
}

function findOrCreateRuler(
  loc: Location,
  characters: Map<string, Character>,
  rng: SeededRandom,
): Character {
  // Look for existing noble character
  for (const id of loc.residentIds) {
    const ch = characters.get(id);
    if (ch && ch.jobType === 'noble') return ch;
  }

  // Create one from residents
  if (loc.residentIds.length > 0) {
    const ch = characters.get(loc.residentIds[0]);
    if (ch) {
      ch.jobType = 'noble';
      ch.title = 'King';
      ch.personality.ambition = Math.max(ch.personality.ambition, 0.7);
      return ch;
    }
  }

  // This shouldn't happen if characters are placed first
  // but return a placeholder reference — will be resolved
  const placeholder: Character = createNobleCharacter(loc, rng);
  characters.set(placeholder.id, placeholder);
  loc.residentIds.push(placeholder.id);
  return placeholder;
}

function findOrCreateLord(
  loc: Location,
  characters: Map<string, Character>,
  rng: SeededRandom,
): Character | null {
  // Look for wealthy/ambitious resident
  for (const id of loc.residentIds) {
    const ch = characters.get(id);
    if (ch && ch.personality.ambition > 0.5 && ch.age >= 20) {
      ch.jobType = 'noble';
      return ch;
    }
  }

  // Create a lord if location is important enough
  if (loc.residentIds.length >= 3) {
    const noble = createNobleCharacter(loc, rng);
    characters.set(noble.id, noble);
    loc.residentIds.push(noble.id);
    return noble;
  }

  return null;
}

function createNobleCharacter(loc: Location, rng: SeededRandom): Character {
  const gender: 'male' | 'female' = rng.chance(0.5) ? 'male' : 'female';
  const id = generateId('ch');

  const ch: Character = {
    id,
    name: generateCharacterName(rng, gender),
    age: rng.nextInt(25, 55),
    gender,
    position: { ...loc.position },
    homeLocationId: loc.id,
    jobType: 'noble',
    health: 80,
    maxHealth: 80,
    stats: { strength: rng.nextInt(4, 8), dexterity: rng.nextInt(4, 7), intelligence: rng.nextInt(5, 9), charisma: rng.nextInt(6, 10), endurance: rng.nextInt(4, 7) },
    needs: { food: 80, shelter: 90, safety: 70, social: 60, purpose: 70 },
    personality: { ambition: rng.nextFloat(0.6, 1.0), courage: rng.next(), greed: rng.nextFloat(0.3, 0.8), loyalty: rng.next(), kindness: rng.next(), curiosity: rng.next() },
    relationships: [],
    skills: { tactics: rng.nextInt(15, 40), persuasion: rng.nextInt(20, 50), trading: rng.nextInt(10, 30), combat: rng.nextInt(10, 25) },
    inventory: [],
    gold: rng.nextInt(50, 300),
    equippedWeapon: null,
    equippedArmor: null,
    isAlive: true,
    currentAction: null,
    destination: null,
    turnsUntilArrival: 0,
    title: null,
    lordId: null,
    vassalIds: [],
    ownedLocationIds: [],
    knownLocationIds: [loc.id],
    flags: {},
  };

  return ch;
}

function calculateMilitaryStrength(
  country: Country,
  locations: Map<string, Location>,
  characters: Map<string, Character>,
): number {
  let strength = 0;
  for (const locId of country.locationIds) {
    const loc = locations.get(locId);
    if (!loc) continue;
    strength += loc.defenseLevel * 10;
    strength += loc.garrisonIds.length * 5;
    strength += loc.wallLevel * 20;
  }
  return strength;
}
