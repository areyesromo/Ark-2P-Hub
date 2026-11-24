// In the 1 player mode (view.solo) the game is Anagram Rush: its screens are in rush.js (ArkRush).
(function () {
  Ark.loadCss('/games/anagram-duel/style.css');
  const rushReady = Ark.loadScript('/games/anagram-duel/rush.js');
  let rush = null; // { el, view }: handing over to Anagram Rush's screen
  const esc = Ark.escapeHtml;
  let root = null;
  let key = '';

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  // How far along each player is with their word (just how many letters, not which).
  function lane(v, slot) {
    let dots = '';
    for (let i = 0; i < 5; i++) dots += '<span class="dot' + (i < v.progress[slot] ? ' on' : '') + '"></span>';
    return '<div class="ad-lane p' + (slot + 1) + '">' + nameOf(v, slot) + '<span class="dots">' + dots + '</span></div>';
  }

  function middle(v) {
    if (v.phase === 'countdown') return '<div class="big">Round ' + v.round + '</div><div class="sub">Get your fingers ready…</div>';
    if (v.phase === 'play') {
      return '<div class="ad-tiles">' + v.letters.map(function (c) { return '<span class="ad-tile">' + esc(c.toUpperCase()) + '</span>'; }).join('') + '</div>' +
                // Views only come when something happens, so the bar runs down by itself from the time left.
        '<div class="ad-bar"><span style="width:' + (100 * v.timeLeft) / v.roundMs + '%;animation-duration:' + v.timeLeft + 'ms"></span></div>' +
        '<div class="ad-lanes">' + lane(v, 0) + lane(v, 1) + '</div>' +
        '<div class="sub">Make a word with all five letters on your phone. Any real word counts.</div>';
    }
    const r = v.result;
    let line = '';
    if (r && r.winner !== null) {
      line = '<div class="big">' + esc(r.word.toUpperCase()) + '</div><div class="sub">' + nameOf(v, r.winner) + ' got it' +
        (r.word !== r.answer ? ' <span class="muted">(it was dealt as ' + esc(r.answer.toUpperCase()) + ')</span>' : '') + '</div>';
    } else if (r) {
      line = '<div class="big muted">' + esc(r.answer.toUpperCase()) + '</div><div class="sub">Nobody found it in time. No point.</div>';
    }
    if (v.phase === 'over') {
      line += '<div class="ad-over"><span class="ark-result">🏆 ' + nameOf(v, v.winner) + ' wins ' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '!</span>' +
        '<div class="sub">' + [0, 1].map(function (s) { return nameOf(v, s) + ': fastest ' + (v.fastest[s] === null ? '–' : (v.fastest[s] / 1000).toFixed(1) + ' s'); }).join(' · ') + '</div>' +
        '<div class="sub">Rematch or head back to the lobby from your phones.</div></div>';
    }
    return line;
  }

  const duel = {
    sounds: function (prev, v) {
      if (v.phase === 'play' && prev.phase !== 'play') return ['go'];
      if (v.phase !== prev.phase && v.result && prev.phase === 'play') return [v.result.winner === null ? 'wrong' : 'correct'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'ad-host';
      el.appendChild(root);
    },
    update: function (v) {
      const k = JSON.stringify([v.phase, v.round, v.scores, v.letters, v.progress, v.result]);
      if (k === key) return;
      key = k;
      root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) + '<div class="ad-main">' + middle(v) + '</div>';
    },
    unmount: function () {
      root = null;
      key = '';
    },
  };

  /** 1 player: show Anagram Rush's screen in place of the duel's (once the script is in). */
  function toRush(v) {
    if (!rush) return false;
    rush.view = v;
    if (!rush.on && window.ArkRush) {
      rush.on = true;
      duel.unmount();
      rush.el.innerHTML = '';
      ArkRush.host.mount(rush.el, rush.api);
    }
    if (rush.on) ArkRush.host.update(v);
    return true;
  }
  const solo = (v) => Boolean(v && v.solo && window.ArkRush);

  Ark.register('host', 'anagram-duel', Object.assign({}, duel, {
    mount: function (el, api) {
      rush = { el: el, api: api, on: false, view: null };
      duel.mount(el, api);
      rushReady.then(function () { if (rush && rush.view && rush.view.solo) toRush(rush.view); });
    },
    update: function (v) {
      if (v.solo) return toRush(v);
      duel.update(v);
    },
    unmount: function () {
      if (rush && rush.on) ArkRush.host.unmount();
      else duel.unmount();
      rush = null;
    },
    sounds: function (prev, v) { return solo(v) ? ArkRush.host.sounds(prev, v) : prev.solo ? [] : duel.sounds(prev, v); },
    padHint: '1 player: left / right pick a letter · A use it · B take one back · Y skip (−3 s) · keyboard: just type, Tab skips',
    pad: function (btn, v) { return solo(v) ? ArkRush.host.pad(btn, v) : null; },
    typing: function (k, v) { return solo(v) ? ArkRush.host.typing(k, v) : null; },
    overHtml: function (v) { return solo(v) ? ArkRush.host.overHtml(v) : ''; },
  }));
})();
