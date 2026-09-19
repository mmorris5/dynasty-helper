import type { TeamView } from "../lib/analytics";
import { contentionLabel } from "../lib/analytics";

const money = (n: number) => Math.round(n).toLocaleString();

export function PowerRankings({ teams, onPick }: { teams: TeamView[]; onPick: (t: TeamView) => void }) {
  const max = Math.max(...teams.map((t) => t.totalValue), 1);

  return (
    <>
      <div className="card">
        <h3>Dynasty value — every asset, players and picks</h3>
        {teams.map((t, i) => (
          <div className="bar-row" key={t.rosterId}>
            <div className="bar-track" style={{ cursor: "pointer" }} onClick={() => onPick(t)}>
              <div className={`bar-fill ${t.isMe ? "me" : ""}`} style={{ width: `${(t.totalValue / max) * 100}%` }} />
              <div className="bar-label">
                <strong>{i + 1}.</strong> {t.teamName}
                {t.isMe && <span className="tag" style={{ color: "var(--good)" }}>you</span>}
              </div>
            </div>
            <span className="num" style={{ minWidth: 70, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {money(t.totalValue)}
            </span>
          </div>
        ))}
      </div>

      <div className="section-title">Team detail</div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th className="no-sort">#</th>
              <th className="no-sort">Team</th>
              <th className="no-sort">Record</th>
              <th className="no-sort num">Players</th>
              <th className="no-sort num">Picks</th>
              <th className="no-sort num">Age</th>
              <th className="no-sort">Window</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr key={t.rosterId} style={{ cursor: "pointer" }} onClick={() => onPick(t)}>
                <td className="muted">{i + 1}</td>
                <td>
                  {t.teamName}
                  {t.isMe && <span className="tag" style={{ color: "var(--good)" }}>you</span>}
                  <div className="muted" style={{ fontSize: 12 }}>{t.ownerName}</div>
                </td>
                <td className="muted">{t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""}</td>
                <td className="num">{money(t.playerValue)}</td>
                <td className="num">{money(t.pickValue)}</td>
                <td className="num">{t.weightedAge != null ? t.weightedAge.toFixed(1) : "—"}</td>
                <td className="muted" style={{ fontSize: 12 }}>{contentionLabel(t, teams)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
