import { cacheGet, cacheSet, HOUR } from "./cache";
import type { AssetValue, LeagueFormat } from "../types";

const BASE = "https://api.fantasycalc.com/values/current";
const SUPPORTED_TEAMS = [8, 10, 12, 14, 16];

function nearestTeams(n: number): number {
  return SUPPORTED_TEAMS.reduce((best, t) =>
    Math.abs(t - n) < Math.abs(best - n) ? t : best, SUPPORTED_TEAMS[0]);
}

/**
 * Community dynasty trade values (FantasyCalc), keyed by Sleeper player id.
 * Draft picks come back in the same list with synthetic ids like
 * "FP_2027_early_0", which we surface as pick assets.
 */
export async function getValues(format: LeagueFormat): Promise<Map<string, AssetValue>> {
  const numQbs = format.superflex ? 2 : 1;
  const numTeams = nearestTeams(format.teams);
  const ppr = format.ppr >= 1 ? 1 : format.ppr > 0 ? 0.5 : 0;
  const key = `values:${numQbs}:${numTeams}:${ppr}`;

  const cachedRows = await cacheGet<AssetValue[]>(key);
  if (cachedRows) return new Map(cachedRows.map((r) => [r.sleeperId, r]));

  const url = `${BASE}?isDynasty=true&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FantasyCalc failed: ${res.status}`);
  const raw = (await res.json()) as any[];

  const rows: AssetValue[] = raw
    .filter((r) => r?.player?.sleeperId)
    .map((r) => ({
      sleeperId: String(r.player.sleeperId),
      name: r.player.name,
      position: r.player.position,
      team: r.player.maybeTeam ?? null,
      age: typeof r.player.maybeAge === "number" ? r.player.maybeAge : null,
      value: r.value ?? 0,
      overallRank: r.overallRank ?? 0,
      positionRank: r.positionRank ?? 0,
      trend30Day: r.trend30Day ?? 0,
      tier: r.maybeTier ?? null,
      redraftValue: r.redraftValue ?? null,
      isPick: r.player.position === "PICK",
    }));

  await cacheSet(key, rows, 6 * HOUR);
  return new Map(rows.map((r) => [r.sleeperId, r]));
}

/** Look up an asset by fuzzy name, for chat/trade input. */
export function findByName(values: Map<string, AssetValue>, query: string): AssetValue | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const all = [...values.values()];
  const exact = all.find((v) => v.name.toLowerCase() === q);
  if (exact) return exact;
  const starts = all.filter((v) => v.name.toLowerCase().startsWith(q));
  if (starts.length === 1) return starts[0];
  const contains = all.filter((v) => v.name.toLowerCase().includes(q));
  if (contains.length >= 1) {
    // Prefer the most valuable match so "jefferson" resolves to the star.
    return contains.sort((a, b) => b.value - a.value)[0];
  }
  return starts.sort((a, b) => b.value - a.value)[0] ?? null;
}

/**
 * Value a future draft pick. Sleeper gives us season + round only, so map to
 * FantasyCalc's generic "<year> <round>" asset (e.g. "FP_2027_1").
 */
export function pickValue(
  values: Map<string, AssetValue>,
  season: string,
  round: number,
): AssetValue | null {
  return values.get(`FP_${season}_${round}`) ?? null;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
