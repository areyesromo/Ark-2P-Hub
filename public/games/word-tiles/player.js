(function () {
  Ark.loadCss('/games/word-tiles/style.css');
  const ready = Ark.loadScript('/games/word-tiles/board.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let order = []; // the rack in your own order (indexes into view.rack)
  let picked = null; // a rack place picked to lay
  let pending = {}; // cell → rack place, laid this turn
  let swapping = false;
  let swapPick = {};
  let passArmed = false;

  const rackLetter = (i) => view.rack[i];

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (v.phase !== 'play' || v.turn !== v.you) return;
    const r = e.target.closest('[data-r]');
    if (r) {
      const i = Number(r.getAttribute('data-r'));
      if (swapping) swapPick[i] = !swapPick[i];
      else picked = picked === i ? null : i;
      api.vibrate(8);
      return render();
    }
    const sq = e.target.closest('[data-c]');
    if (sq && !swapping) {
      const c = Number(sq.getAttribute('data-c'));
      if (pending[c] !== undefined) { delete pending[c]; return render(); } // back to the rack
      if (picked !== null) { pending[c] = picked; picked = null; api.vibrate(8); return render(); }
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.getAttribute('data-act');
    if (act === 'play') {
      const tiles = Object.keys(pending).map(function (c) { return { cell: Number(c), letter: rackLetter(pending[c]) }; });
      if (tiles.length) { api.send({ type: 'play', tiles: tiles }); api.vibrate(20); }
    } else if (act === 'recall') { pending = {}; picked = null; } else if (act === 'mix') {
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    } else if (act === 'swap') {
      if (!swapping) { swapping = true; swapPick = {}; pending = {}; picked = null; } else {
        const letters = Object.keys(swapPick).filter(function (i) { return swapPick[i]; }).map(function (i) { return rackLetter(Number(i)); });
        if (letters.length) api.send({ type: 'swap', letters: letters });
        swapping = false;
      }
    } else if (act === 'cancel') { swapping = false; } else if (act === 'pass') {
      if (!passArmed) { passArmed = true; setTimeout(function () { passArmed = false; render(); }, 3000); } else { passArmed = false; api.send({ type: 'pass' }); }
    }
    render();
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over' || v.phase === 'roundEnd') {
      const r = v.result;
      if (r.winner === null) return 'Level!';
      const won = r.winner === me;
      return '<span class="' + (won ? 'won' : 'lost') + (v.phase === 'over' ? ' big ark-result' : '') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</span> ' + r.points[me] + ' to ' + r.points[1 - me];
    }
    if (v.rejected && v.rejected.n === v.n) return '<span class="bad">' + Ark.escapeHtml(v.rejected.reason) + '</span>';
    if (v.turn !== me) {
      const p = v.lastPlay;
      return p && p.kind === 'play' && p.by !== me ? 'They played ' + p.words.map(function (w) { return w.word.toUpperCase(); }).join(', ') + ' for ' + p.score : 'Their turn…';
    }
    if (swapping) return 'Tap the tiles to swap, then Swap';
    return picked !== null ? 'Tap a square for it' : '<strong>Your turn!</strong> Tap a tile, then a square';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'play' && v.turn === me;
    const laid = {};
    Object.keys(pending).forEach(function (c) { laid[pending[c]] = true; });
    const pendingLetters = {};
    Object.keys(pending).forEach(function (c) { pendingLetters[c] = rackLetter(pending[c]); });
    let html = '<div class="wt-ptop"><span>You <b>' + v.points[me] + '</b></span><span>bag ' + v.bag + '</span><span>Them <b>' + v.points[1 - me] + '</b></span></div>' +
      '<p class="wt-msg">' + message(v) + '</p>' + ArkTiles.boardHtml(v, { pending: pendingLetters, tap: mine && !swapping });
    if (v.rack) {
      html += '<div class="wt-rack">' + order.filter(function (i) { return i < v.rack.length; }).map(function (i) {
        const cls = (picked === i || swapPick[i] ? 'on' : '') + (laid[i] ? ' used' : '');
        return '<button type="button" data-r="' + i + '" class="' + cls + '">' + ArkTiles.tileHtml(v.rack[i]) + '</button>';
      }).join('') + '</div>';
    }
    if (mine) {
      html += swapping
        ? '<div class="wt-buttons"><button type="button" class="wt-play" data-act="swap"' + (v.bag >= 7 ? '' : ' disabled') + '>Swap</button><button type="button" data-act="cancel">Back</button></div>'
        : '<div class="wt-buttons"><button type="button" class="wt-play" data-act="play"' + (Object.keys(pending).length ? '' : ' disabled') + '>Play</button>' +
          '<button type="button" data-act="recall">Back</button><button type="button" data-act="mix">Mix</button>' +
          '<button type="button" data-act="swap"' + (v.bag >= 7 ? '' : ' disabled') + '>Swap</button>' +
          '<button type="button" data-act="pass" class="' + (passArmed ? 'armed' : '') + '">' + (passArmed ? 'Sure?' : 'Pass') + '</button></div>';
    }
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'word-tiles', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'wt-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      // A new rack (a play went down, or a swap): start the layout afresh.
      if (!prev || prev.n !== v.n || (v.rack && order.length !== v.rack.length)) {
        if (!(v.rejected && v.rejected.n === v.n)) { pending = {}; picked = null; }
        order = v.rack ? v.rack.map(function (_, i) { return i; }) : [];
        swapping = false;
        swapPick = {};
      }
      if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      render();
      Ark.phoneClock(v.phase === 'play' && v.turn === v.you && v.timed ? v.timeLeftMs : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = view = null; pending = {}; picked = null; order = []; },
  });
})();
