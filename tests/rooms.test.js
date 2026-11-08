const fs = require('fs');
const { bootGame, installClock, flushClock , createHarness} = require('./helpers');

const suite = createHarness();
const {check, $} = suite;

const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const PAGE_URL = 'https://example.com/bingo-2.html';

function installPeer(w, broker) {
  class FakeConn {
    constructor(peer) { this.peer = peer; this.handlers = {}; this.open = false; }
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; }
    emit(ev, ...a) { (this.handlers[ev] || []).forEach(f => f(...a)); }
    send(msg) {
      const remote = this._remote;
      if (!remote || !remote.open) return;
      const copy = JSON.parse(JSON.stringify(msg));
      remote.emit('data', copy);
    }
    close() {
      this.open = false;
      this.emit('close');
      if (this._remote && this._remote.open) { this._remote.open = false; this._remote.emit('close'); }
    }
  }
  class FakePeer {
    constructor(id) {
      this.id = id || ('p-' + Math.random().toString(36).slice(2, 9));
      this.handlers = {};
      this.destroyed = false;
      broker.peers.set(this.id, this);
      w.setTimeout(() => { if (!this.destroyed) this.emit('open'); }, 0);
    }
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; }
    emit(ev, ...a) { (this.handlers[ev] || []).forEach(f => f(...a)); }
    connect(targetId) {
      const conn = new FakeConn(targetId);
      const remote = new FakeConn(this.id);
      conn._remote = remote; remote._remote = conn;
      conn.open = true; remote.open = true;
      const target = broker.peers.get(targetId);
      if (target) w.setTimeout(() => target.emit('connection', remote), 0);
      w.setTimeout(() => conn.emit('open'), 0);
      return conn;
    }
    destroy() { this.destroyed = true; broker.peers.delete(this.id); }
  }
  w.Peer = FakePeer;
}

function boot(broker) {
  return bootGame({
    html: HTML,
    url: PAGE_URL,
    beforeParse(w) {
      installClock(w, error => { console.log('TIMER ERROR: ' + error.message + '\n' + error.stack); suite.failures++; });
      installPeer(w, broker);
    },
    onError: message => { suite.failures++; console.log('PAGE ERROR: ' + message); }
  });
}
const flush = (w, ms = 0) => flushClock(w, ms, 8);

(async () => {
  /* ---------- solo ---------- */
  {
    const dom = boot({ peers: new Map() });
    const w = dom.window, d = w.document;
    await flush(w);
    check('solo: credits start at 1000', $(d, 'credits').textContent === '1000', $(d, 'credits').textContent);
    $(d, 'startBtn').click();
    await flush(w, 4000);
    const balls = Number($(d, 'balls').textContent);
    check('solo: caller runs', balls > 0, 'balls=' + balls);
    check('solo: 25 cells', $(d, 'grid').children.length === 25);
    check('solo: pot chip hidden', $(d, 'potChip').hidden === true);
    dom.window.close();
  }

  /* ---------- host + bot round, pot and payouts ---------- */
  const broker = { peers: new Map() };
  const hostDom = boot(broker);
  const hw = hostDom.window, hd = hw.document;
  await flush(hw);

  $(hd, 'hostName').value = 'Host';
  $(hd, 'tableSel').value = '10';
  $(hd, 'cardsSel').value = '2';
  $(hd, 'botSel').value = '1';
  $(hd, 'botSel').dispatchEvent(new hw.Event('change', {bubbles: true}));
  check('setup: bot skill pickers follow the bot count', $(hd, 'botSkillSel0') && $(hd, 'botSkillSel0').options.length === 3 && $(hd, 'botSkillSel1Wrap').hidden === true, $(hd, 'botSkillSel0') ? $(hd, 'botSkillSel0').options.length : 'missing');
  $(hd, 'roomsBtn').click();
  await flush(hw);
  $(hd, 'createBtn').click();
  await flush(hw, 20);

  const code = $(hd, 'lobbyCode').textContent.trim();
  check('host: room created with 5-char code', /^[A-Z0-9]{5}$/.test(code), code);
  check('host: lobby shows 2 players', $(hd, 'lobbyCount').textContent === '2', $(hd, 'lobbyCount').textContent);
  check('host: pot preview mentions credits', /pot \d+/.test($(hd, 'lobbyPot').textContent), $(hd, 'lobbyPot').textContent);

  check('host: lobby has a skill picker per bot', $(hd, 'lobbyBotSkill0') && $(hd, 'lobbyBotSkill0').options.length === 3);
  check('host: bots start on normal skill', $(hd, 'lobbyBotSkill0').value === 'normal', $(hd, 'lobbyBotSkill0').value);
  check('host: unused bots have no skill field', $(hd, 'lobbyBotSkill1Wrap').hidden === true && $(hd, 'lobbyBotSkill2Wrap').hidden === true);
  $(hd, 'lobbyBotSkill0').value = 'casual';
  $(hd, 'lobbyBotSkill0').dispatchEvent(new hw.Event('change', {bubbles: true}));
  await flush(hw, 20);
  check('host: skill choice is saved per bot', hw.localStorage.getItem('gh.bingo2.roomBotSkills') === JSON.stringify(['casual', 'normal', 'normal']), hw.localStorage.getItem('gh.bingo2.roomBotSkills'));
  $(hd, 'lobbyBots').value = '3';
  $(hd, 'lobbyBots').dispatchEvent(new hw.Event('change', {bubbles: true}));
  await flush(hw, 20);
  check('host: three bots bring three skill pickers', $(hd, 'lobbyBotSkill2Wrap').hidden === false);
  $(hd, 'lobbyBotSkill1').value = 'sharp';
  $(hd, 'lobbyBotSkill1').dispatchEvent(new hw.Event('change', {bubbles: true}));
  await flush(hw, 20);
  const lobbyText = $(hd, 'lobbyPlayers').textContent.replace(/\s+/g, ' ');
  check('host: each bot shows its own skill', /Rex\s*BOT\s*·\s*CASUAL/.test(lobbyText) && /Nova\s*BOT\s*·\s*SHARP/.test(lobbyText) && /Pip\s*BOT\s*·\s*NORMAL/.test(lobbyText), lobbyText);
  $(hd, 'lobbyBots').value = '0';
  $(hd, 'lobbyBots').dispatchEvent(new hw.Event('change', {bubbles: true}));
  await flush(hw, 20);
  check('host: skill fields hide with no bots', $(hd, 'lobbyBotSkill0Wrap').hidden === true);
  $(hd, 'lobbyBots').value = '1';
  $(hd, 'lobbyBots').dispatchEvent(new hw.Event('change', {bubbles: true}));
  await flush(hw, 20);
  check('host: a returning bot keeps its skill', $(hd, 'lobbyBotSkill0').value === 'casual', $(hd, 'lobbyBotSkill0').value);

  /* ---------- guest joins ---------- */
  const guestDom = boot(broker);
  const gw = guestDom.window, gd = gw.document;
  await flush(gw);
  $(gd, 'joinName').value = 'Gwen';
  $(gd, 'joinCode').value = code;
  $(gd, 'joinTab').click();
  $(gd, 'joinForm').dispatchEvent(new gw.Event('submit', { bubbles: true, cancelable: true }));
  await flush(gw, 30);
  check('guest: entered lobby', $(gd, 'lobbyCode').textContent.trim() === code, $(gd, 'lobbyCode').textContent);
  check('host: room now shows 3 players', $(hd, 'lobbyCount').textContent === '3', $(hd, 'lobbyCount').textContent);
  check('guest: settings name the casual bot', /Bots: Rex casual/.test($(gd, 'guestSettings').textContent), $(gd, 'guestSettings').textContent);

  /* ---------- round ---------- */
  $(hd, 'startRoomBtn').click();
  await flush(hw, 500);
  check('guest: received 2 cards', $(gd, 'cardTabs').children.length === 2, 'tabs=' + $(gd, 'cardTabs').children.length);
  check('guest: credits debited to 980', $(gd, 'credits').textContent === '980', $(gd, 'credits').textContent);
  check('host: credits debited to 980', $(hd, 'credits').textContent === '980', $(hd, 'credits').textContent);
  check('host: pot chip shows 57', $(hd, 'pot').textContent === '57', $(hd, 'pot').textContent);
  check('guest: pot chip shows 57', $(gd, 'pot').textContent === '57', $(gd, 'pot').textContent);

  /* guest daubs a called number, checking each card tab so card contents
     cannot make the test fail at random */
  const calledNums = () => [...$(gd, 'history').children]
    .map(el => Number(String(el.textContent).replace(/\D/g, ''))).filter(Boolean);
  let daubed = false;
  for (let attempt = 0; attempt < 6 && !daubed; attempt++) {
    const tabs = [...$(gd, 'cardTabs').children];
    for (let ti = 0; ti < tabs.length && !daubed; ti++) {
      tabs[ti].click();
      await flush(gw, 5);
      const called = new Set(calledNums());
      const btn = [...$(gd, 'grid').children]
        .find(b => called.has(Number(b.textContent)) && !b.classList.contains('daubed'));
      if (!btn) continue;
      btn.click();
      for (let w = 0; w < 24 && !btn.classList.contains('daubed'); w++) {
        await flush(hw, 10); await flush(gw, 10);
      }
      daubed = btn.classList.contains('daubed');
    }
    if (!daubed) await flush(hw, 2500);
  }
  check('guest: daub accepted by host and confirmed back', daubed);

  /* run to the call budget */
  await flush(hw, 45000);
  const balls = Number($(hd, 'balls').textContent);
  check('host: round ran to the 32-ball budget', balls >= 30, 'balls=' + balls);
  check('host: overlay shows pot/rake line', /Pot \d+/.test($(hd, 'ovText').textContent), $(hd, 'ovText').textContent);
  check('host: credits unchanged (no bingo, no daubs)', $(hd, 'credits').textContent === '980', $(hd, 'credits').textContent);
  check('host: jackpot grew past its 100 seed', Number($(hd, 'jackpotAmt').textContent) > 100, $(hd, 'jackpotAmt').textContent);
  check('guest: overlay shows settlement', /Pot \d+/.test($(gd, 'ovText').textContent), $(gd, 'ovText').textContent);
  check('guest: credits settled at 980', $(gd, 'credits').textContent === '980', $(gd, 'credits').textContent);

  /* second round keeps the jackpot */
  const jackpotBefore = Number($(hd, 'jackpotAmt').textContent);
  $(hd, 'startBtn').click();
  await flush(hw, 45000);
  check('host: second round added to the jackpot', Number($(hd, 'jackpotAmt').textContent) > jackpotBefore,
    jackpotBefore + ' -> ' + $(hd, 'jackpotAmt').textContent);
  check('host: ante charged again', $(hd, 'credits').textContent === '960', $(hd, 'credits').textContent);

    const walletOf = win => { try { return win ? JSON.parse(win.localStorage.getItem('gh.bingo2.wallet')) || {} : {}; } catch (e) { return {}; } };
  check('host: wallet saved to localStorage', walletOf(typeof hw !== 'undefined' ? hw : null).points === 960, JSON.stringify(walletOf(typeof hw !== 'undefined' ? hw : null)));
  check('host: record counted both rounds', $(hd, 'recRoomGames').textContent === '2' && walletOf(typeof hw !== 'undefined' ? hw : null).room.games === 2, $(hd, 'recRoomGames').textContent + ' / ' + JSON.stringify(walletOf(typeof hw !== 'undefined' ? hw : null)));
  check('host: card costs tracked', walletOf(typeof hw !== 'undefined' ? hw : null).room.staked === 40, JSON.stringify(walletOf(typeof hw !== 'undefined' ? hw : null)));
  check('guest: wallet panel mirrors the balance', $(gd, 'walletCredits').textContent === $(gd, 'credits').textContent && $(gd, 'credits').textContent === '960', $(gd, 'walletCredits').textContent + ' vs ' + $(gd, 'credits').textContent);
  process.exit(suite.report('ROOMS'));
})().catch(e => { console.log('HARNESS ERROR: ' + e.stack); process.exit(1); });
