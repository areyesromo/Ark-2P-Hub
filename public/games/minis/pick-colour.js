// PICK THE COLOUR! (server/games/minis/pick-colour.js) A colour's name in another colour's ink:
// pick the ink. The choices are blocks of colour, no names (the names are the trap).
(function () {
  // Same as COLOURS in server/games/minis/pick-colour.js (the colours are the thing itself).
  const COLOURS = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#facc15', purple: '#a855f7', orange: '#f97316' };
  ArkMini.register('pick-colour', ArkMini.pickGame({
    cols: 2,
    question: function (s) { return '<div class="mi-word" style="color:' + COLOURS[s.ink] + '">' + s.word.toUpperCase() + '</div>'; },
    labels: function (s) { return s.choices.map(function (c) { return '<i class="mi-swatch" style="background:' + COLOURS[c] + '"></i>'; }); },
    values: function (s) { return s.choices; },
    picked: function (s, slot) { return s.picks[slot]; },
    input: function (c) { return { type: 'pick', c: c }; },
  }));
})();
