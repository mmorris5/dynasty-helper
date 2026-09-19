import { useState } from "react";
import { getUser } from "../lib/sleeper";
import type { SleeperUser } from "../types";

export function Setup({ onReady }: { onReady: (user: SleeperUser) => void }) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const user = await getUser(username);
    setBusy(false);
    if (!user) {
      setError(`No Sleeper user named "${username.trim()}". Use your username, not your display name.`);
      return;
    }
    onReady(user);
  }

  return (
    <div className="center-wrap">
      <form className="setup" onSubmit={submit}>
        <h1>Dynasty <span style={{ color: "var(--accent)" }}>Helper</span></h1>
        <p>Roster analysis, dynasty values, and trade advice for your Sleeper leagues.</p>

        <div className="field">
          <label htmlFor="username">Sleeper username</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_sleeper_username"
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <span className="hint">
            Read-only and public — no password or login needed.
          </span>
        </div>

        {error && <div className="notice err" style={{ marginBottom: 14 }}>{error}</div>}

        <button className="btn primary" type="submit" disabled={busy || !username.trim()} style={{ width: "100%" }}>
          {busy ? "Looking you up…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
