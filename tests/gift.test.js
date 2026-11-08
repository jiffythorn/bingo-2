const nodeCrypto = require('crypto').webcrypto;
const { GAME, bootGame , createHarness} = require('./helpers');

const suite = createHarness();
const {check, $} = suite;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 5000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(20); }
  return false;
};

function boot(html, url, seed) {
  const local = {};
  if (seed && seed.wallet) local['gh.bingo2.wallet'] = seed.wallet;
  if (seed && seed.claims) local['gh.bingo2.claims'] = seed.claims;
  return bootGame({
    html,
    url,
    local,
    beforeParse(w) {
      try { Object.defineProperty(w, 'crypto', {value: nodeCrypto, configurable: true}); }
      catch (e) { try { w.crypto.subtle = nodeCrypto.subtle; } catch (e2) {} }
      w.confirm = () => true;
    },
    onError: message => { suite.failures++; console.log('PAGE ERROR: ' + message); }
  });
}

(async () => {
  /* Test-only signer: same ES256 token format the game verifies. */
  const pair = await nodeCrypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
  const pub = await nodeCrypto.subtle.exportKey('jwk', pair.publicKey);
  const craft = async payload => {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const input = `GH2G.1.${payload.r}.${body}`;
    const sig = await nodeCrypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, pair.privateKey, Buffer.from(input));
    return `${input}.${Buffer.from(new Uint8Array(sig)).toString('base64url')}`;
  };
  const nowMs = Date.now();
  const token600 = await craft({c: 600, r: 'promo', e: nowMs + 7 * 86400000, i: nowMs, n: 'promo-600'});
  const token250 = await craft({c: 250, r: 'promo', e: nowMs + 7 * 86400000, i: nowMs, n: 'promo-250'});
  check('two different grants signed', token600 !== token250 && token250.startsWith('GH2G.1.promo.'));

  const PAIRED = GAME.replace('const GRANT_KEY = null;', 'const GRANT_KEY = ' + JSON.stringify(pub) + ';');
  check('game copy now carries the key', PAIRED !== GAME && PAIRED.includes('const GRANT_KEY = {'));

  /* gift link */
  const g1 = boot(PAIRED, 'https://example.com/bingo-2.html?gift=' + encodeURIComponent(token600)).window;
  const gd1 = g1.document;
  check('gift link offers the redeem overlay', await until(() => /A gift is waiting/.test($(gd1, 'ovTitle').textContent)), $(gd1, 'ovTitle').textContent);
  check('overlay states the amount', /600 points/.test($(gd1, 'ovText').textContent), $(gd1, 'ovText').textContent);
  $(gd1, 'startBtn').click();
  check('redeem credits the wallet', await until(() => $(gd1, 'credits').textContent === '1600'), $(gd1, 'credits').textContent);
  const walletJson = g1.localStorage.getItem('gh.bingo2.wallet');
  const claimsJson = g1.localStorage.getItem('gh.bingo2.claims');
  check('wallet persisted', JSON.parse(walletJson).points === 1600);
  const nonce = JSON.parse(Buffer.from(token600.split('.')[3], 'base64url').toString('utf8')).n;
  check('claim recorded by nonce', JSON.parse(claimsJson).includes(nonce), claimsJson);
  check('gift param stripped from the URL', g1.location.search === '', g1.location.search);
  check('receipt overlay shown', await until(() => /Gift redeemed/.test($(gd1, 'ovTitle').textContent)), $(gd1, 'ovTitle').textContent);

  /* same browser (seeded storage), same link again */
  const g2 = boot(PAIRED, 'https://example.com/bingo-2.html?gift=' + encodeURIComponent(token600), {wallet: walletJson, claims: claimsJson}).window;
  const gd2 = g2.document;
  check('second use refused', await until(() => /Gift already used/.test($(gd2, 'ovTitle').textContent)), $(gd2, 'ovTitle').textContent);
  check('balance unchanged by the second use', $(gd2, 'credits').textContent === '1600', $(gd2, 'credits').textContent);

  /* manual redeem field on a fresh wallet */
  const g3 = boot(PAIRED, 'https://example.com/bingo-2.html').window;
  const gd3 = g3.document;
  $(gd3, 'giftInput').value = token250;
  $(gd3, 'giftRedeemBtn').click();
  check('wallet field redeems a code', await until(() => $(gd3, 'credits').textContent === '1250'), $(gd3, 'credits').textContent);
  check('success message shown', /250 points added/.test($(gd3, 'giftResult').textContent), $(gd3, 'giftResult').textContent);

  $(gd3, 'giftInput').value = token250;
  $(gd3, 'giftRedeemBtn').click();
  check('same code refused twice in one session', await until(() => /already been redeemed/.test($(gd3, 'giftResult').textContent)), $(gd3, 'giftResult').textContent);

  const sigStart = token250.lastIndexOf('.') + 1;
  const flip = token250.slice(0, sigStart + 3) + (token250[sigStart + 3] === 'A' ? 'B' : 'A') + token250.slice(sigStart + 4);
  $(gd3, 'giftInput').value = flip;
  $(gd3, 'giftRedeemBtn').click();
  check('tampered code rejected', await until(() => /signature/.test($(gd3, 'giftResult').textContent)), $(gd3, 'giftResult').textContent);
  check('balance untouched by tampering', $(gd3, 'credits').textContent === '1250', $(gd3, 'credits').textContent);

  const expired = await craft({c: 500, r: 'promo', e: Date.now() - 60000, i: Date.now() - 7200000, n: 'expired1'});
  $(gd3, 'giftInput').value = expired;
  $(gd3, 'giftRedeemBtn').click();
  check('expired code rejected', await until(() => /expired/.test($(gd3, 'giftResult').textContent)), $(gd3, 'giftResult').textContent);
  check('expired leaves the balance alone', $(gd3, 'credits').textContent === '1250', $(gd3, 'credits').textContent);

  const overCap = await craft({c: 2000, r: 'promo', e: Date.now() + 3600000, i: Date.now(), n: 'overcap1'});
  $(gd3, 'giftInput').value = overCap;
  $(gd3, 'giftRedeemBtn').click();
  check('over-cap code rejected', await until(() => /cap/.test($(gd3, 'giftResult').textContent)), $(gd3, 'giftResult').textContent);

  const prizeOk = await craft({c: 25000, r: 'prize', e: Date.now() + 3600000, i: Date.now(), n: 'prizeok1'});
  $(gd3, 'giftInput').value = prizeOk;
  $(gd3, 'giftRedeemBtn').click();
  check('prize at its cap is accepted', await until(() => $(gd3, 'credits').textContent === '26250'), $(gd3, 'credits').textContent);

  /* unpaired copy */
  const g4 = boot(GAME, 'https://example.com/bingo-2.html').window;
  const gd4 = g4.document;
  $(gd4, 'giftInput').value = token250;
  $(gd4, 'giftRedeemBtn').click();
  check('unpaired copy refuses codes', await until(() => /no grant key configured/.test($(gd4, 'giftResult').textContent)), $(gd4, 'giftResult').textContent);

  const g5 = boot(GAME, 'https://example.com/bingo-2.html?gift=' + encodeURIComponent(token250)).window;
  check('unpaired copy explains gift links are off', await until(() => /Gift links are off/.test($(g5.document, 'ovTitle').textContent)), $(g5.document, 'ovTitle').textContent);

  process.exit(suite.report('GIFT'));
})();
