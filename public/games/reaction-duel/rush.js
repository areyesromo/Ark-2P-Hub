// Reaction Rush, the 1 player mode of Reaction Duel (server/games/reaction-duel.js, view.solo): the TV's
// and the phone's screens. Reaction Duel's renderers hand over to these (window.ArkReactionRush).
(function () {
  // ---- the TV ----
  const host = (function () {


    let root = null;
    let screen = null;
    let list = null;
    let key = '';

    function render(v) {
      const k = [v.phase, v.round, v.times.join(','), v.falseStarts].join('|');
      if (k === key) return;
      key = k;
      let big = '';
      let sub = '';
      if (v.phase === 'ready') {
        big = 'Get ready';
        sub = 'Tap the moment the screen turns green. Not before!';
      } else if (v.phase === 'wait') {
        big = 'Wait…';
        sub = 'Round ' + v.round + ' of ' + v.rounds;
      } else if (v.phase === 'go') {
        big = 'TAP!';
      } else if (v.phase === 'early') {
        big = 'Too soon!';
        sub = '+' + v.penaltyMs + ' ms. This round starts again.';
      } else if (v.phase === 'result') {
        big = v.last.ms + ' ms';
        sub = v.last.ms >= 2000 ? 'Too slow' : v.last.ms < 220 ? '⚡ Lightning!' : v.last.ms < 300 ? 'Quick!' : 'OK';
      } else if (v.phase === 'over') {
        big = '⏱';
      }
      screen.className = 'reaction-screen ' + v.phase;
      screen.innerHTML = '<div class="big">' + big + '</div><div class="sub">' + sub + '</div>';
      let rows = '';
      for (let i = 0; i < v.rounds; i++) {
        const t = v.times[i];
        rows += '<li class="' + (t === undefined ? 'todo' : '') + '">' + (t === undefined ? '·' : t + ' ms') + '</li>';
      }
      list.innerHTML = rows + (v.falseStarts ? '<li class="early">' + v.falseStarts + ' false start' + (v.falseStarts > 1 ? 's' : '') + ' · +' + v.falseStarts * v.penaltyMs + ' ms</li>' : '');
    }


    return {
      sounds: function (prev, v) {
        if (v.phase === 'go' && prev.phase !== 'go') return ['go'];
        if (v.phase === 'early' && prev.phase !== 'early') return ['wrong'];
        if (v.phase === 'result' && prev.phase === 'go') return ['point'];
        return [];
      },
      padHint: 'Any face button, a trigger or Enter / Space: tap',
      pad: function (btn) {
        return ['A', 'B', 'X', 'Y', 'LT', 'RT', 'LB', 'RB'].indexOf(btn) !== -1 ? { type: 'tap' } : null;
      },
      overHtml: function (v) {
        return 'Average ' + v.average + ' ms · fastest ' + v.fastest + ' ms' + (v.falseStarts ? ' · +' + v.falseStarts * v.penaltyMs + ' ms for false starts' : '');
      },
      mount: function (el) {
        root = document.createElement('div');
        root.className = 'reaction-host';
        root.innerHTML = '<div class="reaction-screen"></div><ol class="reaction-times"></ol>';
        el.appendChild(root);
        screen = root.querySelector('.reaction-screen');
        list = root.querySelector('.reaction-times');
      },
      update: render,
      unmount: function () {
        root = screen = list = null;
        key = '';
      },
};
  })();

  // ---- the phone ----
  const player = (function () {


    let root = null;
    let btn = null;
    let api = null;
    let key = '';

    function render(v) {
      const k = v.phase + '|' + v.round;
      if (k === key) return;
      key = k;
      const label = { ready: 'Get ready…', wait: 'Wait for green…', go: 'TAP!', early: 'Too soon!', result: (v.last && v.last.ms) + ' ms', over: '' }[v.phase] || '';
      btn.className = 'reaction-tap ' + v.phase;
      btn.innerHTML = '<span class="big">' + label + '</span><span class="sub">Round ' + v.round + ' of ' + v.rounds + '</span>';
      if (v.phase === 'go') api.vibrate(40);
      if (v.phase === 'early') api.vibrate([80, 40, 80]);
    }


    return {
      mount: function (el, a) {
        api = a;
        root = document.createElement('div');
        root.className = 'reaction-phone';
        root.innerHTML = '<button class="reaction-tap"></button>';
        el.appendChild(root);
        btn = root.querySelector('.reaction-tap');
        // On touch-down: every millisecond counts here.
        btn.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          api.send({ type: 'tap' });
        });
      },
      update: render,
      unmount: function () {
        root = btn = null;
        key = '';
      },
};
  })();

  window.ArkReactionRush = { host: host, player: player };
})();
