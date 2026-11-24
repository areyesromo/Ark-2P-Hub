(function () {
  Ark.loadCss('/games/code-breaker/style.css');
  const ready = Ark.loadScript('/games/code-breaker/vault.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  /** One player's attempt on the other's vault. */
  function vault(v, slot) {
    const target = 1 - slot;
    const open = v.codes !== null;
    const active = v.phase === 'guess' && v.turn === slot;
    const cracked = v.guesses[slot].some(function (g) { return g.bulls === v.length; });
    let head;
    if (v.phase === 'set') head = v.ready[slot] ? 'Code set ✓' : 'Setting a code…';
    else head = nameOf(v, slot) + ' cracks ' + nameOf(v, target) + "'s code";
    return '<section class="cb-vault p' + (slot + 1) + (active ? ' active' : '') + (cracked ? ' cracked' : '') + '">' +
      '<header>' + (v.phase === 'set' ? nameOf(v, slot) + ' · ' : '') + head + '</header>' +
      '<div class="cb-door">' + ArkCode.wheels(open ? v.codes[target] : null, v.length, { hidden: !open }) + '</div>' +
      ArkCode.rows(v.guesses[slot], v.length, v.phase === 'set' ? 0 : Math.max(6, v.guesses[slot].length + 1)) +
      '<footer>' + (active ? 'Guessing…' + (v.timed && v.timeLeftMs ? ' ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's' : '') : cracked ? '<b>Cracked!</b>' : '') + '</footer></section>';
  }

  function caption(v) {
    if (v.phase === 'set') return 'Each of you set a secret code on your phone';
    if (v.phase === 'guess') return '<span class="cb-key"><i class="bull"></i> right digit, right place · <i class="cow"></i> right digit, wrong place</span>';
    const r = v.result;
    if (v.phase === 'over') return '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins the match</span>';
    if (r.winner === null) return r.both ? 'Both cracked it on the same go: level!' : 'Nobody cracked it in ten goes';
    return nameOf(v, r.winner) + ' cracked it first!';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="cb-caption">' + caption(v) + '</div><div class="cb-stage">' + vault(v, 0) + vault(v, 1) + '</div>';
  }

  Ark.register('host', 'code-breaker', {
    sounds: function (prev, v) {
      const n = function (x) { return x.guesses[0].length + x.guesses[1].length; };
      if (v.phase !== 'set' && prev.phase === 'set') return ['lock'];
      if (n(v) > n(prev)) {
        const last = v.guesses[0].length > prev.guesses[0].length ? v.guesses[0] : v.guesses[1];
        const g = last[last.length - 1];
        return [g.bulls === v.length ? 'fanfare' : g.bulls + g.cows ? 'tick' : 'wrong'];
      }
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'cb-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; render(); },
    unmount: function () { root = view = null; },
  });
})();
