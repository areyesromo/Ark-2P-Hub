(function () {
  Ark.loadCss('/games/which-box/style.css');
  const esc = Ark.escapeHtml;
  let root = null;
  let view = null;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  const KEYS = ['X / ◀', 'Y / ▲', 'B / ▶'];

  function boxes(v) {
    const r = v.phase === 'reveal' ? v.result : null;
    let html = '<div class="wb-boxes">';
    for (let b = 0; b < 3; b++) {
      let cls = 'wb-box';
      let inside = '';
      if (r) {
        const prize = r.hid === b || (r.hid === null && r.sought === b);
        cls += ' open';
        if (prize) { cls += ' prize'; inside = '🎁'; }
        if (r.sought === b) cls += ' sought p' + (2 - r.hider) + (r.found ? ' found' : ' miss');
      }
      html += '<div class="' + cls + '"><div class="wb-lid"></div><div class="wb-in">' + inside + '</div><div class="wb-num">' + (b + 1) + '</div></div>';
    }
    return html + '</div>';
  }

  function seat(v, slot) {
    const role = slot === v.hider ? '🙈 Hides' : '🔎 Seeks';
    let state = v.locked[slot] ? '🔒 Picked' : 'Picking…';
    if (v.phase !== 'pick') state = '';
    const local = v.phase === 'pick' && !v.locked[slot] && v.players[slot].local && !v.players[slot].bot;
    return '<div class="wb-seat p' + (slot + 1) + (v.locked[slot] && v.phase === 'pick' ? ' locked' : '') + '">' +
      '<div class="wb-role">' + nameOf(v, slot) + ' · ' + role + '</div>' +
      '<div class="wb-state">' + state + '</div>' +
      (local ? '<div class="wb-keys">' + KEYS.map((k, i) => '<span><b>' + k + '</b> box ' + (i + 1) + '</span>').join('') + '</div>' : '') +
      '</div>';
  }

  function caption(v) {
    if (v.phase === 'over') {
      if (v.winner === null) return '<span class="ark-result draw">Level! A draw.</span>';
      return '<span class="ark-result">🏆 ' + nameOf(v, v.winner) + ' wins the match!</span>';
    }
    if (v.phase === 'pick') {
      return nameOf(v, v.hider) + ' hides the prize, ' + nameOf(v, 1 - v.hider) + ' looks for it' +
        (v.timed && v.timeLeftMs ? ' · ⏱ <span class="wb-secs">' + secsLeft() + 's</span>' : '');
    }
    const r = v.result;
    if (r.point === null) return 'Nobody picked: no point';
    if (r.hid === null) return 'Not hidden! ' + nameOf(v, r.point) + ' gets it';
    if (r.sought === null) return 'No look in time: ' + nameOf(v, r.point) + ' keeps it hidden';
    return r.found ? '🎉 Found it! A point to ' + nameOf(v, r.point) : '💨 Empty! A point to ' + nameOf(v, r.point);
  }

  function trail(v) {
    return '<div class="wb-trail">' + v.history.map(function (h) {
      const s = 1 - h.hider;
      if (h.hid === null && h.sought === null) return '<span>–</span>';
      const pt = h.found ? s : h.hider;
      return '<span class="p' + (pt + 1) + '">' + (h.found ? '🎁' : '·') + '</span>';
    }).join('') + '</div>';
  }

  function render() {
    const v = view;
    root.innerHTML =
      '<div class="scoreboard"><div class="side p1-text"><span class="name">' + esc(v.players[0].name) + '</span><span class="wb-pts">' + v.scores[0] + '</span></div>' +
      '<span class="round">Round ' + Math.min(v.round, v.rounds) + ' of ' + v.rounds + '</span>' +
      '<div class="side p2-text right"><span class="wb-pts">' + v.scores[1] + '</span><span class="name">' + esc(v.players[1].name) + '</span></div></div>' +
      '<div class="wb-caption">' + caption(v) + '</div>' +
      boxes(v) +
      (v.phase === 'over' ? '' : '<div class="wb-seats">' + seat(v, 0) + seat(v, 1) + '</div>') +
      trail(v);
  }

  const PAD = { X: 0, LEFT: 0, Y: 1, UP: 1, B: 2, RIGHT: 2 };

  Ark.register('host', 'which-box', {
    sounds: function (prev, v) {
      const out = [];
      if (v.locked.filter(Boolean).length > prev.locked.filter(Boolean).length) out.push('lock');
      if (prev.phase === 'pick' && v.phase === 'reveal') out.push(v.result.found ? 'correct' : 'wrong');
      if (prev.phase !== 'over' && v.phase === 'over') out.push('fanfare');
      return out;
    },
    padHint: 'X / ◀ box 1 · Y / ▲ box 2 · B / ▶ box 3 · A: rematch at the end',
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase === 'pick' && btn in PAD) return { type: 'pick', box: PAD[btn] };
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'wb-host';
      el.appendChild(root);
      tick = setInterval(function () {
        if (root) root.querySelectorAll('.wb-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
      }, 250);
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = null; },
  });
})();
