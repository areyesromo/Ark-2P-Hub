(function () {
  Ark.loadCss('/games/odd-even/style.css');
  const esc = Ark.escapeHtml;
  let root = null;
  let view = null;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  const HANDS = ['', '☝️', '✌️', '🤟', '🖖', '🖐️'];

  function hand(v, slot) {
    const r = v.phase === 'reveal' ? v.result : null;
    const role = slot === v.odd ? 'Odd' : 'Even';
    let big = '🤔';
    let cap = 'Choosing…';
    let cls = 'oe-hand p' + (slot + 1);
    if (r) {
      big = r.picks[slot] ? HANDS[r.picks[slot]] : '⌛';
      cap = r.picks[slot] ? r.picks[slot] + (r.picks[slot] === 1 ? ' finger' : ' fingers') : 'Out of time';
      if (r.point === slot) cls += ' win';
      else if (r.point !== null) cls += ' lose';
    } else if (v.locked[slot]) {
      big = '✊';
      cap = '🔒 Ready';
      cls += ' locked';
    }
    const local = v.phase === 'pick' && !v.locked[slot] && v.players[slot].local && !v.players[slot].bot;
    return '<div class="' + cls + '"><div class="oe-role">' + nameOf(v, slot) + ' is <b>' + role + '</b></div>' +
      '<div class="oe-emoji">' + big + '</div><div class="oe-cap">' + cap + '</div>' +
      (local ? '<div class="oe-keys">◀ 1 · ▲ 2 · ▶ 3 · ▼ 4 · A 5</div>' : '') + '</div>';
  }

  function middle(v) {
    if (v.phase === 'reveal') {
      const r = v.result;
      return '<div class="oe-total ' + (r.total % 2 ? 'odd' : 'even') + '">' + (r.total || '–') + '<span>' +
        (r.total ? (r.total % 2 ? 'ODD' : 'EVEN') : '') + '</span></div>';
    }
    return '<div class="oe-vs">+</div>';
  }

  function caption(v) {
    if (v.phase === 'over') return '<span class="ark-result">🏆 ' + nameOf(v, v.winner) + ' wins the match!</span>';
    if (v.phase === 'pick') return 'Show your fingers: an odd total for ' + nameOf(v, v.odd) + ', even for ' + nameOf(v, 1 - v.odd) +
      (v.timed && v.timeLeftMs ? ' · ⏱ <span class="oe-secs">' + secsLeft() + 's</span>' : '');
    const r = v.result;
    return r.point === null ? 'Nobody showed: no point' : 'A point to ' + nameOf(v, r.point);
  }

  function render() {
    const v = view;
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="oe-arena">' + hand(v, 0) + middle(v) + hand(v, 1) + '</div>' +
      '<div class="oe-caption">' + caption(v) + '</div>';
  }

  const PAD = { LEFT: 1, X: 1, UP: 2, Y: 2, RIGHT: 3, B: 3, DOWN: 4, A: 5 };

  Ark.register('host', 'odd-even', {
    sounds: function (prev, v) {
      const out = [];
      if (v.locked.filter(Boolean).length > prev.locked.filter(Boolean).length) out.push('lock');
      if (prev.phase === 'pick' && v.phase === 'reveal') out.push('reveal');
      if (prev.phase !== 'over' && v.phase === 'over') out.push('fanfare');
      return out;
    },
    padHint: 'Fingers: ◀ or X 1 · ▲ or Y 2 · ▶ or B 3 · ▼ 4 · A 5 · A: rematch at the end',
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase === 'pick' && PAD[btn]) return { type: 'pick', fingers: PAD[btn] };
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'oe-host';
      el.appendChild(root);
      tick = setInterval(function () {
        if (root) root.querySelectorAll('.oe-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
      }, 250);
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = null; },
  });
})();
