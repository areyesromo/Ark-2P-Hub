# Kart Race 3D: look back and glance sideways (design)

Date: 2026-11-09. Status: approved design, awaiting spec review.

## Goal

While driving in Kart Race 3D, a player can look behind them, to see who's chasing, and glance left
or right, all without letting go of the race. It works the same from a phone and from a controller
on the TV (the Steam Deck included).

## What the owner asked for

- "A mechanic to be able to look around and back."
- **The owner chose:** look back plus a side glance. Holding Look back gives a rear view for as long
  as it's held, a sideways input turns the camera up to about 90°, and letting go swings it back
  behind the kart.

**Assumptions** (agreed in the design review):

- Only the 3D game gets this. The 2D Kart Race and its phone are unchanged.
- It's camera only: steering, items and the race itself don't change.
- Each player's look turns only their own half of the screen.

## 1. Input

Both phones and controllers already send one `drive` message with `steer`, `gas`, `brake` and
`drift`. It gains two fields:

- `look`: the glance, a number from −1 (full left) to 1 (full right), 0 when not glancing.
- `back`: true while Look back is held.

**Controller** (on the TV, read through `public/host/gamepads.js`):

- **The reader:** it reports the right stick too, as `stick2(index)` returning `{ x, y }` (axes 2
  and 3), and the stick clicks as the buttons `LS` (10) and `RS` (11).
- **The 3D game's `padPoll`:**
  - `look` is the right stick's x, past the dead zone, to one decimal.
  - `back` is true when the right stick is pulled down past 0.6, or `RS` is held.
- **Kept:** every existing button stays as it is (the left stick and D-pad steer, A or RT gas, B or
  LT brake, X or RB drift, Y or LB item).
- **The hint:** the pad hint for the 3D game adds "R-stick: look (pull down: look back)".

**Phone** (`public/games/kart-race/player.js`, only when `threeD`):

- **The Look back button:** a 👀 **LOOK BACK** button, held like the pedals.
- **The look strip:** a thin strip above the pedals, labelled "◀ look ▶". A finger on it sets `look`
  from its position: the strip's left edge is −1, its middle 0, its right edge 1. Lifting the finger
  sets 0.
- **Layouts:** both fit the portrait and landscape layouts.
- **Sending:** the phone sends only when a value changes, as it does now (`look` rounded to one
  decimal).

## 2. Server (`server/games/kart-race.js`)

- **Checking the input:** `onDrive` checks the new fields like the others.
  - `look` must be a finite number, clamped to −1..1, otherwise 0.
  - `back` becomes a Boolean.
  - Both are stored on the kart as `k.look` and `k.lookBack`, and reset to 0 and false when a race
    starts.
- **The view:** each kart in the view gains `look` (to one decimal) and `back`. Computer racers
  always show 0 and false.
- **Hidden information:** none. This is camera state that both phones may see.
- **The 2D game:** it ignores these fields.

## 3. The TV camera (`public/games/kart-race-3d/geom3d.js`, `kart3d.js`)

- **The chase camera:** `chase(pose, cam, yaw)` swings the camera round the kart by `yaw`:
  - The eye sits `back` behind the direction `angle + yaw`.
  - It looks `ahead` along that direction.
  - With `yaw = 0` it's exactly today's camera.
- **The angle:** each half's yaw goal is `back ? π : look × π/2`. Looking back wins over a glance.
- **Swinging:** the current yaw eases towards the goal, taking the shorter way round, and gets
  there in about 150 ms. Letting go eases it back to 0 the same way.
- **Kept:** the existing follow smoothing and the clamp that keeps the eye inside the walls apply as
  now.
- **The tag:** while a half's player looks back, a small "👀 Looking back" tag shows in that half's
  top corner (`ui.js`).
- **Battle:** looking works the same, with the battle camera's distances.

## Edge cases

- **Releasing on the way round:** letting go in the middle of the swing eases back from wherever
  the camera is.
- **A phone that drops:** its `drive` input stops, and the kart's last input stays, as today. The
  server clears `look` and `back` when a race starts, so a stale look can't carry into the next
  race.
- **Gamepad and phone together:** the last `drive` message wins, as today.
- **Between races and the overview:** looking has no effect.

## Testing

- **Server:**
  - `look` and `back` reach the view;
  - bad values (a string, NaN, 5) become clamped or 0;
  - they reset at the next race;
  - computer racers show 0.
- **Camera maths:**
  - `chase` with yaw 0 matches today's camera;
  - yaw π puts the eye in front of the kart, looking back at it;
  - yaw π/2 puts the eye to the kart's left, looking right;
  - the easing takes the shorter way round and settles at the goal.
- **Controller:**
  - `stick2` reads axes 2 and 3;
  - `padPoll` maps the right stick to `look`, and the stick pulled down or `RS` to `back`.
- **Phone:**
  - in the 3D game, the Look back button and the strip send the right `drive` input;
  - the 2D phone has neither.
- **Live check:**
  - a race on the dev server, with a controller or a forced input;
  - screenshots of a glance and of looking back;
  - no console errors.

## Not in this work

- A free camera that stays where you leave it.
- Mirrors, or a picture-in-picture rear view.
- Looking in the 2D game.
