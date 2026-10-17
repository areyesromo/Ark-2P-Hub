# Party Board: more maps (forks, warps, tiers) and Harsh mode

Status: design approved in chat (2026-10-17); this spec is for review before planning.

## Goal

Turn Party Board's single loop into a choice of five maps with forks, warps and difficulty tiers,
and add a **Harsh mode** setting that scatters hazard spaces. Builds on
`docs/superpowers/specs/2026-10-17-party-board-design.md` (all its rules still apply).

## Map model (graph)

`server/games/board/maps.js` exports `MAPS = { id: { name, tier, starPrice, shopMarkup, spaces } }`.
Each space: `{ x, y, type, next: [index] , starCandidate?, warp? }`
- `next`: 1 entry normally, 2 at a fork (in display order: first = the default).
- `type` gains `'warp'`: landing on it moves the token to `warp` (an index), one way; passing it does nothing.
- `tier`: 'easy' | 'medium' | 'hard' | 'expert'. `starPrice` (default 20), `shopMarkup` (default 1; price = round(price × markup)).
- A helper `ring(types)` builds simple loops (`next = [i + 1]`, last → 0) so Party Island keeps its layout.

Validity (checked by a test for every map):
- every `next` / `warp` index exists; forks have exactly 2 `next`; no space links to itself;
- every space is reachable from 0, and 0 is reachable from every space (no traps);
- 4-6 star candidates (blue), ≥ 1 shop, ≥ 2 events, ≥ 1 bonus; positions unique, x / y in 0..1.

## The five maps

| id | name | tier | layout | starPrice | shopMarkup |
| --- | --- | --- | --- | --- | --- |
| island | 🏝️ Party Island | easy | the existing 28-space loop | 20 | 1 |
| lagoons | 🌊 Twin Lagoons | easy | one fork: a short path (red / event heavy) or a longer safe one (blue / shop) that rejoin | 20 | 1 |
| pipes | 🔧 Pipe Works | medium | two forks; two warps: one jumps ahead (shortcut), one sends you back to near the start | 20 | 1 |
| haunted | 👻 Haunted Maze | hard | three forks incl. a side loop that leads back before the fork; two backward warps; ~40 % red; star candidates far from the start | 25 | 1 |
| volcano | 🌋 Volcano Peak | expert | four forks; three one-way warps (mostly backward); ~55 % red among blue/red | 30 | 1.5 |

Exact layouts are data in `maps.js`; the test above guards them.

## Walking with forks and warps

- Each step moves to `next[0]`, or, at a fork, to the branch the player picks.
- **Fork prompt** (`kind: 'path'`): options `['0', '1']` (branch indices as strings); the view's prompt `extra`
  carries a preview per branch: the types of the next 4 spaces along it (following `next[0]` after the
  branch). 15 s time-out → '0'. The walk pauses at the fork space before stepping onto the branch;
  the fork prompt is asked before the star / shop pass-by checks of the next space.
- Passing the star / shop works as before on every map. Landing on a warp: message
  "🌀 Warp!", the token moves to the target (no landing effect there), then the turn ends.
- Events / items that move tokens (swap, warp item) are unchanged; the 🌪️ tornado moves to a random space.

## Harsh mode

Setting `harsh`: [0, 1] (off by default). At `start()`, when on: about 15 % of the map's blue and red
spaces (round, at least 2), chosen with `rng`, never index 0, never star candidates, never forks or warp
targets, become hazards (each kind with equal odds):

| type | effect on landing |
| --- | --- |
| thunder ⚡ | lose half your coins (rounded down lost: floor(coins / 2)) |
| skull 💀 | lose a ⭐; with no stars, lose 10 🪙 (never below 0) |
| tornado 🌪️ | blown to a random space (not 0, not the current one) |

The hazard layout is part of the view (`board.spaces[i].type`). Passing a hazard does nothing.

## Settings

Added to Party Board's setup: `map`: ['random', 'island', 'lagoons', 'pipes', 'haunted', 'volcano']
(labels with the tier: '🎲 Random', '🏝️ Party Island · Easy' …); `harsh`: [0, 1]
('Normal spaces' / '💀 Harsh mode'). 'random' picks a map with `rng` at `start()` (a rematch may pick
another). The view carries `board.name` and `board.tier`.

## TV / phone

- TV board: an SVG layer under the spaces draws a line for every `next` link (an arrowhead at forks)
  and a dashed curve for every warp; hazards get icons ⚡ 💀 🌪️ and a dark red / purple fill; warp
  spaces 🌀 cyan. Map name and tier badge above the board.
- Fork prompt: TV shows "⬆️ / ⬇️ path" labels with the previews (icons); phone buttons
  "Path 1: 🛒 ❓ 🔵 🔵" / "Path 2: …"; controller ←→ + A as for other prompts.

## Testing

- `test/board-maps.test.js`: validity for every map; tiers / prices as in the table; `ring()` keeps the island identical.
- `test/party-board.test.js` additions: a fork pauses and asks with previews; choosing '1' takes the second
  branch; time-out takes '0'; landing on a warp moves the token and ends the turn; Expert prices (star 30,
  shop ×1.5) in prompts and payments; harsh off → no hazards; harsh on → hazard count and placement rules;
  each hazard's effect (thunder halves, skull star / 10 coins, tornado moves); map setting picks the map;
  'random' picks one of the five.
- Playwright: Pipe Works + Harsh mode match through a fork and a warp; screenshots of all five maps.
