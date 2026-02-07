import type { GameState, EventLogEntry } from '../types/game';
import type { GameEvent } from '../types/event';
import { EVENT_SPREAD_RADIUS } from '../types/event';
import { euclideanDist } from '../utils/math';

/**
 * When the party enters a settlement, discover news.
 * A settlement knows about:
 *  - Its own events (any severity)
 *  - Events from other locations within the event's spread radius
 *
 * Only events the party hasn't already heard are added to the log.
 */
export function discoverNewsAtSettlement(state: GameState): void {
  const { party, world, worldEvents, knownEventIds, eventLog } = state;
  const tile = world.tiles[party.position.y]?.[party.position.x];
  if (!tile?.locationId) return;

  const loc = world.locations.get(tile.locationId);
  if (!loc || loc.isDestroyed) return;

  const partyPos = loc.position;
  let newNewsCount = 0;

  for (const event of worldEvents) {
    // Already known
    if (knownEventIds.has(event.id)) continue;

    // Too old — news older than 60 turns is forgotten
    if (state.turn - event.turn > 60) continue;

    const spreadRadius = EVENT_SPREAD_RADIUS[event.severity];

    // Events at this settlement are always heard
    if (event.locationId === loc.id) {
      learnEvent(state, event);
      newNewsCount++;
      continue;
    }

    // Events from other locations: check distance
    if (event.locationId) {
      const eventLoc = world.locations.get(event.locationId);
      if (eventLoc) {
        const dist = euclideanDist(partyPos, eventLoc.position);
        if (dist <= spreadRadius) {
          learnEvent(state, event);
          newNewsCount++;
          continue;
        }
      }
    }

    // Global events (no specific location, like war declarations) with big spread
    if (!event.locationId && spreadRadius >= 50) {
      learnEvent(state, event);
      newNewsCount++;
    }
  }

  if (newNewsCount > 0) {
    // Add a separator so the player notices new intel
    eventLog.push({
      turn: state.turn,
      message: `You hear ${newNewsCount} piece${newNewsCount > 1 ? 's' : ''} of news in ${loc.name}.`,
      type: 'social',
      locationId: loc.id,
    });
  }
}

/** Mark an event as known and add it to the visible log */
function learnEvent(state: GameState, event: GameEvent): void {
  state.knownEventIds.add(event.id);
  state.eventLog.push({
    turn: event.turn,
    message: event.title,
    type: severityToLogType(event.severity),
    locationId: event.locationId ?? undefined,
  });
}

/**
 * Check if the party directly witnesses an event
 * (they are at or very close to the event location).
 */
export function checkDirectWitness(state: GameState, event: GameEvent): boolean {
  const { party, world } = state;

  // No location = global event, party doesn't witness directly
  if (!event.locationId) return false;

  const loc = world.locations.get(event.locationId);
  if (!loc) return false;

  const dist = euclideanDist(party.position, loc.position);
  // Party sees/hears events within 8 tiles directly
  return dist <= 8;
}

function severityToLogType(severity: string): EventLogEntry['type'] {
  switch (severity) {
    case 'catastrophic': return 'danger';
    case 'major': return 'danger';
    case 'moderate': return 'info';
    default: return 'info';
  }
}
