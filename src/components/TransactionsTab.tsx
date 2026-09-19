import type { Transaction } from "../types";
import type { TeamView } from "../lib/analytics";
import type { PlayerMeta } from "../types";
import { ordinal } from "../lib/values";

export function TransactionsTab({
  transactions, teams, players,
}: {
  transactions: Transaction[];
  teams: TeamView[];
  players: Record<string, PlayerMeta>;
}) {
  const teamByRoster = new Map(teams.map((t) => [t.rosterId, t]));
  const name = (id: string) => players[id]?.name ?? id;
  const teamName = (rid: number) => teamByRoster.get(rid)?.teamName ?? `Roster ${rid}`;

  const trades = transactions.filter((t) => t.type === "trade" && t.status === "complete");

  if (!trades.length) {
    return <div className="notice info">No completed trades in the last few weeks of this league.</div>;
  }

  return (
    <>
      <div className="section-title">Recent trades</div>
      {trades.map((t) => (
        <div className="card" key={t.transaction_id} style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            {new Date(t.status_updated).toLocaleDateString(undefined, {
              month: "short", day: "numeric", year: "numeric",
            })}
          </div>
          <div className="grid cols-2">
            {t.roster_ids.map((rid) => {
              const gained = Object.entries(t.adds ?? {}).filter(([, r]) => r === rid).map(([pid]) => name(pid));
              const picks = (t.draft_picks ?? []).filter((p) => p.owner_id === rid)
                .map((p) => `${p.season} ${ordinal(p.round)}`);
              const faab = (t.waiver_budget ?? []).filter((w) => w.receiver === rid)
                .map((w) => `$${w.amount} FAAB`);
              const all = [...gained, ...picks, ...faab];
              return (
                <div key={rid}>
                  <strong>{teamName(rid)}</strong> receives
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {all.length ? all.map((x) => <li key={x}>{x}</li>) : <li className="muted">nothing</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
