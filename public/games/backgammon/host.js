(function () {
  Ark.loadCss('/shared/dice.css');
  Ark.loadCss('/games/backgammon/style.css');
  const ready = Promise.all([Ark.loadScript('/shared/dice.js'), Ark.loadScript('/games/backgammon/board.js')]);
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  // Controller players: the picked checker, and the aim among what can be picked (or where it can go).
  const picked = {};
  const aim = {};

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function choices(v, slot) {
    if (picked[slot] !== undefined && picked[slot] !== null) {
      return [...new Set(v.legal.filter(function (m) { return m.from === picked[slot]; }).map(function (m) { return m.to; }))];
    }
    return [...new Set(v.legal.map(function (m) { return m.from; }))];
  }

  function side(v, slot) {
    const active = v.turn === slot && ['roll', 'move', 'noMove'].includes(v.phase);
    const clock = active && v.timed && v.timeLeftMs ? '<span class="bg-clock' + (v.timeLeftMs < 8000 ? ' low' : '') + '">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '';
    let doing = '';
    if (active) doing = v.phase === 'roll' ? 'To roll' : v.phase === 'noMove' ? 'No move' : 'Moving';
    if (v.phase === 'offer') doing = v.offer.by === slot ? 'Doubles to ' + v.offer.value + '!' : 'Take or drop?';
    const p = v.players[slot];
    const keys = active && p.local && !p.bot ? (v.phase === 'roll' ? 'A roll' + (v.canDouble ? ' · Y double' : '') : '◀ ▶ pick · A move · B back · X undo' + (v.canDone ? ' · A done' : '')) :
      v.phase === 'offer' && v.offer.by !== slot && p.local && !p.bot ? 'A take · B drop' : '';
    return '<aside class="bg-side p' + (slot + 1) + (active ? ' active' : '') + '">' +
      '<div class="bg-name">' + ArkBG.checker(slot) + nameOf(v, slot) + '</div>' +
      '<div class="bg-points">' + v.scores[slot] + '<small>/' + v.matchTo + '</small></div>' +
      '<div class="bg-pips">' + v.pips[slot] + ' pips to go · ' + v.off[slot] + ' off</div>' +
      '<div class="bg-doing">' + doing + clock + '</div>' + (keys ? '<div class="bg-keys">' + keys + '</div>' : '') + '</aside>';
  }

  function banner(v) {
    if (v.phase !== 'gameEnd' && v.phase !== 'over') return '';
    const r = v.result;
    const kind = { gammon: 'A gammon! ', backgammon: 'A backgammon! ', drop: 'Double dropped. ', single: '' }[r.kind];
    if (v.phase === 'over') return '<div class="bg-banner"><span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins the match</span><small>' + v.scores[v.winner] + ' to ' + v.scores[1 - v.winner] + ' · Rematch or back to the lobby from your phones or controllers</small></div>';
    return '<div class="bg-banner"><span>' + nameOf(v, r.winner) + ' wins the game</span><small>' + kind + '+' + r.points + ' point' + (r.points > 1 ? 's' : '') + '</small></div>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const s = v.turn;
    const p = v.players[s];
    const local = v.phase === 'move' && p.local && !p.bot;
    let opts = { side: 0, dice: ArkBG.diceHtml(v) };
    if (local) {
      const list = choices(v, s);
      const at = list.length ? list[Math.min(aim[s] || 0, list.length - 1)] : null;
      const hasPick = picked[s] !== undefined && picked[s] !== null;
      opts = Object.assign(opts, {
        from: hasPick ? picked[s] : null,
        sources: hasPick ? new Set() : new Set(list),
        targets: hasPick ? new Set(list) : new Set(),
        cursor: at,
      });
    } else if (v.phase === 'move') {
      opts.sources = new Set(v.legal.map(function (m) { return m.from; }));
    }
    root.innerHTML = '<div class="bg-stage">' + side(v, 0) + '<div class="bg-centre">' +
      (v.phase === 'opening' ? '<div class="bg-note">Rolling to start: the higher die goes first</div>' : '') +
      ArkBG.boardHtml(v, opts) + banner(v) + '</div>' + side(v, 1) + '</div>';
  }

  Ark.register('host', 'backgammon', {
    padHint: 'A rolls · ◀ ▶ picks a checker, A moves it, B puts it back · X undoes · Y doubles · A: take, B: drop',
    sounds: function (prev, v) {
      const out = [];
      if (v.phase === 'move' && prev.phase !== 'move') out.push('knock');
      if ((v.moved || []).length > (prev.moved || []).length) out.push(v.bar[0] + v.bar[1] > prev.bar[0] + prev.bar[1] ? 'boom' : 'drop');
      if (v.phase === 'offer' && prev.phase !== 'offer') out.push('reveal');
      if (v.phase === 'noMove' && prev.phase !== 'noMove') out.push('wrong');
      return out;
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase === 'offer') return v.offer.by !== slot ? (btn === 'A' ? { type: 'take' } : btn === 'B' ? { type: 'drop' } : null) : null;
      if (v.turn !== slot) return null;
      if (v.phase === 'roll') return btn === 'A' ? { type: 'roll' } : btn === 'Y' && v.canDouble ? { type: 'double' } : null;
      if (v.phase !== 'move') return null;
      if (btn === 'X') { picked[slot] = null; return { type: 'undo' }; }
      if (v.canDone) return btn === 'A' ? { type: 'done' } : null;
      const list = choices(v, slot);
      if (!list.length) return null;
      const at = Math.min(aim[slot] || 0, list.length - 1);
      if (btn === 'LEFT' || btn === 'RIGHT' || btn === 'UP' || btn === 'DOWN') {
        aim[slot] = (at + (btn === 'LEFT' || btn === 'UP' ? -1 : 1) + list.length) % list.length;
        render();
        return null;
      }
      if (btn === 'B') { picked[slot] = null; aim[slot] = 0; render(); return null; }
      if (btn !== 'A') return null;
      if (picked[slot] !== undefined && picked[slot] !== null) {
        const move = { type: 'move', from: picked[slot], to: list[at] };
        picked[slot] = null;
        aim[slot] = 0;
        return move;
      }
      picked[slot] = list[at];
      aim[slot] = 0;
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'bg-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      if (view && (v.turn !== view.turn || v.moved.length !== view.moved.length || v.phase !== view.phase)) { picked[0] = picked[1] = null; }
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      picked[0] = picked[1] = null;
      aim[0] = aim[1] = 0;
    },
  });
})();
