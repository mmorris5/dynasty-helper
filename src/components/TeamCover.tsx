import type { League } from "../types";
import { contentionLabel, rosterHoles, type TeamView } from "../lib/analytics";

const money = (n: number) => Math.round(n).toLocaleString();

/**
 * The program "cover": one masthead block carrying the team's identity and a
 * run-in stat line, instead of a row of equal-weight metric boxes.
 */
export function TeamCover({ team, teams, league }: { team: TeamView; teams: TeamView[]; league: League }) {
  const rank = teams.findIndex((t) => t.rosterId === team.rosterId) + 1;
  const holes = rosterHoles(team, league);

  return (
    <header className="cover">
      <div className="cover-rank">
        <b>{String(rank).padStart(2, "0")}</b>
        <i>of {teams.length}</i>
      </div>

      <div className="cover-body">
        <h1>{team.teamName}</h1>
        <p className="cover-owner">{team.ownerName} · {contentionLabel(team, teams)}</p>

        <dl className="cover-line">
          <div><dt>Total value</dt><dd>{money(team.totalValue)}</dd></div>
          <div><dt>Record</dt><dd>{team.wins}&ndash;{team.losses}{team.ties ? `–${team.ties}` : ""}</dd></div>
          <div><dt>Weighted age</dt><dd>{team.weightedAge?.toFixed(1) ?? "—"}</dd></div>
          <div><dt>Draft capital</dt><dd>{money(team.pickValue)}</dd></div>
          <div><dt>Starters</dt><dd>{money(team.starterValue)}</dd></div>
        </dl>

        {holes.length > 0 && (
          <p className="cover-flag">
            <span>Needs attention</span> {holes.join(" · ")}
          </p>
        )}
      </div>
    </header>
  );
}
