# Dynasty Helper

Roster analysis, dynasty trade values, and Claude-powered advice for your Sleeper dynasty leagues.

Fully static — it runs entirely in the browser and deploys to GitHub Pages. There is no server and no database.

## What it does

**My Team** — your roster priced with dynasty trade values, plus draft capital, value-weighted age
(the contention signal that record alone hides), positional strength against the league average,
starter-vs-bench split, and flagged roster gaps.

**Power Rankings** — every team ranked by total dynasty value of players *and* picks, not by record.
Click any team to inspect its roster.

**Players** — search every rostered player in the league by value, age, positional rank, and 30-day
trend. Includes Sleeper's league-wide trending adds.

**Trades** — recent completed trades in your league, with players, picks, and FAAB.

**Ask Claude** — chat about trades and roster decisions. Claude can pull any team's roster, look up
players, run trade math, and scan the league for a trade partner before answering.

## Data sources

| Source | Used for | Auth |
|---|---|---|
| [Sleeper API](https://docs.sleeper.com/) | leagues, rosters, matchups, transactions, traded picks, players | none (public, read-only) |
| [FantasyCalc](https://fantasycalc.com/) | dynasty trade values matched to your league's format | none |
| [Anthropic API](https://console.anthropic.com/) | the chat tab only | your API key |

League format is detected from your league settings — superflex vs 1QB, team count, PPR, and TE
premium — and the matching value set is used. Superflex in particular changes quarterback values by
multiples, so this matters.

Sleeper's player dictionary is ~2.5 MB gzipped. It is fetched once and cached in IndexedDB for a day.

## Running locally

```bash
npm install
npm run dev
```

Then enter your Sleeper **username** (not display name). Nothing else to configure.

## League filtering

The picker shows only your **dynasty** leagues, detected from Sleeper's `settings.type` (`2` =
dynasty). Redraft, best ball, keeper, and survivor leagues are hidden, since dynasty trade values
don't mean anything in them.

If you have leagues it filters out, a **+N other** button appears next to the picker to show them
anyway, labelled `(not dynasty)`. The choice is remembered. If none of your leagues are dynasty,
every league is shown rather than an empty picker.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. The included workflow builds and deploys automatically.

The workflow sets the Vite base path from the repo name, so both project sites
(`<user>.github.io/<repo>/`) and user sites (`<user>.github.io`) work without edits.

## About the API key

The chat tab talks to the Anthropic API directly from your browser, because a static site has no
backend to hold a secret.

- The key is entered in the UI and stored **only in your browser's localStorage**.
- It is never committed, never bundled into the build, and never sent anywhere except
  `api.anthropic.com`.
- **Never put your key in the repo**, in an `.env` file that gets committed, or anywhere in source.
  Anyone who can read a public repo can read a committed key.
- Anyone using your deployed page uses *their own* key, not yours.

If you would rather not hold a key in a browser at all, the alternative is running a small backend
that keeps the key server-side — which GitHub Pages cannot host.

## Limitations

- Dynasty values are community consensus from FantasyCalc. They are a negotiating baseline, not
  truth, and they lag real-world news by a day or so.
- Published value sets cover 8–16 team leagues. Larger leagues fall back to the closest set and the
  app says so.
- Draft picks are valued generically by round (a "2027 1st"), not by the projected slot of the team
  that owns it, so picks from bad teams are undervalued and picks from good teams overvalued.
- Rookie draft picks beyond round 4 carry no published value and show as 0.
- Sleeper only reports picks that have changed hands; original ownership is inferred.
