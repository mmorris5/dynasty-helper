import type { TeamView } from "../lib/analytics";
import { contentionLabel } from "../lib/analytics";

const money = (n: number) => Math.round(n).toLocaleString();

/**
 * One ranked standings listing rather than a chart stacked on a duplicate
 * table — each row carries its own bar, so the comparison and the detail
 * live in the same place.
 */
export function PowerRankings({ teams, onPick }: { teams: TeamView[]; onPick: (t: TeamView) => void }) {
  const max = Math.max(...teams.map((t) => t.totalValue), 1);

  return (
    <>
      <h2 className="rule-head">Standings by dynasty value <i>players and picks</i></h2>
      <ol className="standings">
        {teams.map((t, i) => (
          <li
            key={t.rosterId}
            className={`standing${t.isMe ? " is-me" : ""}`}
            onClick={() => onPick(t)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(t); } }}
          >
            <span className="standing-rank">{String(i + 1).padStart(2, "0")}</span>
            <span className="standing-id">
              <b>{t.teamName}</b>
              <i>{t.ownerName} · {contentionLabel(t, teams)}</i>
            </span>
            <span className="standing-bar">
              <span className="standing-fill" style={{ width: `${(t.totalValue / max) * 100}%` }} />
              <span className="standing-split">
                <em>{money(t.playerValue)} players</em>
                <em>{money(t.pickValue)} picks</em>
              </span>
            </span>
            <span className="standing-figs">
              <b>{money(t.totalValue)}</b>
              <i>{t.wins}&ndash;{t.losses} · age {t.weightedAge?.toFixed(1) ?? "—"}</i>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
