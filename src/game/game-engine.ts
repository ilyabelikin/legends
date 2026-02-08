import type { GameState, Party, ViewMode, EventLogEntry } from '../types/game';
import type { World } from '../types/world';
import type { Character } from '../types/character';
import type { Location } from '../types/location';
import type { Creature } from '../types/creature';
import type { Item } from '../types/item';
import { generateWorld, type WorldGenConfig, DEFAULT_WORLD_CONFIG } from '../world/world-generator';
import { getSeasonFromTurn, getYearFromTurn } from '../types/season';
import { advanceTurn } from './turn-manager';
import { SeededRandom, generateId } from '../utils/random';
import { isWater } from '../world/terrain-generator';
import { BIOME_DEFINITIONS } from '../data/biome-data';
import { RESOURCE_DEFINITIONS } from '../data/resource-data';
import type { BiomeType } from '../types/biome';
import { manhattanDist, inBounds } from '../utils/math';
import { findPath } from '../utils/pathfinding';
import { getMovementCost, getMovementPointCost } from '../utils/movement-cost';
import { discoverNewsAtSettlement } from './news-system';
import { createCharacter } from '../entities/character-factory';

/**
 * The main game engine. Manages state and player interactions.
 */
export class GameEngine {
  state: GameState;
  private rng: SeededRandom;

  constructor() {
    this.state = null!;
    this.rng = new SeededRandom(0);
  }

  /** Initialize a new game with world generation */
  newGame(config?: Partial<WorldGenConfig>, onProgress?: (phase: string, progress: number) => void): void {
    const fullConfig = { ...DEFAULT_WORLD_CONFIG, ...config };
    this.rng = new SeededRandom(fullConfig.seed);

    onProgress?.('Generating world...', 0);
    const world = generateWorld(fullConfig, onProgress);

    // Create the player's adventurer
    const startPos = this.findStartPosition(world);
    const adventurer = createCharacter(this.rng, startPos, null, 'adventurer');
    adventurer.name = 'The Adventurer';
    adventurer.stats.strength = 8;
    adventurer.stats.dexterity = 7;
    adventurer.stats.intelligence = 6;
    adventurer.stats.charisma = 6;
    adventurer.stats.endurance = 8;
    adventurer.health = 100;
    adventurer.maxHealth = 100;
    adventurer.gold = 50;
    adventurer.skills['combat'] = 25;
    adventurer.skills['survival'] = 20;
    adventurer.skills['trading'] = 10;

    // Give starting equipment
    const startSword: Item = {
      definitionId: 'iron_sword',
      instanceId: generateId('item'),
      name: 'Worn Iron Sword',
      ownerId: adventurer.id,
      condition: 'worn',
      rarity: 'common',
      enchantments: [],
      attuned: false,
      attunedToId: null,
      createdBy: null,
      history: ['Found in an old chest.'],
      currentDurability: 60,
      maxDurability: 100,
      type: 'weapon',
      attack: 7,
      defense: 0,
      speed: 5,
      weight: 3,
      value: 18,
    };
    adventurer.equippedWeapon = startSword;
    adventurer.inventory.push(startSword);

    const startArmor: Item = {
      definitionId: 'leather_armor',
      instanceId: generateId('item'),
      name: 'Leather Vest',
      ownerId: adventurer.id,
      condition: 'good',
      rarity: 'common',
      enchantments: [],
      attuned: false,
      attunedToId: null,
      createdBy: null,
      history: [],
      currentDurability: 65,
      maxDurability: 80,
      type: 'armor',
      attack: 0,
      defense: 3,
      speed: -1,
      weight: 5,
      value: 15,
    };
    adventurer.equippedArmor = startArmor;
    adventurer.inventory.push(startArmor);

    // Create initial party
    const party: Party = {
      members: [adventurer],
      position: { ...startPos },
      inventory: [],
      gold: 50,
      reputation: {},
      actionPoints: 6,
      maxActionPoints: 6,
      queuedPath: [],
    };

    // Initialize game state
    this.state = {
      world,
      turn: 0,
      season: 'spring',
      weather: 'clear',
      party,
      activeEvents: [],
      worldEvents: [],
      knownEventIds: new Set(),
      eventLog: [{
        turn: 0,
        message: `Your adventure begins in the world of legends. Explore, trade, and survive!`,
        type: 'system',
      }],
      gameOver: false,
      isPaused: false,
      selectedTile: null,
      viewMode: 'world',
    };

    // Set initial visibility
    this.updateVisibility();

    // Log start location info
    this.addLog(`You stand at the edge of civilization. The world awaits.`, 'system');
    this.describeCurrentLocation();
  }

  /** Find a good starting position for the player */
  private findStartPosition(world: World): { x: number; y: number } {
    // Start near a town
    const towns = Array.from(world.locations.values())
      .filter(l => l.type === 'town' || l.type === 'village')
      .sort((a, b) => b.residentIds.length - a.residentIds.length);

    if (towns.length > 0) {
      const town = towns[0];
      // Find a walkable tile adjacent to town
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = town.position.x + dx;
          const ny = town.position.y + dy;
          if (nx >= 0 && nx < world.width && ny >= 0 && ny < world.height) {
            const tile = world.tiles[ny][nx];
            if (!isWater(tile.terrainType) && !tile.locationId) {
              return { x: nx, y: ny };
            }
          }
        }
      }
      return town.position;
    }

    // Fallback: find any land tile near center
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    for (let r = 0; r < 20; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < world.width && ny >= 0 && ny < world.height) {
            if (!isWater(world.tiles[ny][nx].terrainType)) {
              return { x: nx, y: ny };
            }
          }
        }
      }
    }

    return { x: cx, y: cy };
  }

  /** Move the party in a direction */
  moveParty(dx: number, dy: number): boolean {
    const { party, world } = this.state;
    const newX = party.position.x + dx;
    const newY = party.position.y + dy;

    if (!inBounds({ x: newX, y: newY }, world.width, world.height)) return false;

    const tile = world.tiles[newY][newX];
    if (isWater(tile.terrainType)) {
      this.addLog('The way is blocked by water.', 'system');
      return false;
    }

    // Movement cost — biome base reduced by road level
    const moveCost = getMovementPointCost(tile);

    if (party.actionPoints < moveCost) {
      this.addLog('Not enough action points. End your turn.', 'system');
      return false;
    }

    party.actionPoints -= moveCost;
    party.position.x = newX;
    party.position.y = newY;

    // Update party member positions
    for (const member of party.members) {
      member.position = { ...party.position };
    }

    this.updateVisibility();
    this.describeCurrentLocation();

    // Check for encounters
    this.checkEncounters();

    return true;
  }

  /**
   * Set a movement target — compute the path and queue it.
   * The party will walk one step at a time via tickPartyMovement().
   */
  movePartyToward(targetX: number, targetY: number): boolean {
    const { party, world } = this.state;

    // Already there
    if (party.position.x === targetX && party.position.y === targetY) {
      party.queuedPath = [];
      return false;
    }

    // Find path — A* naturally prefers roads (lower cost)
    const path = findPath(
      party.position,
      { x: targetX, y: targetY },
      world.width,
      world.height,
      (x, y) => getMovementCost(world.tiles[y][x]),
    );

    if (path.length < 2) {
      this.addLog('No path to that location.', 'system');
      return false;
    }

    // Store the remaining steps (skip index 0 which is the current position)
    party.queuedPath = path.slice(1);
    return true;
  }

  /**
   * Advance the party one step along its queued path.
   * Called from the game loop each frame (with a delay between steps).
   * Returns true if a step was taken.
   */
  tickPartyMovement(): boolean {
    const { party } = this.state;
    if (party.queuedPath.length === 0) return false;

    const next = party.queuedPath[0];
    const dx = next.x - party.position.x;
    const dy = next.y - party.position.y;

    if (this.moveParty(dx, dy)) {
      party.queuedPath.shift();
      return true;
    }

    // Step failed (out of MP, water, etc.) — clear remaining path
    party.queuedPath = [];
    return false;
  }

  /** Cancel any queued movement */
  cancelMovement(): void {
    this.state.party.queuedPath = [];
  }

  /** End the player's turn and advance the world */
  endTurn(): void {
    advanceTurn(this.state);
  }

  /** Rest — costs 2 AP. Better healing at settlements. */
  rest(): boolean {
    const { party, world } = this.state;
    const restCost = 2;

    if (party.actionPoints < restCost) {
      this.addLog('Not enough action points to rest.', 'system');
      return false;
    }

    party.actionPoints -= restCost;

    const tile = world.tiles[party.position.y]?.[party.position.x];
    const loc = tile?.locationId ? world.locations.get(tile.locationId) : null;

    if (!loc || loc.isDestroyed) {
      // Camping in the wild — partial rest
      for (const member of party.members) {
        member.health = Math.min(member.maxHealth, member.health + 5);
      }
      this.addLog('You camp in the wilderness. Some health restored.', 'info');
      return true;
    }

    // Full rest at settlement
    const hasTavern = loc.buildings.some(b => b.type === 'tavern' && b.isOperational);
    const healAmount = hasTavern ? 25 : 15;

    for (const member of party.members) {
      member.health = Math.min(member.maxHealth, member.health + healAmount);
      member.needs.food = Math.min(100, member.needs.food + 20);
      member.needs.shelter = Math.min(100, member.needs.shelter + 40);
    }

    if (hasTavern) {
      this.addLog(`You rest at the tavern in ${loc.name}. Health and spirits restored!`, 'social', loc.id);
      if (party.gold >= 2) party.gold -= 2;
    } else {
      this.addLog(`You rest in ${loc.name}. Health restored.`, 'info', loc.id);
    }

    return true;
  }

  /** Preview what food is available and at what price. Returns null if nothing. */
  previewBuyFood(): { foodId: string; price: number; stock: number; locName: string; isExpensive: boolean } | null {
    const { party, world } = this.state;

    if (party.actionPoints < 1) return null;

    const tile = world.tiles[party.position.y]?.[party.position.x];
    if (!tile?.locationId) return null;

    const loc = world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) return null;

    const canTrade = loc.buildings.some(
      b => b.isOperational && (b.type === 'market' || b.type === 'tavern' || b.type === 'dock'),
    );
    if (!canTrade) return null;

    const foodTypes = ['bread', 'meat', 'fish', 'berries', 'wheat', 'exotic_fruit'];
    for (const foodId of foodTypes) {
      const stackIdx = loc.storage.findIndex(s => s.resourceId === foodId && s.quantity > 0);
      if (stackIdx >= 0) {
        const stock = loc.storage[stackIdx].quantity;
        const price = loc.marketPrices[foodId] ?? 3;
        const def = RESOURCE_DEFINITIONS[foodId];
        const isExpensive = def ? price >= def.baseValue * 2 : false;
        return { foodId, price, stock, locName: loc.name, isExpensive };
      }
    }
    return null;
  }

  /** Execute the food purchase (call after preview/confirmation). */
  buyFood(): boolean {
    const { party, world } = this.state;

    if (party.actionPoints < 1) {
      this.addLog('Not enough action points.', 'system');
      return false;
    }

    const tile = world.tiles[party.position.y]?.[party.position.x];
    if (!tile?.locationId) {
      this.addLog('There is nowhere to buy food here.', 'system');
      return false;
    }

    const loc = world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) return false;

    const canTrade = loc.buildings.some(
      b => b.isOperational && (b.type === 'market' || b.type === 'tavern' || b.type === 'dock'),
    );
    if (!canTrade) {
      this.addLog(`${loc.name} has no market or tavern to buy food from.`, 'system', loc.id);
      return false;
    }

    const foodTypes = ['bread', 'meat', 'fish', 'berries', 'wheat', 'exotic_fruit'];
    for (const foodId of foodTypes) {
      const stackIdx = loc.storage.findIndex(s => s.resourceId === foodId && s.quantity > 0);
      if (stackIdx >= 0) {
        const price = loc.marketPrices[foodId] ?? 3;
        if (party.gold < price) {
          this.addLog(`Cannot afford ${foodId} — costs ${price}g.`, 'system');
          return false;
        }

        party.actionPoints -= 1;
        party.gold -= price;
        loc.storage[stackIdx].quantity--;
        if (loc.storage[stackIdx].quantity <= 0) loc.storage.splice(stackIdx, 1);

        for (const member of party.members) {
          member.needs.food = Math.min(100, member.needs.food + 25);
        }

        const remaining = loc.storage.find(s => s.resourceId === foodId)?.quantity ?? 0;
        this.addLog(`Bought ${foodId} for ${price}g in ${loc.name} (${remaining} left).`, 'trade', loc.id);
        return true;
      }
    }

    this.addLog(`${loc.name} has no food in stock.`, 'system', loc.id);
    return false;
  }

  /** Check whether the party is at a location where food can be bought */
  canBuyFood(): boolean {
    const tile = this.state.world.tiles[this.state.party.position.y]?.[this.state.party.position.x];
    if (!tile?.locationId) return false;
    const loc = this.state.world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) return false;
    return loc.buildings.some(
      b => b.isOperational && (b.type === 'market' || b.type === 'tavern' || b.type === 'dock'),
    );
  }

  /** Check whether the party is at any settlement (for rest display) */
  isAtSettlement(): boolean {
    const tile = this.state.world.tiles[this.state.party.position.y]?.[this.state.party.position.x];
    if (!tile?.locationId) return false;
    const loc = this.state.world.locations.get(tile.locationId);
    return !!loc && !loc.isDestroyed;
  }

  /** Get the current settlement the party is at (or null) */
  getCurrentLocation(): Location | null {
    const { party, world } = this.state;
    const tile = world.tiles[party.position.y]?.[party.position.x];
    if (!tile?.locationId) return null;
    return world.locations.get(tile.locationId) ?? null;
  }

  /** Check for encounters at the party's position */
  private checkEncounters(): void {
    const { party, world } = this.state;
    const pos = party.position;

    // Check for creatures
    for (const creature of world.creatures.values()) {
      if (creature.position.x === pos.x && creature.position.y === pos.y) {
        if (creature.isHostile) {
          this.addLog(`You encounter hostile ${creature.name ?? creature.type}!`, 'combat');
          this.initiateCombat(creature);
        } else {
          this.addLog(`You spot a group of ${creature.type} nearby.`, 'info');
        }
      }
    }
  }

  /** Start combat with a creature */
  private initiateCombat(creature: Creature): void {
    const party = this.state.party;
    const leader = party.members[0];
    if (!leader) return;

    // Simple auto-combat for now
    let partyHP = leader.health;
    let creatureHP = creature.health;

    const partyAttack = (leader.stats.strength + (leader.equippedWeapon?.attack ?? 0)) * 2;
    const partyDefense = leader.stats.endurance + (leader.equippedArmor?.defense ?? 0);
    const creatureAttack = creature.attack;
    const creatureDefense = creature.defense;

    let rounds = 0;
    while (partyHP > 0 && creatureHP > 0 && rounds < 20) {
      rounds++;
      // Party attacks
      const partyDmg = Math.max(1, partyAttack - creatureDefense + Math.floor(Math.random() * 4) - 2);
      creatureHP -= partyDmg;

      // Creature attacks
      if (creatureHP > 0) {
        const creatureDmg = Math.max(1, creatureAttack - partyDefense + Math.floor(Math.random() * 4) - 2);
        partyHP -= creatureDmg;
      }
    }

    if (creatureHP <= 0) {
      this.addLog(`You defeated the ${creature.name ?? creature.type}!`, 'combat');
      creature.health = 0;
      // Collect loot
      for (const loot of creature.loot) {
        this.addLog(`Obtained ${loot.quantity} ${loot.resourceId}.`, 'info');
      }
      // XP gain — improve combat skill
      leader.skills['combat'] = Math.min(100, (leader.skills['combat'] ?? 0) + 2);
    } else {
      this.addLog(`The ${creature.name ?? creature.type} drove you back! You took heavy damage.`, 'danger');
    }

    leader.health = Math.max(1, partyHP);
  }

  /** Describe what's at the party's current location and discover news */
  private describeCurrentLocation(): void {
    const { party, world } = this.state;
    const tile = world.tiles[party.position.y][party.position.x];

    if (tile.locationId) {
      const loc = world.locations.get(tile.locationId);
      if (loc) {
        this.addLog(`You arrive at ${loc.name} (${loc.type}).`, 'discovery', loc.id);
        if (loc.countryId) {
          const country = world.countries.get(loc.countryId);
          if (country) {
            this.addLog(`This land belongs to the ${country.name}.`, 'info', loc.id);
          }
        }

        // Learn news from this settlement and its surroundings
        discoverNewsAtSettlement(this.state);
      }
    }

    if (tile.resourceDeposit) {
      this.addLog(`You notice deposits of ${tile.resourceDeposit.resourceId} here.`, 'discovery');
    }
  }

  /** Update visibility around party */
  private updateVisibility(): void {
    const { world, party } = this.state;
    const radius = 6;

    // Clear visibility
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        world.tiles[y][x].visible = false;
      }
    }

    // Set visible around party
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const nx = party.position.x + dx;
        const ny = party.position.y + dy;
        if (nx >= 0 && nx < world.width && ny >= 0 && ny < world.height) {
          world.tiles[ny][nx].visible = true;
          world.tiles[ny][nx].explored = true;
        }
      }
    }
  }

  /** Get info about a specific tile */
  getTileInfo(x: number, y: number): string[] {
    const { world } = this.state;
    if (!inBounds({ x, y }, world.width, world.height)) return [];

    const tile = world.tiles[y][x];
    const info: string[] = [];
    const biomeDef = BIOME_DEFINITIONS[tile.biome as BiomeType];

    info.push(`${biomeDef?.name ?? tile.biome} (${x}, ${y})`);
    info.push(`Elevation: ${Math.round(tile.elevation * 100)}%`);

    if (tile.resourceDeposit) {
      info.push(`Resource: ${tile.resourceDeposit.resourceId} (${tile.resourceDeposit.amount})`);
    }

    if (tile.locationId) {
      const loc = world.locations.get(tile.locationId);
      if (loc) {
        info.push(`${loc.name} — ${loc.type}`);
        info.push(`Population: ${loc.residentIds.length}`);
        info.push(`Prosperity: ${Math.round(loc.prosperity)}`);
        info.push(`Safety: ${Math.round(loc.safety)}`);
        if (loc.countryId) {
          const country = world.countries.get(loc.countryId);
          if (country) info.push(`Country: ${country.name}`);
        }
        // Show key goods and prices
        const goods = loc.storage
          .filter(s => s.quantity > 0)
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 4);
        if (goods.length > 0) {
          info.push(`Stock:`);
          for (const g of goods) {
            const price = loc.marketPrices[g.resourceId] ?? '?';
            info.push(`  ${g.resourceId}: ${g.quantity} (${price}g)`);
          }
        }
      }
    }

    // Check if this tile is a working site for a nearby settlement
    if (!tile.locationId) {
      for (const loc of world.locations.values()) {
        if (loc.isDestroyed) continue;
        const dx = Math.abs(loc.position.x - x);
        const dy = Math.abs(loc.position.y - y);
        if (dx > 1 || dy > 1) continue; // only immediate neighbors
        if (dx === 0 && dy === 0) continue; // that's the settlement itself

        const hasFarms = loc.buildings.some(b => b.type === 'farm_field' && b.isOperational);
        const hasMines = loc.buildings.some(b => b.type === 'mine_shaft' && b.isOperational);
        const hasSawmill = loc.buildings.some(b => (b.type === 'sawmill' || b.type === 'hunter_lodge') && b.isOperational);

        if (hasFarms && (tile.biome === 'grassland' || tile.biome === 'savanna' || tile.biome === 'forest')) {
          info.push(`Wheat fields (${loc.name})`);
        } else if (hasMines && (tile.biome === 'hills' || tile.biome === 'mountain')) {
          info.push(`Mine workings (${loc.name})`);
        } else if (hasSawmill && (tile.biome === 'forest' || tile.biome === 'dense_forest')) {
          info.push(`Lumber site (${loc.name})`);
        }
      }
    }

    // Creatures on this tile (only if visible)
    if (tile.visible) {
      for (const creature of world.creatures.values()) {
        if (creature.position.x === x && creature.position.y === y && creature.health > 0) {
          const label = creature.name ?? creature.type;
          const hostile = creature.isHostile ? ' (hostile)' : '';
          info.push(`Creature: ${label}${hostile}`);
          info.push(`  HP: ${Math.round(creature.health)}/${creature.maxHealth}`);
        }
      }
    }

    if (tile.roadLevel > 0) {
      const roadNames = ['', 'Path', 'Road', 'Highway'];
      info.push(`Road: ${roadNames[tile.roadLevel]}`);
    }

    return info;
  }

  /** Get the current game year and season info */
  getDateString(): string {
    const year = getYearFromTurn(this.state.turn);
    const season = this.state.season;
    return `Year ${year}, ${season.charAt(0).toUpperCase() + season.slice(1)} — Day ${this.state.turn % 90 + 1}`;
  }

  /** Add a log entry, optionally linked to a location */
  addLog(message: string, type: EventLogEntry['type'], locationId?: string): void {
    this.state.eventLog.push({
      turn: this.state.turn,
      message,
      type,
      locationId,
    });
    if (this.state.eventLog.length > 200) {
      this.state.eventLog = this.state.eventLog.slice(-150);
    }
  }
}
