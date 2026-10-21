# Kart Race: Ready Ticks and F1-Style Start Lights

**Goal:** both players say they're ready before a race starts, and the countdown is a row of five
red start lights that come on one by one and then all go out.

**Owner's ask:** a ready tick on the TV setup panel; "a count down or the lights going down
similar to a f1 race". No Nintendo-like look: plain red lights on a dark gantry.

## Ready

- **Setup:** Start (phone) or A (controller) sends `go`. It toggles that player's ready flag.
- **Starting:** when both players are ready, the race begins (`begin()`).
- **Clearing ticks:**
  - changing your own racer or tyres clears your tick;
  - changing a setting clears both ticks (the other player agreed to the old settings);
  - going back to setup clears both.
- **View:** `ready: [bool, bool]`.
- **TV:** a ✓ and "Ready" next to the player's name in the picks panel. The hint says
  "Start (or A) when you're ready: the race begins when you both are."
- **Phone:** the Start button reads "Ready ✓" when you are, and the line under it says
  "Waiting for <rival>…".
- **Rematch:** on the end screen it stays as it is (either player, at once).

## Lights

- `LIGHTS = { count: 5, stepMs: 700, holdMin: 300, holdMax: 1200 }`.
- Light `i` (1 to 5) comes on at `i × stepMs`. After the fifth, a random hold of `holdMin` to
  `holdMax`, using the game's rng. Then all go out and the race starts.
- `TIMING.countdownMs` becomes the longest possible countdown (5 × 700 + 1200 = 4700), so
  anything waiting "past the countdown" still works.
- **View:** `lights` gives how many are lit (0 to 5). It stays 5 through the hold. `countdown`
  stays for the old code paths.
- **TV:** five lights in a row on a dark gantry, each lit red with a glow.
- **Phone:** five small dots, lit the same way.
- **Sounds:** a beep per light and a higher one at lights out. These use the existing sounds if
  they fit.

## Tasks

- [ ] Failing tests:
  - one `go` doesn't start the race; the second player's does;
  - `go` again un-readies;
  - a pick clears your own tick, and a setting clears both;
  - the lights count up 1 to 5 at 700 ms steps, hold, and go out within the bounds, and then
    the race starts.
- [ ] Server, `npm test` (the race helpers now send `go` from both players).
- [ ] TV and phone; browser e2e with screenshots of the gantry and the ready ticks.
- [ ] Review (opus); PR; merge on green.
