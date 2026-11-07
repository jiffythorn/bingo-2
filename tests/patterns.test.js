const fs = require('fs');
const { JSDOM } = require('jsdom');
let html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const inject = '  window.__logic = {PATTERNS, findWin, makeCard, cardFromNumbers, LINES, patternFreeCenter, patternBudget};\n})();\n</script>';
html = html.replace('})();\n</script>', inject);
if (!html.includes('__logic')) { console.log('FAIL could not inject logic hook'); process.exit(1); }

const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.com/games/bingo-2.html', pretendToBeVisual: true });
const w = dom.window;
const L = w.__logic;
let failures = 0;
const check = (n, c, x) => { if (c) console.log('PASS ' + n); else { failures++; console.log('FAIL ' + n + (x !== undefined ? ' :: ' + x : '')); } };

check('logic hook exposed', !!L);

/* select offers every pattern, in a sensible order */
const values = [...w.document.querySelectorAll('#patternSel option')].map(o => o.value);
check('select lists the patterns plus a daily shortcut', values.length === 9 && values.includes('daily'), values.join(','));
check('room form explains the daily option', /Today/.test([...w.document.querySelectorAll('#patternSel option')].find(o => o.value === 'daily').textContent));
check('select covers every pattern key', Object.keys(L.PATTERNS).every(k => values.includes(k)), values.join(','));
check('room select still defaults to any line', w.document.getElementById('patternSel').value === 'line', w.document.getElementById('patternSel').value);

/* pattern shapes */
const sizes = {line: 0, corners: 4, x: 9, h: 13, t: 9, ladder: 9, bullseye: 9, blackout: 25};
Object.entries(L.PATTERNS).forEach(([k, p]) => {
  check(`${k}: has a label and a note`, !!p.label && !!p.note, JSON.stringify({l: p.label, n: p.note}));
  check(`${k}: round budget and jackpot window`, p.budget > 0 && p.jackpot > 0 && p.jackpot < p.budget, `${p.budget}/${p.jackpot}`);
  if (!p.cells) { check(`${k}: line pattern uses the 12 lines`, L.LINES.length === 12); return; }
  check(`${k}: ${sizes[k]} distinct squares`, p.cells.length === sizes[k] && new Set(p.cells).size === p.cells.length, p.cells.length);
  check(`${k}: indices stay on the card`, p.cells.every(i => Number.isInteger(i) && i >= 0 && i < 25), p.cells.join(','));
});

/* H, T, X and the ladder actually draw their letters/steps */
check('H uses both side columns', [0, 5, 10, 15, 20, 4, 9, 14, 19, 24].every(i => L.PATTERNS.h.cells.includes(i)));
check('H crosses the middle row', [11, 12, 13].every(i => L.PATTERNS.h.cells.includes(i)));
check('T is the top row plus the middle column', [0, 1, 2, 3, 4, 2, 7, 12, 17, 22].every(i => L.PATTERNS.t.cells.includes(i)));
check('X is both diagonals', [0, 6, 12, 18, 24, 4, 8, 16, 20].every(i => L.PATTERNS.x.cells.includes(i)));
check('ladder climbs corner to corner', [20, 15, 16, 11, 12, 7, 8, 3, 4].every(i => L.PATTERNS.ladder.cells.includes(i)));
check('bullseye needs the centre', L.PATTERNS.bullseye.cells.includes(12) && L.PATTERNS.bullseye.freeCenter === false);

/* the room start switch uses these helpers */
check('free-centre switch: line and H keep FREE', L.patternFreeCenter('line') && L.patternFreeCenter('h') && L.patternFreeCenter('blackout'));
check('free-centre switch: bullseye goes live', L.patternFreeCenter('bullseye') === false);
check('budget switch reads the pattern', L.patternBudget('line') === 32 && L.patternBudget('blackout') === 75 && L.patternBudget('h') === 60);

/* free centre follows the pattern */
const freeCard = L.makeCard(true);
check('free-centre card marks the middle FREE', freeCard[12].free && freeCard[12].daubed && freeCard[12].n === 0, JSON.stringify(freeCard[12]));
const liveCard = L.makeCard(false);
check('bullseye card keeps a live centre', !liveCard[12].free && !liveCard[12].daubed && liveCard[12].n >= 31 && liveCard[12].n <= 45, JSON.stringify(liveCard[12]));
check('full card has 25 squares', liveCard.length === 25 && liveCard.every(c => Number.isInteger(c.n)));
const parsedFree = L.cardFromNumbers(freeCard.map(c => c.n));
check('host zero at the centre restores FREE', parsedFree[12].free && parsedFree[12].n === 0);
const parsedLive = L.cardFromNumbers(liveCard.map(c => c.n));
check('host number at the centre stays live', !parsedLive[12].free && parsedLive[12].n === liveCard[12].n, JSON.stringify(parsedLive[12]));

/* findWin agrees with each pattern set */
const blank = L.makeCard(true);
const paint = (card, idx) => { const c = card.map(x => ({...x})); idx.forEach(i => { c[i].daubed = true; }); return c; };
Object.entries(L.PATTERNS).forEach(([k, p]) => {
  const cells = p.cells || [0, 1, 2, 3, 4];
  const won = L.findWin(paint(blank, cells), k);
  check(`${k}: completed pattern wins`, Array.isArray(won) && won.length === cells.length, JSON.stringify(won));
  const miss = cells.slice(0, -1);
  check(`${k}: one square short does not win`, L.findWin(paint(blank, miss), k) === null);
});
check('any line: a row wins', (L.findWin(paint(blank, [5, 6, 7, 8, 9]), 'line') || []).length === 5);
check('any line: two scattered squares do not', L.findWin(paint(blank, [0, 24]), 'line') === null);
check('unknown pattern falls back to any line', L.findWin(paint(blank, [5, 6, 7, 8, 9]), 'nope').length === 5);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PATTERN CHECKS PASSED');
process.exit(failures ? 1 : 0);
