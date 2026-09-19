import { pickValue, ordinal } from "./values";
import { starterSlots } from "./format";
import type {
  AssetValue, League, LeagueFormat, LeagueUser, PlayerMeta, Roster, TradedPick,
} from "../types";

export interface RosterAsset {
  id: string;              // sleeper player id, or FP_<season>_<round> for picks
  name: string;
  position: string;        // QB/RB/WR/TE/K/DEF or PICK
  team: string | null;
  age: number | null;
  value: number;
  positionRank: number;
  overallRank: number;
  trend30Day: number;
  tier: number | null;
  injury: string | null;
  isPick: boolean;
  isStarter: boolean;
  onTaxi: boolean;
  onIr: boolean;
}

export interface TeamView {
  rosterId: number;
  ownerId: string | null;
  teamName: string;
  ownerName: string;
  avatar: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  assets: RosterAsset[];
  players: RosterAsset[];
  picks: RosterAsset[];
  totalValue: number;
  playerValue: number;
  pickValue: number;
  starterValue: number;
  byPosition: Record<string, number>;
  /** Value-weighted average age of rostered players; the contention signal. */
  weightedAge: number | null;
  isMe: boolean;
}

const POSITIONS = ["QB", "RB", "WR", "TE"];

/** Below this dynasty value an asset is not a real starter. */
const REPLACEMENT_VALUE = 1000;

function teamLabel(user: LeagueUser | undefined, rosterId: number): { team: string; owner: string } {
  if (!user) return { team: `Roster ${rosterId}`, owner: "Unknown" };
  const owner = user.display_name ?? `Roster ${rosterId}`;
  return { team: user.metadata?.team_name?.trim() || owner, owner };
}

/**
 * Picks each roster currently owns for future rookie drafts: its own picks,
 * less any traded away, plus any acquired. Sleeper only reports picks that
 * have changed hands, so originals are implied.
 */
function ownedPicks(
  rosterId: number,
  traded: TradedPick[],
  seasons: string[],
  rounds: number,
): Array<{ season: string; round: number; fromRosterId: number }> {
  const out: Array<{ season: string; round: number; fromRosterId: number }> = [];
  for (const season of seasons) {
    for (let round = 1; round <= rounds; round++) {
      const moved = traded.find(
        (t) => t.season === season && t.round === round && t.roster_id === rosterId,
      );
      // Own pick still held only if it was never traded away.
      if (!moved || moved.owner_id === rosterId) {
        out.push({ season, round, fromRosterId: rosterId });
      }
    }
  }
  // Picks acquired from other teams.
  for (const t of traded) {
    if (t.owner_id !== rosterId) continue;
    if (t.roster_id === rosterId) continue;
    if (!seasons.includes(t.season)) continue;
    out.push({ season: t.season, round: t.round, fromRosterId: t.roster_id });
  }
  return out.sort((a, b) => a.season.localeCompare(b.season) || a.round - b.round);
}

export interface BuildArgs {
  league: League;
  format: LeagueFormat;
  rosters: Roster[];
  users: LeagueUser[];
  players: Record<string, PlayerMeta>;
  values: Map<string, AssetValue>;
  tradedPicks: TradedPick[];
  myUserId: string | null;
  currentSeason: string;
}

export function buildTeams(args: BuildArgs): TeamView[] {
  const { league, rosters, users, players, values, tradedPicks, myUserId, currentSeason } = args;

  const userById = new Map(users.map((u) => [u.user_id, u]));
  const rounds = league.settings?.draft_rounds ?? 4;
  const base = Number(currentSeason);
  const seasons = [base + 1, base + 2, base + 3].map(String);

  const teams = rosters.map((roster): TeamView => {
    const starters = new Set(roster.starters ?? []);
    const taxi = new Set(roster.taxi ?? []);
    const ir = new Set(roster.reserve ?? []);

    const playerAssets: RosterAsset[] = (roster.players ?? []).map((pid) => {
      const meta = players[pid];
      const val = values.get(pid);
      return {
        id: pid,
        name: meta?.name ?? val?.name ?? pid,
        position: meta?.position ?? val?.position ?? "?",
        team: meta?.team ?? val?.team ?? null,
        age: meta?.age ?? val?.age ?? null,
        value: val?.value ?? 0,
        positionRank: val?.positionRank ?? 0,
        overallRank: val?.overallRank ?? 0,
        trend30Day: val?.trend30Day ?? 0,
        tier: val?.tier ?? null,
        injury: meta?.injury_status ?? null,
        isPick: false,
        isStarter: starters.has(pid),
        onTaxi: taxi.has(pid),
        onIr: ir.has(pid),
      };
    });

    const pickAssets: RosterAsset[] = ownedPicks(roster.roster_id, tradedPicks, seasons, rounds)
      .map(({ season, round, fromRosterId }) => {
        const v = pickValue(values, season, round);
        const via = fromRosterId === roster.roster_id
          ? ""
          : ` (via ${teamLabel(userById.get(rosters.find((r) => r.roster_id === fromRosterId)?.owner_id ?? ""), fromRosterId).team})`;
        return {
          id: `FP_${season}_${round}_${fromRosterId}`,
          name: `${season} ${ordinal(round)}${via}`,
          position: "PICK",
          team: null,
          age: null,
          value: v?.value ?? 0,
          positionRank: 0,
          overallRank: v?.overallRank ?? 0,
          trend30Day: v?.trend30Day ?? 0,
          tier: null,
          injury: null,
          isPick: true,
          isStarter: false,
          onTaxi: false,
          onIr: false,
        };
      });

    const assets = [...playerAssets, ...pickAssets].sort((a, b) => b.value - a.value);
    const playerValue = playerAssets.reduce((s, a) => s + a.value, 0);
    const pickVal = pickAssets.reduce((s, a) => s + a.value, 0);

    const byPosition: Record<string, number> = {};
    for (const p of POSITIONS) {
      byPosition[p] = playerAssets.filter((a) => a.position === p).reduce((s, a) => s + a.value, 0);
    }
    byPosition.PICK = pickVal;

    const aged = playerAssets.filter((a) => a.age != null && a.value > 0);
    const totalAgeWeight = aged.reduce((s, a) => s + a.value, 0);
    const weightedAge = totalAgeWeight > 0
      ? aged.reduce((s, a) => s + (a.age as number) * a.value, 0) / totalAgeWeight
      : null;

    const user = roster.owner_id ? userById.get(roster.owner_id) : undefined;
    const { team, owner } = teamLabel(user, roster.roster_id);
    const s = roster.settings ?? ({} as Roster["settings"]);

    return {
      rosterId: roster.roster_id,
      ownerId: roster.owner_id,
      teamName: team,
      ownerName: owner,
      avatar: user?.metadata?.avatar ?? user?.avatar ?? null,
      wins: s.wins ?? 0,
      losses: s.losses ?? 0,
      ties: s.ties ?? 0,
      pointsFor: (s.fpts ?? 0) + (s.fpts_decimal ?? 0) / 100,
      pointsAgainst: (s.fpts_against ?? 0) + (s.fpts_against_decimal ?? 0) / 100,
      assets,
      players: playerAssets.sort((a, b) => b.value - a.value),
      picks: pickAssets.sort((a, b) => b.value - a.value),
      totalValue: playerValue + pickVal,
      playerValue,
      pickValue: pickVal,
      starterValue: playerAssets.filter((a) => a.isStarter).reduce((s2, a) => s2 + a.value, 0),
      byPosition,
      weightedAge,
      isMe: !!myUserId && roster.owner_id === myUserId,
    };
  });

  return teams.sort((a, b) => b.totalValue - a.totalValue);
}

/** League-average value per position, for strength comparisons. */
export function positionAverages(teams: TeamView[]): Record<string, number> {
  const out: Record<string, number> = {};
  const keys = [...POSITIONS, "PICK"];
  for (const p of keys) {
    out[p] = teams.reduce((s, t) => s + (t.byPosition[p] ?? 0), 0) / Math.max(1, teams.length);
  }
  return out;
}

/** Starting slots the roster cannot fill with a startable asset. */
export function rosterHoles(team: TeamView, league: League): string[] {
  const slots = starterSlots(league);
  const holes: string[] = [];

  for (const pos of POSITIONS) {
    const need = slots[pos] ?? 0;
    if (!need) continue;
    const have = team.players
      .filter((p) => p.position === pos)
      .sort((a, b) => b.value - a.value);

    if (have.length < need) {
      holes.push(`Only ${have.length} ${pos}${have.length === 1 ? "" : "s"} for ${need} starting slot${need === 1 ? "" : "s"}`);
      continue;
    }
    // Every required starter at this position is replacement-level.
    const required = have.slice(0, need);
    if (required.every((p) => p.value < REPLACEMENT_VALUE)) {
      holes.push(`${pos} group is replacement-level`);
    }
  }

  const flexNeed = (slots.FLEX ?? 0) + (slots.SUPER_FLEX ?? 0);
  if (flexNeed > 0) {
    const skill = team.players
      .filter((p) => ["QB", "RB", "WR", "TE"].includes(p.position))
      .sort((a, b) => b.value - a.value);
    const startingSkill = Object.entries(slots)
      .filter(([k]) => ["QB", "RB", "WR", "TE"].includes(k))
      .reduce((s, [, v]) => s + v, 0);
    if (skill.length < startingSkill + flexNeed) {
      holes.push(`Not enough skill players to fill ${flexNeed} flex slot${flexNeed === 1 ? "" : "s"}`);
    }
  }
  return holes;
}

export function contentionLabel(team: TeamView, teams: TeamView[]): string {
  const rank = teams.findIndex((t) => t.rosterId === team.rosterId) + 1;
  const half = teams.length / 2;
  const young = team.weightedAge != null && team.weightedAge < 25.5;
  const old = team.weightedAge != null && team.weightedAge > 27.5;
  if (rank <= half && old) return "Win-now window — roster is strong but aging";
  if (rank <= half && young) return "Contender with a long window";
  if (rank <= half) return "Contending";
  if (young) return "Rebuilding with young capital";
  if (old) return "Retooling — aging and outside the top half";
  return "Middling — the dynasty dead zone";
}
