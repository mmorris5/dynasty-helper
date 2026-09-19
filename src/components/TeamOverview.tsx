import type { League } from "../types";
import { contentionLabel, positionAverages, rosterHoles, type TeamView } from "../lib/analytics";
import { RosterTable } from "./RosterTable";

const money = (n: number) => Math.round(n).toLocaleString();
const POS = ["QB", "RB", "WR", "TE"] as const;
const COLORS: Record<string, string> = { QB: "var(--qb)", RB: "var(--rb)", WR: "var(--wr)", TE: "var(--te)" };

export function TeamOverview({ team, teams, league }: { team: TeamView; teams: TeamView[]; league: League }) {
  const rank = teams.findIndex((t) => t.rosterId === team.rosterId) + 1;
  const avgs = positionAverages(teams);
  const holes = rosterHoles(team, league);
  const posTotal = POS.reduce((s, p) => s + (team.byPosition[p] ?? 0), 0);

  return (
    <>
      <div className="grid cols-4">
        <div className="card stat">
          <div className="value">#{rank}<span className="muted" style={{ fontSize: 16 }}>/{teams.length}</span></div>
          <div className="label">Dynasty power rank</div>
          <div className="sub">{money(team.totalValue)} total value</div>
        </div>
        <div className="card stat">
          <div className="value">{team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ""}</div>
          <div className="label">Record</div>
          <div className="sub">{team.pointsFor.toFixed(1)} points for</div>
        </div>
        <div className="card stat">
          <div className="value">{team.weightedAge != null ? team.weightedAge.toFixed(1) : "—"}</div>
          <div className="label">Value-weighted age</div>
          <div className="sub">{contentionLabel(team, teams)}</div>
        </div>
        <div className="card stat">
          <div className="value">{money(team.pickValue)}</div>
          <div className="label">Draft capital</div>
          <div className="sub">{team.picks.length} future pick{team.picks.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Positional value vs league average</h3>
          {POS.map((p) => {
            const mine = team.byPosition[p] ?? 0;
            const avg = avgs[p] ?? 0;
            const max = Math.max(mine, avg, 1);
            const diff = avg > 0 ? ((mine - avg) / avg) * 100 : 0;
            return (
              <div key={p} style={{ marginBottom: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                  <span><span className={`pos ${p}`}>{p}</span> <span className="muted">{money(mine)}</span></span>
                  <span className={diff >= 0 ? "trend up" : "trend down"}>
                    {diff >= 0 ? "+" : ""}{diff.toFixed(0)}% vs avg
                  </span>
                </div>
                <div className="bar-track" style={{ height: 8 }}>
                  <div className="bar-fill" style={{ width: `${(mine / max) * 100}%`, background: COLORS[p], height: 8 }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <h3>Roster composition</h3>
          <div className="stacked" title="Share of player value by position">
            {POS.map((p) => {
              const v = team.byPosition[p] ?? 0;
              const pct = posTotal > 0 ? (v / posTotal) * 100 : 0;
              return pct > 0 ? (
                <div key={p} style={{ width: `${pct}%`, background: COLORS[p] }} title={`${p} ${pct.toFixed(0)}%`} />
              ) : null;
            })}
          </div>
          <div className="row" style={{ marginTop: 10, gap: 14 }}>
            {POS.map((p) => (
              <span key={p} className="muted" style={{ fontSize: 12 }}>
                <span style={{ color: COLORS[p] }}>■</span> {p}{" "}
                {posTotal > 0 ? `${(((team.byPosition[p] ?? 0) / posTotal) * 100).toFixed(0)}%` : "0%"}
              </span>
            ))}
          </div>

          <h3 style={{ marginTop: 20 }}>Starters vs bench</h3>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Starting lineup</span><strong>{money(team.starterValue)}</strong>
          </div>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
            <span className="muted">Bench & taxi</span>
            <span className="muted">{money(team.playerValue - team.starterValue)}</span>
          </div>

          {holes.length > 0 && (
            <>
              <h3 style={{ marginTop: 20 }}>Roster gaps</h3>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--warn)" }}>
                {holes.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="section-title">Roster ({team.players.length} players)</div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <RosterTable assets={team.players} />
      </div>

      <div className="section-title">Draft picks</div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <RosterTable assets={team.picks} />
      </div>
    </>
  );
}
