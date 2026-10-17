# Party Board (Mario Party-style board game)

Status: design approved in chat (2026-10-17); this spec is for review before planning.

## Goal

A new ⚔️ Competitive lobby game, **Party Board**: two players take turns rolling and moving around a
looping 2D board, collecting coins and buying ⭐ stars, with a Party Minigame (the existing 10) after
every round. Most stars after the last turn wins; coins break ties. A 3D board is a later project.

Constraints: 2 players, phones or controllers (any mix), 2D on the TV, existing hub conventions
(`withSetup` settings, renderers, sounds hooks, stats views with `winner` / `draw` / `scores`).

## Settings

| key | values (first = default) | meaning |
| --- | --- | --- |
| `turns` | 10, 15, 20 | rounds (each player moves once per round) |
| `style` | mix, 2d, 3d | which party minigames (same filter as Party Minigames) |
| `bonus` | 1, 0 | bonus stars at the end on / off |

## Rules

### Round
1. Player 1's turn, then player 2's (the same order every round).
2. A turn: optionally use one item (only offered when holding one), roll, move, resolve the space.
3. After both turns: one party minigame. Winner +10 🪙; draw +3 🪙 each.
4. After the last round's minigame: bonus stars (if on), then the end.

### Dice
Roll 1-10 (server `rng`) when the player taps the spinning die (or presses A). Double Dice rolls
two and adds them; a Mushroom adds 3.

### Moving and passing
Tokens move one space per step (the TV animates ~250 ms per step). Passing or landing on:
- the ⭐ star space with ≥ 20 🪙 → prompt "Buy a star for 20?" (yes / no); after a buy the star moves
  to a random other star candidate space;
- the 🛒 shop → prompt to buy one item (or nothing), only offered with a free item slot.
Then the remaining steps continue. The landing space's effect applies once movement ends.

### Spaces
| type | effect on landing |
| --- | --- |
| blue | +3 🪙 |
| red | −3 🪙 (never below 0) |
| event ❓ | one random event (below) |
| bonus 🎰 | slot machine: the player stops 3 reels (values 1-5, server `rng` per reel); three of a kind +15 🪙, a pair +5, else +1 |
| shop 🛒 | the shop prompt (as when passing) |
| star ⭐ | the star prompt (as when passing) |

Events (equal odds): 🌧️ coin shower (+5 each), 🔀 swap places, 💰 steal up to 5 🪙 from the rival,
🍀 lucky (+10), 👻 the star moves to another candidate space.

### Items (hold at most 3; use one per turn, before rolling)
| id | name | price | effect |
| --- | --- | --- | --- |
| mushroom | 🍄 Mushroom | 5 | +3 to this roll |
| double | 🎲 Double Dice | 10 | roll two dice, add them |
| warp | 🌀 Warp | 10 | swap places with the rival (then roll as normal) |
| coin-thief | 🦹 Coin Thief | 8 | steal up to 10 🪙 from the rival |
| star-thief | 👻 Star Thief | 35 | steal a ⭐ (only usable when the rival has one) |

### Choices and time-outs
Every choice has a 15 s limit, then a default: item → none, roll → roll, star → no, shop → nothing,
slot → stop the remaining reels. Controllers: D-pad moves a highlight over the options, A confirms.

### End
Bonus stars (if on): ⭐ **Minigame star** for the most minigames won, ⭐ **Coin star** for the most
coins earned in total over the match; a tie gives both. Winner: more ⭐, then more 🪙; equal → draw.
Stats view: `scores` = stars.

## Board

`server/games/board/maps.js` exports one map now: an array of ~28 spaces
`{ x, y, type, starCandidate? }` in loop order (x, y in 0..1 for drawing), with 4-6 star candidates,
2 shops, 3 events, 2 bonus, the rest blue/red (about 2:1). The star starts on a random candidate.
Both tokens start on space 0.

## Architecture

- `server/games/party-board.js`: `class PartyBoard` (the game) and its lobby def
  `{ id: 'party-board', name: 'Party Board', category: 'competitive', music: 'casual' }`, registered
  with `withSetup` (settings above).
- Phases: `board` (turns), `minigame`, `bonus` (end-of-game star reveal, ~4 s), `over`.
- In `board` the state has a `prompt`: `{ slot, kind: 'item' | 'roll' | 'star' | 'shop' | 'slot', options, deadline }`
  or `null` while tokens move or messages show. Inputs: `{ type: 'choose', value }` for every prompt
  (item id or 'none', 'roll', 'yes' / 'no', item id or 'none', 'stop').
- `minigame` phase: `class OneMini extends MiniGame` (server/games/minis/runner.js) plays exactly one
  party minigame from the style-filtered `PARTIES` pool (via `poolFor`), then calls back the board with
  its result; the board view nests the minigame's view as `view.mini`, and inputs are forwarded to it.
- Movement is resolved on the server step by step with timers (~250 ms per step) so the TV and
  phones see the token travel; prompts pause the walk.
- View: `{ phase, round, turns, turn, players: [{ space, coins, stars, items, earned, minigames }],
  board: { spaces, star }, prompt, dice, message, mini, bonusStars, winner, draw, scores }`.
- Client: `public/games/party-board/{host,player}.js` + `style.css` (prefix `pb-`). The TV draws the
  board (spaces as coloured circles with icons, tokens, the star), a HUD and messages; during
  `minigame` it mounts `ArkMini.hostFrame` (phone: `ArkMini.phoneFrame`) and feeds it `view.mini`.
  Phones show coins / stars / items and the current prompt as big buttons.

## Testing

- `test/party-board.test.js` (seeded `rng`, `fakeCtx`): each space type; each event; each item and its
  limits (3 slots, star thief needs a rival star, prices); passing star / shop with and without coins;
  time-out defaults; the minigame phase hands control back with coins paid; turn count; bonus stars
  incl. ties; winner / draw / scores; settings; bad inputs ignored (wrong player, wrong prompt, unknown value).
- `test/sounds.test.js`: the board TV renderer's hook.
- Playwright: TV + two phones through a 10-turn match (shortened by test hooks only if needed), no page errors, screenshots checked.
