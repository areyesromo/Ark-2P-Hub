// Dungeon Duo's floors (see dungeon-duo.js), as tile maps 20 wide and 12 high:
//   '#' wall   ' ' floor   'S' where the two heroes start   'E' the stairs down
//   'K' a key (walk over it)   'D' a locked door (walk into it with a key)
//   '^' spikes (up and down in turn)   'P' a pressure plate   'G' a gate, open while a plate is held
//   enemies: 's' slime, 'b' bat, 'k' skeleton (throws bones), 'W' the Stone Warden (the boss)
// Enemy letters stand on floor.

export const FLOORS = [
  {
    name: 'The Cellar',
    // Slimes and bats (none in the room you start in); the key is in the far corner, the
    // stairs behind the locked door.
    map: [
      '####################',
      '#SS   #       b   K#',
      '#     #           ##',
      '#     ####  ###    #',
      '#                  #',
      '#####  s     ####  #',
      '#   #        #  #  #',
      '# E D        #  #  #',
      '#   #   b       s  #',
      '#####   ####       #',
      '#  s               #',
      '####################',
    ],
  },
];
