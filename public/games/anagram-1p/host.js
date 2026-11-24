(function () {
  Ark.loadCss('/games/anagram-1p/style.css');
  const ready = Ark.loadScript('/games/anagram-1p/board.js');

  let root = null;
  let view = null;
  let key = '';
  let round = '';
  let picks = []; // the letters picked so far (on the TV's keyboard or controller)
  let cursor = 0;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkAnagram) return;
    const r = window.ArkAnagram.roundKey(v);
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
    root.querySelector('.an-top').innerHTML = '<span>✓ <strong>' + v.right + '</strong></span><span class="' + (secs <= 10 && v.phase === 'play' ? 'low' : '') + '">⏱ <strong>' + secs + '</strong> s</span>' +
      (v.bestStreak > 1 ? '<span class="muted">streak ' + v.streak + '</span>' : '');
    root.querySelector('.an-bar span').style.width = (100 * v.timeLeft) / (v.seconds * 1000) + '%';
    root.querySelector('.an-main').innerHTML = v.phase === 'ready' ? '<div class="an-ready">Get ready…</div>' : window.ArkAnagram.html(v, picks, local ? cursor : null);
    root.querySelector('.an-msg').innerHTML = window.ArkAnagram.feedback(v);
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

  Ark.register('host', 'anagram-1p', {
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
      root.className = 'an-host';
      root.innerHTML = '<div class="an-top"></div><div class="an-bar"><span></span></div><div class="an-main"></div><div class="an-msg"></div><p class="muted an-rule">Use all five letters. Any real word counts.</p>';
      el.appendChild(root);
      ready.then(render);
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
  });
})();
