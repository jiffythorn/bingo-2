const fs = require('fs');
const { JSDOM } = require('jsdom');
let html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
html = html.replace('})();\n</script>', '  window.__logic = {PATTERNS, dailyPatternKey, resolvePatternSelection, markDailyPlayed, dateKey, previousDateKey, readDaily, recordSoloRound, awardStreakFreeze, renderStreak, setSoloPattern};\n})();\n</script>');

let failures = 0;
const check = (n, c, x) => { if (c) console.log('PASS ' + n); else { failures++; console.log('FAIL ' + n + (x !== undefined ? ' :: ' + x : '')); } };
const $ = (w, id) => w.document.getElementById(id);
function boot(seed) {
  return new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.com/games/bingo-2.html',
    pretendToBeVisual: true,
    beforeParse(w) {
      Object.entries(seed || {}).forEach(([k, v]) => w.localStorage.setItem(k, v));
      w.addEventListener('error', e => { failures++; console.log('PAGE ERROR: ' + (e.message || e.error)); });
    }
  }).window;
}
const pick = (w, value) => {
  const sel = $(w, 'soloPatternSel');
  sel.value = value;
  sel.dispatchEvent(new w.Event('change', { bubbles: true }));
};

/* 1. picker exists, lists every pattern, starts on any line */
const w1 = boot({});
const L = w1.__logic;
const sel1 = $(w1, 'soloPatternSel');
check('solo picker is present', !!sel1);
check('solo picker lists all eight patterns', sel1.options.length === 8, sel1.options.length);
check('first visit opens on today’s pattern', sel1.value === L.dailyPatternKey(), sel1.value);
const daily = L.dailyPatternKey();
check('daily chip names today’s pattern', $(w1, 'dailyName').textContent === L.PATTERNS[daily].label, $(w1, 'dailyName').textContent);
check('rotation advances each day', L.dailyPatternKey(new Date(2026, 10, 7)) !== L.dailyPatternKey(new Date(2026, 10, 8)));
check('rotation repeats after eight days', L.dailyPatternKey(new Date(2026, 10, 7)) === L.dailyPatternKey(new Date(2026, 10, 15)));
check('daily shortcut resolves to the real pattern', L.resolvePatternSelection('daily') === daily);
check('other selections resolve unchanged', L.resolvePatternSelection('bullseye') === 'bullseye' && L.resolvePatternSelection('nope') === 'line');
check('picker is visible outside a room', $(w1, 'soloPatternWrap').hidden === false);

/* 2. choosing bullseye deals a live centre and shows the rule */
pick(w1, 'bullseye');
check('bullseye deals a live centre', $(w1, 'grid').children[12].textContent !== 'FREE', $(w1, 'grid').children[12].textContent);
check('start overlay explains the pattern', /target/.test($(w1, 'ovText').textContent), $(w1, 'ovText').textContent);
check('choice is saved', w1.localStorage.getItem('gh.bingo2.soloPattern') === 'bullseye', w1.localStorage.getItem('gh.bingo2.soloPattern'));
check('picker matches the choice', $(w1, 'soloPatternSel').value === 'bullseye');

/* 3. back to any line brings the free centre back */
pick(w1, 'line');
check('any line restores the free centre', $(w1, 'grid').children[12].textContent === 'FREE', $(w1, 'grid').children[12].textContent);

/* 3b. the chip jumps to today's pattern */
pick(w1, 'line');
$(w1, 'dailyBtn').click();
const dailyLive = L.PATTERNS[L.dailyPatternKey()].freeCenter === false;
check('daily chip selects today’s pattern', $(w1, 'soloPatternSel').value === L.dailyPatternKey(), $(w1, 'soloPatternSel').value);
check('daily chip deals the matching card', ($(w1, 'grid').children[12].textContent === 'FREE') === !dailyLive, $(w1, 'grid').children[12].textContent);
check('daily choice is remembered', w1.localStorage.getItem('gh.bingo2.soloPattern') === L.dailyPatternKey(), w1.localStorage.getItem('gh.bingo2.soloPattern'));

/* 4. best scores are per pattern */
const w2 = boot({ 'gh.bingo2.soloPattern': 'line', 'gh.bingo2.best.line': '7', 'gh.bingo2.best.bullseye': '41' });
check('best shows the any-line record', $(w2, 'best').textContent === '7 balls', $(w2, 'best').textContent);
pick(w2, 'bullseye');
check('best follows the chosen pattern', $(w2, 'best').textContent === '41 balls', $(w2, 'best').textContent);
pick(w2, 'h');
check('unplayed pattern has no best', $(w2, 'best').textContent === '—', $(w2, 'best').textContent);

/* 5. an old single best becomes the any-line record */
const w3 = boot({ 'gh.bingo2.soloPattern': 'line', 'gh.bingo2.best': '9' });
check('legacy best still shows', $(w3, 'best').textContent === '9 balls', $(w3, 'best').textContent);
check('legacy best migrated to any line', w3.localStorage.getItem('gh.bingo2.best.line') === '9', w3.localStorage.getItem('gh.bingo2.best.line'));

/* 6. the chosen pattern survives a reload */
const w4 = boot({ 'gh.bingo2.soloPattern': 'h', 'gh.bingo2.best.h': '22' });
check('saved pattern loads', $(w4, 'soloPatternSel').value === 'h', $(w4, 'soloPatternSel').value);
check("that pattern's best loads", $(w4, 'best').textContent === '22 balls', $(w4, 'best').textContent);
check('H card keeps the free centre', $(w4, 'grid').children[12].textContent === 'FREE');


/* 7. daily streak */
const todayKey = L.dateKey();
const yKey = L.previousDateKey();
const dayOffset = n => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); };
const w5 = boot({ 'gh.bingo2.daily': JSON.stringify({ last: yKey, streak: 3, best: 5 }) });
check('live streak shows in the HUD', $(w5, 'streakChip').hidden === false && $(w5, 'streak').textContent === '3', $(w5, 'streak').textContent);
check('streak chip advertises the best', /best 5/.test($(w5, 'streakChip').title), $(w5, 'streakChip').title);
w5.__logic.markDailyPlayed();
const afterPlay = JSON.parse(w5.localStorage.getItem('gh.bingo2.daily'));
check('playing today extends the streak', afterPlay.streak === 4 && afterPlay.last === todayKey, JSON.stringify(afterPlay));
check('best streak is kept', afterPlay.best === 5, afterPlay.best);
check('the chip updates straight away', $(w5, 'streak').textContent === '4', $(w5, 'streak').textContent);
w5.__logic.markDailyPlayed();
check('a second round the same day does not double count', JSON.parse(w5.localStorage.getItem('gh.bingo2.daily')).streak === 4);

const w6 = boot({ 'gh.bingo2.daily': JSON.stringify({ last: L.dateKey(dayOffset(-3)), streak: 9, best: 9 }) });
check('a missed day lapses the streak', $(w6, 'streakChip').hidden === true && $(w6, 'streak').textContent === '0', $(w6, 'streak').textContent);
w6.__logic.markDailyPlayed();
check('playing again restarts at one', JSON.parse(w6.localStorage.getItem('gh.bingo2.daily')).streak === 1);

const w7 = boot({});
w7.__logic.markDailyPlayed();
check('a first daily round starts a streak', JSON.parse(w7.localStorage.getItem('gh.bingo2.daily')).streak === 1);

/* 8. every round-end path marks the day: solo win, solo no-bingo, host, guest */
const marks = (html.match(/if \((?:soloPattern|roomPattern) === dailyPatternKey\(\)\) markDailyPlayed\(\);/g) || []).length;
check('four round-end paths mark the day', marks === 4, marks);


/* 9. solo rounds land in the solo standings only */
const w8 = boot({});
w8.__logic.recordSoloRound(true);
const st1 = JSON.parse(w8.localStorage.getItem('gh.bingo2.wallet'));
check('solo win counts a solo game and win', st1.solo.games === 1 && st1.solo.wins === 1, JSON.stringify(st1.solo));
check('solo play does not touch room points', st1.room.games === 0 && st1.room.earned === 0 && st1.room.staked === 0, JSON.stringify(st1.room));
w8.__logic.recordSoloRound(false);
const st2 = JSON.parse(w8.localStorage.getItem('gh.bingo2.wallet'));
check('solo loss counts a game but not a win', st2.solo.games === 2 && st2.solo.wins === 1, JSON.stringify(st2.solo));
check('solo win rate shows in the panel', $(w8, 'recSoloRate').textContent === '50%', $(w8, 'recSoloRate').textContent);
const marksSolo = (html.match(/recordSoloRound\((true|false)\);/g) || []).length;
check('both solo round ends record a solo game', marksSolo === 2, marksSolo);


/* 10. one streak freeze, earned from blackouts */
const dayOff = off => {
  const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const f1 = boot({});
f1.__logic.awardStreakFreeze();
let fr1 = JSON.parse(f1.localStorage.getItem('gh.bingo2.daily'));
check('a blackout award banks one freeze', fr1.freezes === 1, JSON.stringify(fr1));
f1.__logic.awardStreakFreeze();
fr1 = JSON.parse(f1.localStorage.getItem('gh.bingo2.daily'));
check('only one freeze is ever held', fr1.freezes === 1, JSON.stringify(fr1));
const f2 = boot({});
f2.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayOff(-2), streak: 5, best: 5, freezes: 1}));
f2.__logic.markDailyPlayed();
const fr2 = JSON.parse(f2.localStorage.getItem('gh.bingo2.daily'));
check('a freeze bridges exactly one missed day', fr2.streak === 6 && fr2.freezes === 0 && fr2.last === dayOff(0), JSON.stringify(fr2));
const f3 = boot({});
f3.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayOff(-2), streak: 5, best: 5, freezes: 0}));
f3.__logic.markDailyPlayed();
check('without a freeze a missed day resets the run', JSON.parse(f3.localStorage.getItem('gh.bingo2.daily')).streak === 1, f3.localStorage.getItem('gh.bingo2.daily'));
const f4 = boot({});
f4.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayOff(-3), streak: 5, best: 5, freezes: 1}));
f4.__logic.markDailyPlayed();
const fr4 = JSON.parse(f4.localStorage.getItem('gh.bingo2.daily'));
check('a freeze cannot bridge two missed days', fr4.streak === 1 && fr4.freezes === 1, JSON.stringify(fr4));
check('award is wired to solos and rooms', (html.match(/awardStreakFreeze\(\);/g) || []).length === 2 && /soloPattern === 'blackout' \? awardStreakFreeze\(\)/.test(html), (html.match(/awardStreakFreeze\(\);/g) || []).length);

const j = v => JSON.parse(v || 'null');

/* 11. seven-day history strip */
const h1 = boot({});
h1.localStorage.setItem('gh.bingo2.daily', JSON.stringify({
  last: dayOff(-2), streak: 4, best: 4, freezes: 1,
  days: [{d: dayOff(-6), t: 0}, {d: dayOff(-5), t: 0}, {d: dayOff(-4), t: 0}, {d: dayOff(-3), t: 0}, {d: dayOff(-2), t: 0}]
}));
h1.__logic.markDailyPlayed();
const hcells = $(h1, 'dailyHistory').querySelectorAll('.dh-day');
check('history strip shows seven days', hcells.length === 7, hcells.length);
check('today is marked played', hcells[6].classList.contains('played'), hcells[6].className);
check('the frozen day is marked', hcells[5].classList.contains('frozen') && hcells[5].querySelector('b').textContent === '❄', hcells[5].className);
const hdays = j(h1.localStorage.getItem('gh.bingo2.daily')).days;
check('history records the played day and the frozen day', hdays.some(x => x.d === dayOff(0) && x.t === 0) && hdays.some(x => x.d === dayOff(-1) && x.t === 1), JSON.stringify(hdays));
check('history keeps only seven entries', hdays.length === 7, hdays.length);
const h2 = boot({});
h2.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: '', streak: 0, best: 0, freezes: 0, days: 'nope'}));
check('bad history data is ignored', h2.__logic.readDaily().days.length === 0, JSON.stringify(h2.__logic.readDaily().days));
const h3 = boot({});
h3.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: '', streak: 0, best: 0, freezes: 0, days: [{d: 'nonsense', t: 0}, {d: dayOff(0), t: 9}, {d: dayOff(0), t: 0}]}));
const h3d = h3.__logic.readDaily().days;
check('history sanitises and dedupes', h3d.length === 1 && h3d[0].t === 0, JSON.stringify(h3d));
const h4 = boot({});
check('empty history shows seven dim days', $(h4, 'dailyHistory').querySelectorAll('.missed').length === 7, $(h4, 'dailyHistory').innerHTML);


/* 12. freeze reminder while today's daily is unplayed */
const r1 = boot({});
r1.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayOff(-1), streak: 3, best: 3, freezes: 1, days: []}));
r1.__logic.renderStreak();
check('reminder shows with a banked freeze and today unplayed', !$(r1, 'freezeReminder').hidden, $(r1, 'freezeReminder').hidden);
check('reminder names the streak it protects', /keep your 3-day streak/.test($(r1, 'freezeReminderText').textContent), $(r1, 'freezeReminderText').textContent);
$(r1, 'freezePlayBtn').click();
check('reminder button picks today\'s pattern', $(r1, 'soloPatternSel').value === r1.__logic.dailyPatternKey(), $(r1, 'soloPatternSel').value);
const r2 = boot({});
r2.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayOff(0), streak: 3, best: 3, freezes: 1, days: []}));
r2.__logic.renderStreak();
check('reminder hides once today is played', $(r2, 'freezeReminder').hidden, $(r2, 'freezeReminder').hidden);
const r3 = boot({});
r3.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayOff(-1), streak: 3, best: 3, freezes: 0, days: []}));
r3.__logic.renderStreak();
check('reminder hides without a freeze', $(r3, 'freezeReminder').hidden, $(r3, 'freezeReminder').hidden);
const r4 = boot({});
r4.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayOff(-2), streak: 3, best: 3, freezes: 1, days: []}));
r4.__logic.markDailyPlayed();
check('reminder disappears after the freeze is spent on a play', $(r4, 'freezeReminder').hidden, $(r4, 'freezeReminder').hidden);
const r5 = boot({});
r5.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: '', streak: 0, best: 0, freezes: 1, days: []}));
r5.__logic.renderStreak();
check('reminder offers to start a streak when none is live', /start a streak/.test($(r5, 'freezeReminderText').textContent), $(r5, 'freezeReminderText').textContent);
const r6 = boot({});
check('no reminder on a fresh install', $(r6, 'freezeReminder').hidden, $(r6, 'freezeReminder').hidden);


/* 13. the reminder can be snoozed until tomorrow */
const s1 = boot({});
s1.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayOff(-1), streak: 3, best: 3, freezes: 1, days: []}));
s1.__logic.renderStreak();
check('reminder visible before snoozing', !$(s1, 'freezeReminder').hidden, $(s1, 'freezeReminder').hidden);
$(s1, 'freezeSnoozeBtn').click();
check('snoozing hides the reminder', $(s1, 'freezeReminder').hidden, $(s1, 'freezeReminder').hidden);
const s1d = j(s1.localStorage.getItem('gh.bingo2.daily'));
check('snooze is stored as today', s1d.snoozed === dayOff(0), JSON.stringify(s1d.snoozed));
check('snoozing leaves the streak and freeze alone', s1d.streak === 3 && s1d.freezes === 1, JSON.stringify(s1d));
const s2 = boot({});
s2.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayOff(-1), streak: 3, best: 3, freezes: 1, days: [], snoozed: dayOff(0)}));
s2.__logic.renderStreak();
check('a snooze from today keeps it hidden', $(s2, 'freezeReminder').hidden, $(s2, 'freezeReminder').hidden);
const s3 = boot({});
s3.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayOff(-1), streak: 3, best: 3, freezes: 1, days: [], snoozed: dayOff(-1)}));
s3.__logic.renderStreak();
check('yesterday\'s snooze has expired', !$(s3, 'freezeReminder').hidden, $(s3, 'freezeReminder').hidden);
const s4 = boot({});
s4.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayOff(-1), streak: 3, best: 3, freezes: 1, days: [], snoozed: 'rubbish'}));
s4.__logic.renderStreak();
check('bad snooze data is ignored', !$(s4, 'freezeReminder').hidden && s4.__logic.readDaily().snoozed === '', s4.localStorage.getItem('gh.bingo2.daily'));


/* 14. the reminder names today's pattern and mirrors the selection */
const p1 = boot({});
p1.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayOff(-1), streak: 2, best: 2, freezes: 1, days: []}));
const todayPretty = $(p1, 'dailyName').textContent;
const otherPattern = ['line', 'corners', 'x', 'h', 't', 'ladder', 'bullseye', 'blackout'].find(k => k !== p1.__logic.dailyPatternKey());
p1.__logic.setSoloPattern(otherPattern);
const p1text = $(p1, 'freezeReminderText').textContent;
check('reminder names today\'s pattern', p1text.includes(todayPretty), p1text);
check('reminder says the pattern is unplayed', /is still unplayed/.test(p1text), p1text);
check('button offers the switch while another pattern is selected', $(p1, 'freezePlayBtn').textContent === 'Play today' && !$(p1, 'freezePlayBtn').disabled, $(p1, 'freezePlayBtn').textContent);
$(p1, 'freezePlayBtn').click();
check('button mirrors the selection once today is chosen', $(p1, 'freezePlayBtn').textContent === '✓ Today selected' && $(p1, 'freezePlayBtn').disabled, $(p1, 'freezePlayBtn').textContent + '/' + $(p1, 'freezePlayBtn').disabled);
check('selecting today did not hide the reminder', !$(p1, 'freezeReminder').hidden, $(p1, 'freezeReminder').hidden);
check('selection took effect in the picker', $(p1, 'soloPatternSel').value === p1.__logic.dailyPatternKey(), $(p1, 'soloPatternSel').value);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL SOLO PATTERN CHECKS PASSED');
process.exit(failures ? 1 : 0);
