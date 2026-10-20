# Kart Race PR 3a: Item Queue, Double Boxes, Power-Up Items

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, as chosen by the owner). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Hold up to 3 items (use the oldest first), get gold double boxes, and race with 8 new items that act on karts: Gold Turbo, Star, Coin Bag, Magnet, Hover, Thunder, Freeze, Swap. The shield now blocks one hit.

**Architecture:**
- Item rules move out of `server/games/kart-race.js` into `server/games/kart-items.js`: constants, odds, `roll`, `use`, and the per-tick effect helpers that `drive()`, `bump()` and the box and banana checks call.
- Item names and emoji live in a shared plain script, `public/games/kart-race/items.js` (`globalThis.ArkKartItems`), used by the TV and the phone (and later the 3D module).
- The kart's state changes from `item` to `items: []`, plus a timer per effect.

**Spec:** `docs/superpowers/specs/2026-10-19-kart-racers-design.md`, Part 3 (only the items listed here; Web, Oil Slick, Bouncer, Seeker and Bomb are PR 3b).

## Global Constraints

- Emoji up to Emoji 12 only: 🍌 ⚡ 🛡️ 🌟 ⭐ 💰 🧲 🎈 🌩️ 🧊 🔄. No emoji on the canvas.
- Values from the spec:
  - hold at most 3 items;
  - the middle box of each row is a double box;
  - shield lasts 5 s and blocks one hit;
  - Gold Turbo: 5 s window;
  - Star: 6 s, top speed +1.5;
  - Coin Bag: +5 coins;
  - Magnet: 5 s, reach 3, slipstream +0.8 when within 6 behind the rival;
  - Hover: 4 s;
  - Thunder: 4 s, top speed −1.5, weight −1;
  - Freeze: 3 s, turning −40%.
- Odds by place, as in the spec's table, limited to the items in this PR.

## Rulings (decided here, from the spec)

- **Freeze:** "grip halves and turning drops 40%" becomes turning ×0.6. This game's `grip` is the speed at which steering reaches full lock, so halving it would make steering *easier*.
- **Hover:** with barriers everywhere, a kart can't cross the grass between stretches any more, so "crossing grass doesn't count as a shortcut" has nothing to do. Hover gives no grass slowdown, and the kart passes over bananas.
- **Star:** a kart with a Star that touches a banana clears it away instead of spinning.
- **Magnet:** coins and boxes within 3 are collected on the spot, with no fly-to animation. Its slipstream works only while the rival is ahead and within 6.

## Review Focus

1. **Using an item:** ITEM with an empty queue does nothing. Spinning or finished karts can't use items. Gold Turbo boosts on every press during its window without using up the queue. Tests in Task 1.
2. **Swap:** Swap with both queues empty, or with only the Swap itself: Swap is spent, and the karts trade what's left. Test in Task 1.
3. **Thunder and Freeze on a shielded rival:** the shield pops, and no shrink or freeze happens. Test in Task 1.
4. **Two Stars meet:** neither spins. Star against Shield: the shield pops. Test in Task 1.
5. **A full queue drives over a double box:** the box stays for the other kart. A queue with one free slot gets one item and spends the box. Test in Task 1.

---

### Task 1: Server items (module and wiring)

**Files:**
- Create: `server/games/kart-items.js`.
- Modify: `server/games/kart-race.js`:
  - kart state;
  - `drive()`: top speed, grass, turning;
  - `bump()`: weight, Star ram;
  - `itemCheck()`: queue, double boxes, Star or Hover against bananas, shield one hit;
  - `useItem()`: delegate to the new module;
  - `coinCheck()`: Magnet reach;
  - view: `items`, effect flags, `boxes[].double`.
- Test: `test/kart-race.test.js` (the existing item tests updated to use `items`).

**Interfaces (produced):**
- `ITEMS` (moved; `kinds` becomes the list of all 11 in this PR, with `maxHeld: 3` and effect constants added).
- `ODDS`: `{ first: {kind: weight}, second: {kind: weight} }`.
- `rollItem(game, slot)`.
- `useItem(game, slot, now)`.
- `effects(k, now)` gives `{ topBonus, noGrass, turnScale, weightBonus, star, immune }`.
- `hitKart(game, k, now, why)`: spins the kart out, or the shield pops it, or a Star ignores it. Returns true if the kart spun.

**Tests (new):**
- `items: hold up to 3, used oldest first; a double box gives two; a full queue leaves the box`
- `items: shield blocks one hit then pops; Star is immune and spins out whoever it rams (two Stars: neither)`
- `items: Gold Turbo boosts on every press for 5 s without using the queue; Coin Bag +5 (max 15)`
- `items: Thunder shrinks the rival (slower, lighter) unless shielded; Freeze cuts their turning`
- `items: Magnet collects nearby coins and boxes and slipstreams you; Hover skips the grass slowdown and rides over bananas`
- `items: Swap trades queues (Swap itself spent)`
- `items: 1st never draws Star, Gold Turbo, Thunder, Freeze, Swap or Hover`

- [ ] Write the tests and see them fail.
- [ ] Implement.
- [ ] `npm test` all green.
- [ ] Commit.

### Task 2: Shared item list and screens

**Files:** `public/games/kart-race/items.js` (new), `host.js`, `player.js`, `style.css`.

- **TV HUD:** the 3 held items, the next one first.
- **TV canvas:**
  - a gold glow for a Star;
  - a kart drawn at 70% size when shrunk;
  - an icy blue ring for Freeze;
  - a shadow under a lifted kart for Hover;
  - arcs for Magnet;
  - a gold "2" on double boxes.
- **Phone:** the ITEM button shows the first item big and the next two small; it lights up with Gold Turbo.
- **Sounds:** `boom` for Thunder, `lock` for Swap, `fanfare` for a Star ram, `whoosh` for Gold Turbo boosts.

- [ ] Implement.
- [ ] `node --check`.
- [ ] Browser e2e (the controller autopilot uses its items).
- [ ] Commit.

### Task 3: Docs, review, PR

- [ ] README (items list) and the catalog; `npm test`.
- [ ] A fresh reviewer (opus); fix the Important findings with a failing test first.
- [ ] PR, check-in reminder, merge on green, sync the branch.
