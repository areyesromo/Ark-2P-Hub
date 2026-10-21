# Kart Race: Hit Size Matches the Bigger Karts

**Goal:** a kart touches things where its picture touches them. The pictures are 1.75 long and
about 1 wide (since PR #77), but every hit still used a 0.42 circle round the kart's middle.

**Design:** the kart is a capsule: a circle of radius `KART.r` = 0.5 (half the picture's width)
swept along a spine `KART.reach` = 0.375 either side of the middle, along the way it faces. That
is 1.75 long (`(reach + r) × 2` = `KART_LEN`) and 1.0 wide.

- **Pickups and hazards** (coins, ? boxes, bananas, webs, oil, shots, bomb blasts) hit when they
  come within their own radius of the spine: `game.touch(k, x, y)` gives that distance.
- **Kart against kart:** they bump when their spines come within `2r`; they push apart along the
  line between the two closest points (weights as before).
- **Walls:** the side radius `r` (0.5). The nose can still dip a little into a barrier on a
  head-on hit; walls are checked from the kart's middle, as now.
- **Dropping things:** bananas, webs and oil land behind the tail, and shots start ahead of the
  nose: `game.kartR` becomes the half length (`reach + r`).
- Magnet reach (3) stays measured from the middle.

**Rulings:** coin spacing must still allow only one coin per grab with the longer kart. The coin
test checks this for the capsule.

## Tasks

- [ ] Failing tests:
  - a coin at the nose is picked up;
  - a banana at the tail spins you;
  - karts nose to tail bump at the picture's length and don't bump side by side 1.1 apart;
  - the capsule is as long as `KART_LEN`.
- [ ] Implement in `server/games/kart-race.js` and `server/games/kart-items.js`; `npm test`.
- [ ] Browser e2e; review (opus); PR; merge on green.
