// In the 1 player mode (view.solo) the game is Mastermind: its screens are in pegs.js (ArkMastermind).
(function () {
  const soloReady = Ark.loadScript('/games/code-breaker/pegs.js');
  let alone = null; // { el, api, on, view }: handing over to Mastermind' screen
  Ark.loadCss('/games/code-breaker/style.css');
  const ready = Ark.loadScript('/games/code-breaker/vault.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);
  const clock = () => '<b class="ark-clock">' + secsLeft() + 's</b>';
  function ticking() {
    tick = setInterval(function () {
      if (root) root.querySelectorAll('.ark-clock').forEach(function (c) { c.textContent = secsLeft() + 's'; });
    }, 250);
  }

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
      '<footer>' + (active ? 'Guessing…' + (v.timed && v.timeLeftMs ? ' ⏱ ' + clock() : '') : cracked ? '<b>Cracked!</b>' : '') + '</footer></section>';
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

  const duel = {
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
      ticking();
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = view = null; },
  };

  /** 1 player: show Mastermind' screen in place of the 2 player one (once the script is in). */
  function toSolo(v) {
    if (!alone) return false;
    alone.view = v;
    if (!alone.on && window.ArkMastermind) {
      alone.on = true;
      duel.unmount();
      alone.el.innerHTML = '';
      ArkMastermind.host.mount(alone.el, alone.api);
    }
    if (alone.on) ArkMastermind.host.update(v);
    return true;
  }
  const solo = (v) => Boolean(v && v.solo && window.ArkMastermind);

  Ark.register('host', 'code-breaker', Object.assign({}, duel, {
    mount: function (el, api) {
      alone = { el: el, api: api, on: false, view: null };
      duel.mount(el, api);
      soloReady.then(function () { if (alone && alone.view && alone.view.solo) toSolo(alone.view); });
    },
    update: function (v) {
      if (v.solo) return toSolo(v);
      duel.update(v);
    },
    unmount: function () {
      if (alone && alone.on) ArkMastermind.host.unmount();
      else duel.unmount();
      alone = null;
    },
    sounds: function (prev, v) { return solo(v) ? (ArkMastermind.host.sounds ? ArkMastermind.host.sounds(prev, v) : []) : prev.solo ? [] : duel.sounds ? duel.sounds(prev, v) : []; },
    padHint: duel.padHint || '← → pick a peg · ↑ ↓ its colour · A guess · B clear the peg · keyboard: type 1–8, Enter to guess',
    pad: function (btn, v, slot) { return solo(v) ? (ArkMastermind.host.pad ? ArkMastermind.host.pad(btn, v) : null) : duel.pad ? duel.pad(btn, v, slot) : null; },
    typing: function (k, v) { return solo(v) ? (ArkMastermind.host.typing ? ArkMastermind.host.typing(k, v) : null) : duel.typing ? duel.typing(k, v) : null; },
    overHtml: function (v) { return solo(v) ? (ArkMastermind.host.overHtml ? ArkMastermind.host.overHtml(v) : '') : duel.overHtml ? duel.overHtml(v) : ''; },
  }));
})();
