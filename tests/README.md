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
| `wallet.test.js` | Points, restore codes v1-v5, standings, streak/freeze codec |
| `solo.test.js` | Solo flow, daily rotation, streak, freeze, history, reminder |
| `gift.test.js` | Gift token format, signature checks, caps, replay, claims |
| `rooms.test.js` | Host/guest room flow with a fake PeerJS broker, bots, settlement |

Notes:

- `gift.test.js` signs tokens with a throwaway ES256 key generated at run time
  and patches the game copy's `GRANT_KEY`, so the ops minter is not required
  and no real key is used.
- `rooms.test.js` installs a virtual clock, so it does not wait in real time.
- The minter UI itself is not tested here: that tool is not part of this repo.
