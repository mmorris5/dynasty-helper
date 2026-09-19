import { cacheGet, cacheSet, DAY, HOUR, MINUTE } from "./cache";
import type {
  League, LeagueUser, Matchup, NflState, PlayerMeta, Roster, SleeperUser,
  TradedPick, Transaction,
} from "../types";

const BASE = "https://api.sleeper.app/v1";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Sleeper ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/** Fetch with an IndexedDB read-through cache. */
async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await fn();
  await cacheSet(key, value, ttl);
  return value;
}

export async function getState(): Promise<NflState> {
  return cached("state", 30 * MINUTE, () => get<NflState>("/state/nfl"));
}

export async function getUser(username: string): Promise<SleeperUser | null> {
  const clean = username.trim().replace(/^@/, "");
  if (!clean) return null;
  try {
    const u = await get<SleeperUser | null>(`/user/${encodeURIComponent(clean)}`);
    return u ?? null;
  } catch {
    return null;
  }
}

export async function getLeagues(userId: string, season: string): Promise<League[]> {
  return cached(`leagues:${userId}:${season}`, HOUR, () =>
    get<League[]>(`/user/${userId}/leagues/nfl/${season}`),
  );
}

export async function getLeague(leagueId: string): Promise<League> {
  return cached(`league:${leagueId}`, HOUR, () => get<League>(`/league/${leagueId}`));
}

export async function getRosters(leagueId: string): Promise<Roster[]> {
  return cached(`rosters:${leagueId}`, 10 * MINUTE, () =>
    get<Roster[]>(`/league/${leagueId}/rosters`),
  );
}

export async function getLeagueUsers(leagueId: string): Promise<LeagueUser[]> {
  return cached(`users:${leagueId}`, HOUR, () =>
    get<LeagueUser[]>(`/league/${leagueId}/users`),
  );
}

export async function getMatchups(leagueId: string, week: number): Promise<Matchup[]> {
  return cached(`matchups:${leagueId}:${week}`, 10 * MINUTE, () =>
    get<Matchup[]>(`/league/${leagueId}/matchups/${week}`),
  );
}

export async function getTradedPicks(leagueId: string): Promise<TradedPick[]> {
  return cached(`picks:${leagueId}`, HOUR, () =>
    get<TradedPick[]>(`/league/${leagueId}/traded_picks`),
  );
}

/** Recent transactions across the last `weeks` scoring periods, newest first. */
export async function getTransactions(leagueId: string, throughWeek: number, weeks = 4): Promise<Transaction[]> {
  const start = Math.max(1, throughWeek - weeks + 1);
  const wanted = Array.from({ length: throughWeek - start + 1 }, (_, i) => start + i);
  const batches = await Promise.all(
    wanted.map((w) =>
      cached(`tx:${leagueId}:${w}`, 10 * MINUTE, () =>
        get<Transaction[]>(`/league/${leagueId}/transactions/${w}`),
      ).catch(() => [] as Transaction[]),
    ),
  );
  return batches.flat().sort((a, b) => b.status_updated - a.status_updated);
}

export interface TrendingPlayer { player_id: string; count: number }

export async function getTrending(type: "add" | "drop"): Promise<TrendingPlayer[]> {
  return cached(`trending:${type}`, HOUR, () =>
    get<TrendingPlayer[]>(`/players/nfl/trending/${type}?lookback_hours=24&limit=25`),
  );
}

/**
 * The full player dictionary is ~14MB of JSON (~2.5MB gzipped). Sleeper asks
 * that it be pulled at most once per day, so slim it to the fields the app
 * uses and keep it in IndexedDB.
 */
export async function getPlayers(): Promise<Record<string, PlayerMeta>> {
  const KEY = "players:v1";
  const hit = await cacheGet<Record<string, PlayerMeta>>(KEY);
  if (hit) return hit;

  const raw = await get<Record<string, any>>("/players/nfl");
  const slim: Record<string, PlayerMeta> = {};
  for (const [id, p] of Object.entries(raw)) {
    if (!p || typeof p !== "object") continue;
    const position = p.position ?? p.fantasy_positions?.[0] ?? null;
    if (!position) continue;
    slim[id] = {
      id,
      name: p.full_name ?? [p.first_name, p.last_name].filter(Boolean).join(" ") ?? id,
      position,
      team: p.team ?? null,
      age: typeof p.age === "number" ? p.age : null,
      years_exp: typeof p.years_exp === "number" ? p.years_exp : null,
      injury_status: p.injury_status ?? null,
      status: p.status ?? null,
      number: typeof p.number === "number" ? p.number : null,
    };
  }
  await cacheSet(KEY, slim, DAY);
  return slim;
}

export function avatarUrl(id: string | null | undefined): string | null {
  return id ? `https://sleepercdn.com/avatars/thumbs/${id}` : null;
}

export function headshotUrl(playerId: string): string {
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
}
