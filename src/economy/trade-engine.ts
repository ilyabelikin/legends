import type { World } from '../types/world';
import type { Location } from '../types/location';
import type { TradeRoute, TransportType } from '../types/economy';
import { TRANSPORT_CAPACITY, TRANSPORT_SPEED } from '../types/economy';
import { RESOURCE_DEFINITIONS } from '../data/resource-data';
import { euclideanDist } from '../utils/math';
import { findPath } from '../utils/pathfinding';
import { getMovementCost } from '../utils/movement-cost';
import { SeededRandom, generateId } from '../utils/random';
import { addToStorage } from './economy-engine';

/**
 * Establish trade routes between settlements that have
 * complementary supply/demand.
 */
export function establishTradeRoutes(world: World, rng: SeededRandom): string[] {
  const logs: string[] = [];
  const locations = Array.from(world.locations.values()).filter(l =>
    !l.isDestroyed && l.residentIds.length >= 3
  );

  // For each location, find potential trade partners
  for (const loc of locations) {
    if (loc.tradeRouteIds.length >= 3) continue; // max 3 routes per location

    // What does this location have surplus of?
    const surpluses: { resourceId: string; amount: number }[] = [];
    for (const stack of loc.storage) {
      const def = RESOURCE_DEFINITIONS[stack.resourceId];
      if (def && stack.quantity > def.stackSize * 0.5) {
        surpluses.push({ resourceId: stack.resourceId, amount: stack.quantity });
      }
    }

    if (surpluses.length === 0) continue;

    // Find best partner
    let bestPartner: Location | null = null;
    let bestScore = 0;

    for (const partner of locations) {
      if (partner.id === loc.id) continue;
      if (world.tradeRoutes.size > 30) break; // global limit

      // Check if route already exists
      const existing = Array.from(world.tradeRoutes.values()).find(
        r => (r.fromLocationId === loc.id && r.toLocationId === partner.id) ||
             (r.fromLocationId === partner.id && r.toLocationId === loc.id)
      );
      if (existing) continue;

      const dist = euclideanDist(loc.position, partner.position);
      if (dist > 30) continue; // too far

      // Score based on complementary needs
      let score = 0;
      for (const surplus of surpluses) {
        const partnerStock = partner.storage
          .filter(s => s.resourceId === surplus.resourceId)
          .reduce((sum, s) => sum + s.quantity, 0);
        const def = RESOURCE_DEFINITIONS[surplus.resourceId];
        if (partnerStock < (def?.stackSize ?? 20) * 0.3) {
          score += surplus.amount * (def?.baseValue ?? 1);
        }
      }

      score /= dist; // closer is better

      // Same country bonus
      if (loc.countryId && loc.countryId === partner.countryId) score *= 1.5;

      if (score > bestScore) {
        bestScore = score;
        bestPartner = partner;
      }
    }

    if (bestPartner && bestScore > 5) {
      // Create trade route
      const path = findPath(
        loc.position,
        bestPartner.position,
        world.width,
        world.height,
        (x, y) => getMovementCost(world.tiles[y][x]),
      );

      if (path.length > 0) {
        const routeId = generateId('route');
        const route: TradeRoute = {
          id: routeId,
          fromLocationId: loc.id,
          toLocationId: bestPartner.id,
          path,
          distance: path.length,
          transportType: determineTransport(path.length, loc, bestPartner),
          goods: [],
          merchantId: null,
          isActive: true,
          dangerLevel: 0,
          lastUsedTurn: 0,
        };

        world.tradeRoutes.set(routeId, route);
        loc.tradeRouteIds.push(routeId);
        bestPartner.tradeRouteIds.push(routeId);

        logs.push(`Trade route established: ${loc.name} ↔ ${bestPartner.name}`);
      }
    }
  }

  return logs;
}

/** Determine best transport type for a route */
function determineTransport(
  distance: number,
  from: Location,
  to: Location,
): TransportType {
  // Ports use ships
  if (from.type === 'port' || to.type === 'port') return 'ship';
  // Long distances use horse carts
  if (distance > 15) return 'horse_cart';
  // Medium distances use carts
  if (distance > 8) return 'cart';
  // Short distances use hauling
  return 'hauling';
}

/**
 * Execute trade along existing routes.
 * Moves goods from surplus locations to deficit locations.
 */
export function executeTrades(world: World, turn: number, rng: SeededRandom): string[] {
  const logs: string[] = [];

  for (const route of world.tradeRoutes.values()) {
    if (!route.isActive) continue;

    const from = world.locations.get(route.fromLocationId);
    const to = world.locations.get(route.toLocationId);
    if (!from || !to || from.isDestroyed || to.isDestroyed) {
      route.isActive = false;
      continue;
    }

    // Check for bandits on route
    if (rng.chance(route.dangerLevel * 0.1)) {
      logs.push(`Trade route ${from.name} → ${to.name} raided by bandits!`);
      route.isActive = false;
      continue;
    }

    // Move surplus goods
    const capacity = TRANSPORT_CAPACITY[route.transportType];
    let weightUsed = 0;

    for (let i = from.storage.length - 1; i >= 0 && weightUsed < capacity; i--) {
      const stack = from.storage[i];
      const def = RESOURCE_DEFINITIONS[stack.resourceId];
      if (!def) continue;

      // Only trade if destination needs it
      const destStock = to.storage
        .filter(s => s.resourceId === stack.resourceId)
        .reduce((sum, s) => sum + s.quantity, 0);
      if (destStock > def.stackSize * 0.5) continue;

      // Only trade surplus
      if (stack.quantity <= def.stackSize * 0.3) continue;

      const tradeAmount = Math.min(
        Math.floor(stack.quantity * 0.3),
        Math.floor((capacity - weightUsed) / def.weight),
      );

      if (tradeAmount <= 0) continue;

      stack.quantity -= tradeAmount;
      if (stack.quantity <= 0) from.storage.splice(i, 1);

      addToStorage(to, stack.resourceId, tradeAmount, stack.quality);
      weightUsed += tradeAmount * def.weight;

      // Generate gold for the origin
      const goldEarned = Math.floor(tradeAmount * (to.marketPrices[stack.resourceId] ?? def.baseValue) * 0.3);
      // Distribute gold among merchants
      for (const charId of from.residentIds) {
        const ch = world.characters.get(charId);
        if (ch && ch.jobType === 'merchant') {
          ch.gold += Math.floor(goldEarned / Math.max(1, from.residentIds.filter(
            id => world.characters.get(id)?.jobType === 'merchant'
          ).length));
          break;
        }
      }
    }

    route.lastUsedTurn = turn;
  }

  return logs;
}

/** Calculate danger level for trade routes based on nearby threats */
export function updateRouteDanger(world: World): void {
  for (const route of world.tradeRoutes.values()) {
    let danger = 0;
    for (const pos of route.path) {
      for (const creature of world.creatures.values()) {
        if (creature.isHostile) {
          const dist = Math.abs(creature.position.x - pos.x) + Math.abs(creature.position.y - pos.y);
          if (dist < 5) danger += 0.05;
        }
      }
    }
    route.dangerLevel = Math.min(1, danger);
  }
}
