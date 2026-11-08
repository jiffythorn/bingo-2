# Bingo 2 — credits, pots and what actually brings players back

> **Terminology note (2026-11-07).** This is the research/design document and
> keeps the industry word *credits* for the apps it surveys. The shipped build
> calls its currency **points**: score tokens with no cash value, used for card
> costs, the pot and a leaderboard record (games, wins, points earned) that
> travels with the player via the restore code. Nothing can be bought, sold or
> redeemed, and no real money is involved anywhere.

Research + design proposal, 2026-11-07. The wallet, pot, restore codes, gift
codes, the broke top-up and the claimable seven-day login ladder are
implemented; the sync, album, event and grant-operations sections remain
proposals.

Goal: work out how the games people spend money on actually structure
credits, pots and return visits, then decide what fits a static, no-account,
GitHub-Pages bingo table — and what we must not copy.

---

## 0. The short version

1. **The big social bingo apps do not run a shared pot.** Bingo Blitz, Bingo
   Bash and Bingo Aloha sell credits per card and pay *algorithmic* prizes.
   Blitz's own support page says a player's prize "may be determined based on
   your own achievements and historical data in the system and **not on the
   current achievements of other players**." (A pot is the thing you *think*
   you're playing for; it is not what they sell.)
2. **Real pots exist in three places**, and all three are modelable: regulated
   bingo (pool = ticket sales − participation fee, with a guaranteed minimum),
   pari-mutuel tournament apps (Bingo Tour: identical cards, top 3 paid from
   the pool, ~29% effective rake in one measured match), and pool/poker-style
   games (8 Ball Pool: combined entry fees = prize pool, winner takes it, small
   "table rental fee" on expensive tables).
3. **What actually moves retention is events, not features**: competition
   events (+212% YoY) and mini-game events (+42% YoY) at Bingo Blitz, per
   Liquid & Grit / Deconstructor of Fun. Collections are near-universal
   (74 of the top 100 social-casino games) but a *meh* collection is negative:
   the average collection release moved revenue share **−1.6% MoM**, while one
   well-integrated collection (Bingo Bash "Fish n' Chips") did **+12% revenue,
   +66% downloads**.
4. **A pure player→player pot with no sink inflates and dies.** If the only
   currency movement is between players, there is no faucet and no sink — just
   redistribution — and bots make it worse (bot farms are the classic inflation
   source; "chip dumping" is the classic exploit). Every working pot economy
   has a rake, a stake ladder, and payouts spread across the top finishers.
5. **We cannot sell credits, and we cannot let credits become money.**
   Purchasable + redeemable currency = gambling, full stop. The UK requires a
   licence even for bingo played over Zoom/social media; New York treats
   "virtual coins that can be redeemed" as gambling regardless of framing and
   sent 26 cease-and-desists; Washington treats non-redeemable wagering
   currency as a "thing of value." A static GitHub Pages site cannot do KYC,
   geofencing, segregated funds or RTP disclosure, so: **single non-redeemable
   currency, no price tag, no cash-out, no transfers, ever** — see §5.

So the design below is "credits with stakes and a pot", not "credits for sale".
Everything is host-authoritative, works offline for the solo table, and the
only external dependency stays PeerJS.

---

## 1. How the money-makers are actually built

### 1.1 Bingo Blitz (Playtika) — credits per card, algorithmic prizes

- **Currencies.** `Credits` buy cards (the play currency); `Gems` buy power-ups,
  boosts and event items in the Blitz Boutique; `Coins` migrated to the Slots
  side. Nine power-ups, seven single-use per round.
- **The gate is the card price, not an energy bar**, and it escalates as you
  unlock rooms: "the prerequisite to participate in each room increases in
  terms of number of items to be found and **credit requirement per card**",
  and card boosters *raise* the credits required per card.
  <https://thewhyofplay.com/2019/06/23/bingo-blitz-deconstruction>
- **A round is a call budget, not a race.** Everyone competes for the chance to
  call 1–4 bingos within a fixed number of calls; runner-up bonuses are paid by
  leaderboard position. Buying more cards and power-ups buys more chances
  inside that budget. This is the structural idea worth stealing.
- **Prizes are individualized.** <https://www.bingoblitz.com/support/rascals-ruse>
- **Retention stack.** Daily Fortune (Doug) — daily credits + weekly lucky
  reward + four-week Grand Reward, and **streak-forgiving**: "even if you miss
  a day your overall progress towards the Grand Reward will not be reset, just
  the progress for the week"
  (<https://www.bingoblitz.com/support/daily-fortune>). Daily Quests →
  Quest Points → milestones. Daily Tournament where "the first 5 rounds are
  FREE." Adventure Book "Pics" collections. Teams Treasure (team points,
  weekly reset). Gift Center whose collection cadence depends on Playtika
  Rewards tier. PLUS subscription at $14.99/mo.
- **Prices.** $0.99–$24.99 tiers; a player's arithmetic: "$7 for 210 credits,
  one game of 4 cards at level 28 is 48 credits — that's $7 for 4 rounds."
  A dollar buys minutes, not sessions.

### 1.2 Bingo Bash (Scopely) — the one-way valve

- `Bingo Chips` are "the essential currency required to enter and participate";
  `Coins` are earned from wins and **cannot be converted back into chips** —
  "coins cannot be directly exchanged for chips."
  <https://scopely.helpshift.com/hc/en/64-bingo-bash/faq/7378-what-are-bingo-chips>
- That asymmetry is the economy: the soft currency can't be recycled into the
  entry fee, so the entry fee always drains.
- **Piggy Bank** = loss rebate sold back to you: "a portion of the chips you
  spend is added to your Piggy Bank balance… your winnings remain untouched",
  with each piggy **priced individually per player**
  (<https://scopely.helpshift.com/hc/en/64-bingo-bash/faq/7577-piggy-bank-information-questions>).
  Piggy banks ship in **70 of the top 100** social-casino games; albums in 74;
  battle passes in 36% (up from 5% in 2020) — GameRefinery 2021 report,
  <https://info.gamerefinery.com/hubfs/Downloads/2021%20Social%20Casino%20Gaming%20Apps%20Report%20-%20EN.pdf>.
- Five stake tiers (Regular → Special → Premium → Legendary → Epic); Bingo
  Royale lets you buy **extra balls mid-round**, and leftover event power-ups
  **expire** when the event ends (a sink).

### 1.3 The evidence on what drives return visits

| Finding | Source |
|---|---|
| Blitz held **49%** of bingo revenue in 2019 by investing in collection, competition, mini-game and quest **events**; competition events **+212% YoY**, mini-game events **+42% YoY** | Deconstructor of Fun, Feb 2020 — <https://www.deconstructoroffun.com/blog/2020/2/3/2020-predictions-8-what-do-the-kardashians-and-casino-publishers-have-in-common-cash> |
| Collections were the **most-released** feature *and* averaged **−1.6% MoM** revenue-share change per release — but a good one works (Bingo Bash **Fish n' Chips**: +12% revenue, +66% downloads) | Liquid & Grit, March 2021 — <https://progamedev.net/wp-content/uploads/2021/04/liquidgrit-casino-report-march-21.pdf> |
| Social scaffolding (multiplayer, leaderboards, collections, customisation) is now the **baseline**, not a differentiator | App Annie / PocketGamer.biz — <https://www.pocketgamer.biz/app-annie-top-grossing-bingo-games/> |
| Design as a pyramid: core loop → **retention game** (progression, unlocks, achievements) → superfan layer; bingo has "sticky community" but the "worst $ unit economics in the category"; poker is "naturally Winner-Take-Most" | GSN, GDC 2014 — <https://media.gdcvault.com/GDC2014/Presentations/Mahoney_Brian_The_Design_And.pdf> |
| Bingo revenue $389.9M in 2025, **+2.0% YoY** — growth is flat, so monetisation shifted to *offer volume* (>300 offers per six months in casino titles) | AppMagic Monetization Report 2025 — <https://gamedevreports.substack.com/p/appmagic-mobile-games-monetization> |

**Read for us:** a static, free, no-ads site will never monetise, so the only
question that matters is *why someone opens the tab again tomorrow*. The
answer from the data is a **short-cycle competition with a visible score**
(daily/weekly, resets, everyone can place), plus **drip rewards** (streak
calendar, a jar that fills while you play) and **one collection that is
integrated into play** — not five cosmetic systems.

---

## 2. Pot mechanics that are actually documented

### 2.1 Regulated bingo (the clean model)

The Gambling Commission defines the pool as **players' stakes less
participation fees**, and requires that stakes be returned "either in the
particular game or in a subsequent one", with the split displayed:
<https://www.gamblingcommission.gov.uk/licensees-and-businesses/guide/how-bingo-is-defined>

```
pool = Σ(cards sold × card price) × (1 − participation_fee)
```

- Operators publish a **guaranteed minimum** and let the pool float with sales
  (Gala's lobby literally shows "players / game prize / ticket price":
  232 players at €0.02 → €110.73; <https://www.galabingo.com/en/bingo/menu/mytickets>).
- Ties split equally (Foxy, Bingo.com). Some rooms are fixed-prize instead of
  shared (Wink runs both).
- **Daily free bingo is a habit loop, not a giveaway**: Gala runs one every
  5 minutes, 00:00–23:55, and pays **Gala Points**, not cash. Sun's free rooms
  pay real cash but capped; Tombola caps free prizes at £500.

### 2.2 Jackpots (fully published, so copy the shape)

Wink lists seed + **0.5% of stakes** + trigger for each pot: "Bingo under 20
calls" (seed £50), "Bingo under 34 calls" (seed £500), with the pot **reset to
seed** after a win and rolled over if unwon.
<https://www.winkbingo.com/progressive-jackpots>

Jackpotjoy: seeds "vary from £10 to £400"; Superlinks pays on a win "within 38
ball calls." Bingo.com seeds at €5,000 and runs a **community jackpot** where
half goes to the trigger and the other half is shared "in proportion to the
number of tickets they have purchased." Sun publishes per-room thresholds (48,
40, 35 calls) with £500/£1,000 seeds.

**The call-count threshold is the hit-frequency dial.** Tighter threshold = rarer
payout = bigger pot. That single number is all the tuning you need.

### 2.3 Pari-mutuel tournament apps

Bingo Tour (AviaGames): identical cards and calls for 5–10 players, top 3 paid
from a pool the player selects, entries $0.50–$55. A 7-player $1 match reported
a $5 pool with $0.50 for 3rd → roughly **29% effective rake**.
<https://sidehustles.com/is-bingo-tour-legit>, <https://financialbinder.com/bingo-tour-review>

Its "Bonus Cash" is breakage: it looks like winnings, funds more entries, and
cannot be withdrawn.

### 2.4 Pool / poker pots

- **8 Ball Pool**: both players stake; winner takes the pot; 9-ball prizes are
  twice the *lower* of the two bets (a cap that stops a whale forcing a big
  pot on a small bankroll); higher tables deduct a small "table rental fee."
  Tournaments with friends: up to 8 players, "the combined entry fees make up
  the prize pool, which goes to the winner" — one winner, seven losers, **no
  rake** in that mode (and Miniclip excludes All-In wins from leaderboards).
  Coin transfer between accounts is explicitly banned.
  <https://support.miniclip.com/hc/en-us/articles/41871974058385-Tournament-with-Friends-Host-your-own-competition>
- **Zynga Poker**: table rake — their own example is a 20,000-chip pot paying
  the winner 17,000 (**15% in that example**), and they state they do **not**
  introduce bots or NPCs to play real users.
  <https://zyngasupport.helpshift.com/hc/en/27-zynga-poker/faq/2120-my-chip-balance-is-missing-what-do-i-do-now/>
- **Bankroll protection.** 8 Ball Pool's answer is free rewards, ads, offers,
  missions, club gifts — not an automatic refill. Social casinos go further:
  Pickem grants 1,000 gold coins instantly whenever the balance hits zero;
  Sixty6 states the purchase pitch outright: "you are paying to skip the
  periodic Gold Coins refill period." The recovery grant should be worth a
  handful of *minimum* stakes, not your old balance.

### 2.5 Why bot-funded pots break, and the fix

Evidence and mechanism, from the research pass:

1. **No sink = no economy.** Player→player movement is redistribution; the
   currency supply is fixed and the game is a wealth pump with churn.
2. **Bots are extractors, not liquidity.** Chip dumping (deliberately losing to
   a beneficiary) is the standard exploit; Zynga even patented transfer limits
   (friends only, ≤1/day, capped size) to stop it.
3. **Bot farms inflate.** Inflation is attributed to missing sinks *and* mass
   bot production; it "significantly degrade[s] player experience."
   <https://arxiv.org/pdf/2210.07970>
4. **Winner-take-most kills the middle** — GSN's own deck calls poker
   winner-take-most with RMG-grade fraud problems; thin liquidity then churns.

**Ship instead:** stake tiers (bankroll gating, not skill gating), a small rake
as the sink, payouts spread over the top ~3, house-funded overlays for events,
and hard caps on any gift/transfer. Also: "immediate feedback" is the single
strongest gamification lever measured in a 584-player competitive study
(<https://pubmed.ncbi.nlm.nih.gov/42243932>), and social proof should compare
you to the player *one rank above* you, not the global #1
(<https://www.cs.mcgill.ca/~jeromew/data/COMP766/CHI2016/p3020-colusso.pdf>).
Near-miss effects are **contested** in the literature (Clark et al. find reward
circuitry recruitment, <https://pmc.ncbi.nlm.nih.gov/articles/PMC2658737>; a
half-century review finds "inconsistent results",
<https://link.springer.com/article/10.1007/s10899-019-09891-8>) — use drama,
don't budget retention on it.

---

## 3. Retention mechanics worth copying (and their numbers)

| Mechanic | Shipped shape | What we'd do |
|---|---|---|
| Daily login | 7-day ladder, day-7 peak, **streak forgiveness**, plus a *cumulative* track so samplers get something (Blitz's 4-week Grand Reward; Puzzle & Dragons' total-days track) | 7-day ladder; a miss drops you one day, not to zero; a separate "games played" counter that never resets |
| Bankruptcy faucet | Instant refill at zero, sized to minimum stakes (Pickem 1,000 GC) | "Top up" button worth 3 entries of the cheapest room, 10-min cooldown, no daily cap |
| Gates | 250k-player Jelly Splash study: difficulty spikes/chapter gates **raised revenue but hurt retention**; the lives mechanic had **no measurable effect** | Soft gates only: bigger room = bigger bankroll needed. Never wall a player out |
| Quests | 3 daily missions, trivial and legible ("spin 10 times"), leaderboard ranks by stars | 3 rotating bingo missions. Caution: unrelated secondary objectives measurably *reduce* play (<https://www.scholar-inbox.com/paper/Andersen2011_On_the_harmfulness_of>) |
| Collections | Album pages + seasons + duplicate handling; friend-requestable items | One album, 12 stickers per theme, drops on bingo, duplicates convert to credits |
| Competition events | Daily Tournament, first 5 rounds free; 8BP weekly leaderboards with anti-farm rule ("only the first match vs the same opponent each week counts") | **Daily Table**: same card order for everyone, 5 rounds, score = credits won |
| Cosmetics | Daubers, cues, rings, medal collection power | Daubers + card felt themes, pure status, purchased with credits |
| Appointment loops | Clash Royale every 4h; 8BP Victory Boxes 3h/8h/12h, max 4 held | "Nightly link game" at a fixed local time, one free entry |

---

## 4. What this means for Bingo 2 (design)

### 4.1 Why this game is a good fit

Bingo 2 already has the hard part: the **host is authoritative**. `roomPlayers`
holds every seat's `card`, `wins` and `connected`; every guest daub goes through
`hostOnData` → `hostDaub`, which validates the ball was called and the cell
exists. Adding `credits` to that seat record gives us a canonical ledger that a
guest cannot forge (it can still be cheated by a malicious *host* — see §4.6).

Constraints to design inside: single HTML file, no build step, no accounts,
offline solo must keep working, and the offline ZIP must stay self-contained.

### 4.2 The one structural change worth making first

**Stop ending the round at the first bingo.** Give the round a call budget and
pay for every bingo called inside it:

```js
const CALL_BUDGET = {line: 32, corners: 45, blackout: 75};
```

- Round runs until the budget is exhausted (or everyone has bingoed).
- Each bingo is recorded with the ball count it landed on.
- Payouts at the end by rank: **1st 55% / 2nd 25% / 3rd 12%**, remainder into
  the room jackpot. Nobody bingoed → the whole pool (minus rake) rolls over.

This is what makes "credits for more cards" mean something: three cards is
three chances at the same budget, which is exactly Blitz's design and the
reason a card is worth buying. It also creates the drama — the pot is visible
and growing during the round, and the runner-up slots keep the middle of the
table playing instead of churning after the first line.

### 4.3 The economy

| Piece | Value | Notes |
|---|---|---|
| Starting bankroll | **1,000 credits** | enough for ~2 sessions at the low table |
| Tables | **Practice (0) · Bronze 10 · Silver 50 · Gold 250 · High Roller 1,000** | stake = price per card |
| Cards per round | 1–3, bought in the lobby | mirrors "credits for more cards" |
| Room rake | **6%** of the pot | the sink. Half funds the jackpot, half is deleted |
| Payout | 55 / 25 / 12, remainder → jackpot | never winner-take-all |
| Jackpot seed | 10 × stake | resets to seed after a payout |
| Jackpot trigger | bingo ≤ 12 calls (line) / ≤ 20 (corners) / ≤ 52 (blackout) | Wink's model; tighten to taste |
| Broke top-up | 3 × minimum stake, 10-min cooldown | always claimable, never scaled to your old balance |
| Daily ladder | 7 days: 25/40/60/90/130/180/**400** | shipped as 50/60/75/95/120/150/**200**; cycles after day 7, one missed day is forgiven and two in a row restart at day 1 |

Sinks: rake, cosmetics, extra cards, jackpot seeding. Faucets: daily ladder,
top-up, bot contributions (§4.4), album completion (funded from rake).

### 4.4 Bots, and the inflation trap

A bot that antes real credits but never pockets them is a **faucet** — fine in
small doses, corrosive if the bot is good. Rules:

- Bots ante like players. **Their winnings are deleted, never transferred.**
- Bots only appear in rooms the host marks as practice-on-bots, and never at
  Gold/High Roller with humans.
- Tune the bot tiers to lose slightly more than they win at low stakes
  (`Casual` ≈ 0.8 of a human's daub accuracy) and cap the leak: if a session's
  net bot contribution exceeds ~200 credits, bots stop winning (their claims
  get deprioritised in the payout ranking).
- Label it in the lobby: "Bots pay in but never collect; their share goes to
  the jackpot." Legibility is the fairness mechanism (§2.5).

### 4.5 Retention features, cheapest first

1. **Daily Table** (no server needed). Seed a PRNG from `YYYY-MM-DD`, so
   everyone on the planet gets the same card sequence and the same 75 balls.
   5 rounds, score = credits won, shareable result string
   (`🎱 4,120 · 3 bingos · 2026-11-07`). This is the +212% competition-event
   finding, implemented in ~60 lines with a mulberry32 seeded `shuffle`.
2. **Album.** 12 stickers per theme, 35% drop on a bingo, guaranteed on a
   jackpot, duplicates → 15 credits, full set → 2,500 + a dauber.
3. **Cosmetics.** Daubers (dots/stars/hearts/flames), card felts, name badges.
   Broadcast the dauber id in `start`/`daub` so guests see each other's marks.
4. **Daily ladder + top-up** in localStorage (`gh.bingo2.econ`), shown as a
   chip in the HUD, works in solo and offline.
5. **Nightly link game.** Host announces "next round starts at :00" — a shared
   clock is enough, no coordination needed. Free entry, jackpot-only pot.
6. **Quick reactions.** `GG`, `🔥`, `😱`, `🎉` buttons in the chat form. Cheap,
   and chat is already relayed by the host.

### 4.6 Honest limits (put these in the UI, not just here)

- **The host is the bank.** A malicious host can invent credits or refuse a
  payout. It is a peer-to-peer game: the lobby already says "chat is ephemeral
  and not moderated — share the code only with people you trust"; the economy
  needs the same sentence. Never present balances as having value.
- **Balances are per-browser.** localStorage only, so no cross-device play and
  clearing data resets the bankroll. That is acceptable and should be stated.
- **Nothing is purchasable, ever.** No price tags, no "get more credits" link,
  no ad wall. This is what keeps it a game instead of an unlicensed gambling
  product.

---

## 5. The legal side of "bingo coins"

A house-issued coin that buys cards, where the pot pays out more coins, with
humans and robots contributing, is decided by **four independent switches** —
not by what the currency is called.

| Switch | Off (safe) | On (regulated) |
|---|---|---|
| **1. Purchase** — can coins be bought with money? | no consideration | consideration exists; the gambling analysis switches on |
| **2. Value out** — cash, gift card, merch, crypto, resale? | prize is in-game only | "money or money's worth" → licence |
| **3. Transfer** — can coins move between players? | closed loop | value transmission + chip-dumping + P2P gambling |
| **4. Rake** — does the house take a cut? | players fund each other | house has an interest in the outcome; house-banked |

### 5.1 Four models, four verdicts

| Model | UK | US | EU | Verdict |
|---|---|---|---|---|
| **A. Free coins, free entry, in-game prizes, no transfer, no rake of value** | not gambling, no licence | fine; de minimis everywhere | fine | **this is Bingo 2** |
| **B. Sold coins, in-game prizes only, no transfer** | no licence, but consumer law + PEGI 16/18 | lawful in most states, **presumptively illegal in Washington** | Netherlands/Belgium risky | the social-casino model |
| **C. Sold coins + any redemption** | remote bingo/casino licence | licensed online bingo exists almost nowhere | licence | don't |
| **D. Pot + rake over purchased coins** | casino licence; the rake defeats exempt gaming | the rake is the pleaded illegality | licence + PSD2 review | don't |

**UK.** For gaming the prize must be "money or money's worth" (Gambling Act
2005 s.6(5)); a game of chance is still one "whether or not a computer
generates images or data taken to represent the actions of other participants"
(s.6(3)(b)) — so **robots change nothing** in the gambling analysis. The
Commission's settled position (2017 position paper, still cited in 2026) is that
purchasable chips whose prizes are ring-fenced to the game are **not licensable
gambling** (§3.18, §5.13), because there is no prize of money or money's worth;
social casino games are "not currently subject to gambling regulation". Calling
them "bingo dollars" changes nothing legally — but it does change advertising
risk: the ASA upheld four rulings in Sept 2024 (Huuuge, SpinX, Dataverse,
Gamehaus) against social-casino ads implying real money could be won.

**US — Washington is the binding constraint.** *Kater v. Churchill Downs*,
886 F.3d 784 (9th Cir. 2018): chips that "extend the privilege of playing" are
a "thing of value" under RCW 9.46.0285, so wagering them is gambling **even
with no cash-out** (the court also noted Big Fish's chip-transfer mechanism as
a de facto cash-out route). *Larsen v. PTT* produced a ~$24.9M judgment in June
2025, and in Feb 2026 the Washington AG sued Playtika and Aristocrat over 16
apps — **including Bingo Blitz** — seeking >$225M, arguing the games are illegal
gambling *because* players cannot cash out. The WSGC's Jan 2025 statement:
games that "ask the player to wager virtual currency for the potential of
winning more virtual currency are likely to constitute illegal gambling."

**Everywhere else, the 2025-26 statutes target the dual-currency redemption
trick, not a single closed-loop coin:** NY PML §912, NJ P.L.2025 c.128,
Indiana HB 1052, Tennessee's 2026 amendment all key on exchanging currency for
cash or a prize. A single non-redeemable coin falls outside them — with two
caveats: Tennessee's wording ("virtual-currency … award") is the closest call,
and AG enforcement is not statute-bound (Illinois sent 60+ cease-and-desists,
Baltimore sued six operators). **Do not build a sweepstakes/"no purchase
necessary" structure** — that is precisely the model being dismantled.

### 5.2 Robots contributing to the pot — three separate issues

1. **Is it gambling?** No extra weight. In GB bots are expressly irrelevant
   (s.6(3)(b)); in the US they don't create gambling on their own.
2. **Is it disclosed?** This is where the money is. Undisclosed bots are a
   consumer-law problem whether or not the game is gambling: DMCCA 2024
   s.226/227 (misleading actions/omissions) and Sch. 20 para 25 (falsely
   representing oneself as a consumer); Pennsylvania requires bots be "clearly
   marked at the tables" (58 Pa. Code §810a.10(b)); UK RTS 16C requires
   disclosure whenever operator software plays in peer-to-peer gambling. The
   litigation is savage where money is involved — *Skillz v. Papaya* (court
   found it "undisputed" Papaya used bots to control outcomes while saying
   "we do not use bots" 200+ times; reported ~$719M verdict), a **$15M class
   settlement** in *Barcelo v. Papaya*, RICO claims in *Pandolfi v. AviaGames*,
   and India's ED attaching ₹3,522 crore over bots + non-disclosure + rake.
3. **Whose money is it?** A bot that antes and loses is a **house overlay** —
   house-funded prizes, which in regulated markets must be disclosed and
   counted in RTP. A bot that antes and wins is taking players' money, which
   makes the game **house-banked**, not peer-to-peer. Either way the "P2P"
   label stops being true.

For us: label them, everywhere. The lobby already prints 🤖 and a BOT tag —
keep that, never count bots in a "players online" figure, and say in the lobby
that bots ante but never collect.

### 5.3 The rake

- **GB**: a rake is what disqualifies exempt gaming and pushes a game into a
  casino operating licence; bingo with a participation fee has its own licence
  class with disclosure duties.
- **US**: the rake is the specific fact Kentucky's 2026 complaint pleads —
  operators either keep players' losses or "take a 'rake' of the pot". FinCEN's
  2019 guidance adds that a gambling business which isn't a "casino" but
  accepts and transmits value may be a money transmitter, and that "even when
  the original transmission or the payout [is] done on a conditional basis …
  money transmission still occurs at the moment the condition is satisfied".
- **With free coins there is no value, so a 6% sink is legally inert.** Show the
  maths anyway, for trust.

### 5.4 Rules for this project

Keep: free entry always available, one currency, no price tag, no cash-out, no
transfer or gifting, bots labelled, rake visible but value-free, no "$" glyph
and no "dollars" branding.

Never: a store, a "get more credits" link, transferable coins, or anything
resembling a "no purchase necessary" sweepstakes structure.

If monetisation is ever wanted, the clean routes are ads (consent + no
under-13 targeting) or donations that buy nothing. Selling coins needs a
company, a hosted backend, geofencing out of Washington, per-state review, a
17+/18 store rating and a gaming lawyer.

*This is research, not legal advice.*

Sources for this section: <https://www.legislation.gov.uk/ukpga/2005/19/section/6>,
<https://www.gamblingcommission.gov.uk/authorities/codes-of-practice/guide/page/digital-and-virtual-currencies>,
<https://cdn.ca9.uscourts.gov/datastore/opinions/2018/03/28/16-35010.pdf>,
<https://wsgc.wa.gov/regarding-virtual-casinos>,
<https://www.atg.wa.gov/news/news-releases/ag-s-office-sues-illegal-gambling-apps-have-taken-more-225-million>,
<https://www.nysenate.gov/legislation/laws/PML/912>,
<https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-16-use-of-third-party-software>,
<https://www.pacodeandbulletin.gov/secure/pacode/data/058/chapter810a/s810a.10.html>,
<https://www.fincen.gov/system/files/2019-05/FinCEN+Guidance+CVC+FINAL+508.pdf>.

---

## 6. Cross-device saves ("get my credits back on another device")

The wallet has to survive a wiped browser, a new phone, and a laptop. Three
routes, in ascending cost. The first is not a compromise — for a currency with
no cash value it is the *correct* amount of engineering.

### 6.1 Threat model first (this decides everything)

Credits buy nothing. They cannot be sold, transferred or redeemed, and inside a
room the **host** owns the ledger — a guest's claimed balance never affects
anyone else's payout. So:

- A forged save code cheats only the person who forged it. There is nothing to
  steal and no one to defraud.
- The real risks are **corruption** (a truncated paste, a bad base64 decode), a
  **lost wallet** (cleared storage), and **accidentally clobbering** a newer
  wallet with an older code.
- Therefore the bar is *integrity against accident*, not *authenticity against
  an attacker*. Any scheme that promises more than that is theatre: a secret
  compiled into a browser bundle is not a secret.

If credits ever acquire value, this whole section is void and balances must
become server-authoritative (see §5). Say that in the code comments.

### 6.2 Route A — a restore code (no backend; ship this first)

A self-contained save token the player can copy, print, or keep in a password
manager. Works offline, works in the downloaded ZIP, needs no infrastructure,
collects no PII.

```
GH2-<payload>-<check>
payload = base64url( xor( json, fixed-keystream ) )
check   = crockford-base32( crc32( payload ) )[0..6]
json    = {v:1, id, name, credits, album:[], daubers:[], streak:{day,last,best}, updated}
```

- **Obfuscation, not encryption.** The XOR keystream stops casual editing and
  nothing else; label it "save code", never "secure" or "encrypted".
- **Crockford base32** for the check so codes survive being read aloud or
  retyped (no I/L/O/U).
- **Clamp on import**: `credits` integer 0–10,000,000; `album` only known item
  ids, ≤ 60; `daubers` known ids only; `name` through the existing
  `cleanName()` (14 chars); `streak.day` 0–6 and `last` not in the future;
  reject `v` above the current version. A malformed code fails closed with a
  message, never a half-applied wallet.
- **Never silently replace**: show "This code holds 1,240 credits · this device
  has 380" and require a confirm. That single prompt prevents the one mistake
  that would actually upset someone.
- Size: ~90–130 characters. Add a QR later only if people ask — a QR encoder is
  ~2 KB of code that has to live in the offline build too, so it is not free.
- Limits to state in the UI: a code is a snapshot. Two devices that both play
  will **diverge**, and whichever code you restore last wins. Codes can be
  copied by anyone who sees them, which only matters because it clones progress.

Cost to build: one module, no new files beyond CSS. This is the version that
ships with the wallet in phase 1.

### 6.3 Route B — an anonymous sync key (real cross-device, one small Worker)

If "play on my phone at lunch, on the laptop at night" turns out to matter,
add a capability-based sync: a long random key *is* the account. No email, no
password, no profile.

```
client                                    tiny worker (free tier)
  key = base32(crypto.getRandomValues(16 bytes))   // 26 chars, shown once
  PUT /wallet  Authorization: Bearer <key>  ->  record id = sha256(key)
            {v, credits, album, daubers, streak, updatedAt}
  GET /wallet  Authorization: Bearer <key>  ->  blob
```

Rules that matter:

| Concern | Handling |
|---|---|
| Credential storage | Server stores only `sha256(key)`; plaintext key never transmitted except as the bearer token over TLS and never logged |
| Record creation | `POST` only with a 128-bit key; no listing endpoint, no enumeration |
| Abuse | Per-key and per-IP rate limits, 2 KB body cap, schema + range validation (same clamps as §6.2), CORS restricted to the site origin |
| Conflicts | Compare `updatedAt`; if the cloud copy is newer than this device's last sync, prompt "cloud has 1,240 / this device has 380 — use cloud or keep local" |
| Offline | Skip sync, queue nothing; reconcile on next online. Local wallet is always the working copy |
| Deletion | "Forget this sync" wipes the local key; a second call deletes the server blob. Idle records purged after ~12 months |
| Privacy | Pseudonymous key + game stats, no name/email/IP retained beyond rate-limiting; deletable, so GDPR/CCPA obligations stay small |

Cost: a hosted endpoint, a domain (or a path on an existing one), and an abuse
budget. Free tiers cover a 1 KB blob many times over; the real cost is that the
game is no longer *purely* static, so the download ZIP must keep working with
local-only saves and no sync panel.

There is no off-the-shelf product for this shape: the service index was checked
and nothing in it offers anonymous key-value sync with CORS for a static page,
so it is a hand-written Worker against a KV/D1 store rather than an SDK.

### 6.4 Route C — real accounts (don't, unless social features arrive)

Email/OAuth sign-in buys you nothing here except: PII, password reset, GDPR
requests, age gates, moderation, and a COPPA problem the moment a 12-year-old
signs up. It only becomes worth it if you add friends, clubs, or moderated
leaderboards — i.e. features that need identity. Until then the sync key is
strictly better: same benefit, no identity.

### 6.5 What this changes in the game

- Wallet module used by both solo and rooms: `loadWallet()`,
  `saveWallet()`, `clampWallet()`, `exportCode()`, `importCode()`.
- Key `gh.bingo2.econ`, next to the existing `gh.bingo2.best` / `gh.bingo2.name`.
- HUD chip for credits; a Wallet panel in the room modal with **Copy save code**,
  **Restore from code**, **Forget wallet**.
- At the end of a room round the host broadcasts each seat's payout; the guest
  writes it to its own wallet. Mid-round, the host ledger is authoritative and
  the save code is irrelevant.
- Consequence worth stating plainly: **table tiers are honour-system.** A guest
  can claim any bankroll, so "High Roller" gates access on honesty, not on
  credits. Either accept that (it is fine — nothing is at stake) or drop the
  bankroll requirement and keep the tiers purely as stake sizes.

## 7. Operator grants — giving credits away on purpose

The operator (whoever controls the repo and the deployed page) needs to hand
out credits for acquisition, rewards and events: a code on a flyer, a streamer
promo, a league prize, an apology for a bad round. Four channels, one token
format.

### 7.1 The problem with the obvious version

A promo code checked in JavaScript is just a string anyone can read from the
source and mint for themselves. And a secret embedded in the page is not a
secret. So either:

- **no backend:** the operator signs tokens with a private key it never
  publishes, and the page embeds only the *public* key — forgery is impossible,
  single-use is not; or
- **with the §6.3 Worker:** the server holds the secret, enforces single use
  and quotas, and keeps an audit trail.

Use the signed version first. It costs one WebCrypto call and works offline,
including in the downloaded ZIP — which matters, because a code printed on a
flyer has to work in a school hall with no wifi.

### 7.2 Token format

```
GH2G.<v>.<role>.<payload>.<sig>
payload = base64url({c: amount, r: role, e: expiryEpoch, i: issueId, n: nonce})
sig     = ECDSA P-256 / SHA-256 over "<v>.<role>.<payload>"
```

- Verifier holds one public JWK per **role**, and each role has a hard cap the
  verifier enforces: `promo` ≤ 1,000, `op` ≤ 10,000, `prize` ≤ 25,000. An
  unknown role, a bad signature, an amount over the role cap, or an expired
  `e` (with ±5 min clock skew) is rejected with a reason, not silently.
- ~150–190 characters: fits a QR, a URL query and a mail merge.
- The amount comes **only** from the signed payload. Never from the URL, the
  form or the host.
- Separate keypairs per use (streamer vs. event) so a leaked key retires one
  channel, not all of them. Rotate by shipping a new public JWK list.

### 7.3 The four channels

| Channel | How | Notes |
|---|---|---|
| **Gift link** | `…/bingo-2.html?gift=GH2G.…` auto-claims on load, shows "+500 credits from the host", then `history.replaceState` strips the parameter | A refresh must not re-claim; strip the param before anything else runs |
| **Promo code** | field in the Wallet panel; case-insensitive, hyphens ignored | Also strips spaces people paste in from chat |
| **Welcome pack** | first load, no code: 500 credits + a "how credits work" card | Costs nothing, converts the curious into players |
| **In-room grant** | host → seat: `{t:'grant', to, amount, note}` | The host is already authoritative, so this needs no signature. This is the "tip the room during a stream" lever |

### 7.4 Abuse, in the honest order of importance

With worthless credits the risk is nuisance, not fraud — so spend effort here
in this order:

1. **Reuse.** A code posted publicly is used by everyone, forever. Offline you
   can only stop it per device (keep a `gh.bingo2.claims` set of ids, reject a
   repeated id, cap daily claims and daily granted total). Server-side, make
   the claim atomic and single-use.
2. **Expiry.** Default 7 days, maximum 30. A stale code in a screenshot is the
   most common leak.
3. **Caps.** Role caps plus a per-device daily ceiling, so one leaked `op` token
   can't turn into an infinite balance that makes the ladder meaningless.
4. **Not a secret.** Don't ship the minting tool with a key inside it, don't
   commit a private key, don't put one in `.env` that gets deployed.

What offline grants **cannot** do, and should be stated in the admin notes:
revoke a code, see who redeemed it, enforce single use across devices, or stop
someone editing their own balance (nothing can, short of a server-authoritative
wallet). That is acceptable because credits are play money.

### 7.5 Operator tooling

A single-file `tools/mint.html`, opened from disk, never linked from the site
and **excluded from the offline ZIP** (add it to the builder's excludes):

- paste your private key (held in a password manager, never in the repo) for
  one session;
- pick role, amount, how many codes, expiry, label;
- it emits a table of codes, gift links and a CSV, and optionally a QR per code;
- it stores nothing — close the tab and the key is gone from memory.

Publishing the tool is harmless (it contains no key) but keep it off the site
nav: it advertises a surface with nothing behind it.

If grants ever carry value, this becomes the §6.3 Worker: `POST /admin/grant`
with an operator token in a Worker secret, `POST /redeem` that claims
atomically in D1 and writes an audit row (code id, amount, timestamp, no PII),
plus listings and revocation. That is the version that can be audited and
stopped.

### 7.6 What the player sees

- Wallet panel: balance, **Redeem code**, **Copy save code**, **Restore**,
  and a short history line ("Promo code · +500 · 3 Nov").
- A claimed code is idempotent per device: the same code twice shows "already
  claimed on this device" rather than a second payout.
- Gift link claims show the amount and expiry in the toast, and never overwrite
  an existing balance — they add.

## 8. Build plan (proposed, not started)

| Phase | Work | Files | Risk |
|---|---|---|---|
| **P1 — Wallet + pot** | `credits` on each seat, lobby stake/cards selects, host debit + pot, call budget, ranked payouts, pot ticker, end-of-round payout panel, wallet module + restore code (§6.2) | `index.html`, `bingo-2.css`, `style.css` (HUD chips) | medium: touches `hostStartRound`, `endRoomRound`, `hostOnData`, `guestOnData` |
| **P1.5 — Grants** | signed grant tokens, `?gift=` auto-claim, redeem field, local claim ledger, welcome pack, host tip, `tools/mint.html` + builder exclude | `index.html`, `bingo-2.css`, `tools/mint.html`, `scripts/build-zip.py` | low, but needs the wallet first |
| **P2 — Jackpot** | Seed/contribution/reset, trigger by call count, room-bar ticker, rollover across rounds | above | low |
| **P3 — Bankroll guardrails** | Daily ladder, broke top-up, `gh.bingo2.econ` persistence, HUD chips | above | low |
| **P4 — Daily Table** | Seeded PRNG from date, fixed 5-round run, score + share string, local history | above | low, self-contained |
| **P5 — Album + daubers** | Drop table, album screen, cosmetic purchase, dauber broadcast | above | medium (UI surface) |
| **P6 — Reactions + polish** | Chat emote row, "next round" in the end overlay, mobile pass | above | low |

Every phase ends with `node --check` on the extracted script,
`python3 scripts/build-zip.py`, and a jsdom click-through — the same harness
the repo's `tests/` suites use.

### Open questions for the owner

1. Call budget + multiple bingos (recommended, Blitz-like) or keep "first line
   wins" as the default and treat the budget as a separate room mode?
2. Do we want the High Roller table at all on a site aimed at casual players?
   It only matters if the stake ladder is what makes the pot feel real.
3. Is a "Nightly link game" worth a shared wall clock, or is the Daily Table
   enough of an appointment?
4. Grants: are signed tokens enough, or do we stand up the little Worker so a
   leaked promo code can be revoked and single-use is actually enforced?

---

## Sources

- Bingo Blitz: <https://www.bingoblitz.com/support/rascals-ruse>, <https://www.bingoblitz.com/support/daily-fortune>, <https://www.bingoblitz.com/support/10228>, <https://www.bingoblitz.com/support/the-piggy-bank>, <https://www.bingoblitz.com/support/gift-center>
- Bingo Bash: <https://scopely.helpshift.com/hc/en/64-bingo-bash/faq/7378-what-are-bingo-chips>, <https://scopely.helpshift.com/hc/en/64-bingo-bash/faq/7577-piggy-bank-information-questions>, <https://scopely.helpshift.com/hc/en/64-bingo-bash/faq/8643-bingo-royale>
- Teardowns: <https://thewhyofplay.com/2019/06/23/bingo-blitz-deconstruction>, <https://www.deconstructoroffun.com/blog/2020/2/3/2020-predictions-8-what-do-the-kardashians-and-casino-publishers-have-in-common-cash>, <https://progamedev.net/wp-content/uploads/2021/04/liquidgrit-casino-report-march-21.pdf>, <https://info.gamerefinery.com/hubfs/Downloads/2021%20Social%20Casino%20Gaming%20Apps%20Report%20-%20EN.pdf>
- GSN GDC 2014: <https://media.gdcvault.com/GDC2014/Presentations/Mahoney_Brian_The_Design_And.pdf>
- Regulated bingo: <https://www.gamblingcommission.gov.uk/licensees-and-businesses/guide/how-bingo-is-defined>, <https://www.winkbingo.com/progressive-jackpots>, <https://www.galabingo.com/en/bingo/menu/mytickets>, <https://www.sunbingo.co.uk/what-is-a-progressive-jackpot>, <https://www.bingo.com/polopoly_fs/1.2774396.1779791997!/menu/standard/file/Bingo_rules_en_GB.pdf>
- Tournament/pot apps: <https://sidehustles.com/is-bingo-tour-legit>, <https://support.miniclip.com/hc/en-us/articles/41871974058385-Tournament-with-Friends-Host-your-own-competition>, <https://zyngasupport.helpshift.com/hc/en/27-zynga-poker/faq/2120-my-chip-balance-is-missing-what-do-i-do-now/>
- Economy design: <https://lostgarden.com/2021/12/12/value-chains/>, <https://unity.com/resources/game-economy-design-guide>, <https://www.gamedeveloper.com/business/the-science-craft-of-designing-daily-rewards-and-why-ftp-games-need-them>, <http://www.fdg2015.org/papers/fdg2015_paper_57.pdf>
- Legal: <https://www.gamblingcommission.gov.uk/licensees-and-businesses/guide/page/running-online-bingo>, <https://ag.ny.gov/press-release/2025/attorney-general-james-stops-illegal-online-sweepstakes-casinos>, <https://www.tn.gov/content/dam/tn/attorneygeneral/documents/pr/2025/pr25-61-casino.pdf>, <https://wsgc.wa.gov/regarding-virtual-casinos>, <https://assets.ctfassets.net/j16ev64qyf6l/4A644HIpG1g2ymq11HdPOT/ca6272c45f1b2874d09eabe39515a527/Virtual-currencies-eSports-and-social-casino-gaming.pdf> (UK position paper), <https://www.ag.ky.gov/Documents/2026.06.17%20Accepted%20KYOAG%20v.%20VGW%20Complaint%20-%20Final.pdf> (rake pleading)
