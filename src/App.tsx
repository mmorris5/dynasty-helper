import { useCallback, useEffect, useMemo, useState } from "react";
import { Setup } from "./components/Setup";
import { TeamOverview } from "./components/TeamOverview";
import { PowerRankings } from "./components/PowerRankings";
import { PlayersTab } from "./components/PlayersTab";
import { TransactionsTab } from "./components/TransactionsTab";
import { Chat } from "./components/Chat";
import { buildTeams, type TeamView } from "./lib/analytics";
import { detectFormat, isDynastyLeague } from "./lib/format";
import { getValues, ordinal } from "./lib/values";
import { cacheClear } from "./lib/cache";
import {
  getLeague, getLeagues, getLeagueUsers, getPlayers, getRosters, getState,
  getTradedPicks, getTransactions, getTrending, type TrendingPlayer,
} from "./lib/sleeper";
import type {
  League, LeagueFormat, PlayerMeta, SleeperUser, Transaction,
} from "./types";
import type { LeagueContext } from "./lib/claude";

const USER_KEY = "dynasty-helper:user";
const LEAGUE_KEY = "dynasty-helper:league";
const SHOW_ALL_KEY = "dynasty-helper:show-all-leagues";

type Tab = "team" | "league" | "players" | "trades" | "chat";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "team", label: "My Team" },
  { id: "league", label: "Power Rankings" },
  { id: "players", label: "Players" },
  { id: "trades", label: "Trades" },
  { id: "chat", label: "Ask Claude" },
];

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

interface LeagueData {
  league: League;
  format: LeagueFormat;
  teams: TeamView[];
  players: Record<string, PlayerMeta>;
  transactions: Transaction[];
  trendingAdd: TrendingPlayer[];
  week: number;
}

export function App() {
  const [user, setUser] = useState<SleeperUser | null>(() => load<SleeperUser>(USER_KEY));
  const [leagues, setLeagues] = useState<League[] | null>(null);
  const [showAll, setShowAll] = useState<boolean>(() => load<boolean>(SHOW_ALL_KEY) ?? false);
  const [leagueId, setLeagueId] = useState<string | null>(() => load<string>(LEAGUE_KEY));
  const [data, setData] = useState<LeagueData | null>(null);
  const [tab, setTab] = useState<Tab>("team");
  const [viewRosterId, setViewRosterId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Load the user's leagues for the current season.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const state = await getState();
        const list = await getLeagues(user.user_id, state.season);
        if (cancelled) return;
        setLeagues(list);
        const preferred = list.filter(isDynastyLeague);
        const pickFrom = preferred.length ? preferred : list;
        if (pickFrom.length && !pickFrom.some((l) => l.league_id === leagueId)) {
          setLeagueId(pickFrom[0].league_id);
        }
        if (!list.length) setError(`No NFL leagues found for ${user.display_name} in ${state.season}.`);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Load everything for the selected league.
  useEffect(() => {
    if (!user || !leagueId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setViewRosterId(null);

    (async () => {
      try {
        setStatus("Reading league settings…");
        const [league, state] = await Promise.all([getLeague(leagueId), getState()]);
        if (cancelled) return;
        const format = detectFormat(league);

        setStatus("Loading rosters…");
        const [rosters, users, tradedPicks] = await Promise.all([
          getRosters(leagueId), getLeagueUsers(leagueId), getTradedPicks(leagueId),
        ]);
        if (cancelled) return;

        setStatus("Loading player database (first run downloads ~2.5MB)…");
        const players = await getPlayers();
        if (cancelled) return;

        setStatus("Loading dynasty values…");
        const values = await getValues(format);
        if (cancelled) return;

        setStatus("Loading recent activity…");
        const [transactions, trendingAdd] = await Promise.all([
          getTransactions(leagueId, state.week || 1).catch(() => [] as Transaction[]),
          getTrending("add").catch(() => [] as TrendingPlayer[]),
        ]);
        if (cancelled) return;

        const teams = buildTeams({
          league, format, rosters, users, players, values, tradedPicks,
          myUserId: user.user_id, currentSeason: state.season,
        });

        setData({ league, format, teams, players, transactions, trendingAdd, week: state.week || 1 });
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, leagueId]);

  useEffect(() => { save(SHOW_ALL_KEY, showAll); }, [showAll]);
  useEffect(() => { if (user) save(USER_KEY, user); }, [user]);
  useEffect(() => { if (leagueId) save(LEAGUE_KEY, leagueId); }, [leagueId]);

  const dynastyLeagues = useMemo(
    () => (leagues ?? []).filter(isDynastyLeague),
    [leagues],
  );
  const hiddenCount = (leagues?.length ?? 0) - dynastyLeagues.length;
  // With no dynasty leagues at all, showing an empty picker would be worse than showing everything.
  const visibleLeagues = useMemo(
    () => (showAll || dynastyLeagues.length === 0 ? (leagues ?? []) : dynastyLeagues),
    [showAll, dynastyLeagues, leagues],
  );

  const myTeam = useMemo(
    () => data?.teams.find((t) => t.isMe) ?? null,
    [data],
  );

  useEffect(() => {
    if (!visibleLeagues.length) return;
    if (!visibleLeagues.some((l) => l.league_id === leagueId)) {
      setLeagueId(visibleLeagues[0].league_id);
    }
  }, [visibleLeagues, leagueId]);

  const shownTeam = useMemo(() => {
    if (!data) return null;
    if (viewRosterId != null) return data.teams.find((t) => t.rosterId === viewRosterId) ?? myTeam;
    return myTeam;
  }, [data, viewRosterId, myTeam]);

  const chatCtx: LeagueContext | null = useMemo(() => {
    if (!data) return null;
    const teamByRoster = new Map(data.teams.map((t) => [t.rosterId, t]));
    const summary = data.transactions
      .filter((t) => t.type === "trade" && t.status === "complete")
      .slice(0, 8)
      .map((t) => {
        const legs = t.roster_ids.map((rid) => {
          const got = Object.entries(t.adds ?? {}).filter(([, r]) => r === rid)
            .map(([pid]) => data.players[pid]?.name ?? pid);
          const picks = (t.draft_picks ?? []).filter((p) => p.owner_id === rid)
            .map((p) => `${p.season} ${ordinal(p.round)}`);
          const name = teamByRoster.get(rid)?.teamName ?? `Roster ${rid}`;
          return `${name} got ${[...got, ...picks].join(", ") || "nothing"}`;
        });
        return `- ${legs.join(" | ")}`;
      })
      .join("\n");

    return {
      league: data.league,
      format: data.format,
      teams: data.teams,
      myTeam,
      week: data.week,
      transactionsSummary: summary,
    };
  }, [data, myTeam]);

  const onPickTeam = useCallback((t: TeamView) => {
    setViewRosterId(t.rosterId);
    setTab("team");
  }, []);

  async function hardRefresh() {
    await cacheClear();
    window.location.reload();
  }

  if (!user) return <Setup onReady={setUser} />;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">Dynasty <span>Helper</span></div>

        {visibleLeagues.length > 0 && (
          <select
            className="league-select"
            value={leagueId ?? ""}
            onChange={(e) => setLeagueId(e.target.value)}
          >
            {visibleLeagues.map((l) => (
              <option key={l.league_id} value={l.league_id}>
                {l.name}{showAll && !isDynastyLeague(l) ? " (not dynasty)" : ""}
              </option>
            ))}
          </select>
        )}
        {hiddenCount > 0 && dynastyLeagues.length > 0 && (
          <button
            className="btn"
            onClick={() => setShowAll(!showAll)}
            title={showAll
              ? "Show only dynasty leagues"
              : `Also show ${hiddenCount} redraft/survivor league${hiddenCount === 1 ? "" : "s"}`}
          >
            {showAll ? "Dynasty only" : `+${hiddenCount} other`}
          </button>
        )}
        {data && <span className="format-chip">{data.format.label} · Week {data.week}</span>}

        <div className="spacer" />
        <span className="muted" style={{ fontSize: 13 }}>{user.display_name}</span>
        <button className="btn" onClick={hardRefresh} title="Clear cached data and reload">Refresh</button>
        <button
          className="btn"
          onClick={() => {
            try { localStorage.removeItem(USER_KEY); localStorage.removeItem(LEAGUE_KEY); } catch { /* ignore */ }
            setUser(null); setLeagues(null); setData(null); setLeagueId(null);
          }}
        >
          Sign out
        </button>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {error && <div className="notice err" style={{ marginBottom: 16 }}>{error}</div>}

        {data?.format.valuesApproximated && (
          <div className="notice info" style={{ marginBottom: 16 }}>
            This league has {data.league.total_rosters} teams. Published dynasty value sets only go up
            to 16, so values here use the closest available set and understate how scarce talent is.
            Treat the rankings as directional.
          </div>
        )}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <div>{status}</div>
          </div>
        )}

        {!loading && data && (
          <>
            {tab === "team" && (
              shownTeam ? (
                <>
                  {viewRosterId != null && shownTeam && !shownTeam.isMe && (
                    <div className="row" style={{ marginBottom: 14 }}>
                      <strong style={{ fontSize: 16 }}>{shownTeam.teamName}</strong>
                      <span className="muted">{shownTeam.ownerName}</span>
                      <button className="btn" onClick={() => setViewRosterId(null)}>Back to my team</button>
                    </div>
                  )}
                  <TeamOverview team={shownTeam} teams={data.teams} league={data.league} />
                </>
              ) : (
                <div className="notice info">
                  You don't own a roster in this league — pick a team from Power Rankings to inspect it.
                </div>
              )
            )}

            {tab === "league" && <PowerRankings teams={data.teams} onPick={onPickTeam} />}

            {tab === "players" && (
              <PlayersTab teams={data.teams} trendingAdd={data.trendingAdd} players={data.players} />
            )}

            {tab === "trades" && (
              <TransactionsTab transactions={data.transactions} teams={data.teams} players={data.players} />
            )}

            {tab === "chat" && chatCtx && <Chat ctx={chatCtx} />}
          </>
        )}
      </main>
    </div>
  );
}
