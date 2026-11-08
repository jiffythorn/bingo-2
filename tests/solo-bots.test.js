const fs = require('fs');
const { bootGame, installClock, flushClock , createHarness} = require('./helpers');

const suite = createHarness();
const {check, $} = suite;
let html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
html = html.replace('})();\n</script>', '  window.__logic = {soloWin, soloBotLeft, soloBotPrize, soloWonToday, soloBotAllowance, dateKey};\n})();\n</script>');


const boot = (local, opts = {}) => bootGame({
  html,
  /* Returning visitors have already dismissed the What's new card; pass
     {freshCard: true} to boot a browser that has never seen it. */
  local: opts.freshCard ? local : Object.assign({'gh.bingo2.whatsNew': 'bots-v1'}, local),
  beforeParse(w) {
    installClock(w, error => { console.log('TIMER ERROR: ' + error.message); suite.failures++; });
    /* 0 makes every bot daub check pass and every delay the shortest one */
    if (opts && opts.random !== undefined) w.Math.random = () => opts.random;
  },
  onError: message => { suite.failures++; console.log('PAGE ERROR: ' + message); }
}).window;
const flush = (w, ms = 0) => flushClock(w, ms);
const pick = (w, value) => {
  const sel = $(w, 'soloBotSel');
  sel.value = value;
  sel.dispatchEvent(new w.Event('change', {bubbles: true}));
};

(async () => {
  /* 1. the picker: opponents exist by default, and the strip shows them */
  const w1 = boot({'gh.bingo2.soloPattern': 'line'});
  const sel = $(w1, 'soloBotSel');
  check('opponents picker is present', !!sel);
  check('picker offers none up to three bots', sel.options.length === 4, sel.options.length);
  check('a first visit races one bot by default', sel.value === '1', sel.value);
  const strip = $(w1, 'soloBots');
  check('opponent strip is visible', strip.hidden === false);
  check('default opponent is a labelled bot', strip.children.length === 1 && /🤖 Rex/.test(strip.textContent), strip.textContent);
  check('strip counts the squares the bot needs', /Rex · \d+ to go/.test(strip.textContent.replace(/\s+/g, ' ')), strip.textContent);
  check('start text offers the bot prize', /Beat the normal bot to earn 10 points/.test($(w1, 'ovText').textContent), $(w1, 'ovText').textContent);
  check('the HUD shows today’s bot winnings', $(w1, 'botCapChip').hidden === false && $(w1, 'botCapWon').textContent === '0', $(w1, 'botCapWon').textContent);
  check('the points panel starts the bot tally at zero', $(w1, 'recBotWon').textContent === '0/100', $(w1, 'recBotWon').textContent);

  /* 2. more opponents */
  pick(w1, '3');
  await flush(w1);
  check('three opponents are dealt', $(w1, 'soloBots').children.length === 3, $(w1, 'soloBots').children.length);
  check('all three bots are named and labelled', /Rex/.test(strip.textContent) && /Nova/.test(strip.textContent) && /Pip/.test(strip.textContent), strip.textContent);
  check('the choice is saved', w1.localStorage.getItem('gh.bingo2.soloBots') === '3', w1.localStorage.getItem('gh.bingo2.soloBots'));
  check('start text prices three bots at 30 points', /Beat Rex \(normal\), Nova \(normal\), Pip \(normal\) to earn 30 points/.test($(w1, 'ovText').textContent), $(w1, 'ovText').textContent);

  /* 3. opponents can be turned off */
  pick(w1, '0');
  await flush(w1);
  check('no strip with opponents off', $(w1, 'soloBots').hidden === true);
  check('off is saved', w1.localStorage.getItem('gh.bingo2.soloBots') === '0', w1.localStorage.getItem('gh.bingo2.soloBots'));
  check('the bot winnings chip hides with opponents off', $(w1, 'botCapChip').hidden === true);
  check('start text says it is a practice card', /No opponents this time/.test($(w1, 'ovText').textContent), $(w1, 'ovText').textContent);

  /* 4. a bot can win the race: first bingo ends the round, and costs nothing */
  const w2 = boot({'gh.bingo2.soloPattern': 'line', 'gh.bingo2.soloBots': '1'}, {random: 0});
  $(w2, 'startBtn').click();
  await flush(w2, 60000);
  const raceTitle = $(w2, 'ovTitle').textContent;
  check('a bot can finish first', /Rex got there first/.test(raceTitle), raceTitle);
  check('a lost race still says the next card is free', /costs nothing/.test($(w2, 'ovText').textContent), $(w2, 'ovText').textContent);
  const lost = JSON.parse(w2.localStorage.getItem('gh.bingo2.wallet'));
  check('a bot win counts a solo game but not a win', lost.solo.games === 1 && lost.solo.wins === 0, JSON.stringify(lost.solo));
  check('losing to a bot moves no points', $(w2, 'credits').textContent === '1000', $(w2, 'credits').textContent);

  /* 5. beating bots pays the prize */
  const w3 = boot({'gh.bingo2.soloPattern': 'line', 'gh.bingo2.soloBots': '2'});
  w3.__logic.soloWin([0, 1, 2, 3, 4]);
  check('beating two bots pays 20 points', $(w3, 'credits').textContent === '1020', $(w3, 'credits').textContent);
  const won = JSON.parse(w3.localStorage.getItem('gh.bingo2.wallet'));
  check('the prize is saved to the wallet', won.points === 1020, JSON.stringify(won));
  check('the win still counts in the solo standings', won.solo.games === 1 && won.solo.wins === 1, JSON.stringify(won.solo));
  check('the win overlay names the prize', /\+20 points for beating 2 bots/.test($(w3, 'ovText').textContent), $(w3, 'ovText').textContent);

  /* 6. with no opponents a solo win pays nothing */
  const w4 = boot({'gh.bingo2.soloPattern': 'line', 'gh.bingo2.soloBots': '0'});
  w4.__logic.soloWin([0, 1, 2, 3, 4]);
  check('a practice win pays no points', $(w4, 'credits').textContent === '1000', $(w4, 'credits').textContent);
  check('a practice win sends no prize line', !/points for beating/.test($(w4, 'ovText').textContent), $(w4, 'ovText').textContent);

  /* 7. the strip reading follows the pattern: bullseye counts nine squares */
  const w5 = boot({'gh.bingo2.soloPattern': 'bullseye'});
  const card = Array.from({length: 25}, (_, i) => ({daubed: false}));
  check('a fresh bullseye card needs nine squares', w5.__logic.soloBotLeft(card) === 9, w5.__logic.soloBotLeft(card));
  card[6].daubed = true;
  check('daubed squares are taken off the count', w5.__logic.soloBotLeft(card) === 8, w5.__logic.soloBotLeft(card));

  /* 8. per-opponent skill: casual misses, sharp chases, choices are independent */
  const w6 = boot({'gh.bingo2.soloPattern': 'line'});
  const skillSel = $(w6, 'soloSkillSel0');
  check('a skill picker exists per opponent', !!skillSel && $(w6, 'soloSkillSel2Wrap').hidden === true);
  check('skill offers casual, normal and sharp', skillSel.options.length === 3, skillSel.options.length);
  check('skill starts on normal', skillSel.value === 'normal', skillSel.value);
  check('start text names the default skill', /Beat the normal bot/.test($(w6, 'ovText').textContent), $(w6, 'ovText').textContent);
  skillSel.value = 'sharp';
  skillSel.dispatchEvent(new w6.Event('change', {bubbles: true}));
  check('the opponent skill is saved per bot', w6.localStorage.getItem('gh.bingo2.soloSkills') === JSON.stringify(['sharp', 'normal', 'normal']), w6.localStorage.getItem('gh.bingo2.soloSkills'));
  check('start text follows that opponent', /Beat the sharp bot/.test($(w6, 'ovText').textContent), $(w6, 'ovText').textContent);

  const w6b = boot({'gh.bingo2.soloBots': '3'});
  check('three opponents bring three skill pickers', $(w6b, 'soloSkillSel2Wrap').hidden === false);
  $(w6b, 'soloSkillSel1').value = 'casual';
  $(w6b, 'soloSkillSel1').dispatchEvent(new w6b.Event('change', {bubbles: true}));
  $(w6b, 'soloSkillSel2').value = 'sharp';
  $(w6b, 'soloSkillSel2').dispatchEvent(new w6b.Event('change', {bubbles: true}));
  check('start text lists every opponent skill and its total', /Rex \(normal\), Nova \(casual\), Pip \(sharp\) to earn 30 points/.test($(w6b, 'ovText').textContent), $(w6b, 'ovText').textContent);

  const w7 = boot({'gh.bingo2.soloPattern': 'line', 'gh.bingo2.soloBots': '0'});
  check('skill pickers hide with no opponents', $(w7, 'soloSkillSel0Wrap').hidden === true);

  /* the old single skill value still applies to every opponent */
  const w8 = boot({'gh.bingo2.soloPattern': 'line', 'gh.bingo2.soloBots': '1', 'gh.bingo2.soloSkill': 'casual'}, {random: 0.8});
  $(w8, 'startBtn').click();
  await flush(w8, 100000);
  check('a casual opponent can miss the whole card', !/got there first/.test($(w8, 'ovTitle').textContent), $(w8, 'ovTitle').textContent);
  check('an unattended casual round runs the deck out', /No bingo/.test($(w8, 'ovTitle').textContent), $(w8, 'ovTitle').textContent);

  /* two opponents, different skills, same round */
  const w9 = boot({'gh.bingo2.soloPattern': 'line', 'gh.bingo2.soloBots': '2', 'gh.bingo2.soloSkills': JSON.stringify(['casual', 'sharp', 'normal'])}, {random: 0.8});
  $(w9, 'startBtn').click();
  await flush(w9, 60000);
  check('the sharp opponent wins while the casual one misses', /Nova got there first/.test($(w9, 'ovTitle').textContent), $(w9, 'ovTitle').textContent);
  check('the casual opponent is not credited with the win', !/Rex got there first/.test($(w9, 'ovTitle').textContent), $(w9, 'ovTitle').textContent);

  const w10 = boot({'gh.bingo2.soloPattern': 'line', 'gh.bingo2.soloBots': '1', 'gh.bingo2.soloSkills': JSON.stringify(['sharp', 'normal', 'normal'])}, {random: 0.8});
  $(w10, 'startBtn').click();
  await flush(w10, 60000);
  check('a sharp opponent chases every call and wins', /Rex got there first/.test($(w10, 'ovTitle').textContent), $(w10, 'ovTitle').textContent);

  /* 9. the prize follows each opponent's skill: 5 casual, 10 normal, 15 sharp */
  const w11 = boot({'gh.bingo2.soloPattern': 'line', 'gh.bingo2.soloBots': '1', 'gh.bingo2.soloSkills': JSON.stringify(['casual', 'normal', 'normal'])});
  check('a casual opponent is worth 5 points', w11.__logic.soloBotPrize() === 5, w11.__logic.soloBotPrize());
  check('the start text prices a casual opponent at 5', /Beat the casual bot to earn 5 points/.test($(w11, 'ovText').textContent), $(w11, 'ovText').textContent);
  w11.__logic.soloWin([0, 1, 2, 3, 4]);
  check('beating a casual opponent pays 5', $(w11, 'credits').textContent === '1005', $(w11, 'credits').textContent);
  check('the win overlay names the smaller prize', /\+5 points for beating the bot/.test($(w11, 'ovText').textContent), $(w11, 'ovText').textContent);

  const w12 = boot({'gh.bingo2.soloPattern': 'line', 'gh.bingo2.soloBots': '1', 'gh.bingo2.soloSkills': JSON.stringify(['sharp', 'normal', 'normal'])});
  check('a sharp opponent is worth 15 points', w12.__logic.soloBotPrize() === 15, w12.__logic.soloBotPrize());
  w12.__logic.soloWin([0, 1, 2, 3, 4]);
  check('beating a sharp opponent pays 15', $(w12, 'credits').textContent === '1015', $(w12, 'credits').textContent);

  const w13 = boot({'gh.bingo2.soloPattern': 'line', 'gh.bingo2.soloBots': '3', 'gh.bingo2.soloSkills': JSON.stringify(['sharp', 'sharp', 'casual'])});
  check('a mixed trio sums its skills', w13.__logic.soloBotPrize() === 35, w13.__logic.soloBotPrize());
  check('the start text offers the mixed total', /to earn 35 points/.test($(w13, 'ovText').textContent), $(w13, 'ovText').textContent);

  /* 10. a small daily cap on solo bot winnings */
  const cap = boot({'gh.bingo2.soloPattern': 'line', 'gh.bingo2.soloBots': '1', 'gh.bingo2.soloSkills': JSON.stringify(['sharp', 'normal', 'normal'])});
  check('a fresh day allows the whole solo bot cap', cap.__logic.soloBotAllowance() === 100, cap.__logic.soloBotAllowance());
  cap.localStorage.setItem('gh.bingo2.soloWon', JSON.stringify({d: cap.__logic.dateKey(), won: 95}));
  check('earlier wins shrink the allowance', cap.__logic.soloBotAllowance() === 5, cap.__logic.soloBotAllowance());
  $(cap, 'soloSkillSel0').value = 'sharp';
  $(cap, 'soloSkillSel0').dispatchEvent(new cap.Event('change', {bubbles: true}));
  check('the start text offers only the remaining room', /earn up to 5 points \(daily cap 100\)/.test($(cap, 'ovText').textContent), $(cap, 'ovText').textContent);
  cap.__logic.soloWin([0, 1, 2, 3, 4]);
  check('a win at the cap edge pays what is left', $(cap, 'credits').textContent === '1005', $(cap, 'credits').textContent);
  check('the trimmed win says what was held back', /daily solo bot cap 100: 10 held back/.test($(cap, 'ovText').textContent), $(cap, 'ovText').textContent);
  check('the HUD chip counts up to the cap', $(cap, 'botCapWon').textContent === '100' && $(cap, 'botCapChip').classList.contains('full'), $(cap, 'botCapWon').textContent);
  check('the chip explains the spent cap', /today's cap is spent/.test($(cap, 'botCapChip').title), $(cap, 'botCapChip').title);
  check('the points panel mirrors the tally', $(cap, 'recBotWon').textContent === '100/100', $(cap, 'recBotWon').textContent);
  check('the day total is recorded', JSON.parse(cap.localStorage.getItem('gh.bingo2.soloWon')).won === 100, cap.localStorage.getItem('gh.bingo2.soloWon'));
  cap.__logic.soloWin([0, 1, 2, 3, 4]);
  check('a second win the same day pays nothing', $(cap, 'credits').textContent === '1005', $(cap, 'credits').textContent);
  check('the overlay says the cap is spent', /cap \(100 points\) is spent/.test($(cap, 'ovText').textContent), $(cap, 'ovText').textContent);
  const yday = (() => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const cap2 = boot({'gh.bingo2.soloPattern': 'line', 'gh.bingo2.soloBots': '1', 'gh.bingo2.soloSkills': JSON.stringify(['sharp', 'normal', 'normal']), 'gh.bingo2.soloWon': JSON.stringify({d: yday, won: 100})});
  check('yesterday’s winnings do not count today', cap2.__logic.soloBotAllowance() === 100, cap2.__logic.soloBotAllowance());

  /* 11. the one-time What's new card */
  const wn1 = boot({}, {freshCard: true});
  check("a first visit shows the What's new card", /What's new/.test($(wn1, 'ovTitle').textContent) && wn1.localStorage.getItem('gh.bingo2.whatsNew') === null, $(wn1, 'ovTitle').textContent);
  check('the card states the prizes and the daily cap', /5, 10 or 15 points/.test($(wn1, 'ovText').textContent) && /100 points a day/.test($(wn1, 'ovText').textContent), $(wn1, 'ovText').textContent);
  $(wn1, 'overlayAlt').click();
  check('Got it dismisses the card and restores the start screen', wn1.localStorage.getItem('gh.bingo2.whatsNew') === 'bots-v1' && $(wn1, 'ovTitle').textContent === 'Bingo night', $(wn1, 'ovTitle').textContent);
  const wn2 = boot({'gh.bingo2.whatsNew': 'bots-v1'});
  check('a dismissed card stays gone on the next visit', $(wn2, 'ovTitle').textContent === 'Bingo night' && !/What's new/.test($(wn2, 'ovTitle').textContent), $(wn2, 'ovTitle').textContent);
  const wn3 = boot({}, {freshCard: true});
  $(wn3, 'startBtn').click();
  await flush(wn3);
  check('starting from the card dismisses it and deals a race', wn3.localStorage.getItem('gh.bingo2.whatsNew') === 'bots-v1' && !$(wn3, 'overlay').classList.contains('show') && $(wn3, 'soloBots').children.length === 1, $(wn3, 'ovTitle').textContent);

  process.exit(suite.report('SOLO OPPONENT'));
})().catch(e => { console.log('HARNESS ERROR: ' + e.stack); process.exit(1); });
