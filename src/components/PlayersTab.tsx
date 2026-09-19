import { useMemo, useState } from "react";
import type { RosterAsset, TeamView } from "../lib/analytics";
import { RosterTable } from "./RosterTable";
import type { PlayerMeta } from "../types";
import type { TrendingPlayer } from "../lib/sleeper";

const money = (n: number) => Math.round(n).toLocaleString();

export function PlayersTab({
  teams, trendingAdd, players,
}: {
  teams: TeamView[];
  trendingAdd: TrendingPlayer[];
  players: Record<string, PlayerMeta>;
}) {
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("ALL");

  const ownerOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams) for (const a of t.assets) m.set(a.id, t.teamName);
    return m;
  }, [teams]);

  const all = useMemo(() => {
    const out: RosterAsset[] = [];
    for (const t of teams) out.push(...t.players);
    return out.sort((a, b) => b.value - a.value);
  }, [teams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((a) => {
      if (pos !== "ALL" && a.position !== pos) return false;
      if (!q) return true;
      return a.name.toLowerCase().includes(q) || (a.team ?? "").toLowerCase().includes(q);
    });
  }, [all, query, pos]);

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <input
          className="search"
          placeholder="Search rostered players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="league-select" value={pos} onChange={(e) => setPos(e.target.value)}>
          <option value="ALL">All positions</option>
          {["QB", "RB", "WR", "TE"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="muted">{filtered.length} players</span>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <RosterTable assets={filtered.slice(0, 300)} showOwner={(a) => ownerOf.get(a.id) ?? "—"} />
      </div>

      <div className="section-title">Trending adds (last 24h, all of Sleeper)</div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th className="no-sort">Player</th>
              <th className="no-sort">Rostered by</th>
              <th className="no-sort num">Adds</th>
            </tr>
          </thead>
          <tbody>
            {trendingAdd.slice(0, 15).map((t) => {
              const meta = players[t.player_id];
              return (
                <tr key={t.player_id}>
                  <td>
                    <span className={`pos ${meta?.position ?? ""}`}>{meta?.position ?? "?"}</span>{" "}
                    {meta?.name ?? t.player_id}
                    {meta?.team && <span className="muted"> · {meta.team}</span>}
                  </td>
                  <td className="muted">{ownerOf.get(t.player_id) ?? "Free agent"}</td>
                  <td className="num">{money(t.count)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
