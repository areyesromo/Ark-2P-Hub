# Minigame ideas

Ideas for new Party Minigames and Micro Mayhem minis, waiting their turn. This is the working
backlog, not the bucket list: pick from here when choosing what to build next. Each gets a short
design when its turn comes.

**Look** says who builds what (see `docs/3D-HANDOFF.md`):

- **2D**: done here, start to finish.
- **3D base**: done here with simple shapes (boxes, spheres, cylinders); playable and shippable as is.
- **3D art**: the base is done here, then the local session adds models, scenery and animation from a
  brief in `docs/3D-HANDOFF.md`.

## Quick reflex (Micro Mayhem size, 5 to 10 seconds)

| Idea | How it plays | Look |
|---|---|---|
| Catch It | Something drops from a random spot up top; tap when it's over your basket. | 2D |
| Pick the Colour | A colour word in a different ink: tap the ink, not the word. | 2D |
| Bigger Number | Two numbers flash; tap the side with the bigger one. Three right in a row wins. | 2D |
| Lights Out | A row of lights goes off one at a time; tap the moment the last one goes (a false start loses). | 2D |
| Snap | Cards flip on the TV; first to tap SNAP on a matching pair wins, a wrong snap loses. | 2D |
| Dodge Ball | Balls fly across; swipe up or down to dodge. Last one standing. | 2D |
| Pump It | Tap fast to blow up a tyre to the line, but not past it (it bursts). | 2D |

## Party minigames (30 to 75 seconds)

| Idea | How it plays | Look |
|---|---|---|
| Hammer Bell | Swing (shake or a timed tap) to send the puck up the tower; ring the bell, best of three. | 3D base |
| Darts | The hand sways like Archery but faster; three darts each, real dart scoring (doubles, trebles, bull). | 3D base |
| Shuffleboard | Slide pucks down a table into the scoring zones, knocking the other's off. Curling's physics, short table. | 3D base |
| Basket Shot | Swipe to shoot from spots round the arc; the hoop moves in the last round. | 3D art |
| Paper Plane | Throw angle and power, then tilt (or buttons) to ride the wind; furthest wins. | 3D art |
| Pancake Flip | Flip on the beat, catch it flat; tallest stack when the time's up. | 2D |
| Hot Air Race | Tap to burn, let it sink; catch the faster wind at each height. | 2D |
| Snowball Fight | Hide behind your wall, pop up to throw; a hit while you're up costs a heart. | 3D art |
| Bridge Builder | Take turns placing planks over a gap; a cart rolls over at the end and the side it falls on loses. | 2D |
| Treasure Dig | A grid of sand, both dig at once; the beeper says warmer or colder. First to the chest. | 2D |
| Lasso | A calf runs round the pen; time the throw to its path. | 3D art |
| Bubble Pop | Bubbles in both colours float up; pop yours, popping the other's costs a point. | 2D |
| Rhythm Jump | A rope swings under you both; jump on time, the beat speeds up. Last one standing. | 3D base |
| Golf Putt Off | One green, one hole, slopes that change each round; nearest to the pin or holed wins. Mini Golf's roll. | 3D base |
| Cup Stack | Build then unstack a pyramid of cups with a tap pattern; quickest wins. | 2D |

## Games of guessing and reading the other player

| Idea | How it plays | Look |
|---|---|---|
| Higher or Lower | A card shows; each guesses the next, secretly. Streaks score. | 2D |
| Which Box | One hides the prize in one of three boxes, the other picks; swap roles, five rounds. | 2D |
| Odd or Even | Both secretly pick fingers 1 to 5; one calls odd, one even, winner takes a point. | 2D |
| Price Guess | A made-up shop item and its parts; nearest guess without going over. | 2D |

## Notes

- Every idea needs a computer player (see `server/games/minis/bots.js`) and a controller mapping.
- Timing ones judge the press on the server with `lagFor` (see `runner.js`), like Musical Chairs.
- Before building, check the name isn't a famous game's and that it's not the same as an existing
  mini (`server/games/minis/`).
