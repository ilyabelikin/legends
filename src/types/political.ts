/** A country / kingdom in the world */
export interface Country {
  id: string;
  name: string;
  color: string;             // hex color for map borders
  leaderId: string;          // character ID of ruler
  capitalLocationId: string;
  locationIds: string[];     // all locations in this country
  alliances: string[];       // allied country IDs
  enemies: string[];         // enemy country IDs
  vassalIds: string[];       // lord character IDs
  treasury: number;
  taxRate: number;           // 0–1
  militaryStrength: number;  // calculated from garrisons
  reputation: number;        // -100 to 100 (affects diplomacy)
  foundedTurn: number;
}

/** A diplomatic relation between two countries */
export interface DiplomaticRelation {
  countryAId: string;
  countryBId: string;
  type: DiplomacyType;
  strength: number;          // -100 to 100
  startedTurn: number;
}

export type DiplomacyType =
  | 'neutral'
  | 'friendly'
  | 'alliance'
  | 'trade_agreement'
  | 'rivalry'
  | 'war'
  | 'truce';
