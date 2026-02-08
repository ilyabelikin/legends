import type { World } from './world';
import type { Character } from './character';
import type { Item } from './item';
import type { Season, Weather } from './season';
import type { GameEvent } from './event';
import type { ResourceStack } from './resource';

/** The player's adventure party */
export interface Party {
  members: Character[];
  position: { x: number; y: number };
  inventory: ResourceStack[];
  gold: number;
  reputation: Record<string, number>; // countryId → reputation (-100..100)
  actionPoints: number;
  maxActionPoints: number;
  /** Queued path the party is walking along, one step per tick */
  queuedPath: { x: number; y: number }[];
  /** Whether the party is currently sailing (can move on water) */
  isSailing: boolean;
}

/** Complete game state */
export interface GameState {
  world: World;
  turn: number;
  season: Season;
  weather: Weather;
  party: Party;
  activeEvents: GameEvent[];
  /** All world events (the party may or may not know about them) */
  worldEvents: GameEvent[];
  /** IDs of events the party has learned about */
  knownEventIds: Set<string>;
  /** The visible event log (only events the party knows + party-local messages) */
  eventLog: EventLogEntry[];
  gameOver: boolean;
  isPaused: boolean;
  selectedTile: { x: number; y: number } | null;
  viewMode: ViewMode;
}

/** An entry in the scrolling event log */
export interface EventLogEntry {
  turn: number;
  message: string;
  type: LogEntryType;
  locationId?: string;
}

export type LogEntryType =
  | 'info'
  | 'combat'
  | 'trade'
  | 'political'
  | 'discovery'
  | 'danger'
  | 'social'
  | 'system';

/** What view mode the player is in */
export type ViewMode =
  | 'world'        // normal map view
  | 'location'     // inspecting a location
  | 'combat'       // in combat
  | 'dialogue'     // talking to NPC
  | 'trade'        // trading at market
  | 'inventory';   // managing inventory
