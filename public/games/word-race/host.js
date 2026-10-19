(function () {
  Ark.loadCss('/games/word-race/style.css');
  const gridReady = Ark.loadScript('/games/word-race/grid.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let viewAt = 0;
  let loaded = false;
  let raf = null;
  let textKey = '';

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function wordList(v, slot) {
    const t = v.result.tally[slot];
    if (!t.length) return '<p class="muted">No words</p>';
    return '<ul>' + t.map(function (w) {
      return '<li class="' + (w.shared ? 'shared' : '') + '">' + esc(w.word.toUpperCase()) + '<em>' + (w.shared ? '×' : '+' + w.points) + '</em></li>';
    }).join('') + '</ul>';
  }

  function side(v, slot) {
    let body;
    if (v.phase === 'setup') {
      body = '<div class="muted">📱 phone</div>';
    } else if (v.result) {
      body = '<div class="pts">' + v.result.points[slot] + ' pts</div>' + wordList(v, slot);
    } else {
      body = '<div class="count">' + v.counts[slot] + '</div><div class="muted">word' + (v.counts[slot] === 1 ? '' : 's') + ' found</div>';
    }
    return '<div class="wr-side p' + (slot + 1) + '"><div class="name">' + nameOf(v, slot) + '</div>' + body + '</div>';
  }

  function setup(v) {
    return '<div class="wr-center"><div class="wr-banner">Set up the match</div>' + Ark.setup.html(v, ArkWords.ROWS) +
      '<div class="sub">Change it on your phone. <strong>Start</strong> when you\'re both ready.</div></div>';
  }

  function middle(v) {
    if (v.phase === 'setup') return loaded ? setup(v) : '';
    if (v.phase === 'countdown') {
      return '<div class="wr-center"><div class="big">' + (v.countdown || '') + '</div><div class="sub">Round ' + v.round +
        ': find words by joining touching letters. Words you both find cancel out!</div>' +
        (loaded ? '<div class="sub">' + Ark.setup.summary(v, ArkWords.ROWS) + '</div>' : '') + '</div>';
    }
    if (!loaded || !v.grid) return '';
    let banner = '';
    if (v.phase === 'reveal' || v.phase === 'over') {
      const r = v.result;
      banner = r.winner === null ? 'Round ' + v.round + ': a draw!' : nameOf(v, r.winner) + ' takes round ' + v.round + '!';
      if (v.phase === 'over') {
        banner = v.draw ? "🤝 It's a draw!" : '🏆 ' + nameOf(v, v.winner) + ' wins the match!';
        banner += '<div class="sub">Rematch, change the settings or head back to the lobby from your phones.</div>';
      }
      banner = '<div class="wr-banner">' + banner + '<div class="sub">' + v.possible + ' words were hiding in this grid</div></div>';
    }
    return ArkWords.gridHtml(v.grid, v.size) + '<div class="wr-bar"><div class="fill"></div></div>' + banner;
  }

  function render() {
    if (!root || !view) return;
    const v = view;
    const key = JSON.stringify([v.phase, v.round, v.countdown, v.counts, v.scores, Boolean(v.result), v.settings, loaded]);
    if (key === textKey) return;
    textKey = key;
    root.innerHTML =
      Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="wr-main">' + side(v, 0) + '<div class="wr-mid">' + middle(v) + '</div>' + side(v, 1) + '</div>';
  }

  // The clock bar runs smoothly between the once-a-second views.
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!root || !view) return;
    const bar = root.querySelector('.wr-bar .fill');
    if (!bar) return;
    const frac = view.phase === 'play' ? Math.max(0, view.timeLeftMs - (performance.now() - viewAt)) / view.playMs : 0;
    bar.style.width = (frac * 100).toFixed(2) + '%';
    bar.classList.toggle('low', frac < 0.15);
  }

  Ark.register('host', 'word-race', {
    // Sound: a blip for every word found, a chime when the words are revealed.
    sounds: function (prev, v) {
      const out = [];
      if (v.phase === 'play' && v.counts[0] + v.counts[1] > prev.counts[0] + prev.counts[1]) out.push('eat');
      if (v.phase === 'reveal' && prev.phase !== 'reveal') out.push('reveal');
      return out;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'wr-host';
      el.appendChild(root);
      raf = requestAnimationFrame(tick);
      gridReady.then(function () {
        loaded = true;
        render();
      });
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      render();
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = view = null;
      textKey = '';
    },
  });
})();
