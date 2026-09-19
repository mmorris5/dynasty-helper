import type { RosterAsset } from "../lib/analytics";

const money = (n: number) => Math.round(n).toLocaleString();
const ORDER = ["QB", "RB", "WR", "TE"];

/**
 * A program-style team listing: grouped by position with a subtotal per group,
 * rather than one flat sortable grid. Reading down a position group is how you
 * actually assess dynasty depth.
 */
export function RosterListing({ assets }: { assets: RosterAsset[] }) {
  const groups = new Map<string, RosterAsset[]>();
  for (const a of assets) {
    const key = ORDER.includes(a.position) ? a.position : "OTHER";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  const keys = [...ORDER.filter((p) => groups.has(p)), ...(groups.has("OTHER") ? ["OTHER"] : [])];

  if (!assets.length) return <p className="muted">No players rostered.</p>;

  return (
    <div className="listing">
      {keys.map((pos) => {
        const rows = groups.get(pos)!.sort((a, b) => b.value - a.value);
        const subtotal = rows.reduce((s, a) => s + a.value, 0);
        return (
          <section className="listing-group" key={pos}>
            <h4 className={`listing-head ${pos}`}>
              <span className="listing-pos">{pos === "OTHER" ? "Other" : pos}</span>
              <span className="listing-count">{rows.length}</span>
              <span className="listing-sub">{money(subtotal)}</span>
            </h4>
            <ol className="listing-rows">
              {rows.map((a) => (
                <li className={`listing-row${a.isStarter ? " is-starter" : ""}`} key={a.id}>
                  <span className="listing-name">
                    {a.name}
                    {a.team && <em> · {a.team}</em>}
                    {a.onTaxi && <span className="tag">taxi</span>}
                    {a.onIr && <span className="tag">IR</span>}
                    {a.injury && a.injury.toUpperCase() !== "IR" && (
                      <span className="tag inj">{a.injury}</span>
                    )}
                  </span>
                  <span className="listing-age">{a.age != null ? a.age.toFixed(0) : "—"}</span>
                  <span className="listing-val">{a.value ? money(a.value) : "—"}</span>
                  <span className={`listing-trend ${a.trend30Day > 0 ? "up" : a.trend30Day < 0 ? "down" : ""}`}>
                    {a.trend30Day ? `${a.trend30Day > 0 ? "+" : ""}${money(a.trend30Day)}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
