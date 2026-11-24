(function () {
  Ark.loadCss('/games/hangman/style.css');
  const ready = Ark.loadScript('/games/hangman/gallows.js');
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

  /** One player's go at the other's word: the gallows, the tiles, the letters tried. */
  function board(v, slot) {
    const other = 1 - slot;
    const state = v.done[slot];
    const word = v.words ? v.words[other] : null;
    const mask = v.masks[slot];
    let head;
    if (v.phase === 'set') head = nameOf(v, slot) + (v.ready[slot] ? ' · word set ✓' : ' · thinking of a word…');
    else head = nameOf(v, slot) + ' guesses ' + nameOf(v, other) + "'s word";
    const wrong = mask ? v.tried[slot].filter(function (c) { return !mask.includes(c); }) : [];
    return '<section class="hg-board p' + (slot + 1) + (state ? ' ' + state : '') + '">' +
      '<header>' + head + '</header>' +
      '<div class="hg-art">' + ArkHang.gallows(v.phase === 'set' ? 0 : v.misses[slot], v.lives, state) + '</div>' +
      (mask ? ArkHang.tiles(mask, word) : '<div class="hg-tiles waiting">' + (v.ready[slot] ? '🔒' : '…') + '</div>') +
      '<div class="hg-wrong">' + (mask ? wrong.map(function (c) { return '<span>' + c + '</span>'; }).join('') : '') + '</div>' +
      '<footer>' + (state === 'solved' ? '<b>Solved!</b>' : state === 'hanged' ? 'Out of letters' : mask ? (v.lives - v.misses[slot]) + ' wrong letters left' : '') + '</footer></section>';
  }

  function caption(v) {
    if (v.phase === 'set') return 'Each of you set a secret word on your phone' + (v.timed && v.timeLeftMs ? ' · ⏱ ' + clock() : '');
    if (v.phase === 'guess') return 'Guess their word letter by letter, both at once!' + (v.timed && v.timeLeftMs ? ' · ⏱ ' + clock() : '');
    const r = v.result;
    if (v.phase === 'over') return '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins the match</span>';
    if (r.winner === null) return r.how === 'both' ? 'Both out of letters: level!' : 'Time up, the same found each: level!';
    return nameOf(v, r.winner) + (r.how === 'time' ? ' found more letters!' : ' got it first!');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="hg-caption">' + caption(v) + '</div><div class="hg-stage">' + board(v, 0) + board(v, 1) + '</div>';
  }

  Ark.register('host', 'hangman', {
    sounds: function (prev, v) {
      if (v.phase === 'guess' && prev.phase === 'set') return ['lock'];
      if (v.phase !== 'guess' && prev.phase === 'guess') return [v.result && v.result.winner !== null ? 'fanfare' : 'tick'];
      if (v.phase !== 'guess' || !prev.masks || !prev.masks[0]) return [];
      const miss = v.misses[0] + v.misses[1] > prev.misses[0] + prev.misses[1];
      const hit = v.tried[0].length + v.tried[1].length > prev.tried[0].length + prev.tried[1].length;
      return miss ? ['wrong'] : hit ? ['tick'] : [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'hg-host';
      el.appendChild(root);
      ticking();
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = view = null; },
  });
})();
