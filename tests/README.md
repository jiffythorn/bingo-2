# Tests

JSDOM suites that boot `index.html` (or a patched copy of it) and drive the real
DOM and `localStorage`. No server and no network needed; PeerJS is faked for the
room suite.

Run everything:

```bash
npm install
npm test
```

| Suite | Covers |
| --- | --- |
| `patterns.test.js` | Pattern cell sets, free-centre rules, budgets, `findWin` |
| `wallet.test.js` | Points, restore codes v1-v6 and their legacy fixtures, standings, streak/freeze codec |
| `solo.test.js` | Solo flow, daily rotation, streak, freeze, history, reminder |
| `solo-bots.test.js` | Solo opponents: picker, bot cards and progress, per-opponent skills, lost race, win prize, daily cap in the HUD chip and points panel, the one-time What's new card |
| `gift.test.js` | Gift token format, signature checks, caps, replay, claims |
| `rooms.test.js` | Host/guest room flow with a fake PeerJS broker, per-bot skills, settlement |

Notes:

- `gift.test.js` signs tokens with a throwaway ES256 key generated at run time
  and patches the game copy's `GRANT_KEY`, so the ops minter is not required
  and no real key is used.
- `rooms.test.js` installs a virtual clock, so it does not wait in real time.
- `run.js` streams each suite, then prints a per-suite summary comparing its
  PASS count with the expected `checks` table in `run.js`, plus wall-clock time
  and the total. A drift fails the run, so checks cannot disappear silently;
  `npm run test:update` rewrites the table after a clean run.
- The minter UI itself is not tested here: that tool is not part of this repo.
- `tests/helpers.js` boots the real page with seeded storage:
  `bootGame({seed, local, html, beforeParse, onError})`. Typed `seed` values —
  `wallet` and `soloWon` objects, `dailyBonus` as-is — are serialized into their
  storage keys, while `local` takes raw key/value entries. `onError` forwards
  page errors to the suite's failure counter. It also exports
  `installClock(w, onError)`, the deterministic timer used by the solo-bots and
  rooms suites, which turns a callback throw into `onError(error)`; with it come
  `sleep()` (one promise tick) and `flushClock(w, ms, rounds)`, which advances
  the clock and drains jobs before returning. Every suite boots through it; `patterns.test.js` passes a patched copy
  of the page with its logic hook injected. It is the pure-logic suite: one
  boot, no seeded storage.
- **Restore-code version bump.** `LEGACY_CODES` in `wallet.test.js` keeps one
  literal code per shipped codec version, so old codes never need recapturing.
  Before changing `WALLET_VERSION`:
  1. Boot the current `index.html` with a known wallet, click Copy restore code,
     and add that code to `LEGACY_CODES` with its group count in
     `LEGACY_GROUPS` (v4 has 10 groups, v5 12, v6 14).
  2. Teach `parseWalletCode` the previous payload length and version, and keep
     `readWallet` accepting the old stored `v`.
  3. Extend section 16 of `wallet.test.js`: the new version's tally must
     round-trip, and the table loop must still prove every older code restores
     2,500 points and leaves today's bot tally alone.
  4. Update the byte layout in `PROJECT.md`, the version wording in `README.md`
     and the suite table above.

- `createHarness()` from `tests/helpers.js` returns `{check, $, failures}`:
  `check(name, cond, extra)` prints PASS/FAIL and bumps the counter,
  `$(doc, id)` accepts a window or document, and `report(label)` prints the
  ALL/FAILURE summary and returns the exit code, so suites end with
  `process.exit(suite.report('WALLET'))`.
