# Kart Race 3D: bigger tracks (design)

Date: 2026-11-09. Status: approved design, awaiting spec review.

## Goal

Kart Race 3D's five tracks become big enough to feel like real circuits. The road is wider, so a pack
of eight has room to race side by side, and the laps are long enough to matter.

## What the owner asked for

- "The tracks are quite small. It took me 1 minute and 36 seconds for 5 laps." That's about 19
  seconds a lap. "Each lap needs to be bigger."
- **The owner chose:**
  - both a wider road and longer laps;
  - a road **12 karts wide** (today it's 7 units, about 7 karts);
  - growing the tracks by **scaling today's five layouts up** rather than laying them out again.

**Measured today:**
- laps are 170–229 units of centre line, about 20–27 seconds at top speed;
- the road is 7 wide and the field is 128 × 72.

The Grand Prix design aimed for laps of 40–60 seconds, and the tracks came in at about half that.

**Assumptions** (agreed in the design review):

- 3D races default to 3 laps, so a race and a Cup stay a sensible length.
- The 2D game, the battle arenas and the phones don't change.

## 1. The tracks (`server/games/kart-tracks-3d.js`)

- **Road and field:** the road is **12** wide (from 7), on a **288 × 162** field (from 128 × 72).
- **Layouts:**
  - Each track's control points are today's points (after the current `around(…, 0.72)`), multiplied by the track's `size` about the field's corner (0, 0). So the shape, the bends and where the start line sits on the lap don't change.
  - `size` is set per track, about **2.25**, and smaller where a track is already long (Serpent Pass).
  - Every lap must take **45–60 seconds at top speed**, so 383–510 units of centre line at 8.5 units a second. A test pins this.
- **? boxes:**
  - The rows still come about **every 60 units** of lap, so 7 or 8 rows a lap. They're given as fractions of the lap, spread evenly from about 0.1, and each track lists its own.
  - Each row is **5 boxes across the wider road**, at offsets −4, −2, 0, 2 and 4, with the middle one a double, as now.
- **Coins:** each track's coin count is multiplied by its `size` (rounded), so there are about 140–170 a lap.
- **Boost pads:** the existing pads keep their place on the lap. Each track gains one more pad, in the middle of its longest straight.
- **The grid:** rows **5** apart, and **2.5** either side of the middle, so the eight-kart grid still fits behind the line.
- **Sunset Canyon's arches:** they keep their lap fractions (0.396 and 0.85).

## 2. Racing on the wider road (`server/games/kart-race.js`, `kart-race-3d.js`)

- **Computer racers' lanes:** they scale with the road. A track can set `lanes`; the 3D tracks use **[−4.1, 0, 4.1]** (about a third of the road either side). The 2D game keeps CPU.lanes `[−2.4, 0, 2.4]`. The pass and gap distances stay as they are.
- **Laps:**
  - Kart Race 3D's laps setting is **[3, 5, 8]**, so 3 is the default. The 2D game keeps [5, 3, 8].
  - A saved setting of 5 still loads as 5.
- **Unchanged:** kart speed and handling, the items, and the shortcut rule (`cutJump` already scales with the lap's length).

## 3. The TV (`public/games/kart-race-3d/`)

- **How far the cameras see:** the chase cameras and the overview see up to **max(200, 2.5 × the field's width)**, set when a track's world is built. So the overview between races takes in the whole bigger field, and the far cliffs and dam aren't cut off.
- **Room for the items on the road:** up to **400** coins and **120** ? boxes (`things3d.js`).
- **Sunset Canyon** (`canyon3d.js`): the scenery scales with the field's width against today's 128, by `s = field.w / 128`.
  - The cliffs' and boulders' sizes and the grid the boulders are placed on scale by `s`.
  - There are up to 80 boulders (from 36).
  - The dam is at `y = −30 × s`, `w = 56 × s` and `h = 22 × s`.
  - The paddock's pieces sit at a fixed 4 to 6 units beyond the barriers (half the road plus `wallOut`), not at today's fixed offsets.
  - The arches still span the road with at least **7** clear over its middle.
  - The canyon stays within its budget of **40 draw calls and 80,000 triangles**.
- **The course map and HUD:** they already read the field's size and the road's width, so they scale by themselves.

## 4. Lap records

- **The problem:** lap records are kept per game and track name (`stats.lapRecord(game, track)`). If
  the tracks kept their names, the old 20-second laps would stand as records nobody can beat on the
  longer tracks.
- **The fix:**
  - A track can set `recordName`, used wherever its record is looked up or saved
    (`kart-race.js:414` and `:1084`), and otherwise its `name`.
  - The 3D tracks use `'<name> (wide)'`, for example "Speedway Oval (wide)", which is how the stats
    page lists them.
  - The old records stay in the stats file under the old names, untouched.
- **Unchanged:** the 2D game's record names.

## 5. Unchanged

- The 2D Kart Race and its six tracks.
- The battle arenas.
- The phones.

## Testing

- **Tracks:**
  - each of the five is 12 wide on a 288 × 162 field and is a clean loop;
  - every lap takes 45–60 seconds at top speed;
  - the rows come every 50–70 units, and the boxes and coins sit on the road;
  - each track has one more boost pad than before;
  - the eight-kart grid fits behind the line;
  - no bend is tighter than the minimum.
- **Computer racers** (fixed seed):
  - each finishes a lap on every big track without getting stuck;
  - in the 3D tracks they use lanes at ±4.1, and in the 2D game ±2.4.
- **Laps:** Kart Race 3D's default is 3, and the 2D default is 5.
- **Records:** a 3D lap record is looked up and saved as `'<name> (wide)'`, and the 2D game's records keep their names.
- **TV:**
  - the cameras' far distance follows the field;
  - the item stand-ins hold up to 400 coins;
  - the canyon's tests run again on the 288 × 162 field: cliffs outside the field, rocks off the road, arches clear, the dam in the distance, the paddock outside the loop, and the budget.
- **Live check:** a race on Sunset Canyon and on Speedway Oval, with screenshots of the race and the overview between races, and the time of one lap noted.

## Not in this work

- New track layouts (approach B), or new tracks.
- Changes to kart speed or handling.
- The 2D game's tracks.
