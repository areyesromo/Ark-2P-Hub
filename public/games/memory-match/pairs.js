// Memory Pairs, the 1 player mode of Memory Match (server/games/memory-match.js, view.solo): the TV's
// and the phone's screens. Memory Match's renderers hand over to these (window.ArkPairs.host / .player).
(function () {

  /** The grid's markup: each card carries data-cell; cursor marks a controller's place. */
  function html(v, cursor) {
    let out = '<div class="mp-grid" style="--w:' + v.w + ';--h:' + v.h + '">';
    v.cards.forEach(function (c, i) {
      const up = c !== null;
      out += '<button type="button" class="mp-card' + (up ? ' up' : '') + (v.matched[i] ? ' matched' : '') + (cursor === i ? ' cursor' : '') + '" data-cell="' + i + '">' +
        '<span class="back"></span><span class="face">' + (up ? Ark.escapeHtml(c) : '') + '</span></button>';
    });
    return out + '</div>';
  }

  // ---- the TV ----
  const host = (function () {


    let root = null;
    let field = null;
    let stats = null;
    let view = null;
    let boardKey = '';
    let cursor = 0; // a controller's place on the grid

    function render() {
      const v = view;
      if (!v || !root) return;
      const local = v.player && v.player.local && v.phase === 'play';
      const key = JSON.stringify([v.cards, v.matched, local && cursor]);
      if (key !== boardKey) {
        boardKey = key;
        field.innerHTML = html(v, local ? cursor : null);
      }
      stats.innerHTML =
        '<span><strong>' + v.tries + '</strong> tries</span>' +
        '<span><strong>' + v.pairsLeft + '</strong> pairs to find</span>' +
        '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>' +
        (v.streak > 1 ? '<span>🔥 <strong>' + v.streak + '</strong> in a row</span>' : '');
    }

    function shake() {
      const grid = field && field.querySelector('.mp-grid');
      if (!grid) return;
      grid.classList.remove('shake');
      void grid.offsetWidth; // restart the animation
      grid.classList.add('shake');
    }


    return {
      sounds: function (prev, v) {
        const found = v.matched.filter(Boolean).length > prev.matched.filter(Boolean).length;
        if (found) return ['point'];
        if (v.lastMiss > prev.lastMiss) return ['wrong'];
        if (v.up.length > prev.up.length) return ['flag'];
        return [];
      },
      padHint: 'D-pad move · A turn a card over',
      pad: function (btn, v) {
        if (v.phase !== 'play') return null;
        const n = v.cards.length;
        if (btn === 'LEFT') cursor = (cursor + n - 1) % n;
        else if (btn === 'RIGHT') cursor = (cursor + 1) % n;
        else if (btn === 'UP') cursor = (cursor + n - v.w) % n;
        else if (btn === 'DOWN') cursor = (cursor + v.w) % n;
        else if (btn === 'A') return { type: 'flip', cell: cursor };
        else return null;
        render();
        return null;
      },
      overHtml: function (v) {
        return 'Every pair found in ' + v.tries + ' tries · ' + Ark.clock(v.elapsed) + ' · best run ' + v.bestStreak + ' in a row';
      },
      mount: function (el) {
        root = document.createElement('div');
        root.className = 'mp-host';
        root.innerHTML = '<div class="mp-stats"></div><div class="mp-field"></div>';
        el.appendChild(root);
        field = root.querySelector('.mp-field');
        stats = root.querySelector('.mp-stats');
        render();
      },
      update: function (v) {
        const missed = view && v.lastMiss > view.lastMiss;
        if (!view || v.tries < view.tries) cursor = 0;
        view = v;
        render();
        if (missed) shake();
      },
      unmount: function () {
        root = field = stats = view = null;
        boardKey = '';
        cursor = 0;
      },
};
  })();

  // ---- the phone ----
  const player = (function () {


    let root = null;
    let field = null;
    let info = null;
    let view = null;
    let boardKey = '';
    let api = null;

    function render() {
      const v = view;
      if (!v || !root) return;
      const key = JSON.stringify([v.cards, v.matched]);
      if (key !== boardKey) {
        boardKey = key;
        field.innerHTML = html(v, null);
      }
      info.innerHTML = '<strong>' + v.tries + '</strong> tries · ' + v.pairsLeft + ' pairs to find' + (v.best === null || v.best === undefined ? '' : ' · best ' + v.best);
    }


    return {
      mount: function (el, a) {
        api = a;
        root = document.createElement('div');
        root.className = 'mp-phone';
        root.innerHTML = '<div class="info"></div><div class="mp-field"></div>';
        el.appendChild(root);
        field = root.querySelector('.mp-field');
        info = root.querySelector('.info');
        field.addEventListener('click', function (e) {
          const card = e.target.closest('[data-cell]');
          if (!card || !view || view.phase !== 'play') return;
          api.send({ type: 'flip', cell: Number(card.getAttribute('data-cell')) });
          api.vibrate(6);
        });
        render();
      },
      update: function (v) {
        if (view && v.lastMiss > view.lastMiss) api.vibrate([40, 30, 40]);
        view = v;
        render();
      },
      unmount: function () {
        root = field = info = view = api = null;
        boardKey = '';
      },
};
  })();

  window.ArkPairs = { host: host, player: player };
})();
