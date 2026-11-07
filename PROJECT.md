# Bingo 2 — project status

_Last updated: 7 November 2026._

A single-page, points-only 75-ball bingo game. Solo play or live rooms with
friends and bots. No build step, no server, no accounts.

- **Live:** <https://jiffythorn.github.io/bingo-2/>
- **Repo:** <https://github.com/jiffythorn/bingo-2>
- **Licence:** MIT
- **Stack:** one HTML file (inline IIFE), two stylesheets, `localStorage`,
  PeerJS for rooms.

## At a glance

| Area | State |
| --- | --- |
| Solo game | Done |
| Patterns (8) | Done |
| Daily pattern / streak / freeze / history / reminder | Done |
| Wallet + standings (solo & rooms, gross/net/return) | Done |
| Restore codes (v5, backwards compatible) | Done |
| Live rooms, bots, chat | Done, but host-authoritative and PeerJS-dependent |
| Server-side leaderboard / anti-abuse | **Not started** |
| Automated tests in the repo | Done — `npm test` (JSDOM) |
| CI (tests, ZIP rebuild) | **Not started** |

## What's done

### Gameplay

- 75-ball bingo, 5x5 cards with a free centre (except patterns that forbid it,
  e.g. bullseye).
- Eight win patterns, each with its own card-cost budget and bonus window:
  any line, four corners, X, T, H, climbing ladder, bullseye, blackout.
- Solo: pick any pattern (or today's), start calling, daub by tapping. Per
  pattern best scores, with the old single best migrated to "any line".
- Rooms: host picks pattern, pace, card cost and cards per player; up to three
  labelled smart bots; in-room and lobby chat; invite links with a 5-character
  code; host-authoritative rounds.
- Points economy: card costs feed the pot, 6% table fee, payouts 55/25/12,
  leftover rolls into a bonus pot that pays a fast bingo then resets. Bots pay
  the card cost but never collect. Everything is score tokens with no cash
  value (see `terms.html`).

### Records and standings

- Wallet: points, plus separate **solo** (games, wins, win rate) and **room**
  (games, wins, gross points won, net = gross − card costs, return on cards)
  standings.
- Return on cards is cumulative and shown as a percentage, with an em dash
  until a paid round exists.
- Restore codes are checksummed and versioned. v5 carries points, both
  standings, daily streak/best and a banked freeze in 30 bytes → 12
  four-character groups. v1–v4 still decode; old flat counters map onto the
  room side; imports merge with `Math.max` so a restore cannot lower a record.

### Daily loop

- Pattern of the day rotates by local calendar date (UTC day number, so DST
  cannot skip or repeat).
- Streak advances when today's pattern is completed in solo or in a seated room
  round; best is kept.
- **Streak freeze:** finish a blackout (solo, or win a blackout room) to bank
  one. Spent automatically to cover exactly one missed day; cannot bridge two.
- **Seven-day history strip** under the HUD: amber played, snowflake frozen,
  dim missed.
- **Freeze reminder** when a freeze is banked and today's pattern is unplayed:
  names the pattern, offers a switch, reflects whether it is already selected,
  and can be snoozed with "Not today" until the next day.

### Delivery

- `downloads/bingo-2.zip` ships the playable files (page, both stylesheets,
  terms, README, this doc, licence) with deterministic timestamps.
- GitHub Pages serves `main` at the URL above; HTTPS enforced.
- `terms.html` documents the points-only model.

## How it works

### Shape of the code

Everything lives in `index.html`: markup, structure that hooks into
`bingo-2.css`, and one IIFE at the bottom holding all logic. There is no
bundler, no modules and no network calls except loading PeerJS when a room is
used. State is read and written synchronously to `localStorage`.

Key pieces:

| Piece | Where |
| --- | --- |
| `PATTERNS` table (cells, budget, jackpot window, free-centre flag) | top of the IIFE |
| Pattern matching (`findWin`) | works on index sets, so one function serves every pattern |
| Daily rotation / streak / freeze / history | `dailyPatternKey`, `readDaily`, `markDailyPlayed`, `renderDailyHistory` |
| Wallet codec | `walletCodeFor`, `parseWalletCode` |
| Standings | `myStats`, `recordRoomRound`, `recordSoloRound`, `renderRecord` |
| Rooms | PeerJS host/guest handlers, `broadcast`, lobby + end-round settlement |
| Gift grants | ECDSA P-256 verification against an embedded public key |

### Stored state (all local to one browser)

| Key | Contents |
| --- | --- |
| `gh.bingo2.wallet` | `{v:5, points, solo:{games,wins}, room:{games,wins,earned,staked}, updated}` |
| `gh.bingo2.daily` | `{last, streak, best, freezes, days:[{d,t}], snoozed}` |
| `gh.bingo2.best.<pattern>` | best ball count per pattern |
| `gh.bingo2.soloPattern` | last solo pattern choice |
| `gh.bingo2.name` | player name |
| `gh.bingo2.claims` | recent gift-code IDs already redeemed |

### Restore code v5

Payload 26 bytes + 4-byte CRC = 30 bytes, which is exactly 48 base32
characters, rendered as `GH2-` plus twelve groups of four. Layout:

```
[0]      version 5
[1..4]   points (uint32)
[5..6]   solo games     [7..8]  solo wins
[9..12]  room gross     [13..16] room card costs
[17..18] room games     [19..20] room wins
[21..22] daily last (days since 1970)
[23]     streak         [24]    best        [25] freeze (0/1)
[26..29] CRC32 of the payload
```

Bytes are XOR-mixed with a fixed pad before base32. Decoding validates CRC and
length before trusting anything.

### Rooms

Rooms use PeerJS (WebRTC data channels) loaded at runtime from
`https://unpkg.com/peerjs@1.5.4/`. The host is the authority: it holds the deck,
validates daubs, settles the pot and broadcasts state. There is no persistence,
so closing the tab ends the room, and there is no reconnect or replay.

### Gift codes

`GH2G.1.<role>.<body>.<sig>` tokens are signed offline with an ECDSA P-256 key;
the game embeds only the public key and verifies in `crypto.subtle`. The minter
used to issue them is intentionally **not** in this repo. Redemption IDs are
recorded in `gh.bingo2.claims` so a code cannot be reused on the same browser.

## Verified

- `node --check` on the extracted script: clean.
- Logic suites (JSDOM) run with `npm test`: patterns **69** checks, wallet and
  restore codes **50**, solo + daily + freeze + history + reminder **75**, gift
  tokens **22**, rooms **27** — five suites, all passing and stable across
  repeated runs.
- Published page checked at the Pages URL: HTML, both stylesheets, terms and the
  ZIP return 200; the board, pattern list and history strip render; browser
  console is empty.

The suites live in `tests/`, use `jsdom` as the only dev dependency, and boot
the real `index.html` (the gift suite patches in a throwaway public key; the room
suite fakes PeerJS). Nothing runs on push yet — see the CI item below.

## Not done / known gaps

1. **No CI.** `npm test` exists and is stable, but nothing runs it on push or
   pull request, so regressions still depend on someone running it locally.
2. **No server-side state.** Points, records and streaks are client-side and
   editable by the player. Restore codes are not secrets and can be copied or
   replayed, so standings are not trustworthy for prizes.
3. **Rooms depend on a public CDN and PeerJS cloud broker.** If unpkg or the
   broker is unavailable, rooms fail; the offline ZIP cannot do rooms either.
4. **Host is trusted.** A modified host client can mis-settle pots; guests
   cannot verify fairness.
5. **No reconnect or state recovery** in rooms; a refresh or network blip ends
   a player's seat.
6. **Accessibility is partial.** Cards and chips are buttons, but overlays and
   modals need focus trapping and restoration, and the board has no keyboard
   daub shortcut beyond tabbing.
7. **Mobile polish is unverified.** The HUD strip, the two-button reminder and
   the room modal's five-column wallet row have not been checked at phone width.
8. **No privacy or analytics story**, and no 404 page or custom domain.
9. **Gift-code operations** (key rotation, issuance tooling, revocation) live
   outside the repo and are undocumented here.

## Roadmap

### Now (small, high value)

| Task | Why |
| --- | --- |
| GitHub Action: run tests on PR/push | Prevents silent regressions |
| GitHub Action: rebuild `downloads/bingo-2.zip` when page/CSS/docs change | Stops the download drifting from the page |
| Vendor PeerJS or add a clear load-failure message | Removes a silent CDN failure mode |

### Next

| Task | Why |
| --- | --- |
| Accessibility pass (focus management, keyboard daub, contrast, reduced motion) | Broadens who can play |
| Phone-width layout review for HUD, strip, reminder, wallet, room modal | Most play will be mobile |
| Reconnect handling and host migration for rooms | Rooms currently die on a blip |
| 404 page, Open Graph/Twitter cards, favicon set | Presentation for a standalone project |

### Later (needs a backend decision)

| Task | Why |
| --- | --- |
| Server-side ledger + leaderboard (see `BINGO-2-ECONOMY.md` section 6.3) | Makes standings meaningful and portable without shareable codes |
| Accounts / optional sign-in | Ties a record to a person instead of a browser |
| Server-authoritative rooms or a signed round receipt | Removes host trust and client-side point edits |
| Gift-code issuance/rotation tooling and abuse limits | Makes the promo path operable |
| Moderation for names/chat | Needed before wider sharing |

## Decisions worth keeping

- **Points only.** No purchase, transfer or cash-out; card costs and pots are
  score mechanics. Keep money words out of the UI (`terms.html` is canonical).
- **Static first.** Any backend should be additive; the page must keep working
  as a standalone file.
- **Bots never collect.** Their share rolls into the bonus pot.
- **Internal `myCredits` / `#credits` names stay** even though the UI says
  points; renaming them buys nothing and risks breaking CSS/tests.
- **Restore codes stay backwards compatible.** New fields go in reserved bytes
  or a version bump that still decodes older codes.

## How to work on it

```bash
# tests
npm install
npm test

# play locally
python3 -m http.server 8080   # then open http://localhost:8080/

# rebuild the downloadable ZIP (same deterministic layout)
python3 - <<'ZIPEOF'
import zipfile
from pathlib import Path
files = ['index.html', 'bingo-2.css', 'style.css', 'terms.html',
         'README.md', 'PROJECT.md', 'LICENSE']
out = Path('downloads/bingo-2.zip'); out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name in files:
        info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, Path(name).read_bytes())
ZIPEOF
```

Push to `main`; GitHub Pages redeploys automatically. The ZIP is a committed
snapshot, so rebuild it in the same commit as any page change.

## Open questions

- Is the leaderboard meant to be competitive (needs a server and identity) or a
  personal progress record (current design is fine)?
- Should gift codes remain part of the public project, or move to a private
  ops repo?
- Do rooms need to survive a host disconnect, or is "host closes, room ends"
  acceptable for a casual game?
- Is a custom domain wanted, and should the hub keep linking to its own copy or
  hand over to this repo as canonical?
