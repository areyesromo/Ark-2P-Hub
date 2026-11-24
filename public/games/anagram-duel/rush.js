// Anagram Rush, the 1 player mode of Anagram Duel (server/games/anagram-duel.js, view.solo): the TV's
// and the phone's screens. The duel's renderers hand over to these (window.ArkRush.host / .player).
// The word is made on the screen itself (picks: which letters, in order) and sent whole once every
// letter is used.
(function () {

  /** What just happened, as a line under the letters. */
  function feedback(v) {
    const l = v.last;
    if (!l) return '';
    if (l.timeUp) return '⏰ Time! It was <strong>' + l.answer.toUpperCase() + '</strong>';
    if (l.skipped) return '⏭ Skipped: it was <strong>' + l.answer.toUpperCase() + '</strong>';
    if (l.ok) return '<span class="ok">✓ ' + l.word.toUpperCase() + '</span>' + (l.word !== l.answer ? ' <span class="muted">(or ' + l.answer.toUpperCase() + ')</span>' : '');
    return '<span class="no">✗ ' + l.word.toUpperCase() + ' isn\'t a word</span>';
  }

  /** The letters to pick from (used ones faded) and the word so far; cursor outlines a letter (the TV's controller). */
  function html(v, picks, cursor) {
    const letters = v.letters || [];
    let tiles = '<div class="ar-tiles">';
    letters.forEach(function (ch, i) {
      tiles += '<button type="button" class="ar-tile' + (picks.indexOf(i) !== -1 ? ' used' : '') + (cursor === i ? ' cursor' : '') + '" data-i="' + i + '">' + ch.toUpperCase() + '</button>';
    });
    tiles += '</div>';
    let word = '<div class="ar-word">';
    for (let k = 0; k < letters.length; k++) word += '<span class="ar-slot' + (k < picks.length ? ' full' : '') + '">' + (k < picks.length ? letters[picks[k]].toUpperCase() : '') + '</span>';
    word += '</div>';
    return word + tiles;
  }

  /** A fresh word (or a wrong guess) clears what's been picked: the key changes when it should. */
  function roundKey(v) {
    return (v.letters ? v.letters.join('') : '') + '|' + (v.last ? v.last.n : 0);
  }


  // ---- the TV ----
  const host = (function () {


    let root = null;
    let view = null;
    let key = '';
    let round = '';
    let picks = []; // the letters picked so far (on the TV's keyboard or controller)
    let cursor = 0;

    function render() {
      const v = view;
      if (!v || !root) return;
      const r = roundKey(v);
      if (r !== round) {
        round = r;
        picks = [];
        cursor = 0;
      }
      const local = v.player && v.player.local && v.phase === 'play';
      const k = JSON.stringify([r, picks, local && cursor, v.phase, Math.ceil(v.timeLeft / 1000), v.right]);
      if (k === key) return;
      key = k;
      const secs = Math.ceil(v.timeLeft / 1000);
      root.querySelector('.ar-top').innerHTML = '<span>✓ <strong>' + v.right + '</strong></span><span class="' + (secs <= 10 && v.phase === 'play' ? 'low' : '') + '">⏱ <strong>' + secs + '</strong> s</span>' +
        (v.bestStreak > 1 ? '<span class="muted">streak ' + v.streak + '</span>' : '');
      root.querySelector('.ar-bar span').style.width = (100 * v.timeLeft) / (v.seconds * 1000) + '%';
      root.querySelector('.ar-main').innerHTML = v.phase === 'ready' ? '<div class="ar-ready">Get ready…</div>' : html(v, picks, local ? cursor : null);
      root.querySelector('.ar-msg').innerHTML = feedback(v);
    }

    /** Pick letter i; once every letter is used, the word goes off. */
    function pick(i) {
      const v = view;
      if (!v.letters || picks.indexOf(i) !== -1) return null;
      picks.push(i);
      render();
      if (picks.length < v.letters.length) return true;
      return { type: 'guess', word: picks.map(function (j) { return v.letters[j]; }).join('') };
    }

    function back() {
      picks.pop();
      render();
      return true;
    }


    return {
      sounds: function (prev, v) {
        if (v.phase === 'over' && prev.phase !== 'over') return ['end'];
        const l = v.last;
        if (l && (!prev.last || l.n !== prev.last.n)) return [l.ok ? 'correct' : l.skipped ? 'whoosh' : 'wrong'];
        if (v.phase === 'play' && prev.phase === 'ready') return ['go'];
        return [];
      },
      padHint: 'Left / right pick a letter · A use it · B take one back · Y skip (−3 s) · keyboard: just type, Tab skips',
      pad: function (btn, v) {
        if (v.phase !== 'play' || !v.letters) return null;
        const n = v.letters.length;
        if (btn === 'LEFT' || btn === 'RIGHT') {
          cursor = (cursor + (btn === 'LEFT' ? n - 1 : 1)) % n;
          render();
        } else if (btn === 'A') {
          const input = pick(cursor);
          // Hop on to the next letter not used yet.
          for (let k = 1; k <= n && picks.indexOf(cursor) !== -1; k++) cursor = (cursor + 1) % n;
          render();
          return input === true ? null : input;
        } else if (btn === 'B') back();
        else if (btn === 'Y') return { type: 'skip' };
        return null;
      },
      typing: function (k, v) {
        if (v.phase !== 'play' || !v.letters) return null;
        if (k === 'Backspace') return back();
        if (k === 'Tab') return { type: 'skip' }; // letters are all taken, so skip needs a key of its own
        if (k === 'Enter') return true; // words go off by themselves: a habit Enter does nothing
        if (!/^[a-zA-Z]$/.test(k)) return null;
        // The first letter like it that's not used yet; a letter that isn't there is swallowed.
        const ch = k.toLowerCase();
        const i = v.letters.findIndex(function (c, j) { return c === ch && picks.indexOf(j) === -1; });
        return i === -1 ? true : pick(i);
      },
      overHtml: function (v) {
        return v.right + ' ' + (v.right === 1 ? 'word' : 'words') + ' · ' + v.skips + ' skipped' + (v.bestStreak > 1 ? ' · best streak ' + v.bestStreak : '');
      },
      mount: function (el) {
        root = document.createElement('div');
        root.className = 'ar-host';
        root.innerHTML = '<div class="ar-top"></div><div class="ar-bar"><span></span></div><div class="ar-main"></div><div class="ar-msg"></div><p class="muted ar-rule">Use all five letters. Any real word counts.</p>';
        el.appendChild(root);
        render();
      },
      update: function (v) {
        view = v;
        render();
      },
      unmount: function () {
        root = view = null;
        key = round = '';
        picks = [];
        cursor = 0;
      },
};
  })();

  // ---- the phone ----
  const player = (function () {


    let root = null;
    let api = null;
    let view = null;
    let key = '';
    let round = '';
    let picks = [];

    function render() {
      const v = view;
      if (!v || !root) return;
      const r = roundKey(v);
      if (r !== round) {
        if (v.last && round && v.last.n && !v.last.ok && !v.last.skipped) api.vibrate([40, 30, 40]);
        round = r;
        picks = [];
      }
      const k = JSON.stringify([r, picks, v.phase, Math.ceil(v.timeLeft / 1000)]);
      if (k === key) return;
      key = k;
      root.querySelector('.info').innerHTML = '✓ <strong>' + v.right + '</strong> · ⏱ ' + Math.ceil(v.timeLeft / 1000) + ' s' +
        (v.best === null || v.best === undefined ? '' : ' · best ' + v.best);
      root.querySelector('.ar-main').innerHTML = v.phase === 'ready' ? '<div class="ar-ready">Get ready…</div>' : html(v, picks, null);
      root.querySelector('.ar-msg').innerHTML = feedback(v);
      const play = v.phase === 'play';
      root.querySelector('.back').disabled = !play || !picks.length;
      root.querySelector('.skip').disabled = !play;
    }


    return {
      mount: function (el, a) {
        api = a;
        root = document.createElement('div');
        root.className = 'ar-phone';
        root.innerHTML = '<div class="info"></div><div class="ar-main"></div><div class="ar-msg"></div><div class="ar-buttons"><button class="ghost back">⌫ Back</button><button class="ghost skip">⏭ Skip (−3 s)</button></div>';
        el.appendChild(root);
        // On touch-down, so fast fingers keep up.
        root.querySelector('.ar-main').addEventListener('pointerdown', function (e) {
          const t = e.target.closest('[data-i]');
          if (!t || !view || view.phase !== 'play' || !view.letters) return;
          e.preventDefault();
          const i = Number(t.getAttribute('data-i'));
          if (picks.indexOf(i) !== -1) return;
          picks.push(i);
          api.vibrate(5);
          if (picks.length === view.letters.length) api.send({ type: 'guess', word: picks.map(function (j) { return view.letters[j]; }).join('') });
          render();
        });
        root.querySelector('.back').addEventListener('click', function () { picks.pop(); render(); });
        root.querySelector('.skip').addEventListener('click', function () { api.send({ type: 'skip' }); });
        render();
      },
      update: function (v) {
        view = v;
        render();
      },
      unmount: function () {
        root = view = null;
        key = round = '';
        picks = [];
      },
};
  })();

  window.ArkRush = { host: host, player: player };
})();
