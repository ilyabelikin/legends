import type { Tile, Position } from '../types/terrain';
import type { Location, LocationType, Building } from '../types/location';
import type { ResourceStack, StorageType } from '../types/resource';
import type { BiomeType } from '../types/biome';
import { BIOME_DEFINITIONS } from '../data/biome-data';
import { SeededRandom, generateId } from '../utils/random';
import { euclideanDist } from '../utils/math';
import { generateSettlementName } from '../data/name-data';

/** Minimum distance between settlements */
const MIN_SETTLEMENT_DISTANCE = 6;

/** Maximum settlements to generate (scales with world size) */
const MAX_SETTLEMENTS = 120;

/** Score a tile for settlement desirability */
function scoreTileForSettlement(tile: Tile, tiles: Tile[][], width: number, height: number): number {
  const biomeDef = BIOME_DEFINITIONS[tile.biome as BiomeType];
  if (!biomeDef || !biomeDef.canBuildSettlement) return 0;

  let score = 0;

  // Flat land is preferred (elevation is 0-14)
  // Lowland (4-7) is ideal, highland (8-9) is acceptable
  if (tile.elevation >= 4 && tile.elevation <= 7) score += 3;
  else if (tile.elevation >= 8 && tile.elevation <= 9) score += 1;

  // Near water is good
  let nearWater = false;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const neighborTerrain = tiles[ny][nx].terrainType;
        if (neighborTerrain === 'shallow_ocean' || neighborTerrain === 'coast') {
          nearWater = true;
        }
      }
    }
  }
  if (nearWater) score += 3;

  // Resources nearby are valuable
  let resourceScore = 0;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const dep = tiles[ny][nx].resourceDeposit;
        if (dep) resourceScore += dep.amount * 0.01;
      }
    }
  }
  score += Math.min(resourceScore, 5);

  // Good biomes score higher
  if (tile.biome === 'grassland') score += 2;
  if (tile.biome === 'forest') score += 1;
  if (tile.biome === 'hills') score += 1;
  if (tile.biome === 'beach') score += 1;

  // Moderate climate preferred
  if (tile.temperature > 0.3 && tile.temperature < 0.7) score += 1;

  return score;
}

/** Determine location type based on surroundings */
function determineLocationType(
  tile: Tile,
  tiles: Tile[][],
  width: number,
  height: number,
  rng: SeededRandom,
): LocationType {
  // Coastal → fishing village or port
  let isCoastal = false;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (tiles[ny][nx].terrainType === 'shallow_ocean') isCoastal = true;
      }
    }
  }

  if (isCoastal && rng.chance(0.3)) return 'fishing_village';

  // Near mountains with ore → mine
  if (tile.resourceDeposit?.resourceId === 'iron_ore' ||
      tile.resourceDeposit?.resourceId === 'gold_ore' ||
      tile.resourceDeposit?.resourceId === 'coal') {
    if (rng.chance(0.2)) return 'mine';
  }

  // Grassland → farm or hamlet
  if (tile.biome === 'grassland' && rng.chance(0.2)) return 'farm';

  // Forest → lumber camp
  if ((tile.biome === 'forest' || tile.biome === 'dense_forest') && rng.chance(0.15)) {
    return 'lumber_camp';
  }

  // Default to hamlet/homestead
  return rng.chance(0.5) ? 'hamlet' : 'homestead';
}

/** Create initial buildings for a location */
function createInitialBuildings(type: LocationType, rng: SeededRandom): Building[] {
  const buildings: Building[] = [];

  const addBuilding = (bType: Building['type'], level = 1) => {
    buildings.push({
      type: bType,
      level,
      condition: 80 + rng.nextInt(0, 20),
      workerId: null,
      isOperational: true,
    });
  };

  switch (type) {
    case 'homestead':
      for (let i = 0; i < rng.nextInt(1, 3); i++) addBuilding('house');
      addBuilding('farm_field');
      break;
    case 'hamlet':
      for (let i = 0; i < rng.nextInt(6, 10); i++) addBuilding('house');
      addBuilding('farm_field');
      if (rng.chance(0.5)) addBuilding('hunter_lodge');
      break;
    case 'village':
      for (let i = 0; i < rng.nextInt(15, 25); i++) addBuilding('house');
      for (let i = 0; i < 2; i++) addBuilding('farm_field');
      addBuilding('market');
      addBuilding('tavern');
      if (rng.chance(0.5)) addBuilding('blacksmith');
      if (rng.chance(0.4)) addBuilding('church');
      break;
    case 'town':
      for (let i = 0; i < rng.nextInt(30, 50); i++) addBuilding('house');
      for (let i = 0; i < 3; i++) addBuilding('farm_field');
      addBuilding('market');
      addBuilding('tavern');
      addBuilding('blacksmith');
      addBuilding('church');
      addBuilding('barracks');
      addBuilding('warehouse');
      addBuilding('wall');
      if (rng.chance(0.5)) addBuilding('guild_hall');
      if (rng.chance(0.5)) addBuilding('bakery');
      break;
    case 'city':
      for (let i = 0; i < rng.nextInt(60, 100); i++) addBuilding('house');
      for (let i = 0; i < 2; i++) addBuilding('market');
      addBuilding('tavern');
      addBuilding('blacksmith');
      addBuilding('church');
      addBuilding('barracks');
      for (let i = 0; i < 2; i++) addBuilding('warehouse');
      addBuilding('wall', 2);
      addBuilding('guild_hall');
      addBuilding('bakery');
      if (rng.chance(0.6)) addBuilding('apothecary');
      if (rng.chance(0.5)) addBuilding('weaponsmith');
      if (rng.chance(0.5)) addBuilding('armorer');
      break;
    case 'castle':
      // Fortified military settlement
      addBuilding('castle_keep', 2);
      addBuilding('wall', 3); // Strong walls
      for (let i = 0; i < 2; i++) addBuilding('barracks', 2);
      for (let i = 0; i < rng.nextInt(15, 30); i++) addBuilding('house');
      addBuilding('warehouse');
      addBuilding('blacksmith');
      addBuilding('weaponsmith');
      addBuilding('armorer');
      addBuilding('stable');
      if (rng.chance(0.6)) addBuilding('church');
      if (rng.chance(0.4)) addBuilding('tavern');
      break;
    case 'farm':
      for (let i = 0; i < rng.nextInt(2, 4); i++) addBuilding('house');
      for (let i = 0; i < rng.nextInt(2, 4); i++) addBuilding('farm_field');
      break;
    case 'mine':
      for (let i = 0; i < rng.nextInt(3, 6); i++) addBuilding('house');
      addBuilding('mine_shaft');
      if (rng.chance(0.4)) addBuilding('smelter');
      break;
    case 'lumber_camp':
      for (let i = 0; i < rng.nextInt(2, 5); i++) addBuilding('house');
      addBuilding('sawmill');
      break;
    case 'fishing_village':
      for (let i = 0; i < rng.nextInt(8, 15); i++) addBuilding('house');
      addBuilding('dock');
      if (rng.chance(0.4)) addBuilding('tavern');
      break;
    case 'port':
      // Large coastal trading hub
      for (let i = 0; i < rng.nextInt(25, 40); i++) addBuilding('house');
      for (let i = 0; i < rng.nextInt(2, 4); i++) addBuilding('dock');
      for (let i = 0; i < 2; i++) addBuilding('warehouse');
      addBuilding('market');
      addBuilding('tavern');
      addBuilding('blacksmith');
      if (rng.chance(0.6)) addBuilding('guild_hall');
      if (rng.chance(0.5)) addBuilding('church');
      if (rng.chance(0.4)) addBuilding('barracks');
      break;
    default:
      addBuilding('house');
      break;
  }

  return buildings;
}

/**
 * Place settlements throughout the world.
 * Returns a map of location ID → Location.
 */
export function placeSettlements(
  tiles: Tile[][],
  width: number,
  height: number,
  rng: SeededRandom,
): Map<string, Location> {
  const locations = new Map<string, Location>();
  const placed: Position[] = [];

  // Score all tiles
  const scores: { x: number; y: number; score: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const score = scoreTileForSettlement(tiles[y][x], tiles, width, height);
      if (score > 0) scores.push({ x, y, score });
    }
  }

  // Sort by score (best first) with some randomization
  scores.sort((a, b) => (b.score + rng.next() * 2) - (a.score + rng.next() * 2));

  for (const candidate of scores) {
    if (locations.size >= MAX_SETTLEMENTS) break;

    // Check minimum distance from existing settlements
    const tooClose = placed.some(p =>
      euclideanDist(p, candidate) < MIN_SETTLEMENT_DISTANCE
    );
    if (tooClose) continue;

    const tile = tiles[candidate.y][candidate.x];
    const locType = determineLocationType(tile, tiles, width, height, rng);

    // Upgrade some to larger settlements
    let finalType = locType;
    
    // Check if location is defensible (good for castles) - elevated or hilly terrain
    const isDefensible = tile.elevation >= 6 || tile.biome === 'hills' || tile.biome === 'mountains';
    
    // Check if this is a basic settlement that can be upgraded
    const canUpgrade = (locType === 'hamlet' || locType === 'homestead' || 
                       locType === 'farm' || locType === 'mine' || locType === 'lumber_camp');
    
    // First settlements become major cities/towns/castles
    if (locations.size < 2 && canUpgrade) {
      // First 2 settlements: mix of castles and cities
      if (isDefensible && rng.chance(0.5)) {
        finalType = 'castle';
      } else {
        finalType = 'city';
      }
    } else if (locations.size < 12 && canUpgrade) {
      // Next 10 settlements: mix of towns, cities, and castles
      if (isDefensible && rng.chance(0.4)) {
        finalType = 'castle';
      } else if (rng.chance(0.25)) {
        finalType = 'city';
      } else {
        finalType = 'town';
      }
    } else if (locations.size < 25 && canUpgrade) {
      // Settlements 13-25: towns, villages, and castles
      if (isDefensible && rng.chance(0.3)) {
        finalType = 'castle';
      } else if (rng.chance(0.35)) {
        finalType = 'village';
      } else if (rng.chance(0.5)) {
        finalType = 'town';
      }
    } else if (locations.size < 40 && (locType === 'hamlet' || locType === 'homestead')) {
      // Later settlements: occasional villages
      if (rng.chance(0.4)) {
        finalType = 'village';
      }
    }

    const id = generateId('loc');
    const name = generateSettlementName(rng);
    const buildings = createInitialBuildings(finalType, rng);
    const houseCount = buildings.filter(b => b.type === 'house').length;

    const location: Location = {
      id,
      name,
      type: finalType,
      position: { x: candidate.x, y: candidate.y },
      size: houseCount,
      populationCapacity: houseCount * 6, // Increased from 4 to support larger populations
      residentIds: [],
      buildings,
      productionSites: [],
      storage: getInitialStorage(finalType, rng),
      storageCapacity: {
        none: 200,
        dry: 100,
        cold: 30,
        secure: 20,
      },
      tradeRouteIds: [],
      marketPrices: {},
      defenseLevel: finalType === 'castle' ? 5 : finalType === 'city' ? 4 : finalType === 'town' ? 3 : finalType === 'port' ? 2 : finalType === 'village' ? 1 : 0,
      wallLevel: finalType === 'castle' ? 3 : finalType === 'city' ? 2 : finalType === 'town' ? 1 : finalType === 'port' ? 1 : 0,
      garrisonIds: [],
      ownerId: null,
      countryId: null,
      prosperity: 50 + rng.nextInt(-10, 10),
      safety: 60 + rng.nextInt(-10, 10),
      happiness: 50 + rng.nextInt(-5, 5),
      foundedTurn: 0,
      isDestroyed: false,
      growthPoints: 0,
      durability: finalType === 'castle' ? 120 : finalType === 'city' ? 100 : finalType === 'town' ? 80 : finalType === 'port' ? 70 : finalType === 'village' ? 60 : 40,
      originalType: null,
      burningTurns: 0,
    };

    locations.set(id, location);
    tile.locationId = id;
    placed.push({ x: candidate.x, y: candidate.y });
  }

  return locations;
}

/**
 * Generate initial resource stocks for a location.
 * Cities/castles get large stockpiles but NO farm fields —
 * they depend on trade for food resupply.
 * Villages/farms/fishing villages are food PRODUCERS.
 */
function getInitialStorage(type: LocationType, rng: SeededRandom): ResourceStack[] {
  const storage: ResourceStack[] = [];
  const add = (id: string, qty: number) => {
    storage.push({ resourceId: id, quantity: Math.round(qty), quality: 0.7, age: 0 });
  };

  switch (type) {
    case 'city':
      // Large stockpile but will drain fast without trade
      add('bread', rng.nextInt(40, 60));
      add('meat', rng.nextInt(15, 25));
      add('wheat', rng.nextInt(20, 35));
      add('ale', rng.nextInt(15, 25));
      add('wood', rng.nextInt(15, 30));
      add('stone', rng.nextInt(10, 20));
      add('iron_ore', rng.nextInt(5, 15));
      add('tools', rng.nextInt(5, 12));
      add('fabric', rng.nextInt(5, 10));
      add('weapons', rng.nextInt(2, 6));
      add('armor', rng.nextInt(1, 3));
      break;
    case 'town':
      add('bread', rng.nextInt(25, 40));
      add('wheat', rng.nextInt(15, 25));
      add('meat', rng.nextInt(8, 15));
      add('ale', rng.nextInt(8, 15));
      add('wood', rng.nextInt(10, 25));
      add('stone', rng.nextInt(5, 15));
      add('tools', rng.nextInt(3, 8));
      add('fabric', rng.nextInt(2, 6));
      if (rng.chance(0.4)) add('weapons', rng.nextInt(1, 4));
      break;
    case 'castle':
      add('bread', rng.nextInt(30, 50));
      add('meat', rng.nextInt(15, 25));
      add('ale', rng.nextInt(10, 20));
      add('weapons', rng.nextInt(5, 10));
      add('armor', rng.nextInt(3, 6));
      add('stone', rng.nextInt(10, 20));
      add('tools', rng.nextInt(3, 6));
      break;
    case 'village':
      add('wheat', rng.nextInt(15, 25));
      add('bread', rng.nextInt(8, 15));
      add('wood', rng.nextInt(8, 15));
      add('tools', rng.nextInt(1, 4));
      break;
    case 'hamlet':
    case 'homestead':
      add('wheat', rng.nextInt(8, 15));
      add('wood', rng.nextInt(3, 10));
      break;
    case 'farm':
      add('wheat', rng.nextInt(20, 40));
      add('sheep', rng.nextInt(3, 8));
      add('bread', rng.nextInt(5, 10));
      break;
    case 'mine':
      add('iron_ore', rng.nextInt(10, 25));
      add('coal', rng.nextInt(8, 15));
      add('stone', rng.nextInt(8, 15));
      add('bread', rng.nextInt(5, 10));
      break;
    case 'lumber_camp':
      add('wood', rng.nextInt(20, 40));
      add('wheat', rng.nextInt(5, 10));
      break;
    case 'fishing_village':
      add('fish', rng.nextInt(10, 25));
      add('wheat', rng.nextInt(3, 8));
      break;
    case 'port':
      add('fish', rng.nextInt(15, 30));
      add('bread', rng.nextInt(10, 15));
      add('ale', rng.nextInt(5, 12));
      add('tools', rng.nextInt(2, 5));
      break;
    default:
      add('wheat', rng.nextInt(3, 8));
      break;
  }

  return storage;
}
