(function () {
  Ark.loadCss('/games/word-race/style.css');
  const gridReady = Ark.loadScript('/games/word-race/grid.js');
  const esc = Ark.escapeHtml;
  const HIT = 0.38; // only the middle of a tile (this fraction of its size from the centre) counts, so diagonals are easy
  const REASONS = { again: 'Already found', short: 'Too short (3+ letters)', unknown: 'Not in the dictionary' };

  let root = null;
  let els = null;
  let api = null;
  let view = null;
  let loaded = false;
  let path = []; // the trace in progress
  let tracing = false;
  let lastPt = null; // where the finger was last seen, to fill in fast moves
  let lastFeedback = 0;
  let toastTimer = null;
  let gridKey = '';
  let textKey = '';

  // ---- tracing ----------------------------------------------------------------

  function tileAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const tile = el && el.closest && el.closest('.tile');
    if (!tile || !els.grid.contains(tile)) return -1;
    const r = tile.getBoundingClientRect();
    const dx = (x - (r.left + r.width / 2)) / r.width;
    const dy = (y - (r.top + r.height / 2)) / r.height;
    return Math.hypot(dx, dy) <= HIT ? Number(tile.getAttribute('data-i')) : -1;
  }

  function extend(i) {
    if (i < 0) return;
    const last = path[path.length - 1];
    if (i === last) return;
    if (i === path[path.length - 2]) {
      path.pop(); // slid back: undo the last letter
    } else if (path.indexOf(i) === -1 && (last === undefined || ArkWords.adjacent(last, i, view.size))) {
      path.push(i);
      api.vibrate(8);
    } else {
      return;
    }
    drawGrid();
  }

  /**
   * Follow the finger to (x, y). Browsers merge fast moves (one event per
   * frame), so walk the straight line from the last point in small steps:
   * otherwise a quick swipe can skip right over a tile.
   */
  function follow(x, y) {
    const tile = els.grid.querySelector('.tile');
    const step = tile ? tile.getBoundingClientRect().width / 5 : 10;
    const from = lastPt || { x: x, y: y };
    const n = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / step));
    for (let k = 1; k <= n; k++) extend(tileAt(from.x + ((x - from.x) * k) / n, from.y + ((y - from.y) * k) / n));
    lastPt = { x: x, y: y };
  }

  function followEvent(e) {
    const all = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    (all.length ? all : [e]).forEach(function (p) { follow(p.clientX, p.clientY); });
  }

  function onDown(e) {
    if (!canPlay()) return;
    e.preventDefault();
    if (els.grid.setPointerCapture) els.grid.setPointerCapture(e.pointerId);
    tracing = true;
    path = [];
    lastPt = null;
    follow(e.clientX, e.clientY);
  }

  function onMove(e) {
    if (tracing) followEvent(e);
  }

  function onUp(e) {
    if (!tracing) return;
    if (e && e.type === 'pointerup') follow(e.clientX, e.clientY);
    tracing = false;
    lastPt = null;
    if (path.length >= 2 && canPlay()) api.send({ type: 'word', path: path });
    path = [];
    drawGrid();
  }

  function canPlay() {
    return view && view.phase === 'play';
  }

  // ---- view -------------------------------------------------------------------

  function drawGrid() {
    if (!loaded || !view || !view.grid) {
      els.grid.innerHTML = '';
      els.word.textContent = '';
      gridKey = '';
      return;
    }
    const key = view.grid.join('') + '|' + path.join(',');
    if (key === gridKey) return;
    gridKey = key;
    els.grid.innerHTML = ArkWords.gridHtml(view.grid, view.size, [{ path: path, cls: 'me' }]);
    els.word.textContent = path.length ? ArkWords.spell(view.grid, path) : '';
  }

  function toast(text, ok) {
    els.toast.textContent = text;
    els.toast.className = 'wr-toast show ' + (ok ? 'ok' : 'bad');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.className = 'wr-toast'; }, 1400);
  }

  function myWords(v) {
    if (v.result) {
      return v.result.tally[v.you].map(function (w) {
        return '<li class="' + (w.shared ? 'shared' : '') + '">' + esc(w.word.toUpperCase()) + '<em>' + (w.shared ? '×' : '+' + w.points) + '</em></li>';
      }).join('');
    }
    return v.yourWords.slice().reverse().map(function (w) {
      return '<li>' + esc(w.word.toUpperCase()) + '<em>+' + w.points + '</em></li>';
    }).join('');
  }

  function status(v) {
    const you = v.you;
    if (v.phase === 'setup') return '<span class="big">Word Race</span><br>Pick the settings (either of you can), then start.';
    if (v.phase === 'countdown') return 'Get ready… ' + v.countdown + (loaded ? '<br><small>' + Ark.setup.summary(v, ArkWords.ROWS) + '</small>' : '');
    if (v.phase === 'play') {
      const pts = v.yourWords.reduce(function (s, w) { return s + w.points; }, 0);
      return v.yourWords.length + ' words · ' + pts + ' pts · ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's · them: ' + v.counts[1 - you];
    }
    if (v.result) {
      const r = v.result;
      const line = 'You ' + r.points[you] + ' – ' + r.points[1 - you] + ' them (shared words cancel)';
      if (v.phase === 'over') {
        if (v.draw) return '<span class="big">Draw! 🤝</span><br>' + line;
        return '<span class="big ' + (v.winner === you ? 'won' : 'lost') + '">' + (v.winner === you ? 'You win! 🏆' : 'You lose') + '</span><br>' + line;
      }
      return (r.winner === null ? 'Round drawn. ' : r.winner === you ? '<span class="won">Round to you! 🎉</span> ' : '<span class="lost">Round to them.</span> ') + line;
    }
    return '';
  }

  function render(v) {
    const fb = v.feedback;
    if (fb && fb.seq !== lastFeedback) {
      lastFeedback = fb.seq;
      if (fb.ok) toast('✓ ' + fb.word.toUpperCase() + ' +' + fb.points, true);
      else toast(fb.word.toUpperCase() + ': ' + REASONS[fb.reason], false);
      api.vibrate(fb.ok ? 30 : [20, 40, 20]);
    }
    if (!view || view.round !== v.round) path = [];
    view = v;
    drawGrid();
    const key = JSON.stringify([v.phase, v.round, v.countdown, Math.ceil(v.timeLeftMs / 1000), v.yourWords.length, v.counts, v.scores, Boolean(v.result), v.settings, loaded]);
    if (key === textKey) return;
    textKey = key;
    const setup = v.phase === 'setup';
    els.score.textContent = setup ? '' : 'You ' + v.scores[v.you] + ' – ' + v.scores[1 - v.you] + ' Them' +
      (v.settings.rounds > 1 ? ' · best of ' + v.settings.rounds : '') + ' · round ' + v.round;
    els.status.innerHTML = status(v);
    els.setup.innerHTML = setup && loaded ? Ark.setup.html(v, ArkWords.ROWS) : '';
    els.go.classList.toggle('hidden', !setup);
    els.words.innerHTML = myWords(v);
    els.hint.classList.toggle('hidden', v.phase !== 'play' || v.yourWords.length > 0);
    els.rematch.classList.toggle('hidden', v.phase !== 'over');
    els.change.classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'word-race', {
    // Setup and the end screen are menus: pinch zoom stays on.
    zoomable: function (v) { return v.phase === 'setup' || v.phase === 'over'; },
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'wr-phone';
      root.innerHTML =
        '<div class="score"></div>' +
        '<div class="status"></div>' +
        '<div class="wr-setup-box"></div>' +
        '<button class="primary go hidden">Start</button>' +
        '<div class="wr-word"></div>' +
        '<div class="wr-pad"></div>' +
        '<p class="hint">Swipe across touching letters, then lift your finger.</p>' +
        '<div class="wr-toast"></div>' +
        '<ul class="wr-words"></ul>' +
        '<button class="primary rematch hidden">Rematch</button>' +
        '<button class="ghost change hidden">Change settings</button>';
      el.appendChild(root);
      els = {
        score: root.querySelector('.score'),
        status: root.querySelector('.status'),
        word: root.querySelector('.wr-word'),
        grid: root.querySelector('.wr-pad'),
        hint: root.querySelector('.hint'),
        toast: root.querySelector('.wr-toast'),
        words: root.querySelector('.wr-words'),
        rematch: root.querySelector('.rematch'),
        change: root.querySelector('.change'),
        setup: root.querySelector('.wr-setup-box'),
        go: root.querySelector('.go'),
      };
      els.grid.addEventListener('pointerdown', onDown);
      els.grid.addEventListener('pointermove', onMove);
      els.grid.addEventListener('pointerup', onUp);
      els.grid.addEventListener('pointercancel', onUp);
      els.rematch.addEventListener('click', function () { api.send({ type: 'rematch' }); });
      els.change.addEventListener('click', function () { api.send({ type: 'setup' }); });
      els.go.addEventListener('click', function () { api.send({ type: 'go' }); });
      Ark.setup.bind(els.setup, api);
      gridReady.then(function () {
        loaded = true;
        if (view) {
          textKey = '';
          render(view);
        }
      });
    },
    update: render,
    unmount: function () {
      clearTimeout(toastTimer);
      root = els = view = null;
      path = [];
      tracing = false;
      lastFeedback = 0;
      gridKey = textKey = '';
    },
  });
})();
