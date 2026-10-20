# Kart Race PR 2: Coins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the owner chose inline execution for this spec's PRs). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rows of coins on every track. Each coin you hold (max 15) raises your top speed a
little. Spin-outs and head-on wall hits cost coins.

**Architecture:**
- Coin rows are track data (`coins: [[p, offset, count], ...]`), next to the boost pads.
- The server owns the coin state (positions, respawn times, each kart's count) and adds
  `coins × 0.05` to the kart's top speed (and boost speed) in `drive()`.
- The views carry the active coins and each kart's count. The TV draws gold discs and a HUD
  counter; the phone shows the count by the speed bar.

**Tech Stack:** Node (`node:test`), browser JS, canvas 2D, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-19-kart-racers-design.md` (Part 2).

## Global Constraints

- Emoji up to Emoji 12 only: the HUD counter uses 🟡 (🪙 is Emoji 13). No emoji on the canvas.
- Coins work whether items are on or off.
- Values from the spec:
  - max 15 coins;
  - +0.05 top speed per coin (boost speed rises with it);
  - pickup radius 0.35;
  - respawn 8 s;
  - a spin-out costs 3 coins, a head-on wall bounce costs 1;
  - coins reset at each race start.

## Review Focus

1. **Coin loss is clamped at 0:** a spin-out with fewer than 3 coins leaves 0, never a negative count. Tested in Task 1.
2. **Both karts reach the same coin on the same tick:** only one takes it (slot order). Tested in Task 1.
3. **A kart with 15 coins drives over a coin:** the coin stays for the other kart. Tested in Task 1.
4. **A best-of-3 next race:** coins are reset and every coin is back. Tested in Task 1.
5. **Coins off the drivable area:** every coin sits inside the barriers (where a kart can reach it). Tested in Task 1.

---

### Task 1: Server coins

**Files:** `server/games/kart-race.js`, `test/kart-race.test.js`

**Data and constants:**
- `COINS = { max: 15, perCoin: 0.05, r: 0.35, respawnMs: 8000, spinLoss: 3, wallLoss: 1, spacing: 0.6 }`, exported.
- Track rows (count 4; offsets alternate +0.9 / −0.9 from row to row):

  | Track | Coin rows at |
  |---|---|
  | Speedway | .10 .40 .55 .65 .90 |
  | Kidney | .10 .38 .60 .68 .90 |
  | Serpent | .10 .20 .45 .60 .70 |
  | Grand Prix | .10 .20 .40 .60 .70 |
  | Hairpins | .12 .20 .50 .60 .90 |
  | Zigzag | .10 .20 .45 .55 .88 |

**State:**
- `this.coins = [{ x, y, backAt }]`, built in `newRace()`. Coin `j` of a row sits at `pointAt(track, p + j*spacing/length, offset)`.
- Each kart gets `coins: 0`.

**Behaviour:**
- `coinCheck(k, now)`: if `k.coins < max`, take every coin within `r + KART.r` whose `backAt <= now` (`coins++`, `backAt = now + respawnMs`, `events.coins++`). Runs per kart in slot order, after `walls`.
- In `drive()`: `top` adds `k.coins * perCoin` to both the max and the boost speed.
- `loseCoins(k, n)`: `k.coins = max(0, coins - n)`; adds to `events.coinsLost` if anything was lost. Called:
  - with `spinLoss` where a kart starts spinning out (banana hit);
  - with `wallLoss` in `hit()`'s head-on branch.

**View:**
- `coins`: the active coins as `{x, y}`.
- Each kart's `coins`.
- `events.coins` and `events.coinsLost`.

- [ ] **Step 1: write the failing tests:**
  - `coins: rows on every track, inside the barriers, clear of boost pads, box rows and the start`.
  - `coins: pick up (max 15), top speed rises, respawn after 8 s, reset each race`. This covers Review Focus 2, 3 and 4.
  - `coins: a spin-out costs 3 (never below 0), a head-on wall hit costs 1`. This covers Review Focus 1.
- [ ] **Step 2: run them.** `node --test test/kart-race.test.js` → the new tests fail.
- [ ] **Step 3: implement as above.**
- [ ] **Step 4: run** `npm test`. All pass.
- [ ] **Step 5: commit** `Kart Race: coins on the track raise your top speed`.

### Task 2: Screens

**Files:** `public/games/kart-race/host.js`, `player.js`, `style.css`

**TV:**
- Gold discs on the canvas, scaling in width to look like they spin.
- HUD: a `🟡 n/15` line under each player.
- Sounds: `eat` when a coin is picked up, `drop` when coins are lost.

**Phone:** the coin count next to km/h in `.kr-read`.

- [ ] **Step 1: implement**, then run `node --check` on both files.
- [ ] **Step 2: browser e2e** (a copy of kart6: the controller autopilot races a lap). Assert that the TV view's kart 1 `coins` > 0 at the end, take screenshots, and check `errors: []`.
- [ ] **Step 3: commit.**

### Task 3: Docs, review, PR

- [ ] **Step 1: docs.** Add coins to the README row and the tagline, then run `node tools/games-catalog.mjs` and `npm test`.
- [ ] **Step 2: review.** A fresh reviewer (opus) reviews the branch since main. Fix Important findings with a failing test first.
- [ ] **Step 3: ship.** PR, subscribe, check-in reminder; merge on green, then sync.
