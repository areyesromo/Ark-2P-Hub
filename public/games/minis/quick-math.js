// QUICK MATH! (server/games/minis/quick-math.js)
ArkMini.register('quick-math', ArkMini.pickGame({
  cols: 2,
  question: function (s) { return '<div class="mi-sum">' + s.q + ' = ?</div>'; },
  labels: function (s) { return s.choices.map(String); },
  values: function (s) { return s.choices; },
  picked: function (s, slot) { return s.picks[slot]; },
  input: function (n) { return { type: 'pick', n: n }; },
}));
