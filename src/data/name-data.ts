import type { SeededRandom } from '../utils/random';

/** Male first names — vaguely medieval/fantasy */
const MALE_NAMES = [
  'Aldric', 'Bran', 'Cedric', 'Doran', 'Edric', 'Finn', 'Gareth', 'Harald',
  'Ivan', 'Jasper', 'Kael', 'Leif', 'Magnus', 'Nolan', 'Oswin', 'Percival',
  'Quinn', 'Rowan', 'Silas', 'Theron', 'Ulric', 'Voss', 'Wren', 'Yorick',
  'Zephyr', 'Alden', 'Bjorn', 'Corwin', 'Dorian', 'Elric', 'Felix', 'Gideon',
  'Hector', 'Ingram', 'Jareth', 'Kellan', 'Lorcan', 'Merrick', 'Nigel', 'Orin',
  'Phelan', 'Ragnar', 'Stellan', 'Torin', 'Uther', 'Vidar', 'Wolfric', 'Arden',
];

/** Female first names */
const FEMALE_NAMES = [
  'Alara', 'Brynn', 'Celeste', 'Daria', 'Elara', 'Freya', 'Gwendolyn', 'Helena',
  'Isolde', 'Juna', 'Kira', 'Lyra', 'Miriel', 'Nessa', 'Orla', 'Petra',
  'Rosalind', 'Seren', 'Thea', 'Una', 'Vera', 'Wilda', 'Ysolde', 'Zara',
  'Aelith', 'Brigid', 'Cordelia', 'Dahlia', 'Eira', 'Fiona', 'Greta', 'Hilda',
  'Iris', 'Jorunn', 'Katla', 'Lena', 'Maren', 'Niamh', 'Olwen', 'Rhiannon',
  'Sigrid', 'Talia', 'Ursa', 'Violet', 'Wynne', 'Astrid', 'Rowena', 'Svea',
];

/** Surnames / family names */
const SURNAMES = [
  'Ironforge', 'Stonewall', 'Blackthorn', 'Ashwood', 'Silverbrook', 'Goldcrest',
  'Ravenhill', 'Oakenshield', 'Winterborne', 'Thornfield', 'Brightwater', 'Darkmoor',
  'Greycloak', 'Hawkswood', 'Nightingale', 'Redstone', 'Whitewolf', 'Greenhollow',
  'Stormborn', 'Firebrand', 'Coldwell', 'Deepwood', 'Fairweather', 'Highforge',
  'Longstrider', 'Meadowbrook', 'Northwind', 'Proudfoot', 'Quicksilver', 'Riverton',
  'Strongbow', 'Truehart', 'Underhill', 'Wildwood', 'Copperfield', 'Dunmore',
  'Elderwood', 'Foxglove', 'Grimshaw', 'Heathrow', 'Kettleblack', 'Marshwood',
  'Oakridge', 'Pennywhistle', 'Sagewind', 'Thornwick', 'Valeborn', 'Woodhaven',
];

/** Settlement name prefixes */
const SETTLEMENT_PREFIXES = [
  'Stone', 'Iron', 'Green', 'White', 'Black', 'Red', 'Gold', 'Silver',
  'Oak', 'Elm', 'Ash', 'Thorn', 'Raven', 'Wolf', 'Bear', 'Hawk',
  'River', 'Lake', 'Hill', 'Dale', 'Glen', 'Mist', 'Storm', 'Frost',
  'High', 'Low', 'North', 'South', 'East', 'West', 'Old', 'New',
  'Dark', 'Bright', 'Deep', 'Long', 'Fair', 'Cold', 'Warm', 'Wild',
];

/** Settlement name suffixes */
const SETTLEMENT_SUFFIXES = [
  'haven', 'hold', 'stead', 'gate', 'ford', 'bridge', 'burgh', 'ton',
  'dale', 'vale', 'field', 'wood', 'moor', 'wick', 'mere', 'marsh',
  'crest', 'peak', 'fall', 'reach', 'watch', 'guard', 'wall', 'helm',
  'keep', 'rock', 'port', 'bay', 'cove', 'shore', 'cross', 'way',
];

/** Country name templates */
const COUNTRY_NAMES = [
  'Kingdom of {name}', 'Realm of {name}', 'Duchy of {name}',
  'Principality of {name}', 'Dominion of {name}', '{name}',
  'The {adj} Kingdom', 'Land of {name}', 'Free City of {name}',
];

const COUNTRY_ADJECTIVES = [
  'Northern', 'Southern', 'Eastern', 'Western', 'United', 'Holy',
  'Grand', 'Great', 'Ancient', 'Iron', 'Golden', 'Silver',
];

const COUNTRY_BASE_NAMES = [
  'Valderia', 'Aethelmark', 'Norheim', 'Sunreach', 'Frostholme',
  'Thornwall', 'Ashenmoor', 'Brightwind', 'Ironvale', 'Goldcrest',
  'Ravenshire', 'Stormhold', 'Deepwood', 'Highreach', 'Westmarch',
  'Silverkeep', 'Darkhollow', 'Greenholme', 'Redspire', 'Whitecliff',
];

/** Dragon names */
const DRAGON_NAMES = [
  'Pyraxis', 'Vorthrun', 'Ashenwing', 'Glacius', 'Thundermaw',
  'Nightfang', 'Emberclaw', 'Stormscale', 'Dreadfire', 'Shadowcoil',
  'Ironhide', 'Frostbite', 'Cinderjaw', 'Deathwing', 'Silvanus',
];

export function generateMaleName(rng: SeededRandom): string {
  return `${rng.pick(MALE_NAMES)} ${rng.pick(SURNAMES)}`;
}

export function generateFemaleName(rng: SeededRandom): string {
  return `${rng.pick(FEMALE_NAMES)} ${rng.pick(SURNAMES)}`;
}

export function generateCharacterName(rng: SeededRandom, gender: 'male' | 'female'): string {
  return gender === 'male' ? generateMaleName(rng) : generateFemaleName(rng);
}

export function generateSettlementName(rng: SeededRandom): string {
  return `${rng.pick(SETTLEMENT_PREFIXES)}${rng.pick(SETTLEMENT_SUFFIXES)}`;
}

export function generateCountryName(rng: SeededRandom): string {
  const template = rng.pick(COUNTRY_NAMES);
  const baseName = rng.pick(COUNTRY_BASE_NAMES);
  const adj = rng.pick(COUNTRY_ADJECTIVES);
  return template.replace('{name}', baseName).replace('{adj}', adj);
}

export function generateDragonName(rng: SeededRandom): string {
  return rng.pick(DRAGON_NAMES);
}
