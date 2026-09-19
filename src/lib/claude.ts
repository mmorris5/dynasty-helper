import Anthropic from "@anthropic-ai/sdk";
import type { League, LeagueFormat } from "../types";
import type { TeamView } from "./analytics";
import { contentionLabel, positionAverages, rosterHoles } from "./analytics";

export const MODEL = "claude-opus-5";
const KEY_STORAGE = "dynasty-helper:anthropic-key";

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* storage blocked; chat will prompt again next load */
  }
}

function client(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: { "anthropic-dangerous-direct-browser-access": "true" },
  });
}

export interface LeagueContext {
  league: League;
  format: LeagueFormat;
  teams: TeamView[];
  myTeam: TeamView | null;
  week: number;
  transactionsSummary: string;
}

const money = (n: number) => Math.round(n).toLocaleString();

function describeTeam(t: TeamView, ctx: LeagueContext, full: boolean): string {
  const rank = ctx.teams.findIndex((x) => x.rosterId === t.rosterId) + 1;
  const lines = [
    `${t.teamName} (${t.ownerName}) — dynasty rank ${rank}/${ctx.teams.length}`,
    `Record ${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}, ${t.pointsFor.toFixed(1)} PF`,
    `Total value ${money(t.totalValue)} (players ${money(t.playerValue)}, picks ${money(t.pickValue)})`,
    `Value-weighted age ${t.weightedAge?.toFixed(1) ?? "n/a"} — ${contentionLabel(t, ctx.teams)}`,
    `By position: ${["QB", "RB", "WR", "TE"].map((p) => `${p} ${money(t.byPosition[p] ?? 0)}`).join(", ")}`,
  ];
  const holes = rosterHoles(t, ctx.league);
  if (holes.length) lines.push(`Roster gaps: ${holes.join("; ")}`);

  if (full) {
    lines.push("Players:");
    for (const p of t.players) {
      const flags = [
        p.isStarter ? "starter" : null,
        p.onTaxi ? "taxi" : null,
        p.onIr ? "IR" : null,
        p.injury,
      ].filter(Boolean).join("/");
      lines.push(
        `  ${p.name} ${p.position}${p.team ? ` ${p.team}` : ""}` +
        ` age ${p.age ?? "?"} value ${money(p.value)}` +
        (p.positionRank ? ` (${p.position}${p.positionRank})` : "") +
        (p.trend30Day ? ` 30d ${p.trend30Day > 0 ? "+" : ""}${p.trend30Day}` : "") +
        (flags ? ` [${flags}]` : ""),
      );
    }
    lines.push(`Picks: ${t.picks.map((p) => `${p.name} (${money(p.value)})`).join(", ") || "none"}`);
  }
  return lines.join("\n");
}

function systemPrompt(ctx: LeagueContext): string {
  const avgs = positionAverages(ctx.teams);
  return [
    "You are a sharp dynasty fantasy football analyst helping the user manage a specific team.",
    "",
    "How to work:",
    "- Use the tools to pull roster, player, and trade data before giving a verdict. Do not guess at values.",
    "- Dynasty values come from FantasyCalc community consensus for this league's exact format. They are a starting point for negotiation, not gospel — weigh age, situation, positional scarcity, and the team's contention window on top of them.",
    "- Be direct and give an actual recommendation. Say accept, decline, or counter, and why.",
    "- A trade that loses raw value can still be right (consolidating for a contender, selling age for a rebuilder). Say so when it applies.",
    "- Keep answers tight. Lead with the verdict, then the reasoning that matters.",
    "- You cannot execute trades or change the roster. You are giving advice.",
    "",
    `League: ${ctx.league.name} — ${ctx.format.label}, week ${ctx.week}, season ${ctx.league.season}.`,
    `Starting lineup: ${ctx.league.roster_positions.filter((p) => !["BN", "IR", "TAXI"].includes(p)).join(", ")}.`,
    `League average value by position: ${["QB", "RB", "WR", "TE"].map((p) => `${p} ${money(avgs[p] ?? 0)}`).join(", ")}.`,
    "",
    ctx.myTeam
      ? `THE USER'S TEAM (full roster below):\n${describeTeam(ctx.myTeam, ctx, true)}`
      : "The user has not selected a team in this league.",
    "",
    "Standings by dynasty value:",
    ...ctx.teams.map((t, i) =>
      `${i + 1}. ${t.teamName} — ${money(t.totalValue)} (${t.wins}-${t.losses}), age ${t.weightedAge?.toFixed(1) ?? "?"}`),
    "",
    ctx.transactionsSummary ? `Recent league activity:\n${ctx.transactionsSummary}` : "",
  ].filter(Boolean).join("\n");
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_team_roster",
    description:
      "Full roster, picks, values, and positional breakdown for one team in the league. Use before evaluating any trade involving that team.",
    input_schema: {
      type: "object",
      properties: {
        team: { type: "string", description: "Team name or owner name. Use 'me' for the user's own team." },
      },
      required: ["team"],
    },
  },
  {
    name: "lookup_players",
    description:
      "Dynasty value, age, positional rank, 30-day trend, and current roster owner for one or more players or draft picks. Pick names look like '2027 1st'.",
    input_schema: {
      type: "object",
      properties: {
        names: { type: "array", items: { type: "string" }, description: "Player or pick names." },
      },
      required: ["names"],
    },
  },
  {
    name: "evaluate_trade",
    description:
      "Compute the dynasty value math for a proposed trade from the user's perspective. Returns per-asset values and the net difference. Always follow up with judgment — raw value is not the whole answer.",
    input_schema: {
      type: "object",
      properties: {
        give: { type: "array", items: { type: "string" }, description: "Assets the user sends away." },
        receive: { type: "array", items: { type: "string" }, description: "Assets the user gets back." },
      },
      required: ["give", "receive"],
    },
  },
  {
    name: "list_teams",
    description: "Every team in the league with dynasty value, record, contention window, and positional strengths. Use to find a trade partner.",
    input_schema: { type: "object", properties: {} },
  },
];

function executeTool(name: string, input: any, ctx: LeagueContext): string {
  const findTeam = (q: string): TeamView | null => {
    const s = String(q ?? "").trim().toLowerCase();
    if (!s || s === "me" || s === "my team" || s === "mine") return ctx.myTeam;
    return (
      ctx.teams.find((t) => t.teamName.toLowerCase() === s || t.ownerName.toLowerCase() === s) ??
      ctx.teams.find((t) => t.teamName.toLowerCase().includes(s) || t.ownerName.toLowerCase().includes(s)) ??
      null
    );
  };

  const findAsset = (q: string) => {
    const s = String(q ?? "").trim().toLowerCase();
    let best: { asset: any; owner: TeamView } | null = null;
    for (const t of ctx.teams) {
      for (const a of t.assets) {
        const n = a.name.toLowerCase();
        if (n === s || n.startsWith(s) || n.includes(s)) {
          if (!best || a.value > best.asset.value) best = { asset: a, owner: t };
        }
      }
    }
    return best;
  };

  switch (name) {
    case "get_team_roster": {
      const t = findTeam(input.team);
      if (!t) return `No team matching "${input.team}". Teams: ${ctx.teams.map((x) => x.teamName).join(", ")}`;
      return describeTeam(t, ctx, true);
    }
    case "lookup_players": {
      const names: string[] = Array.isArray(input.names) ? input.names : [];
      return names.map((n) => {
        const hit = findAsset(n);
        if (!hit) return `${n}: not found on any roster in this league (likely a free agent or not a rostered asset).`;
        const a = hit.asset;
        return `${a.name} — ${a.position}${a.team ? ` ${a.team}` : ""}, age ${a.age ?? "?"}, value ${money(a.value)}` +
          (a.positionRank ? `, ${a.position}${a.positionRank}` : "") +
          (a.trend30Day ? `, 30-day trend ${a.trend30Day > 0 ? "+" : ""}${a.trend30Day}` : "") +
          `, rostered by ${hit.owner.teamName}${hit.owner.isMe ? " (the user)" : ""}`;
      }).join("\n");
    }
    case "evaluate_trade": {
      const give: string[] = Array.isArray(input.give) ? input.give : [];
      const receive: string[] = Array.isArray(input.receive) ? input.receive : [];
      const price = (list: string[]) =>
        list.map((n) => {
          const hit = findAsset(n);
          return { name: n, value: hit?.asset.value ?? 0, resolved: hit?.asset.name ?? null, owner: hit?.owner.teamName ?? null };
        });
      const g = price(give);
      const r = price(receive);
      const gSum = g.reduce((s, x) => s + x.value, 0);
      const rSum = r.reduce((s, x) => s + x.value, 0);
      const net = rSum - gSum;
      const pct = gSum > 0 ? ((net / gSum) * 100).toFixed(1) : "n/a";
      return [
        "User sends:",
        ...g.map((x) => `  ${x.resolved ?? x.name}${x.resolved ? "" : " (UNRESOLVED)"} — ${money(x.value)}${x.owner ? ` [${x.owner}]` : ""}`),
        `  subtotal ${money(gSum)}`,
        "User receives:",
        ...r.map((x) => `  ${x.resolved ?? x.name}${x.resolved ? "" : " (UNRESOLVED)"} — ${money(x.value)}${x.owner ? ` [${x.owner}]` : ""}`),
        `  subtotal ${money(rSum)}`,
        `Net for the user: ${net >= 0 ? "+" : ""}${money(net)} (${pct}% vs what they give up)`,
        "Note: consolidating two mid assets into one stud usually warrants paying a premium; the reverse warrants a discount.",
      ].join("\n");
    }
    case "list_teams": {
      return ctx.teams.map((t) => describeTeam(t, ctx, false)).join("\n\n");
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StreamHandlers {
  onText: (delta: string) => void;
  onToolUse: (name: string) => void;
}

/**
 * Run one user turn to completion, executing tools locally against league data
 * already loaded in the browser. Returns the final assistant text.
 */
export async function runChat(
  apiKey: string,
  ctx: LeagueContext,
  history: ChatTurn[],
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<string> {
  const anthropic = client(apiKey);
  const messages: Anthropic.MessageParam[] = history.map((h) => ({
    role: h.role,
    content: h.content,
  }));

  const system = systemPrompt(ctx);
  let finalText = "";

  for (let turn = 0; turn < 8; turn++) {
    const stream = anthropic.messages.stream(
      {
        model: MODEL,
        max_tokens: 16000,
        system,
        messages,
        tools: TOOLS,
        thinking: { type: "adaptive" },
      },
      { signal },
    );

    stream.on("text", (delta) => {
      finalText += delta;
      handlers.onText(delta);
    });

    const message = await stream.finalMessage();
    messages.push({ role: "assistant", content: message.content });

    if (message.stop_reason !== "tool_use") {
      return finalText;
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of message.content) {
      if (block.type !== "tool_use") continue;
      handlers.onToolUse(block.name);
      let text: string;
      try {
        text = executeTool(block.name, block.input as any, ctx);
      } catch (err) {
        text = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
      }
      results.push({ type: "tool_result", tool_use_id: block.id, content: text });
    }
    messages.push({ role: "user", content: results });
  }
  return finalText || "I ran out of tool steps before reaching an answer. Try narrowing the question.";
}
