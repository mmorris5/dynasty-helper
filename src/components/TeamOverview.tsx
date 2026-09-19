import type { League } from "../types";
import { positionAverages, type TeamView } from "../lib/analytics";
import { TeamCover } from "./TeamCover";
import { RosterListing } from "./RosterListing";

const money = (n: number) => Math.round(n).toLocaleString();
const POS = ["QB", "RB", "WR", "TE"] as const;
const COLORS: Record<string, string> = {
  QB: "var(--qb)", RB: "var(--rb)", WR: "var(--wr)", TE: "var(--te)",
};

export function TeamOverview({ team, teams, league }: { team: TeamView; teams: TeamView[]; league: League }) {
  const avgs = positionAverages(teams);
  const posTotal = POS.reduce((s, p) => s + (team.byPosition[p] ?? 0), 0);
  const benchValue = team.playerValue - team.starterValue;

  return (
    <>
      <TeamCover team={team} teams={teams} league={league} />

      {/* Editorial split: the roster is the story, the analysis is the margin. */}
      <div className="spread">
        <main className="spread-main">
          <h2 className="rule-head">Team listing <i>{team.players.length} players</i></h2>
          <RosterListing assets={team.players} />
        </main>

        <aside className="spread-rail">
          <section className="rail-block">
            <h3 className="rail-head">Against league average</h3>
            {POS.map((p) => {
              const mine = team.byPosition[p] ?? 0;
              const avg = avgs[p] ?? 0;
              const diff = avg > 0 ? ((mine - avg) / avg) * 100 : 0;
              const max = Math.max(mine, avg, 1);
              return (
                <div className="gauge" key={p}>
                  <div className="gauge-top">
                    <span className={`pos ${p}`}>{p}</span>
                    <b>{money(mine)}</b>
                    <i className={diff >= 0 ? "up" : "down"}>
                      {diff >= 0 ? "+" : ""}{diff.toFixed(0)}%
                    </i>
                  </div>
                  <div className="gauge-track">
                    <div className="gauge-fill" style={{ width: `${(mine / max) * 100}%`, background: COLORS[p] }} />
                    <div className="gauge-mark" style={{ left: `${(avg / max) * 100}%` }} title={`League average ${money(avg)}`} />
                  </div>
                </div>
              );
            })}
            <p className="rail-note">The notch marks the league average.</p>
          </section>

          <section className="rail-block">
            <h3 className="rail-head">Where the value sits</h3>
            <div className="stacked">
              {POS.map((p) => {
                const pct = posTotal > 0 ? ((team.byPosition[p] ?? 0) / posTotal) * 100 : 0;
                return pct > 0 ? (
                  <div key={p} style={{ width: `${pct}%`, background: COLORS[p] }} title={`${p} ${pct.toFixed(0)}%`} />
                ) : null;
              })}
            </div>
            <ul className="key">
              {POS.map((p) => (
                <li key={p}>
                  <i style={{ background: COLORS[p] }} />{p}
                  <b>{posTotal > 0 ? `${(((team.byPosition[p] ?? 0) / posTotal) * 100).toFixed(0)}%` : "0%"}</b>
                </li>
              ))}
            </ul>
            <dl className="split">
              <div><dt>Starting lineup</dt><dd>{money(team.starterValue)}</dd></div>
              <div><dt>Bench &amp; taxi</dt><dd>{money(benchValue)}</dd></div>
            </dl>
          </section>

          <section className="rail-block">
            <h3 className="rail-head">Draft capital <i>{team.picks.length}</i></h3>
            <ol className="picks">
              {team.picks.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <b>{p.value ? money(p.value) : "—"}</b>
                </li>
              ))}
              {!team.picks.length && <li className="muted">No future picks.</li>}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
