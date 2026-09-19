import { useMemo, useState } from "react";
import type { RosterAsset } from "../lib/analytics";

type SortKey = "value" | "name" | "position" | "age" | "trend30Day";

const money = (n: number) => Math.round(n).toLocaleString();

/**
 * Sleeper reports an IR slot and an injury status separately, and for a
 * player on IR both say "IR" — so dedupe before rendering.
 */
function statusTags(a: RosterAsset): Array<{ label: string; hurt: boolean }> {
  const out: Array<{ label: string; hurt: boolean }> = [];
  const seen = new Set<string>();
  const add = (label: string | null, hurt: boolean) => {
    if (!label) return;
    const key = label.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, hurt });
  };
  add(a.onIr ? "IR" : null, false);
  add(a.injury, true);
  return out;
}

export function RosterTable({ assets, showOwner }: { assets: RosterAsset[]; showOwner?: (a: RosterAsset) => string }) {
  const [sort, setSort] = useState<SortKey>("value");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const copy = [...assets];
    copy.sort((a, b) => {
      let d: number;
      if (sort === "name") d = a.name.localeCompare(b.name);
      else if (sort === "position") d = a.position.localeCompare(b.position) || b.value - a.value;
      else if (sort === "age") d = (a.age ?? 99) - (b.age ?? 99);
      else if (sort === "trend30Day") d = a.trend30Day - b.trend30Day;
      else d = a.value - b.value;
      return asc ? d : -d;
    });
    return copy;
  }, [assets, sort, asc]);

  function head(key: SortKey, label: string, cls = "") {
    const active = sort === key;
    return (
      <th
        className={cls}
        onClick={() => {
          if (active) setAsc(!asc);
          else { setSort(key); setAsc(key === "name" || key === "age"); }
        }}
      >
        {label}{active ? (asc ? " ↑" : " ↓") : ""}
      </th>
    );
  }

  if (!assets.length) return <p className="muted">No assets to show.</p>;

  return (
    <table className={`table${showOwner ? " with-owner" : ""}`}>
      <thead>
        <tr>
          {head("position", "Pos")}
          {head("name", "Player")}
          {showOwner && <th className="no-sort">Owner</th>}
          {head("age", "Age", "num")}
          {head("value", "Value", "num")}
          {head("trend30Day", "30d", "num")}
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td><span className={`pos ${a.position}`}>{a.position}</span></td>
            <td>
              {a.isStarter && <span className="starter-dot" title="In starting lineup">●</span>}
              {a.name}
              {a.team && <span className="muted"> · {a.team}</span>}
              {a.positionRank > 0 && <span className="tag">{a.position}{a.positionRank}</span>}
              {a.onTaxi && <span className="tag">taxi</span>}
              {statusTags(a).map((t) => (
                <span className={`tag${t.hurt ? " inj" : ""}`} key={t.label}>{t.label}</span>
              ))}
            </td>
            {showOwner && <td className="muted" data-label="Owner">{showOwner(a)}</td>}
            <td className="num" data-label="Age">{a.age != null ? a.age.toFixed(1) : "—"}</td>
            <td className="num" data-label="Value">{a.value ? money(a.value) : <span className="muted">—</span>}</td>
            <td className={`num trend ${a.trend30Day > 0 ? "up" : a.trend30Day < 0 ? "down" : ""}`} data-label="30d">
              {a.trend30Day ? `${a.trend30Day > 0 ? "+" : ""}${money(a.trend30Day)}` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
