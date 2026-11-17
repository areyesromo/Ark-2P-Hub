// The hub's looks, and a small picture of each (Settings and the TV's theme picker): the themes
// (colours and fonts, public/shared/themes/) and the layouts (how the lobby is arranged,
// public/shared/layouts/), picked apart. The pictures' styles are in theme-previews.css.
(function () {
  const THEMES = [
    { id: 'default', name: 'Default', note: 'the original look, dark blue with the two players\' colours' },
    { id: 'neon', name: 'Neon', note: 'scoreboard letters and the two players\' colours, on a split court' },
    { id: 'cozy', name: 'Cozy', note: 'warm wood and paper, players as game pieces' },
  ];
  const LAYOUTS = [
    { id: 'classic', name: 'Classic', note: 'the QR code, the two seats and a grid of games' },
    { id: 'versus', name: 'Versus', note: 'the two players face to face, big names, the games as a running order' },
    { id: 'shelf', name: 'Shelf', note: 'games as boxes on a shelf, the chosen one pulled out' },
  ];

  function themeMini(id) {
    const cap = id === 'neon' ? function (s) { return s.toUpperCase(); } : function (s) { return s; };
    return '<span class="mini mini-' + id + '" aria-hidden="true"><b class="t"><i class="a">ARK</i> <i class="b">2P</i></b>' +
      '<span class="s s1">' + cap('Ana') + '</span>' + (id === 'neon' ? '<span class="vs">VS</span>' : '') + '<span class="s s2">' + cap('Ben') + '</span>' +
      '<span class="g"></span><span class="g"></span><span class="g"></span></span>';
  }

  // A layout's picture: the lobby's parts as blocks (in the page's own colours).
  function layoutMini(id) {
    let parts;
    if (id === 'classic') {
      parts = '<i class="q"></i><i class="st p1" style="left:42%;top:10%"></i><i class="st p2" style="left:71%;top:10%"></i>' +
        [0, 1, 2, 3, 4, 5].map(function (k) { return '<i class="bx" style="left:' + (42 + (k % 3) * 19.3) + '%;top:' + (44 + Math.floor(k / 3) * 26) + '%"></i>'; }).join('');
    } else if (id === 'versus') {
      parts = '<i class="court"></i><i class="name p1" style="left:6%">Ana</i><i class="vs">VS</i><i class="name p2" style="right:6%">Ben</i>' +
        [0, 1, 2, 3, 4, 5].map(function (k) { return '<i class="row' + (k ? '' : ' on') + '" style="left:' + (6 + (k % 3) * 30) + '%;top:' + (62 + Math.floor(k / 3) * 17) + '%"></i>'; }).join('');
    } else {
      parts = '<i class="piece p1" style="left:30%"></i><i class="pname" style="left:40%">Ana</i><i class="piece p2" style="left:62%"></i><i class="pname" style="left:72%">Ben</i>' +
        [0, 1, 2, 3, 4, 5, 6, 7].map(function (k) {
          return k === 3 ? '<i class="front" style="left:' + (8 + k * 8) + '%"></i>' : '<i class="spine s' + (k % 4) + '" style="left:' + (8 + k * 8 + (k > 3 ? 17 : 0)) + '%;height:' + [38, 32, 36, 34][k % 4] + '%"></i>';
        }).join('') + '<i class="plank"></i>';
    }
    return '<span class="mini lay lay-' + id + '" aria-hidden="true">' + parts + '</span>';
  }

  window.ArkLooks = { themes: THEMES, layouts: LAYOUTS, themeMini: themeMini, layoutMini: layoutMini };
})();
