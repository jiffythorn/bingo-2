const fs = require('fs');
const { JSDOM } = require('jsdom');
const GAME = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

let failures = 0;
const check = (n, c, x) => { if (c) console.log('PASS ' + n); else { failures++; console.log('FAIL ' + n + (x ? ' :: ' + x : '')); } };
const $ = (d, id) => d.document.getElementById(id);

function boot(seed) {
  return new JSDOM(GAME, {
    runScripts: 'dangerously',
    url: 'https://example.com/games/bingo-2.html',
    pretendToBeVisual: true,
    beforeParse(w) {
      if (seed && seed.wallet) w.localStorage.setItem('gh.bingo2.wallet', JSON.stringify(seed.wallet));
      w.addEventListener('error', e => { failures++; console.log('PAGE ERROR: ' + (e.message || e.error)); });
    }
  }).window;
}

const codeOf = d => ($(d, 'walletCodeOut').textContent || '').trim();
const stored = d => JSON.parse(d.localStorage.getItem('gh.bingo2.wallet') || '{}');

function copyCode(d) { $(d, 'walletCopy').click(); return codeOf(d); }
function restore(d, code) {
  $(d, 'walletRestoreBtn').click();
  $(d, 'walletCodeInput').value = code;
  $(d, 'walletCheck').click();
  const preview = $(d, 'walletPreview').textContent.trim();
  const ready = !$(d, 'walletConfirm').hidden;
  if (ready) $(d, 'walletApply').click();
  return { preview, ready };
}

// 1. legacy v1 wallet migrates to points with an empty record
const d1 = boot({ wallet: { v: 1, credits: 2500, updated: 0 } });
check('v1 wallet loads points', $(d1, 'credits').textContent === '2500', $(d1, 'credits').textContent);
check('v1 wallet shows points in panel', $(d1, 'walletCredits').textContent === '2,500', $(d1, 'walletCredits').textContent);
check('v1 wallet starts an empty record', $(d1, 'recRoomGames').textContent === '0' && $(d1, 'recRoomWins').textContent === '0' && $(d1, 'recRoomEarned').textContent === '0');
$(d1, 'walletCopy').click();
check('wallet saved as v5 with points', stored(d1).v === 5 && stored(d1).points === 2500, JSON.stringify(stored(d1)));

// 2. code shape
const code = copyCode(d1);
check('restore code is the v5 12-group format', /^GH2(-[A-Z2-7]{4}){12}$/.test(code), code);
check('copy shows the code', $(d1, 'walletCodeOut').hidden === false);

// 3. record renders and survives a restore into a fresh browser
const d2 = boot({ wallet: { v: 2, points: 1000, games: 4, wins: 2, earned: 3200, updated: 1 } });
check('v2 record renders', $(d2, 'recRoomGames').textContent === '4' && $(d2, 'recRoomWins').textContent === '2' && $(d2, 'recRoomEarned').textContent === '3,200', [$(d2, 'recRoomGames').textContent, $(d2, 'recRoomWins').textContent, $(d2, 'recRoomEarned').textContent].join('/'));
const code2 = copyCode(d2);
const r1 = restore(d1, code2);
check('preview names points and the record', /1,000 points/.test(r1.preview) && /4 room games \(2 won\)/.test(r1.preview), r1.preview);
check('restore replaces the balance', $(d1, 'credits').textContent === '1000', $(d1, 'credits').textContent);
check('restore brings the record across', $(d1, 'recRoomGames').textContent === '4' && $(d1, 'recRoomWins').textContent === '2' && $(d1, 'recRoomEarned').textContent === '3,200', [$(d1, 'recRoomGames').textContent, $(d1, 'recRoomWins').textContent, $(d1, 'recRoomEarned').textContent].join('/'));
check('restore persisted v5', stored(d1).v === 5 && stored(d1).points === 1000 && stored(d1).room.games === 4 && stored(d1).room.wins === 2 && stored(d1).room.earned === 3200, JSON.stringify(stored(d1)));

// 4. merging can only move the record up
const d3 = boot({ wallet: { v: 2, points: 300, games: 9, wins: 5, earned: 9000, updated: 2 } });
const r2 = restore(d3, code2);
check('merge keeps the higher record', r2.ready && $(d3, 'recRoomGames').textContent === '9' && $(d3, 'recRoomWins').textContent === '5' && $(d3, 'recRoomEarned').textContent === '9,000', [$(d3, 'recRoomGames').textContent, $(d3, 'recRoomWins').textContent, $(d3, 'recRoomEarned').textContent].join('/'));
check('merge still takes the imported points', $(d3, 'credits').textContent === '1000', $(d3, 'credits').textContent);

// 5. bad codes never change anything
const before = stored(d3);
const r3 = restore(d3, 'GH2-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG');
check('bad code is refused', r3.ready === false && $(d3, 'walletPreview').classList.contains('bad'), r3.preview);
check('bad code leaves balance and record alone', stored(d3).points === before.points && stored(d3).room.games === (before.room ? before.room.games : before.games), JSON.stringify(stored(d3)));
const r4 = restore(d3, 'not-a-code');
check('garbage is refused', r4.ready === false && $(d3, 'credits').textContent === '1000', r4.preview);


// 6. return on card costs
const d4 = boot({ wallet: { v: 3, points: 800, games: 5, wins: 2, earned: 1500, staked: 1200, updated: 1 } });
check('return on cards shows the ratio', $(d4, 'recRoomReturn').textContent === '125%', $(d4, 'recRoomReturn').textContent);
check('return explains the numbers', /1,500 points won on 1,200 spent/.test($(d4, 'recRoomReturn').title), $(d4, 'recRoomReturn').title);
const code4 = copyCode(d4);
const d5 = boot({});
restore(d5, code4);
check('restore carries card costs', stored(d5).room.staked === 1200, JSON.stringify(stored(d5)));
check('return survives a restore', $(d5, 'recRoomReturn').textContent === '125%', $(d5, 'recRoomReturn').textContent);
const d6 = boot({ wallet: { v: 3, points: 800, games: 1, wins: 0, earned: 0, staked: 0, updated: 1 } });
check('no card costs shows a dash', $(d6, 'recRoomReturn').textContent === '—', $(d6, 'recRoomReturn').textContent);
const d7 = boot({ wallet: { v: 2, points: 700, games: 3, wins: 1, earned: 400, updated: 1 } });
check('v2 saves load with no staked figure', $(d7, 'recRoomReturn').textContent === '—' && $(d7, 'credits').textContent === '700', $(d7, 'recRoomReturn').textContent);


// 7. separate solo and room standings
const d8 = boot({ wallet: { v: 4, points: 900, solo: { games: 8, wins: 5 }, room: { games: 6, wins: 3, earned: 1500, staked: 1200 }, updated: 1 } });
check('solo standings render', $(d8, 'recSoloGames').textContent === '8' && $(d8, 'recSoloWins').textContent === '5', [$(d8, 'recSoloGames').textContent, $(d8, 'recSoloWins').textContent].join('/'));
check('solo win rate renders', $(d8, 'recSoloRate').textContent === '63%', $(d8, 'recSoloRate').textContent);
check('room standings stay separate', $(d8, 'recRoomGames').textContent === '6' && $(d8, 'recRoomWins').textContent === '3', [$(d8, 'recRoomGames').textContent, $(d8, 'recRoomWins').textContent].join('/'));
check('gross earnings render', $(d8, 'recRoomEarned').textContent === '1,500', $(d8, 'recRoomEarned').textContent);
check('net points render with a sign', $(d8, 'recRoomNet').textContent === '+300' && $(d8, 'recRoomNet').classList.contains('up'), $(d8, 'recRoomNet').textContent);
check('return on cards still renders', $(d8, 'recRoomReturn').textContent === '125%', $(d8, 'recRoomReturn').textContent);
const code8 = copyCode(d8);
const d9 = boot({});
restore(d9, code8);
check('restore carries solo standings', stored(d9).solo.games === 8 && stored(d9).solo.wins === 5, JSON.stringify(stored(d9).solo));
check('restore carries room standings', stored(d9).room.games === 6 && stored(d9).room.earned === 1500 && stored(d9).room.staked === 1200, JSON.stringify(stored(d9).room));
check('both standings show after a restore', $(d9, 'recSoloGames').textContent === '8' && $(d9, 'recRoomNet').textContent === '+300', $(d9, 'recRoomNet').textContent);
const d10 = boot({ wallet: { v: 4, points: 500, solo: { games: 2, wins: 1 }, room: { games: 2, wins: 0, earned: 200, staked: 1200 }, updated: 1 } });
check('a losing run shows negative net', $(d10, 'recRoomNet').textContent === '−1,000' && $(d10, 'recRoomNet').classList.contains('down'), $(d10, 'recRoomNet').textContent);


// 8. the daily streak rides along in the code
const dayKey = off => {
  const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayOf = d => JSON.parse(d.localStorage.getItem('gh.bingo2.daily') || 'null');
const d11 = boot({});
d11.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayKey(0), streak: 5, best: 9}));
const code11 = copyCode(d11);
check('streaked code is the v5 12-group format', /^GH2(-[A-Z2-7]{4}){12}$/.test(code11), code11);
const d12 = boot({});
$(d12, 'walletRestoreBtn').click();
$(d12, 'walletCodeInput').value = code11;
$(d12, 'walletCheck').click();
check('preview mentions the daily streak', /5-day daily streak/.test($(d12, 'walletPreview').textContent), $(d12, 'walletPreview').textContent);
const d12b = boot({});
restore(d12b, code11);
check('restore carries the streak', dayOf(d12b) && dayOf(d12b).streak === 5 && dayOf(d12b).best === 9 && dayOf(d12b).last === dayKey(0), JSON.stringify(dayOf(d12b)));
check('streak chip shows after a restore', $(d12b, 'streak').textContent === '5' && !$(d12b, 'streakChip').hidden, $(d12b, 'streak').textContent);
const d13 = boot({});
d13.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayKey(-1), streak: 2, best: 4}));
restore(d13, code11);
check('a newer streak replaces an older one', dayOf(d13).streak === 5 && dayOf(d13).last === dayKey(0) && dayOf(d13).best === 9, JSON.stringify(dayOf(d13)));
const d14 = boot({});
d14.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayKey(0), streak: 7, best: 7}));
restore(d14, code11);
check('a same-day restore keeps the longer streak', dayOf(d14).streak === 7 && dayOf(d14).best === 9, JSON.stringify(dayOf(d14)));
const d15 = boot({});
d15.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayKey(-3), streak: 3, best: 3}));
restore(d15, 'GH2-L3BS-PGFK-WQ6Y-R4K2-YMTZ-C3VU-HWEP-CWWD-E6XF-FZBT');
check('a v4 code still restores points', stored(d15).points === 2500, JSON.stringify(stored(d15)) + ' preview=' + $(d15, 'walletPreview').textContent);
check('a v4 code leaves the local streak alone', dayOf(d15).streak === 3 && dayOf(d15).last === dayKey(-3), JSON.stringify(dayOf(d15)));


// 9. an expired carried streak is called out
const staleKey = dayKey(-4);
const d16 = boot({});
d16.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: staleKey, streak: 6, best: 8}));
const staleCode = copyCode(d16);
const d17 = boot({});
$(d17, 'walletRestoreBtn').click();
$(d17, 'walletCodeInput').value = staleCode;
$(d17, 'walletCheck').click();
const stalePreview = $(d17, 'walletPreview').textContent;
check('preview warns the carried streak lapsed', /ended 4 days ago/.test(stalePreview) && /will not count as a live run/.test(stalePreview) && /best of 8/.test(stalePreview), stalePreview);
restore(d17, staleCode);
check('restore keeps the lapsed best but not a live chip', dayOf(d17).best === 8 && $(d17, 'streakChip').hidden, JSON.stringify(dayOf(d17)));
check('restore says the streak lapsed', /daily streak ended/.test($(d17, 'walletPreview').textContent) && /best of 8/.test($(d17, 'walletPreview').textContent), $(d17, 'walletPreview').textContent);
const d18 = boot({});
d18.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayKey(-2), streak: 3, best: 3}));
const twoDayCode = copyCode(d18);
const d19 = boot({});
$(d19, 'walletRestoreBtn').click();
$(d19, 'walletCodeInput').value = twoDayCode;
$(d19, 'walletCheck').click();
check('two days away reads naturally', /ended the day before yesterday/.test($(d19, 'walletPreview').textContent), $(d19, 'walletPreview').textContent);
const d20 = boot({});
d20.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayKey(0), streak: 4, best: 4}));
restore(d20, twoDayCode);
check('a live local streak is not called lapsed', !/daily streak ended/.test($(d20, 'walletPreview').textContent) && dayOf(d20).streak === 4, $(d20, 'walletPreview').textContent);


// 10. the streak freeze rides in the code
const d21 = boot({});
d21.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayKey(0), streak: 2, best: 2, freezes: 1}));
const freezeCode = copyCode(d21);
const d22 = boot({});
$(d22, 'walletRestoreBtn').click();
$(d22, 'walletCodeInput').value = freezeCode;
$(d22, 'walletCheck').click();
check('preview mentions the carried freeze', /also carries a streak freeze/.test($(d22, 'walletPreview').textContent), $(d22, 'walletPreview').textContent);
restore(d22, freezeCode);
check('freeze travels in the code', dayOf(d22).freezes === 1, JSON.stringify(dayOf(d22)));
check('freeze marker shows on the chip', !$(d22, 'freezeTag').hidden, String($(d22, 'freezeTag').hidden));
const d23 = boot({});
d23.localStorage.setItem('gh.bingo2.daily', JSON.stringify({last: dayKey(0), streak: 3, best: 3, freezes: 0}));
restore(d23, freezeCode);
check('a carried freeze joins a local streak', dayOf(d23).freezes === 1 && dayOf(d23).streak === 3, JSON.stringify(dayOf(d23)));
check('code length is unchanged by the freeze', /^GH2(-[A-Z2-7]{4}){12}$/.test(freezeCode), freezeCode);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL WALLET CHECKS PASSED');
process.exit(failures ? 1 : 0);
