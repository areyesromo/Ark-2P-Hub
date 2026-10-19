# Dream list

Big ideas we'd like to build one day. Not planned yet: each gets its own design when its turn comes.

## Kart Race 3D

A separate game module (its own entry in the lobby), not a mode of the 2D Kart Race.

- A 3D chase-camera view per player (split screen on the TV), like Mario Kart's step from
  top-down to 3D.
- New tracks made for 3D: hills, jumps, banked turns, bridges and tunnels.
- Tracks built in 3D software (e.g. Blender) and loaded as **`.glb`** files: the road, walls,
  start line, boost pads and item rows marked in the model (named meshes or empties) so the
  game can read them.
- Reuses the 2D game's shared pieces: the racer roster and stats
  (`public/games/kart-race/racers.js`), the driving model (gas, brake/reverse, drift, walls) and
  the controls (phone pedals, controller mapping). Each racer gets a 3D kart model.
