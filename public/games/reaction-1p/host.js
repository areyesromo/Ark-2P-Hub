(function () {
  Ark.loadCss('/games/reaction-1p/style.css');

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

  Ark.register('host', 'reaction-1p', {
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
  });
})();
