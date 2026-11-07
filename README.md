# Bingo 2

A points-only 75-ball bingo table, built as plain HTML/CSS/JS with no build step. Open `index.html` and play — solo, or host a live room and invite friends with a 5-character code.

There is **no money here**. Points are score tokens: they cannot be bought, sold, transferred or cashed out. They are used for card costs and pots, and they feed the record that acts as the leaderboard.

Project status, architecture notes and remaining work: [PROJECT.md](PROJECT.md).

## Features

- **Eight win patterns** — any line, four corners, X, T, H, the climbing ladder, bullseye (3×3 target, no free centre) and blackout — each with its own card-cost budget and bonus window.
- **Pattern of the day** — one pattern rotates daily; the 🎯 chip jumps straight to it.
- **Daily streak** — completing today's pattern (solo or seated room round) extends the streak; the HUD shows the live run and your best.
- **Streak freeze** — finish a blackout (solo, or win a blackout room) to bank one freeze. It is spent automatically to cover exactly one missed day.
- **Seven-day history** — a strip under the HUD marks amber for played, ❄ for a frozen day, dim for missed.
- **Freeze reminder** — when a freeze is banked and today's pattern is still unplayed, a reminder names the pattern and offers a switch to it; "Not today" hides it until tomorrow.
- **Solo and room standings** — solo games/wins/win rate, and room games/wins, gross points won, **net** (gross − card costs) and return on cards. Restore codes carry a runner's prizes and record.
- **Live rooms** — host creates a table (pattern, pace, card cost, cards each), adds up to three labelled smart bots, and everyone gets in-room chat. Bots pay card costs but never collect.
- **Portable restore codes** — a checksummed code restores points, both standings, daily streak and banked freeze on another browser (v5, 12 four-character groups). Older v1–v4 codes still decode; codes that carried a streak which has since lapsed say so.

## Playing

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/
```

Solo: pick a pattern (or press 🎯 Today) and start calling. Daub each called number; complete the pattern to win. Rooms: 🌐 Rooms → create or join; the host controls rounds.

## Tests

```bash
npm install
npm test
```

Five JSDOM suites boot `index.html` and cover patterns, wallet/restore codes,
the solo and daily loop, gift tokens and the room flow with a fake PeerJS
broker. See `tests/README.md`. GitHub Actions runs the same suites on every
push and refreshes `downloads/bingo-2.zip` when the page or docs change; pull
requests fail if the committed ZIP is stale.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole game — layout, styles hooks and logic |
| `bingo-2.css` | Game-specific styles |
| `style.css` | Shared base styles (nav, buttons, page shell) |
| `terms.html` | Points-only notice and terms |
| `BINGO-2-ECONOMY.md` | Design notes on the points economy and why nothing has cash value |
| `tests/` | JSDOM suites, run with `npm test` |
| `scripts/build-zip.py` | Rebuilds `downloads/bingo-2.zip` deterministically |
| `.github/workflows/ci.yml` | Tests plus reproducible ZIP refresh on push |

A ready-to-share copy of the playable files ships as `downloads/bingo-2.zip` (unzip it and open `index.html`).

## Notes

- All state lives in `localStorage` in the player's browser; there is no server, account or sync. Restore codes are the only way to move a record.
- Daily history and the reminder snooze are local to a browser; the streak, best and freeze travel in restore codes.
- Source: <https://github.com/jiffythorn/bingo-2> · MIT License.

Bingo 2 was extracted from the larger [Game Hub](https://github.com/jiffythorn/game-hub) arcade; this repository is its standalone home.
