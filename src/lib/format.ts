import type { League, LeagueFormat } from "../types";

const BENCH = new Set(["BN", "IR", "TAXI"]);

/**
 * Sleeper's `settings.type`: 0 redraft, 1 keeper, 2 dynasty, 3 survivor.
 * Only type 2 carries rosters year over year in the way dynasty values assume.
 */
export function isDynastyLeague(league: League): boolean {
  return league.settings?.type === 2;
}

/**
 * Derive the scoring/roster shape that decides which value set applies.
 * Superflex vs 1QB in particular swings quarterback values by multiples.
 */
export function detectFormat(league: League): LeagueFormat {
  const positions = league.roster_positions ?? [];
  const starters = positions.filter((p) => !BENCH.has(p));
  const qbSlots = starters.filter((p) => p === "QB").length;
  const superflex = starters.includes("SUPER_FLEX") || qbSlots >= 2;

  const scoring = league.scoring_settings ?? {};
  const rec = typeof scoring.rec === "number" ? scoring.rec : 0;
  const tePremium = (scoring.bonus_rec_te ?? 0) > 0;

  const parts = [
    `${league.total_rosters}-team`,
    superflex ? "Superflex" : "1QB",
    rec >= 1 ? "PPR" : rec > 0 ? "Half-PPR" : "Standard",
  ];
  if (tePremium) parts.push("TEP");

  return {
    valuesApproximated: league.total_rosters > 16 || league.total_rosters < 8,
    superflex,
    teams: league.total_rosters,
    ppr: rec,
    tePremium,
    startersCount: starters.length,
    label: parts.join(" · "),
  };
}

/** Starting slots by position, e.g. { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 2 }. */
export function starterSlots(league: League): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of league.roster_positions ?? []) {
    if (BENCH.has(p)) continue;
    out[p] = (out[p] ?? 0) + 1;
  }
  return out;
}
