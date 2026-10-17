// COUNT 'EM! (server/games/minis/count-em.js) Sheep in a field; pick how many.
ArkMini.register('count-em', ArkMini.pickGame({
  cols: 2,
  question: function (s) {
    return '<div class="mi-field">' + s.sheep.map(function (p) {
      return '<span style="left:' + p.x * 100 + '%;top:' + p.y * 100 + '%">🐑</span>';
    }).join('') + '</div>';
  },
  labels: function (s) { return s.choices.map(String); },
  values: function (s) { return s.choices; },
  picked: function (s, slot) { return s.picks[slot]; },
  input: function (n) { return { type: 'pick', n: n }; },
}));
