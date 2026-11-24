// In the 1 player mode (view.solo) the game is Anagram Rush: its screens are in rush.js (ArkRush).
(function () {
  Ark.loadCss('/games/anagram-duel/style.css');
  const rushReady = Ark.loadScript('/games/anagram-duel/rush.js');
  let rush = null; // { el, view }: handing over to Anagram Rush's screen
  const esc = Ark.escapeHtml;
  let root = null;
  let api = null;
  let view = null;
  let round = '';
  let picks = []; // which letters, in order
  let shake = 0;
  let lockTimer = null;
  let viewAt = 0; // when the view came: picking letters redraws without a new one

  // A new set of letters, or a wrong word, clears what's been picked.
  function roundKey(v) {
    return v.round + '|' + (v.letters ? v.letters.join('') : '') + '|' + (v.feedback ? v.feedback.n : 0);
  }

  function setPicks(list, quiet) {
    picks = list;
    if (!quiet) api.send({ type: 'progress', n: picks.length });
    render();
  }

  function tiles(v, locked) {
    let word = '<div class="ad-word">';
    for (let k = 0; k < v.letters.length; k++) word += '<span class="ad-slot' + (k < picks.length ? ' full' : '') + '">' + (k < picks.length ? esc(v.letters[picks[k]].toUpperCase()) : '') + '</span>';
    word += '</div>';
    let row = '<div class="ad-tiles' + (locked ? ' locked' : '') + '">';
    v.letters.forEach(function (c, i) {
      row += '<button type="button" class="ad-tile' + (picks.indexOf(i) !== -1 ? ' used' : '') + '" data-i="' + i + '">' + esc(c.toUpperCase()) + '</button>';
    });
    return word + row + '</div>';
  }

  function render() {
    const v = view;
    if (!root || !v) return;
    const you = v.you;
    const score = '<div class="score">You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them</div>';
    let html = '';
    if (v.phase === 'countdown') html = '<div class="big">Round ' + v.round + '</div><div class="sub">Get ready…</div>';
    else if (v.phase === 'play') {
      const locked = v.lockedFor > 0;
      // Runs down by itself: views only come when something happens.
      const left = Math.max(0, v.timeLeft - (Date.now() - viewAt));
      html = '<div class="ad-bar"><span style="width:' + (100 * left) / v.roundMs + '%;animation-duration:' + left + 'ms"></span></div>' + tiles(v, locked) +
        '<div class="msg">' + (locked ? '<span class="no">✗ ' + esc(v.feedback.word.toUpperCase()) + ' isn\'t a word · wait…</span>' : 'Use all five letters') + '</div>' +
        '<button class="ghost back"' + (picks.length ? '' : ' disabled') + '>⌫ Back</button>';
    } else {
      const r = v.result;
      if (r && r.winner !== null) html = '<div class="big ' + (r.winner === you ? 'won' : 'lost') + '">' + (r.winner === you ? 'Got it! ' : 'Too slow: ') + esc(r.word.toUpperCase()) + '</div>';
      else if (r) html = '<div class="big">' + esc(r.answer.toUpperCase()) + '</div><div class="sub">Nobody found it</div>';
      if (v.phase === 'over') html += '<div class="big ark-result ' + (v.winner === you ? 'won' : 'lost') + '">' + (v.winner === you ? 'You win! 🏆' : 'You lose') + '</div><button class="primary rematch">Rematch</button>';
    }
    root.innerHTML = score + '<div class="ad-main">' + html + '</div>';
    if (shake) {
      const t = root.querySelector('.ad-word');
      if (t) t.classList.add('shake');
      shake = 0;
    }
  }

  const duel = {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'ad-phone';
      el.appendChild(root);
      // On touch-down, so fast fingers keep up.
      root.addEventListener('pointerdown', function (e) {
        const t = e.target.closest('.ad-tile');
        if (!t || !view || view.phase !== 'play' || view.lockedFor > 0) return;
        e.preventDefault();
        const i = Number(t.getAttribute('data-i'));
        if (picks.indexOf(i) !== -1) return;
        api.vibrate(5);
        const next = picks.concat([i]);
        const full = next.length === view.letters.length;
        // A full word goes as a guess (the server resets the TV's count if it's wrong).
        if (full) api.send({ type: 'guess', word: next.map(function (j) { return view.letters[j]; }).join('') });
        setPicks(next, full);
      });
      root.addEventListener('click', function (e) {
        if (e.target.closest('.back')) setPicks(picks.slice(0, -1));
        if (e.target.closest('.rematch')) api.send({ type: 'rematch' });
      });
    },
    update: function (v) {
      const k = roundKey(v);
      if (k !== round) {
        // A wrong word: shake and buzz.
        if (view && v.feedback && (!view.feedback || v.feedback.n !== view.feedback.n)) {
          shake = 1;
          api.vibrate([40, 30, 40]);
        }
        if (v.result && view && !view.result && v.result.winner === v.you) api.vibrate([60, 40, 120]);
        round = k;
        picks = [];
      }
      view = v;
      viewAt = Date.now();
      // The phone counts the lock down itself and redraws when it's over.
      clearTimeout(lockTimer);
      if (v.lockedFor > 0) lockTimer = setTimeout(function () { if (view) { view.lockedFor = 0; render(); } }, v.lockedFor);
      render();
    },
    unmount: function () {
      clearTimeout(lockTimer);
      root = view = null;
      round = '';
      picks = [];
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
      ArkRush.player.mount(rush.el, rush.api);
    }
    if (rush.on) ArkRush.player.update(v);
    return true;
  }

  Ark.register('player', 'anagram-duel', Object.assign({}, duel, {
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
      if (rush && rush.on) ArkRush.player.unmount();
      else duel.unmount();
      rush = null;
    },
  }));
})();
