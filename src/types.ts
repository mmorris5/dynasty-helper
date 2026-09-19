export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface LeagueUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string; avatar?: string };
}

export interface League {
  league_id: string;
  name: string;
  season: string;
  status: string;
  sport: string;
  total_rosters: number;
  avatar: string | null;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  settings: Record<string, number>;
  previous_league_id: string | null;
}

export interface Roster {
  roster_id: number;
  owner_id: string | null;
  co_owners: string[] | null;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  taxi: string[] | null;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
    waiver_budget_used?: number;
    total_moves?: number;
  };
}

export interface Matchup {
  roster_id: number;
  matchup_id: number | null;
  points: number;
  players: string[] | null;
  starters: string[] | null;
  starters_points: number[] | null;
  players_points: Record<string, number> | null;
}

export interface TradedPick {
  season: string;
  round: number;
  roster_id: number;       // original owner
  previous_owner_id: number;
  owner_id: number;        // current owner
}

export interface Transaction {
  transaction_id: string;
  type: "trade" | "waiver" | "free_agent" | string;
  status: string;
  status_updated: number;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: Array<{
    season: string;
    round: number;
    roster_id: number;
    previous_owner_id: number;
    owner_id: number;
  }>;
  waiver_budget: Array<{ sender: number; receiver: number; amount: number }>;
}

/** Slimmed player record stored in IndexedDB. */
export interface PlayerMeta {
  id: string;
  name: string;
  position: string;
  team: string | null;
  age: number | null;
  years_exp: number | null;
  injury_status: string | null;
  status: string | null;
  number: number | null;
}

export interface NflState {
  week: number;
  season: string;
  season_type: string;
  display_week: number;
}

/** A dynasty trade value from FantasyCalc, normalized. */
export interface AssetValue {
  sleeperId: string;
  name: string;
  position: string;
  team: string | null;
  age: number | null;
  value: number;
  overallRank: number;
  positionRank: number;
  trend30Day: number;
  tier: number | null;
  redraftValue: number | null;
  isPick: boolean;
}

export interface LeagueFormat {
  superflex: boolean;
  teams: number;
  ppr: number;
  tePremium: boolean;
  startersCount: number;
  label: string;
  /** True when no published value set matches this league size (>16 teams). */
  valuesApproximated: boolean;
}
