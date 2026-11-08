const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const GAME = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const PAGE_URL = 'https://example.com/bingo-2.html';

/* Typed seeds are serialized into storage; `local` entries are written as-is,
   which is how the older suites store already-stringified values. */
const SEED_KEYS = {wallet: 'gh.bingo2.wallet', soloWon: 'gh.bingo2.soloWon'};

function bootGame({html = GAME, seed = {}, local = {}, url = PAGE_URL, beforeParse, onError} = {}) {
  return new JSDOM(html, {
    runScripts: 'dangerously',
    url,
    pretendToBeVisual: true,
    beforeParse(w) {
      Object.entries(SEED_KEYS).forEach(([key, name]) => {
        if (seed[key] !== undefined) w.localStorage.setItem(name, JSON.stringify(seed[key]));
      });
      if (seed.dailyBonus !== undefined) w.localStorage.setItem('gh.bingo2.dailyBonus', seed.dailyBonus);
      Object.entries(local).forEach(([key, value]) => w.localStorage.setItem(key, value));
      if (typeof beforeParse === 'function') beforeParse(w);
      if (typeof onError === 'function') w.addEventListener('error', e => onError(e.message || e.error));
    }
  });
}


/* Deterministic timers for the race suites: replaces the window's clock and
   exposes __advance(ms). `onError` receives anything a callback throws. */
function installClock(w, onError) {
  const timers = new Map();
  let nextId = 1, now = 0;
  w.setInterval = (fn, ms) => { const id = nextId++; timers.set(id, {fn, ms, next: now + ms, every: true}); return id; };
  w.setTimeout = (fn, ms = 0) => { const id = nextId++; timers.set(id, {fn, ms, next: now + ms, every: false}); return id; };
  w.clearInterval = w.clearTimeout = id => { timers.delete(id); };
  w.__advance = ms => {
    const end = now + ms;
    for (;;) {
      let best = null;
      for (const [id, t] of timers) if (t.next <= end && (!best || t.next < best.t.next)) best = {id, t};
      if (!best) break;
      now = best.t.next;
      if (best.t.every) best.t.next += best.t.ms; else timers.delete(best.id);
      try { best.t.fn(); } catch (e) { if (typeof onError === 'function') onError(e); }
    }
    now = end;
  };
}


const sleep = () => new Promise(r => setImmediate(r));

/* Advance a fake clock and let the promise jobs it queues settle. `rounds`
   repeats the advance; the room suite needs eight hops for socket traffic. */
async function flushClock(w, ms = 0, rounds = 1) {
  for (let i = 0; i < rounds; i++) { w.__advance(ms); await sleep(); }
}


/* One PASS/FAIL harness: suites destructure {check, $} and read failures. */
function createHarness() {
  const harness = {failures: 0};
  harness.check = (name, cond, extra) => {
    if (cond) console.log('PASS ' + name);
    else { harness.failures++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + extra : '')); }
  };
  harness.$ = (doc, id) => (doc.document || doc).getElementById(id);
  harness.report = label => {
    console.log(harness.failures ? `\n${harness.failures} FAILURE(S)` : `\nALL ${label} CHECKS PASSED`);
    return harness.failures ? 1 : 0;
  };
  return harness;
}

module.exports = {GAME, PAGE_URL, bootGame, installClock, sleep, flushClock, createHarness};
