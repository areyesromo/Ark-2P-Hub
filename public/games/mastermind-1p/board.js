// Mastermind's rows of pegs, drawn the same way on the TV and the phone. Every colour
// has a number too (and the keyboard types it), so the pegs tell apart without colour.
(function () {
  // The pegs' colours are the pegs themselves.
  const COLOURS = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];

  function peg(c, extra) {
    if (c === null || c === undefined || c < 0) return '<span class="mm1-peg empty' + (extra || '') + '"></span>';
    return '<span class="mm1-peg' + (extra || '') + '" style="--c:' + COLOURS[c] + '">' + (c + 1) + '</span>';
  }

  /** The little black and white pins that say how a guess did. */
  function pins(g, n) {
    let out = '<span class="mm1-pins" style="--n:' + Math.ceil(n / 2) + '">';
    for (let i = 0; i < n; i++) out += '<i class="' + (i < g.exact ? 'black' : i < g.exact + g.colour ? 'white' : '') + '"></i>';
    return out + '</span>';
  }

  /** The guesses so far, then (for the one building a guess) the row being made. */
  function rows(v, draft, cursor) {
    let out = '<div class="mm1-rows">';
    for (let r = 0; r < v.maxGuesses; r++) {
      const g = v.guesses[r];
      const building = !g && draft && r === v.guesses.length && v.phase === 'play';
      out += '<div class="mm1-row' + (g ? ' done' : '') + (building ? ' now' : '') + '"><span class="no">' + (r + 1) + '</span><span class="pegs">';
      for (let i = 0; i < v.pegs; i++) {
        out += peg(g ? g.pegs[i] : building ? draft[i] : -1, building && cursor === i ? ' cursor' : '');
      }
      out += '</span>' + (g ? pins(g, v.pegs) : '<span class="mm1-pins"></span>') + '</div>';
    }
    return out + '</div>';
  }

  /** The secret code, once the run is over. */
  function code(v) {
    if (!v.code) return '';
    return '<div class="mm1-code">' + (v.won ? '🎉 Cracked it' : 'The code was') + '<span class="pegs">' + v.code.map(function (c) { return peg(c); }).join('') + '</span></div>';
  }

  window.ArkMaster = { COLOURS: COLOURS, peg: peg, rows: rows, code: code };
})();
