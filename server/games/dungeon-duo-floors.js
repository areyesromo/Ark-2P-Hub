// Dungeon Duo's floors (see dungeon-duo.js), as tile maps 20 wide and 12 high:
//   '#' wall   ' ' floor   'S' where the two heroes start   'E' the stairs down
//   'K' a key (walk over it)   'D' a locked door (walk into it with a key)
//   '^' spikes (up and down in turn)   'P' a pressure plate   'G' a gate, open while a plate is held
//   '~' ice (slippery)   '>' '<' an arrow trap in the wall (fires along its row on a beat)
//   'l' a lever   'I' an iron door (opens for good with both of you on the two levers at once)
//   enemies: 's' slime, 'm' big slime (splits in two), 'b' bat, 'k' skeleton (throws bones),
//   'W' the Stone Warden (the boss)
// Floors marked `long` are only in the full quest.
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
  {
    name: 'The Crypt',
    // You start shut in behind a gate: one stands on the plate while the other gets out, then
    // the plate outside lets the first one through. Spikes guard the key and the way down;
    // skeletons throw bones from a distance.
    map: [
      '####################',
      '#SS  #  k    ^^   K#',
      '#    #       ^^    #',
      '# P  G   P   ^^  s #',
      '#    #       ^^    #',
      '#############^^#####',
      '#  ^^^  #    ^^    #',
      '#  ^^^  D      k   #',
      '#       #          #',
      '#  E    #  b    ^^ #',
      '#       #       ^^ #',
      '####################',
    ],
  },
  {
    name: 'The Ice Caves',
    long: true,
    tip: 'the lake is ice (you slide), and big slimes split in two. Find the key, open the door, take the stairs',
    // A frozen lake in the middle: you slide on it (and the spikes in it don't wait for you to
    // stop). Big slimes split in two. The key's across the ice; the stairs behind a door.
    map: [
      '####################',
      '#SS  #~~~~~~~~~   K#',
      '#    #~~~~m~~~~    #',
      '#    #~~~~~~~~~ b  #',
      '#     ~~~~~~~~~    #',
      '#  m  ~~~~~~~~~#####',
      '######~~~^^~~~~#   #',
      '#     ~~~^^~~~~D E #',
      '#  b  ~~~~~~~~~#   #',
      '#     ~~~~m~~~~#   #',
      '#        ~~~~~ #   #',
      '####################',
    ],
  },
  {
    name: 'The Armory',
    long: true,
    tip: 'arrows fly across the hall on a beat (a shield stops them). Stand on the two levers at once to open the iron door',
    // Arrow traps in the west wall fire across two rows on a beat (the shield stops them). The
    // stairs are behind an iron door: one of you on each lever, at the same time, opens it.
    map: [
      '####################',
      '#SS     #     k   l#',
      '#       #          #',
      '>                  #',
      '#       #          #',
      '#####  ######  #####',
      '#   #          #   #',
      '>              #   #',
      '# l #          I E #',
      '#   #   k      #   #',
      '#              #   #',
      '####################',
    ],
  },
  {
    name: "The Warden's Hall",
    // The Stone Warden in the middle: pillars to dodge behind (and to make it charge into).
    // No stairs: beat it and the quest is won.
    map: [
      '####################',
      '#                  #',
      '#  ##        ##    #',
      '#  ##        ##    #',
      '#                  #',
      '#        W         #',
      '#                  #',
      '#    ##       ##   #',
      '#    ##       ##   #',
      '#                  #',
      '#        SS        #',
      '####################',
    ],
  },
];
