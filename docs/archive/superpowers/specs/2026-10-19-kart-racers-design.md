# Kart Race: racers, tyres, coins and items (design)

## Goal

Make the 2D Kart Race feel like a fuller kart game: each player picks a **racer** (character +
kart + stats) and **tyres** that shift those stats; **coins** on the track raise your top speed;
and **items** grow into a 3-item queue with double boxes and 16 items (Mario-Kart-style ones plus
our own). The racers, tyres and per-track coin spots are defined once in shared files so a future
**Kart Race 3D** module (see `docs/DREAMS.md`) can reuse them.

Agreed with the owner:
- One combined racer pick (character + kart + stats) plus a separate tyre pick.
- Stats only, no per-racer perks: Speed, Acceleration, Handling, Weight.
- 6 stat types × a male and a female version (identical stats) = 12 racers.
- Coins: max 15, each raises top speed.
- Items: hold up to 3, used oldest first; double item boxes; 16 items. Names and art are our own
  (no Nintendo names, characters or art).

Delivered in **three PRs**, each tested by the owner before the next:
1. Racers and tyres. 2. Coins. 3. Item queue, double boxes and the new items.

---

## Part 1: racers and tyres

### Roster

Shared module `public/games/kart-race/racers.js`: a plain script setting
`globalThis.ArkKartRacers` (same pattern as `track.js`). The server imports it for its side
effect; screens load it with `Ark.loadScript`.

| type | id (m / f) | name (m / f) | emoji | Spd | Acc | Hnd | Wgt | kart shape |
|---|---|---|---|---|---|---|---|---|
| speed | rex / roxy | Rex / Roxy | 🔥 | 5 | 2 | 2 | 3 | long nose |
| accel | zip / zara | Zip / Zara | ⚡ | 2 | 5 | 3 | 2 | short, stubby |
| handling | swift / sky | Swift / Sky | 🌀 | 3 | 3 | 5 | 1 | low, wide wings |
| heavy | boulder / bella | Boulder / Bella | 🪨 | 4 | 1 | 2 | 5 | wide, boxy |
| allround | dash / daisy | Dash / Daisy | ⚖️ | 3 | 3 | 3 | 3 | classic (today's kart) |
| tricky | rascal / ruby | Rascal / Ruby | 🦊 | 2 | 4 | 5 | 1 | narrow, pointed |

Every type totals 12 points. A racer: `{ id, name, type, gender: 'm'|'f', emoji, stats: { speed,
accel, handling, weight }, shape, stripe }` (`stripe`: the type's colour).

### Tyres

In the same module:

| id | name | emoji | change | drawn as |
|---|---|---|---|---|
| standard | Standard | ⚫ | none (default) | today's wheels |
| slicks | Slicks | 🏁 | Speed +1, Handling −1 | thin |
| grippy | Grippy | 🔩 | Handling +1, Speed −1 | chunky tread |
| rollers | Rollers | 🔘 | Accel +1, Speed −1 | small |
| monster | Monster | 🚜 | Weight +1, Accel −1; half the speed loss on grass | huge |

Combined stats = racer + tyre, each 0–6.

Module exports:
- `RACERS`, `TYRES`;
- `racer(id)`, `tyre(id)` (unknown ids fall back to the defaults);
- `DEFAULT_RACERS = ['dash', 'daisy']` (by slot), `DEFAULT_TYRE = 'standard'`;
- `stats(racerId, tyreId)` gives the combined stats;
- `physics(stats, tyreId)` gives the kart's driving numbers (below), so 2D and any future 3D
  turn stats into handling the same way.

### Stats → driving

All 3s give exactly today's kart. Each step is linear and runs 0–6:

| stat | drives | per step | at 3 |
|---|---|---|---|
| Speed | `maxSpeed` | ±0.45 | 8.5 (boost speed = maxSpeed + 4) |
| Acceleration | `accel` | ±1.25 | 9 |
| Handling | `turnRate`; `grip` | turnRate ±0.15; grip ∓0.1 | 2.8; 1.2 (lower grip = full steering sooner) |
| Weight | `weight`; `grassSpeed` | weight ±0.25; grassSpeed ±0.15 | 1; 3.2 (Monster: grass slowdown halved) |

`KART` keeps the base values. At race start each kart gets `k.car = Racers.physics(...)`, and
`drive()` and `bump()` read those fields from `k.car`. In a bump, each kart is pushed apart by
the other's share of the total weight.

### Picking

- Game state gains `picks: [{ racer, tyre }, { racer, tyre }]`, starting at the defaults and kept
  across rematches and races.
- Inputs `{ type: 'racer', id }` and `{ type: 'tyre', id }` come from a player during `setup` or
  `over` and set that player's own slot. Unknown ids are ignored. Both players may pick the same.
- Nothing blocks Start: an unpicked player races the default.
- **Phone** (setup screen), under the settings:
  - a "Your racer" grid of 12 cards (emoji, name; each m/f pair side by side);
  - a row of 5 tyres;
  - the combined stat bars, with the tyre's +/− shown in green or red.
  - The last picks are remembered on the phone (`localStorage`) and sent when setup opens.
- **Controller** (setup screen): two new rows in that player's setup focus, "Racer" and
  "Tyres"; ←→ cycles.
- **TV setup**: both players' picks (emoji, name, tyre, stat bars) next to the track preview.
- **Race HUD**: each player's racer emoji and name by their name.

### Drawing (2D)

- The kart keeps the player's colour (P1 / P2).
- The body outline follows the racer's shape, with a stripe in the type colour.
- Wheel size and width follow the tyre.
- No emoji on the canvas (a kiosk browser may have no colour emoji font); emoji appear in HTML only.

### Views

`common()` adds `picks`. Karts in the view gain `racer` and `tyre`. The roster is not sent:
screens load `racers.js`.

---

## Part 2: coins

- **Placement**: each track gains `coins: [[p, offset, count], ...]`, short rows along the road
  (count coins spaced 0.6 apart, along the lap from p), about 5–6 rows per track. They sit off the
  racing line and away from boost pads and box rows.
- **Pickup and respawn**: a kart touching a coin (radius 0.35) takes it if it holds under 15. The
  coin comes back after 8 s.
- **Effect**: top speed + 0.05 per coin held (15 coins = +0.75; boost speed rises with it). No
  speed burst on pickup.
- **Losing coins**:
  - any spin-out costs 3 (banana, Bouncer, Seeker, Bomb, a Star ram);
  - a head-on wall bounce costs 1;
  - Web, Oil Slick, Freeze, Thunder and kart bumps cost nothing.
  - Lost coins vanish (they are not dropped on the track).
- **Reset**: coins return to 0 at the start of each race. Coins are on whether or not items are.
- **Display**:
  - TV HUD: `🟡 7/15` under each player.
  - Phone: the count next to the speed bar.
  - The canvas draws coins as spinning gold discs.
  - Sounds: a ding on pickup, a scatter when coins are lost.
- **View**: `coins` (the active coins' x and y), and each kart's `coins`. Events gain `coins` and
  `coinsLost`.
- **3D later**: coin rows live in the track definitions, like boost pads.

---

## Part 3: item queue, double boxes and new items

### Queue

- `k.items` becomes an array of up to 3 item kinds (replacing `k.item`).
- ITEM (phone button, controller Y/LB) uses `items[0]`; the rest move up.
- A box gives nothing while the queue is full.
- **Phone**: the item button shows the first item large and the next two small. **TV HUD**:
  all three.
- Gold Turbo is the exception: while active, each ITEM press boosts again without using up the
  next item (see the table).

### Boxes

- In each row the middle box is a **double box**, drawn gold and marked "2". It gives two items
  (or one if only one slot is free).
- Rows, offsets and respawn are unchanged.

### Items (16)

"Spin out" means today's banana spin (1.2 s, steering lost); it costs 3 coins. The shield
(5 s, as today) now blocks **one** hit of any kind (a spin, Web, Oil, Freeze or Thunder) and
then pops.

| id | name | emoji | effect |
|---|---|---|---|
| banana | Banana | 🍌 | dropped behind; whoever hits it spins out (today's) |
| turbo | Turbo | ⚡ | short boost (today's) |
| shield | Shield | 🛡️ | blocks the next hit for 5 s |
| bouncer | Bouncer | 🥏 | fired straight ahead at 12/s; bounces off walls (the road walls and field edge); lasts 4 s; spins out any kart it touches, the thrower included after 0.5 s |
| seeker | Seeker | 🎯 | follows the road ahead toward the rival at 13/s, steering to them once within 4; spins them out; destroyed by a banana, Web or Bouncer it touches; gives up after 6 s |
| bomb | Bomb | 💣 | lobbed 5 ahead; lands and explodes after 1.5 s; spins out every kart within 2 |
| star | Star | ⭐ | 6 s: top speed +1.5, immune to every hit and to grass slowdown; ramming the rival spins them out |
| goldturbo | Gold Turbo | 🌟 | 5 s window: each ITEM press gives a turbo boost (the queue is not used during the window) |
| thunder | Thunder | 🌩️ | the rival shrinks for 4 s: drawn smaller, top speed −1.5, weight −1 |
| coinbag | Coin Bag | 💰 | +5 coins (to 15) |
| magnet | Magnet | 🧲 | 5 s: coins and boxes within 3 fly to you; if the rival is ahead and within 6, a slipstream (+0.8 top speed) |
| hover | Hover | 🎈 | 4 s: no grass slowdown; passes over bananas, bombs, webs and oil; crossing grass does not count as a shortcut |
| web | Web | 🕸️ | dropped behind; a kart touching it is held to half speed for 1.5 s |
| oil | Oil Slick | 🛢️ | dropped behind; a kart crossing it can't steer or brake for 1 s (keeps its speed and heading) |
| freeze | Freeze | 🧊 | the rival's grip halves and turning drops 40% for 3 s |
| swap | Swap | 🔄 | trades your item queue with the rival's (the Swap itself is used up first) |

- **Dropped hazards** (banana, web, oil): up to 6 of each kind on the track. The oldest goes
  when a new one is dropped.
- **Projectiles** (bouncer, seeker, bomb) are simulated on the server each tick and appear in
  the view as `shots: [{ kind, x, y, angle }]`.

### Odds by position

Weights per draw, by place (1st / 2nd):

| item | 1st | 2nd |
|---|---|---|
| banana | 5 | 1 |
| turbo | 3 | 3 |
| shield | 3 | 1 |
| bouncer | 4 | 2 |
| web | 3 | 1 |
| oil | 3 | 1 |
| coinbag | 3 | 1 |
| bomb | 1 | 2 |
| seeker | 0 | 3 |
| magnet | 1 | 2 |
| hover | 0 | 2 |
| freeze | 0 | 2 |
| swap | 0 | 2 |
| thunder | 0 | 1 |
| goldturbo | 0 | 2 |
| star | 0 | 1 |

With Items off, no boxes appear (as today). Coins still appear.

### Effects and sounds

- New view flags per kart: `star`, `shrunk`, `frozen`, `webbed`, `oiled`, `hover`, `magnet`.
- Hazards in the view: `webs`, `oils`.
- The TV draws each effect on the kart: a star glow, a smaller kart, an ice tint, web strands,
  an oily sheen, a shadow lifted under a hovering kart, magnet arcs.
- New events, with sounds from the existing set: `fired`, `exploded`, `zapped`, `swapped`.

---

## Testing

- **Unit** (`test/kart-race.test.js`, plus a new `test/kart-racers.test.js`):
  - **Roster:** stats total 12 per type; m and f versions match; ids unique.
  - **Physics:** `physics()` at all-3s with Standard tyres equals today's KART.
  - **Speed vs acceleration:** Rex has a higher top speed than Zip; Zip reaches 5 sooner.
  - **Handling:** Swift turns further than Boulder; Slicks raise Speed and lower Handling.
  - **Weight:** in a bump, Bella pushes Ruby further than Ruby pushes Bella; Monster tyres lose
    less speed on grass.
  - **Pick inputs:** own slot only, only in setup/over; bad ids ignored; picks survive a rematch.
  - **Coins:** pickup caps at 15; top speed rises per coin; a spin-out costs 3 and a head-on wall
    hit costs 1; coins respawn; they reset each race.
  - **Queue:** holds 3 and is used oldest first; a double box gives 2; a full queue takes nothing.
  - **Items:** each item's core effect, the shield popping after one hit, a Seeker stopped by a
    banana, Swap trading queues, Star immunity, Hover skipping hazards and the shortcut check.
  - **Odds:** 1st never draws Star, Seeker, Hover, Freeze, Swap, Thunder or Gold Turbo.
- **Browser e2e per PR:** phone and controller pick racer and tyres, the TV shows both, and a race
  runs with no page errors. The coins PR shows the counter rising; the items PR shows a queue of 3
  on the phone and HUD.
- README rows (phone, controller, settings) and `docs/GAMES.md` regenerated in each PR.

## Out of scope

Per-racer perks, unlockables, kart bodies or gliders as separate parts, online play, and 3D
(see `docs/DREAMS.md`).
