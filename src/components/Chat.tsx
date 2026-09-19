import { useEffect, useRef, useState } from "react";
import { getApiKey, runChat, setApiKey, type ChatTurn, type LeagueContext } from "../lib/claude";

interface Rendered extends ChatTurn {
  tools?: string[];
}

const TOOL_LABEL: Record<string, string> = {
  get_team_roster: "Reading roster",
  lookup_players: "Looking up players",
  evaluate_trade: "Running trade math",
  list_teams: "Scanning the league",
};

/** Minimal inline formatter: **bold** plus bullet lines. */
function Body({ text }: { text: string }) {
  const blocks = text.split("\n");
  return (
    <>
      {blocks.map((line, i) => {
        const bullet = /^\s*[-*]\s+/.test(line);
        const content = line.replace(/^\s*[-*]\s+/, "");
        const parts = content.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        const rendered = parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>,
        );
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
        return (
          <div key={i} style={bullet ? { paddingLeft: 16, textIndent: -10 } : undefined}>
            {bullet ? "• " : ""}{rendered}
          </div>
        );
      })}
    </>
  );
}

export function Chat({ ctx }: { ctx: LeagueContext }) {
  const [key, setKey] = useState(getApiKey());
  const [keyInput, setKeyInput] = useState("");
  const [turns, setTurns] = useState<Rendered[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const suggestions = [
    "Should I buy or sell in this league right now?",
    "What's my biggest roster weakness, and who should I target to fix it?",
    "Which of my players should I sell high before they lose value?",
    "Find me a realistic trade partner and propose a deal both sides would accept.",
  ];

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setDraft("");

    const history: ChatTurn[] = [
      ...turns.map((t) => ({ role: t.role, content: t.content })),
      { role: "user" as const, content: question },
    ];
    setTurns((t) => [...t, { role: "user", content: question }, { role: "assistant", content: "", tools: [] }]);
    setBusy(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await runChat(key, ctx, history, {
        onText: (delta) => {
          setTurns((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, content: last.content + delta };
            return copy;
          });
        },
        onToolUse: (name) => {
          setTurns((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, tools: [...(last.tools ?? []), name] };
            return copy;
          });
        },
      }, ac.signal);
    } catch (err: any) {
      const msg = err?.status === 401
        ? "That API key was rejected. Check it and try again."
        : err?.status === 429
        ? "Rate limited by the Anthropic API — wait a moment and retry."
        : err?.name === "AbortError"
        ? null
        : err?.message ?? String(err);
      if (msg) setError(msg);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  if (!key) {
    return (
      <div className="center-wrap">
        <div className="setup">
          <h1>Connect Claude</h1>
          <p>
            This app is fully static, so chat talks to the Anthropic API straight from your browser.
            Paste an API key to enable it.
          </p>
          <div className="field">
            <label htmlFor="apikey">Anthropic API key</label>
            <input
              id="apikey"
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
            />
            <span className="hint">
              Stored only in this browser's localStorage. It is never committed to the repo
              and never sent anywhere except api.anthropic.com. Get one at console.anthropic.com.
            </span>
          </div>
          <button
            className="btn primary"
            style={{ width: "100%" }}
            disabled={!keyInput.trim()}
            onClick={() => { setApiKey(keyInput.trim()); setKey(keyInput.trim()); }}
          >
            Save key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat">
      <div className="chat-log" ref={logRef}>
        {turns.length === 0 && (
          <>
            <div className="notice info" style={{ marginBottom: 6 }}>
              Claude can see your full roster, every other team, dynasty values, and draft capital
              for <strong>{ctx.league.name}</strong>. Ask it anything.
            </div>
            <div className="suggestions">
              {suggestions.map((s) => (
                <button key={s} className="suggestion" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </>
        )}

        {turns.map((t, i) => (
          <div className={`msg ${t.role}`} key={i}>
            <div className="who">{t.role === "user" ? "You" : "AI"}</div>
            <div className="body">
              {t.tools && t.tools.length > 0 && (
                <div>
                  {t.tools.map((tool, j) => (
                    <span className="tool-chip" key={j}>{TOOL_LABEL[tool] ?? tool}</span>
                  ))}
                </div>
              )}
              {t.content ? <Body text={t.content} /> : (
                t.role === "assistant" && busy ? <span className="muted">Thinking…</span> : null
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="notice err" style={{ marginTop: 12 }}>{error}</div>}

      <div className="chat-input">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); }
          }}
          placeholder="Ask about a trade, a start/sit, or who to target…"
        />
        {busy ? (
          <button className="btn" onClick={() => abortRef.current?.abort()}>Stop</button>
        ) : (
          <button className="btn primary" onClick={() => send(draft)} disabled={!draft.trim()}>Send</button>
        )}
      </div>
    </div>
  );
}
