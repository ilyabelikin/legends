/** Four seasons */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** Weather conditions */
export type Weather =
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'heatwave'
  | 'blizzard';

/** How many turns each season lasts */
export const SEASON_LENGTH = 90;

/** Season order */
export const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** Get current season from turn number */
export function getSeasonFromTurn(turn: number): Season {
  const yearProgress = turn % (SEASON_LENGTH * 4);
  const seasonIndex = Math.floor(yearProgress / SEASON_LENGTH);
  return SEASON_ORDER[seasonIndex];
}

/** Get year number from turn */
export function getYearFromTurn(turn: number): number {
  return Math.floor(turn / (SEASON_LENGTH * 4)) + 1;
}

/** Get day within season */
export function getDayInSeason(turn: number): number {
  return (turn % SEASON_LENGTH) + 1;
}

/** Weather probabilities by season */
export const WEATHER_PROBABILITIES: Record<Season, Record<Weather, number>> = {
  spring: { clear: 0.3, cloudy: 0.25, rain: 0.3, storm: 0.1, snow: 0.0, fog: 0.05, heatwave: 0.0, blizzard: 0.0 },
  summer: { clear: 0.45, cloudy: 0.2, rain: 0.15, storm: 0.1, snow: 0.0, fog: 0.0, heatwave: 0.1, blizzard: 0.0 },
  autumn: { clear: 0.25, cloudy: 0.3, rain: 0.25, storm: 0.05, snow: 0.05, fog: 0.1, heatwave: 0.0, blizzard: 0.0 },
  winter: { clear: 0.2, cloudy: 0.2, rain: 0.1, storm: 0.05, snow: 0.3, fog: 0.05, heatwave: 0.0, blizzard: 0.1 },
};
