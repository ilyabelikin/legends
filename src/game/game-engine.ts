import type { GameState, Party, ViewMode, EventLogEntry } from "../types/game";
import type { World } from "../types/world";
import type { Character } from "../types/character";
import type { Location } from "../types/location";
import type { Creature } from "../types/creature";
import type { Item } from "../types/item";
import {
  generateWorld,
  type WorldGenConfig,
  DEFAULT_WORLD_CONFIG,
} from "../world/world-generator";
import { getSeasonFromTurn, getYearFromTurn } from "../types/season";
import { advanceTurn } from "./turn-manager";
import { SeededRandom, generateId } from "../utils/random";
import { isWater } from "../world/terrain-generator";
import { BIOME_DEFINITIONS } from "../data/biome-data";
import { RESOURCE_DEFINITIONS } from "../data/resource-data";
import type { BiomeType } from "../types/biome";
import { manhattanDist, inBounds } from "../utils/math";
import { findPath } from "../utils/pathfinding";
import { getMovementCost, getMovementPointCost } from "../utils/movement-cost";
import { discoverNewsAtSettlement } from "./news-system";
import { createCharacter } from "../entities/character-factory";
import { formatQuantity } from "../utils/format";

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
  newGame(
    config?: Partial<WorldGenConfig>,
    onProgress?: (phase: string, progress: number) => void,
  ): void {
    const fullConfig = { ...DEFAULT_WORLD_CONFIG, ...config };
    this.rng = new SeededRandom(fullConfig.seed);

    onProgress?.("Generating world...", 0);
    const world = generateWorld(fullConfig, onProgress);

    // Create the player's adventurer
    const startPos = this.findStartPosition(world);
    const adventurer = createCharacter(this.rng, startPos, null, "adventurer");
    adventurer.name = "The Adventurer";
    adventurer.stats.strength = 8;
    adventurer.stats.dexterity = 7;
    adventurer.stats.intelligence = 6;
    adventurer.stats.charisma = 6;
    adventurer.stats.endurance = 8;
    adventurer.health = 100;
    adventurer.maxHealth = 100;
    adventurer.gold = 50;
    adventurer.skills["combat"] = 25;
    adventurer.skills["survival"] = 20;
    adventurer.skills["trading"] = 10;

    // Give starting equipment
    const startSword: Item = {
      definitionId: "iron_sword",
      instanceId: generateId("item"),
      name: "Worn Iron Sword",
      ownerId: adventurer.id,
      condition: "worn",
      rarity: "common",
      enchantments: [],
      attuned: false,
      attunedToId: null,
      createdBy: null,
      history: ["Found in an old chest."],
      currentDurability: 60,
      maxDurability: 100,
      type: "weapon",
      attack: 7,
      defense: 0,
      speed: 5,
      weight: 3,
      value: 18,
    };
    adventurer.equippedWeapon = startSword;
    adventurer.inventory.push(startSword);

    const startArmor: Item = {
      definitionId: "leather_armor",
      instanceId: generateId("item"),
      name: "Leather Vest",
      ownerId: adventurer.id,
      condition: "good",
      rarity: "common",
      enchantments: [],
      attuned: false,
      attunedToId: null,
      createdBy: null,
      history: [],
      currentDurability: 65,
      maxDurability: 80,
      type: "armor",
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
      isSailing: false,
    };

    // Initialize game state
    this.state = {
      world,
      turn: 0,
      season: "spring",
      weather: "clear",
      party,
      activeEvents: [],
      worldEvents: [],
      knownEventIds: new Set(),
      eventLog: [
        {
          turn: 0,
          message: `Your adventure begins in the world of legends. Explore, trade, and survive!`,
          type: "system",
        },
      ],
      gameOver: false,
      isPaused: false,
      selectedTile: null,
      viewMode: "world",
      combatAnimation: null,
    };

    // Set initial visibility
    this.updateVisibility();

    // Log start location info
    this.addLog(
      `You stand at the edge of civilization. The world awaits.`,
      "system",
    );
    this.describeCurrentLocation();
  }

  /** Find a good starting position for the player */
  private findStartPosition(world: World): { x: number; y: number } {
    // Start near a town
    const towns = Array.from(world.locations.values())
      .filter((l) => l.type === "town" || l.type === "village")
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

    if (!inBounds({ x: newX, y: newY }, world.width, world.height))
      return false;

    const tile = world.tiles[newY][newX];
    const currentTile = world.tiles[party.position.y][party.position.x];
    const water = isWater(tile.terrainType);
    const pier = tile.features.some((f) => f.type === "pier");

    // === Check elevation difference (prevent climbing cliffs) ===
    // Elevation is now discrete 0-14 levels
    const elevDiff = Math.abs(tile.elevation - currentTile.elevation);
    const MAX_ELEVATION_STEP = 2; // Can't climb more than 2 elevation levels in one step

    // Roads make steep slopes more manageable
    const hasRoad = tile.roadLevel > 0 || currentTile.roadLevel > 0;
    const elevLimit = hasRoad ? 3 : MAX_ELEVATION_STEP;

    if (elevDiff > elevLimit) {
      this.addLog("The terrain is too steep to traverse.", "system");
      return false;
    }

    // === Determine if the move is allowed and its cost ===
    let cost: number;

    if (party.isSailing) {
      // SAILING: can move on water and pier tiles
      if (water || pier) {
        cost = 1;
      } else {
        // Trying to step onto land — allowed only if current tile is a pier
        const currentTile = world.tiles[party.position.y][party.position.x];
        const onPier = currentTile.features.some((f) => f.type === "pier");
        if (onPier) {
          // Disembarking from pier onto adjacent land
          party.isSailing = false;
          cost = getMovementPointCost(tile);
          this.addLog("You disembark at the pier.", "discovery");
        } else {
          this.addLog("You need a pier to disembark.", "system");
          return false;
        }
      }
    } else {
      // WALKING: can move on land and pier tiles; water requires embarking from pier
      if (water && !pier) {
        // Check if we're currently on a pier - if so, auto-embark
        const currentTile = world.tiles[party.position.y][party.position.x];
        const onPier = currentTile.features.some((f) => f.type === "pier");

        if (onPier) {
          // Auto-embark when stepping from pier to water
          const boatCost = 10;
          if (party.gold < boatCost) {
            this.addLog(`You need ${boatCost}g to board a boat.`, "system");
            return false;
          }
          if (party.actionPoints < 1) {
            this.addLog("Not enough action points.", "system");
            return false;
          }

          // Embark and continue with the move
          party.gold -= boatCost;
          party.isSailing = true;
          cost = 1; // Moving onto water after embarking
          this.addLog(
            `You board a boat for ${boatCost}g and set sail.`,
            "discovery",
          );
        } else {
          this.addLog(
            "The way is blocked by water. Find a pier to board a boat.",
            "system",
          );
          return false;
        }
      } else {
        cost = pier ? 1 : getMovementPointCost(tile);
      }
    }

    if (party.actionPoints < cost) {
      this.addLog("Not enough action points. End your turn.", "system");
      return false;
    }
    console.log(
      `[moveParty] Consuming ${cost} AP (before: ${party.actionPoints})`,
    );
    party.actionPoints -= cost;
    console.log(`[moveParty] After: ${party.actionPoints} AP`);

    // === Handle sailing state transitions ===
    if (party.isSailing && !water && !pier) {
      // Stepped onto dry land — disembark
      party.isSailing = false;
      this.addLog("You disembark.", "discovery");
    }

    party.position.x = newX;
    party.position.y = newY;

    for (const member of party.members) {
      member.position = { ...party.position };
    }

    this.updateVisibility();
    this.describeCurrentLocation();
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

    // If the target is adjacent (4-way or 8-way), move directly there without pathfinding
    const dx = Math.abs(targetX - party.position.x);
    const dy = Math.abs(targetY - party.position.y);
    const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    
    if (isAdjacent) {
      // Direct move to adjacent tile - skip pathfinding
      party.queuedPath = [{ x: targetX, y: targetY }];
      return true;
    }

    // Find path — allows both land and water via piers
    // Piers connect land ↔ water; the pathfinder treats them as
    // bridges so the party can sail to a pier and continue on land.
    const path = findPath(
      party.position,
      { x: targetX, y: targetY },
      world.width,
      world.height,
      (x: number, y: number, fromX?: number, fromY?: number) => {
        const t = world.tiles[y][x];
        const water = isWater(t.terrainType);
        const hasPier = t.features.some((f) => f.type === "pier");

        // Check elevation difference from previous tile
        // Elevation is now discrete 0-14 levels
        if (fromX !== undefined && fromY !== undefined) {
          const fromTile = world.tiles[fromY][fromX];
          const elevDiff = Math.abs(t.elevation - fromTile.elevation);
          const MAX_ELEVATION_STEP = 2;
          const hasRoad = t.roadLevel > 0 || fromTile.roadLevel > 0;
          const elevLimit = hasRoad ? 3 : MAX_ELEVATION_STEP;
          if (elevDiff > elevLimit) return Infinity; // Too steep
        }

        // Piers are always passable (cheap transition point)
        if (hasPier) return 1;

        // Water: passable when sailing, or when walking from a pier (to allow auto-embark)
        if (water) {
          if (party.isSailing) return 1;

          // Allow pathfinding to water from a pier (auto-embark will trigger)
          if (fromX !== undefined && fromY !== undefined) {
            const fromTile = world.tiles[fromY][fromX];
            const fromPier = fromTile.features.some((f) => f.type === "pier");
            if (fromPier) return 1; // Allow pier -> water transition
          }

          return Infinity; // Otherwise water is blocked when walking
        }

        // Land: always passable (if sailing, moveParty handles disembark)
        return getMovementCost(t);
      },
    );

    if (path.length < 2) {
      this.addLog("No path to that location.", "system");
      return false;
    }

    // Store the remaining steps (skip index 0 which is the current position)
    party.queuedPath = path.slice(1);
    return true;
  }

  /** Board a boat at a pier tile. Costs gold and 1 AP. */
  embark(): boolean {
    const { party, world } = this.state;
    if (party.isSailing) {
      this.addLog("You are already sailing.", "system");
      return false;
    }

    // Check adjacent tiles for a pier
    const { x: px, y: py } = party.position;
    let pierTile: { x: number; y: number } | null = null;
    const dirs = [
      { dx: 0, dy: 1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 1 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
    ];
    // Also check current tile
    const currentTile = world.tiles[py][px];
    if (currentTile.features.some((f) => f.type === "pier")) {
      pierTile = { x: px, y: py };
    }
    if (!pierTile) {
      for (const d of dirs) {
        const nx = px + d.dx;
        const ny = py + d.dy;
        if (nx >= 0 && nx < world.width && ny >= 0 && ny < world.height) {
          if (world.tiles[ny][nx].features.some((f) => f.type === "pier")) {
            pierTile = { x: nx, y: ny };
            break;
          }
        }
      }
    }

    if (!pierTile) {
      this.addLog("No pier nearby to board a boat.", "system");
      return false;
    }

    const boatCost = 10;
    if (party.gold < boatCost) {
      this.addLog(
        `A boat ride costs ${boatCost}g — you can't afford it.`,
        "system",
      );
      return false;
    }
    if (party.actionPoints < 1) {
      this.addLog("Not enough action points.", "system");
      return false;
    }

    party.gold -= boatCost;
    party.actionPoints -= 1;
    party.isSailing = true;

    // Move party onto the pier tile if not already there
    if (party.position.x !== pierTile.x || party.position.y !== pierTile.y) {
      party.position = { ...pierTile };
      for (const member of party.members) {
        member.position = { ...pierTile };
      }
    }

    this.addLog(
      `You board a boat for ${boatCost}g. Right-click water to sail!`,
      "discovery",
    );
    this.updateVisibility();
    return true;
  }

  /** Check if party can embark (pier nearby) */
  canEmbark(): boolean {
    if (this.state.party.isSailing) return false;
    const { x: px, y: py } = this.state.party.position;
    const world = this.state.world;
    // Check current tile and neighbors for pier
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx >= 0 && nx < world.width && ny >= 0 && ny < world.height) {
          if (world.tiles[ny][nx].features.some((f) => f.type === "pier"))
            return true;
        }
      }
    }
    return false;
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
    console.log(
      `[endTurn] Before advance: AP = ${this.state.party.actionPoints}`,
    );
    // Clear queued movement so player starts fresh next turn
    this.state.party.queuedPath = [];
    advanceTurn(this.state);
    console.log(
      `[endTurn] After advance: AP = ${this.state.party.actionPoints}`,
    );
  }

  /** Rest — costs 1 AP. Better healing at settlements. */
  rest(): boolean {
    const { party, world } = this.state;
    const restCost = 1;

    if (party.actionPoints < restCost) {
      this.addLog("Not enough action points to rest.", "system");
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
      this.addLog("You camp in the wilderness. Some health restored.", "info");
      return true;
    }

    // Full rest at settlement
    const hasTavern = loc.buildings.some(
      (b) => b.type === "tavern" && b.isOperational,
    );
    const healAmount = hasTavern ? 25 : 15;

    for (const member of party.members) {
      member.health = Math.min(member.maxHealth, member.health + healAmount);
      member.needs.food = Math.min(100, member.needs.food + 20);
      member.needs.shelter = Math.min(100, member.needs.shelter + 40);
    }

    if (hasTavern) {
      this.addLog(
        `You rest at the tavern in ${loc.name}. Health and spirits restored!`,
        "social",
        loc.id,
      );
      if (party.gold >= 2) party.gold -= 2;
    } else {
      this.addLog(`You rest in ${loc.name}. Health restored.`, "info", loc.id);
    }

    return true;
  }

  /** Preview what food is available and at what price. Returns null if nothing. */
  previewBuyFood(): {
    foodId: string;
    price: number;
    stock: number;
    locName: string;
    isExpensive: boolean;
  } | null {
    const { party, world } = this.state;

    if (party.actionPoints < 1) return null;

    const tile = world.tiles[party.position.y]?.[party.position.x];
    if (!tile?.locationId) return null;

    const loc = world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) return null;

    const canTrade = loc.buildings.some(
      (b) =>
        b.isOperational &&
        (b.type === "market" || b.type === "tavern" || b.type === "dock"),
    );
    if (!canTrade) return null;

    const foodTypes = [
      "bread",
      "meat",
      "fish",
      "berries",
      "wheat",
      "exotic_fruit",
    ];
    for (const foodId of foodTypes) {
      const stackIdx = loc.storage.findIndex(
        (s) => s.resourceId === foodId && s.quantity > 0,
      );
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
      this.addLog("Not enough action points.", "system");
      return false;
    }

    const tile = world.tiles[party.position.y]?.[party.position.x];
    if (!tile?.locationId) {
      this.addLog("There is nowhere to buy food here.", "system");
      return false;
    }

    const loc = world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) return false;

    const canTrade = loc.buildings.some(
      (b) =>
        b.isOperational &&
        (b.type === "market" || b.type === "tavern" || b.type === "dock"),
    );
    if (!canTrade) {
      this.addLog(
        `${loc.name} has no market or tavern to buy food from.`,
        "system",
        loc.id,
      );
      return false;
    }

    const foodTypes = [
      "bread",
      "meat",
      "fish",
      "berries",
      "wheat",
      "exotic_fruit",
    ];
    for (const foodId of foodTypes) {
      const stackIdx = loc.storage.findIndex(
        (s) => s.resourceId === foodId && s.quantity > 0,
      );
      if (stackIdx >= 0) {
        const price = loc.marketPrices[foodId] ?? 3;
        if (party.gold < price) {
          this.addLog(`Cannot afford ${foodId} — costs ${price}g.`, "system");
          return false;
        }

        party.actionPoints -= 1;
        party.gold -= price;

        // Get the food's quality before removing it from storage
        const foodQuality = loc.storage[stackIdx].quality;

        loc.storage[stackIdx].quantity--;
        if (loc.storage[stackIdx].quantity <= 0)
          loc.storage.splice(stackIdx, 1);

        // Add 1 unit of food to party inventory
        this.addToPartyInventory(foodId, 1, foodQuality);

        // Also immediately restore food need
        for (const member of party.members) {
          member.needs.food = Math.min(100, member.needs.food + 25);
        }

        const remaining =
          loc.storage.find((s) => s.resourceId === foodId)?.quantity ?? 0;
        this.addLog(
          `Bought ${foodId} for ${price}g in ${loc.name} (${formatQuantity(remaining)} left).`,
          "trade",
          loc.id,
        );
        return true;
      }
    }

    this.addLog(`${loc.name} has no food in stock.`, "system", loc.id);
    return false;
  }

  /** Check whether the party is at a location where food can be bought */
  canBuyFood(): boolean {
    const tile =
      this.state.world.tiles[this.state.party.position.y]?.[
        this.state.party.position.x
      ];
    if (!tile?.locationId) return false;
    const loc = this.state.world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) return false;
    return loc.buildings.some(
      (b) =>
        b.isOperational &&
        (b.type === "market" || b.type === "tavern" || b.type === "dock"),
    );
  }

  /** Check whether the party is at a location with a market */
  isAtMarket(): boolean {
    const tile =
      this.state.world.tiles[this.state.party.position.y]?.[
        this.state.party.position.x
      ];
    if (!tile?.locationId) return false;
    const loc = this.state.world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) return false;
    return loc.buildings.some((b) => b.isOperational && b.type === "market");
  }

  /** Check if party can hunt (standing on a wild animal) */
  canHunt(): boolean {
    const { party, world } = this.state;
    if (party.actionPoints < 2) return false;

    for (const creature of world.creatures.values()) {
      if (
        creature.position.x === party.position.x &&
        creature.position.y === party.position.y
      ) {
        // Can hunt game animals (not bandits, dragons, guards, armies, traders, hunters)
        const huntableTypes = ["deer", "sheep", "boar", "wolf", "bear"];
        if (huntableTypes.includes(creature.type)) {
          return creature.health > 0;
        }
      }
    }
    return false;
  }

  /** Hunt a wild animal at the party's position */
  hunt(): boolean {
    const { party, world } = this.state;
    const leader = party.members[0];
    if (!leader) return false;

    if (party.actionPoints < 2) {
      this.addLog("Not enough action points to hunt.", "system");
      return false;
    }

    // Find huntable creature at position
    let target: Creature | null = null;
    const huntableTypes = ["deer", "sheep", "boar", "wolf", "bear"];
    for (const creature of world.creatures.values()) {
      if (
        creature.position.x === party.position.x &&
        creature.position.y === party.position.y
      ) {
        if (huntableTypes.includes(creature.type) && creature.health > 0) {
          target = creature;
          break;
        }
      }
    }

    if (!target) {
      this.addLog("No wild game to hunt here.", "system");
      return false;
    }

    party.actionPoints -= 2;
    const label = target.name ?? target.type;

    // Hunting is milder than combat - takes a few rounds, low damage to party
    const huntingSkill = leader.skills["hunting"] ?? 0;
    const partyAttack =
      leader.stats.strength +
      (leader.equippedWeapon?.attack ?? 0) +
      huntingSkill / 10;

    let rounds = 0;
    let totalDmg = 0;
    let damageTaken = 0;

    while (target.health > 0 && rounds < 10) {
      rounds++;
      const dmg = Math.max(
        1,
        Math.floor(partyAttack - target.defense / 2 + Math.random() * 3),
      );
      target.health -= dmg;
      totalDmg += dmg;

      // Wild animals fight back a little (much less than combat)
      if (target.health > 0 && Math.random() < 0.3) {
        const animalDmg = Math.max(
          1,
          Math.floor(target.attack / 3 + Math.random() * 2),
        );
        leader.health -= animalDmg;
        damageTaken += animalDmg;
      }
    }

    // Start combat animation for hunting (300ms per round, faster than combat)
    this.state.combatAnimation = {
      active: true,
      partyPos: { ...party.position },
      enemyPos: { ...target.position },
      enemyId: target.id,
      startTime: Date.now(),
      duration: rounds * 300,
      rounds: rounds,
    };

    if (target.health <= 0) {
      // Collect loot into party inventory
      for (const loot of target.loot) {
        this.addToPartyInventory(loot.resourceId, loot.quantity, loot.quality);
        this.addLog(
          `Hunted ${label}! Obtained ${formatQuantity(loot.quantity)} ${loot.resourceId}.`,
          "info",
        );
      }

      // Gain hunting skill
      leader.skills["hunting"] = Math.min(
        100,
        (leader.skills["hunting"] ?? 0) + 2,
      );

      if (damageTaken > 0) {
        this.addLog(
          `Hunt successful (took ${Math.round(damageTaken)} dmg).`,
          "info",
        );
      }

      // Remove creature after animation completes (handled in renderer)
    } else {
      // Animal escaped - move it to a nearby tile
      const directions = [
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: -1 },
        { dx: -1, dy: 1 },
        { dx: 1, dy: -1 },
        { dx: 1, dy: 1 },
      ];

      // Shuffle directions for randomness
      const shuffled = directions.sort(() => Math.random() - 0.5);

      // Find first valid adjacent tile
      for (const dir of shuffled) {
        const newX = target.position.x + dir.dx;
        const newY = target.position.y + dir.dy;

        // Check if in bounds
        if (
          newX >= 0 &&
          newX < world.width &&
          newY >= 0 &&
          newY < world.height
        ) {
          const tile = world.tiles[newY][newX];
          // Check if tile is walkable (not water/deep water)
          if (
            tile.terrainType !== "shallow_ocean" &&
            tile.terrainType !== "deep_ocean"
          ) {
            target.position.x = newX;
            target.position.y = newY;
            this.addLog(
              `Hunt failed - ${label} escaped to nearby cover!`,
              "info",
            );
            return true;
          }
        }
      }

      // If no valid tile found, just log escape
      this.addLog(`Hunt failed - ${label} escaped!`, "info");
    }

    return true;
  }

  /** Add resources to party inventory (stacking logic) */
  private addToPartyInventory(
    resourceId: string,
    quantity: number,
    quality: number,
  ): void {
    const { party } = this.state;

    // Try to stack with existing
    const existing = party.inventory.find(
      (s) => s.resourceId === resourceId && Math.abs(s.quality - quality) < 0.1,
    );
    if (existing) {
      existing.quantity += quantity;
    } else {
      party.inventory.push({ resourceId, quantity, quality, age: 0 });
    }
  }

  /** Check if party can sell at marketplace */
  canSell(): boolean {
    const tile =
      this.state.world.tiles[this.state.party.position.y]?.[
        this.state.party.position.x
      ];
    if (!tile?.locationId) return false;
    const loc = this.state.world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) return false;
    return (
      loc.buildings.some((b) => b.isOperational && b.type === "market") &&
      this.state.party.inventory.length > 0
    );
  }

  /** Buy 1 unit of a specific market item */
  buyMarketItem(resourceId: string, storageIndex: number): boolean {
    const { party, world } = this.state;

    const tile = world.tiles[party.position.y]?.[party.position.x];
    if (!tile?.locationId) {
      this.addLog("No settlement here.", "system");
      return false;
    }

    const loc = world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) {
      this.addLog("This settlement is destroyed.", "system");
      return false;
    }

    const hasMarket = loc.buildings.some(
      (b) => b.isOperational && b.type === "market",
    );
    if (!hasMarket) {
      this.addLog("No marketplace here.", "system");
      return false;
    }

    if (storageIndex < 0 || storageIndex >= loc.storage.length) {
      this.addLog("Item no longer available.", "system");
      return false;
    }

    const stack = loc.storage[storageIndex];
    if (stack.quantity <= 0) {
      this.addLog("Out of stock.", "system");
      return false;
    }

    const price = loc.marketPrices[resourceId] ?? 3;
    const buyPrice = Math.floor(price * stack.quality);

    if (party.gold < buyPrice) {
      this.addLog(
        `Cannot afford ${resourceId} — costs ${buyPrice}g.`,
        "system",
      );
      return false;
    }

    // Buy 1 unit
    party.gold -= buyPrice;
    stack.quantity -= 1;

    // Remove stack if empty
    if (stack.quantity <= 0) {
      loc.storage.splice(storageIndex, 1);
    }

    // Add to party inventory
    this.addToPartyInventory(resourceId, 1, stack.quality);

    this.addLog(`Bought 1 ${resourceId} for ${buyPrice}g.`, "trade", loc.id);

    // Restore food need if it's food
    const foodTypes = [
      "bread",
      "meat",
      "fish",
      "berries",
      "wheat",
      "exotic_fruit",
    ];
    if (foodTypes.includes(resourceId)) {
      for (const member of party.members) {
        member.needs.food = Math.min(100, member.needs.food + 25);
      }
    }

    return true;
  }

  /** Sell a specific inventory item at current marketplace */
  sellInventoryItem(itemIndex: number): boolean {
    const { party, world } = this.state;

    if (itemIndex < 0 || itemIndex >= party.inventory.length) {
      this.addLog("Invalid item.", "system");
      return false;
    }

    const tile = world.tiles[party.position.y]?.[party.position.x];
    if (!tile?.locationId) {
      this.addLog("No settlement here to sell at.", "system");
      return false;
    }

    const loc = world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) {
      this.addLog("This settlement is destroyed.", "system");
      return false;
    }

    const hasMarket = loc.buildings.some(
      (b) => b.isOperational && b.type === "market",
    );
    if (!hasMarket) {
      this.addLog("No marketplace here.", "system");
      return false;
    }

    const stack = party.inventory[itemIndex];
    const def = RESOURCE_DEFINITIONS[stack.resourceId];
    if (!def) return false;

    const price = loc.marketPrices[stack.resourceId] ?? def.baseValue;
    const value = Math.floor(stack.quantity * price * stack.quality);

    party.gold += value;
    this.addLog(
      `Sold ${formatQuantity(stack.quantity)} ${stack.resourceId} for ${value}g.`,
      "trade",
      loc.id,
    );

    // Add sold items to settlement storage
    const existingStack = loc.storage.find(
      (s) =>
        s.resourceId === stack.resourceId &&
        Math.abs(s.quality - stack.quality) < 0.1,
    );
    if (existingStack) {
      existingStack.quantity += stack.quantity;
    } else {
      loc.storage.push({
        resourceId: stack.resourceId,
        quantity: stack.quantity,
        quality: stack.quality,
        age: 0,
      });
    }

    // Remove from inventory
    party.inventory.splice(itemIndex, 1);

    return true;
  }

  /** Sell all inventory at current marketplace */
  sellInventory(): boolean {
    const { party, world } = this.state;
    const tile = world.tiles[party.position.y]?.[party.position.x];
    if (!tile?.locationId) return false;

    const loc = world.locations.get(tile.locationId);
    if (!loc || loc.isDestroyed) return false;

    const hasMarket = loc.buildings.some(
      (b) => b.isOperational && b.type === "market",
    );
    if (!hasMarket) {
      this.addLog("No marketplace here.", "system");
      return false;
    }

    if (party.inventory.length === 0) {
      this.addLog("Nothing to sell.", "system");
      return false;
    }

    party.actionPoints -= 1;
    let totalGold = 0;

    for (const stack of party.inventory) {
      const def = RESOURCE_DEFINITIONS[stack.resourceId];
      if (def) {
        const price = loc.marketPrices[stack.resourceId] ?? def.baseValue;
        const value = Math.floor(stack.quantity * price * stack.quality);
        totalGold += value;
        this.addLog(
          `Sold ${formatQuantity(stack.quantity)} ${stack.resourceId} for ${value}g.`,
          "trade",
          loc.id,
        );

        // Add sold items to settlement storage so they enter the economy
        const existingStack = loc.storage.find(
          (s) =>
            s.resourceId === stack.resourceId &&
            Math.abs(s.quality - stack.quality) < 0.1,
        );
        if (existingStack) {
          existingStack.quantity += stack.quantity;
        } else {
          loc.storage.push({
            resourceId: stack.resourceId,
            quantity: stack.quantity,
            quality: stack.quality,
            age: 0,
          });
        }
      }
    }

    party.gold += totalGold;
    party.inventory = []; // Clear inventory
    this.addLog(`Total earned: ${totalGold}g.`, "trade", loc.id);

    return true;
  }

  /** Check whether the party is at any settlement (for rest display) */
  isAtSettlement(): boolean {
    const tile =
      this.state.world.tiles[this.state.party.position.y]?.[
        this.state.party.position.x
      ];
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
          this.addLog(
            `You encounter hostile ${creature.name ?? creature.type}!`,
            "combat",
          );
          this.initiateCombat(creature);
        } else {
          this.addLog(`You spot a group of ${creature.type} nearby.`, "info");
        }
      }
    }
  }

  /** Start combat with a creature */
  private initiateCombat(creature: Creature): void {
    const party = this.state.party;
    const leader = party.members[0];
    if (!leader) return;

    const label = creature.name ?? creature.type;

    let partyHP = leader.health;
    let creatureHP = creature.health;

    const partyAttack =
      (leader.stats.strength + (leader.equippedWeapon?.attack ?? 0)) * 2;
    const partyDefense =
      leader.stats.endurance + (leader.equippedArmor?.defense ?? 0);
    const creatureAttack = creature.attack;
    const creatureDefense = creature.defense;

    let totalDmgDealt = 0;
    let totalDmgTaken = 0;
    let rounds = 0;

    while (partyHP > 0 && creatureHP > 0 && rounds < 20) {
      rounds++;
      // Party attacks
      const partyDmg = Math.max(
        1,
        partyAttack - creatureDefense + Math.floor(Math.random() * 4) - 2,
      );
      creatureHP -= partyDmg;
      totalDmgDealt += partyDmg;

      // Creature attacks
      if (creatureHP > 0) {
        const creatureDmg = Math.max(
          1,
          creatureAttack - partyDefense + Math.floor(Math.random() * 4) - 2,
        );
        partyHP -= creatureDmg;
        totalDmgTaken += creatureDmg;
      }
    }

    // Start combat animation (400ms per round)
    this.state.combatAnimation = {
      active: true,
      partyPos: { ...party.position },
      enemyPos: { ...creature.position },
      enemyId: creature.id,
      startTime: Date.now(),
      duration: rounds * 400,
      rounds: rounds,
    };

    // Always write back HP to both sides
    creature.health = Math.max(0, creatureHP);
    leader.health = Math.max(1, partyHP);

    if (creature.health <= 0) {
      this.addLog(
        `You defeated ${label}! (${rounds} rounds, dealt ${Math.round(totalDmgDealt)} dmg)`,
        "combat",
      );
      // Collect loot into party inventory
      for (const loot of creature.loot) {
        this.addToPartyInventory(loot.resourceId, loot.quantity, loot.quality);
        this.addLog(
          `Obtained ${formatQuantity(loot.quantity)} ${loot.resourceId}.`,
          "info",
        );
      }
      // XP gain
      leader.skills["combat"] = Math.min(
        100,
        (leader.skills["combat"] ?? 0) + 3,
      );
      // Remove creature immediately from world (after animation completes)
      // Animation will handle cleanup
    } else {
      this.addLog(
        `Fought ${label} for ${rounds} rounds — dealt ${Math.round(totalDmgDealt)} dmg, took ${Math.round(totalDmgTaken)}. ` +
          `${label} has ${Math.round(creature.health)}/${creature.maxHealth} HP left.`,
        "combat",
      );
      // Still gain some XP for surviving
      leader.skills["combat"] = Math.min(
        100,
        (leader.skills["combat"] ?? 0) + 1,
      );
    }
  }

  /** Describe what's at the party's current location and discover news */
  private describeCurrentLocation(): void {
    const { party, world } = this.state;
    const tile = world.tiles[party.position.y][party.position.x];

    if (tile.locationId) {
      const loc = world.locations.get(tile.locationId);
      if (loc) {
        this.addLog(
          `You arrive at ${loc.name} (${loc.type}).`,
          "discovery",
          loc.id,
        );
        if (loc.countryId) {
          const country = world.countries.get(loc.countryId);
          if (country) {
            this.addLog(
              `This land belongs to the ${country.name}.`,
              "info",
              loc.id,
            );
          }
        }

        // Learn news from this settlement and its surroundings
        discoverNewsAtSettlement(this.state);
      }
    }

    if (tile.resourceDeposit) {
      this.addLog(
        `You notice deposits of ${tile.resourceDeposit.resourceId} here.`,
        "discovery",
      );
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
    info.push(`Elevation: Level ${tile.elevation} (${tile.terrainType})`);

    if (tile.resourceDeposit) {
      info.push(
        `Resource: ${tile.resourceDeposit.resourceId} (${formatQuantity(tile.resourceDeposit.amount)})`,
      );
    }

    if (tile.locationId) {
      const loc = world.locations.get(tile.locationId);
      if (loc) {
        info.push(`${loc.name} — ${loc.type}`);
        info.push(`Population: ${loc.residentIds.length}`);
        info.push(`Durability: ${Math.round(loc.durability)}/100`);
        info.push(`Prosperity: ${Math.round(loc.prosperity)}`);
        info.push(`Safety: ${Math.round(loc.safety)}`);
        if (loc.countryId) {
          const country = world.countries.get(loc.countryId);
          if (country) info.push(`Country: ${country.name}`);
        }
        // Show key goods and prices
        const allGoods = loc.storage.filter((s) => s.quantity > 0);
        const goods = allGoods
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 4);
        if (goods.length > 0) {
          info.push(`Stock:`);
          for (const g of goods) {
            const price = loc.marketPrices[g.resourceId] ?? "?";
            info.push(
              `  ${g.resourceId}: ${formatQuantity(g.quantity)} (${price}g)`,
            );
          }
          // Show if there are more items
          const remaining = allGoods.length - goods.length;
          if (remaining > 0) {
            info.push(
              `  ...and ${remaining} more item${remaining === 1 ? "" : "s"}`,
            );
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

        const hasFarms = loc.buildings.some(
          (b) => b.type === "farm_field" && b.isOperational,
        );
        const hasMines = loc.buildings.some(
          (b) => b.type === "mine_shaft" && b.isOperational,
        );
        const hasSawmill = loc.buildings.some(
          (b) =>
            (b.type === "sawmill" || b.type === "hunter_lodge") &&
            b.isOperational,
        );

        if (
          hasFarms &&
          (tile.biome === "grassland" ||
            tile.biome === "savanna" ||
            tile.biome === "forest")
        ) {
          info.push(`Wheat fields (${loc.name})`);
        } else if (
          hasMines &&
          (tile.biome === "hills" || tile.biome === "mountain")
        ) {
          info.push(`Mine workings (${loc.name})`);
        } else if (
          hasSawmill &&
          (tile.biome === "forest" || tile.biome === "dense_forest")
        ) {
          info.push(`Lumber site (${loc.name})`);
        }
      }
    }

    // Characters on this tile (only if visible)
    if (tile.visible) {
      for (const character of world.characters.values()) {
        if (
          character.position.x === x &&
          character.position.y === y &&
          character.isAlive
        ) {
          // Skip the player's party members
          if (
            this.state.party.members.some(
              (m: Character) => m.id === character.id,
            )
          )
            continue;

          const jobLabel =
            character.jobType.charAt(0).toUpperCase() +
            character.jobType.slice(1);
          info.push(`${character.name} (${jobLabel})`);
          info.push(
            `  HP: ${Math.round(character.health)}/${character.maxHealth}`,
          );

          // Show current action
          if (character.currentAction) {
            const actionType = character.currentAction.type;
            info.push(`  Activity: ${actionType}`);
          }

          // Show duty status for guards/soldiers
          if (
            (character.jobType === "guard" ||
              character.jobType === "soldier") &&
            character.onDuty
          ) {
            info.push(`  On patrol`);
          }
        }
      }
    }

    // Creatures on this tile (only if visible)
    if (tile.visible) {
      for (const creature of world.creatures.values()) {
        if (
          creature.position.x === x &&
          creature.position.y === y &&
          creature.health > 0
        ) {
          const label = creature.name ?? creature.type;
          const hostile = creature.isHostile ? " (hostile)" : "";
          info.push(`Creature: ${label}${hostile}`);
          info.push(
            `  HP: ${Math.round(creature.health)}/${creature.maxHealth}`,
          );

          // Show trader inventory
          if (creature.type === "trader" && creature.loot.length > 0) {
            info.push(`  Carrying:`);
            for (const item of creature.loot) {
              info.push(
                `    ${item.resourceId}: ${formatQuantity(item.quantity)}`,
              );
            }
          }
        }
      }
    }

    if (tile.roadLevel > 0) {
      const roadNames = ["", "Path", "Road", "Highway"];
      info.push(`Road: ${roadNames[tile.roadLevel]}`);
    }

    if (tile.features.some((f) => f.type === "pier")) {
      info.push(`Pier — step onto water to board a boat (10g)`);
    }

    return info;
  }

  /** Get the current game year and season info */
  getDateString(): string {
    const year = getYearFromTurn(this.state.turn);
    const season = this.state.season;
    return `Year ${year}, ${season.charAt(0).toUpperCase() + season.slice(1)} — Day ${(this.state.turn % 90) + 1}`;
  }

  /** Add a log entry, optionally linked to a location */
  addLog(
    message: string,
    type: EventLogEntry["type"],
    locationId?: string,
  ): void {
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
