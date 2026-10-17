// ODD ONE OUT! (server/games/minis/odd-one.js)
ArkMini.register('odd-one', ArkMini.pickGame({
  cols: 3,
  question: function () { return ''; },
  labels: function (s) { return s.cells; },
  values: function (s) { return s.cells.map(function (_, i) { return i; }); },
  picked: function (s, slot) { return s.picks[slot]; },
  input: function (i) { return { type: 'pick', i: i }; },
}));
