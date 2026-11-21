(function () {
  Ark.loadCss('/games/make-24/style.css');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let gotAt = 0;
  let tick = null;

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  /** The puzzle card: a number on each side, 24 in the middle. */
  function card(v) {
    const spots = ['n', 'e', 's', 'w'];
    return '<div class="m24-card">' + v.numbers.map(function (n, i) {
      return '<span class="m24-num ' + spots[i] + '">' + n + '</span>';
    }).join('') + '<span class="m24-medal">24</span></div>';
  }

  function side(v, slot) {
    const joined = v.progress[slot];
    let pips = '';
    for (let i = 0; i < 3; i++) pips += '<i class="' + (i < joined ? 'on' : '') + '"></i>';
    let note = 'Thinking…';
    if (joined === 1) note = 'Two joined';
    if (joined === 2) note = 'Nearly there…';
    if (v.skips[slot]) note = 'Gave up on this one';
    if (v.result && v.result.winner === slot) note = 'Made 24!';
    else if (v.phase !== 'play') note = '';
    return '<aside class="m24-side p' + (slot + 1) + (v.result && v.result.winner === slot ? ' won' : '') + '">' +
      '<div class="m24-name">' + nameOf(v, slot) + '</div><div class="m24-pips">' + pips + '</div><div class="m24-note">' + note + '</div></aside>';
  }

  function clockText(v) {
    const left = Math.max(0, v.timeLeftMs - (Date.now() - gotAt));
    return Math.ceil(left / 1000) + 's';
  }

  function under(v) {
    if (v.phase === 'play') return v.timed ? '<div class="m24-clock">⏱ <span>' + clockText(v) + '</span></div>' : '<div class="m24-hint">No timer: give up together on your phones to move on</div>';
    const r = v.result;
    let head;
    if (v.phase === 'over') head = '<div class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins the match</div>';
    else head = '<div class="m24-verdict">' + (r.solved ? nameOf(v, r.winner) + ' made it!' : 'Nobody got it. One way:') + '</div>';
    return head + '<div class="m24-sum">' + esc(r.text) + ' <b>= 24</b></div>' +
      (v.phase === 'over' ? '<p class="m24-hint">Rematch or back to the lobby from your phones.</p>' : '');
  }

  function render() {
    if (!root || !view) return;
    const v = view;
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="m24-stage">' + side(v, 0) + '<div class="m24-centre">' + card(v) + '<div class="m24-under">' + under(v) + '</div></div>' + side(v, 1) + '</div>';
  }

  Ark.register('host', 'make-24', {
    sounds: function (prev, v) {
      if (v.round !== prev.round) return ['start'];
      const out = [];
      [0, 1].forEach(function (s) { if (v.progress[s] > prev.progress[s] && v.phase === 'play') out.push('tick'); });
      if (v.phase !== 'play' && prev.phase === 'play') out.push(v.result.solved ? 'correct' : 'wrong');
      return out;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'm24-host';
      el.appendChild(root);
      tick = setInterval(function () {
        const c = root && root.querySelector('.m24-clock span');
        if (c && view) {
          c.textContent = clockText(view);
          c.parentNode.classList.toggle('low', view.timeLeftMs - (Date.now() - gotAt) < 10000);
        }
      }, 250);
    },
    update: function (v) {
      view = v;
      gotAt = Date.now();
      render();
    },
    unmount: function () {
      clearInterval(tick);
      root = view = null;
    },
  });
})();
