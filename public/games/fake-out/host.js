// Fake Out on the TV (server/games/fake-out.js): the fact with its blank, who has written their
// fake, then the four answers to pick from, and the reveal: answer by answer, whose fake it was
// and who fell for it, the truth last.
(function () {
  Ark.loadCss('/games/fake-out/style.css');
  const esc = Ark.escapeHtml;

  let root = null;
  let bar = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let lastKey = '';

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  /** The fact, its blank drawn as a line (or filled in with the truth once it's revealed). */
  function factHtml(v, truth) {
    const parts = esc(v.question).split('___');
    return parts.join(truth ? '<b class="fo-truth">' + esc(truth) + '</b>' : '<span class="fo-blank"></span>');
  }

  function side(v, slot) {
    let status = '';
    if (v.phase === 'write') status = v.written[slot] ? '✍️ Fake written' : 'Writing…';
    else if (v.phase === 'pick') status = v.picked[slot] ? '🔒 Picked' : 'Choosing…';
    const gain = v.gained[slot] ? '<span class="gain">+' + v.gained[slot] + '</span>' : '';
    return '<div class="fo-side' + (slot === 1 ? ' right' : '') + '"><span class="name">' + nameOf(v, slot) + '</span>' +
      '<span class="points">' + v.scores[slot] + gain + '</span><span class="status">' + status + '</span></div>';
  }

  function revealCard(v, r) {
    if (!r.kind) return '<div class="fo-answer hidden-yet"><span class="text">' + esc(r.text) + '</span></div>';
    const who = r.kind === 'truth' ? '✅ The truth!'
      : r.kind === 'house' ? '🏦 The bank\'s fake'
        : '🤥 ' + r.authors.map(function (a) { return nameOf(v, a); }).join(' & ') + '\'s fake';
    const fooled = r.pickedBy.length
      ? (r.kind === 'truth' ? 'Found by ' : 'Fooled ') + r.pickedBy.map(function (s) { return nameOf(v, s); }).join(' & ')
      : r.kind === 'truth' ? 'Nobody found it' : 'Fooled nobody';
    return '<div class="fo-answer ' + r.kind + (r.at === v.step - 1 ? ' now' : '') + '"><span class="text">' + esc(r.text) + '</span>' +
      '<span class="who">' + who + '</span><span class="fooled">' + fooled + '</span></div>';
  }

  function body(v) {
    if (v.phase === 'countdown') {
      return '<div class="fo-center"><div class="big">' + (v.countdown || '') + '</div><div class="sub">' + v.rounds +
        ' rounds · write a fake answer that sounds true, then find the real one · the last round counts double</div></div>';
    }
    if (v.phase === 'over') {
      const sub = v.draw
        ? 'It\'s a draw! <strong>' + v.scores[0] + ' : ' + v.scores[1] + '</strong>'
        : nameOf(v, v.winner) + ' wins <strong>' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '</strong>';
      return '<div class="fo-center"><div class="big">' + (v.draw ? '🤝' : '🏆') + '</div><div class="sub">' + sub +
        '<br>Rematch or head back to the lobby from your phones.</div></div>';
    }
    const shown = v.phase === 'reveal' && v.reveal ? v.reveal.find(function (r) { return r.kind === 'truth'; }) : null;
    const truth = shown ? shown.text : null;
    let html = '<div class="fo-card"><div class="meta">Round ' + v.round + ' / ' + v.rounds + (v.last ? ' · ⭐ double points' : '') + '</div>' +
      '<div class="q">' + factHtml(v, truth) + '</div></div>';
    if (v.phase === 'write') {
      html += '<div class="fo-bar"><div class="fill"></div></div><div class="fo-hint">✍️ On your phone, write a fake answer that sounds true…</div>';
    } else if (v.phase === 'pick') {
      html += '<div class="fo-bar"><div class="fill"></div></div><div class="fo-list">' + v.options.map(function (o) {
        return '<div class="fo-answer"><span class="text">' + esc(o.text) + '</span></div>';
      }).join('') + '</div><div class="fo-hint">Which one is real? Pick it on your phone.</div>';
    } else if (v.phase === 'reveal') {
      // The cards stay where they were for the pick, and turn over one by one.
      html += '<div class="fo-list">' + v.reveal.map(function (r) { return revealCard(v, r); }).join('') + '</div>';
    }
    return html;
  }

  // The server pushes a view every second; ease the timer bar smoothly in between.
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!bar || !view) return;
    const frac = view.phaseMs ? Math.max(0, view.timeLeftMs - (performance.now() - viewAt)) / view.phaseMs : 0;
    bar.style.width = (frac * 100).toFixed(2) + '%';
    bar.classList.toggle('low', frac < 0.25);
  }

  Ark.register('host', 'fake-out', {
    sounds: function (prev, v) {
      const out = [];
      if (v.phase === prev.phase && v.written.filter(Boolean).length > prev.written.filter(Boolean).length) out.push('lock');
      if (v.phase === prev.phase && v.picked.filter(Boolean).length > prev.picked.filter(Boolean).length) out.push('lock');
      if (v.phase === 'reveal' && v.step > (prev.phase === 'reveal' ? prev.step : 0)) {
        const r = v.reveal.find(function (x) { return x.at === v.step - 1; });
        out.push(r.kind === 'truth' ? 'fanfare' : r.pickedBy.length ? 'wrong' : 'reveal');
      }
      return out;
    },
    padHint: 'Fake Out needs two phones: you each write a secret fake answer · A: rematch at the end',
    pad: function (btn, v) {
      return v.phase === 'over' && (btn === 'A' || btn === 'START') ? { type: 'rematch' } : null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'fo-host';
      el.appendChild(root);
      raf = requestAnimationFrame(tick);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      const key = JSON.stringify([v.phase, v.round, v.countdown, v.written, v.picked, v.step, v.scores, v.gained, v.players.map(function (p) { return p.name; })]);
      if (key === lastKey) return; // per-second clock updates only move the bar
      lastKey = key;
      root.innerHTML = '<div class="fo-top">' + side(v, 0) + '<span class="vs">VS</span>' + side(v, 1) + '</div>' + body(v);
      bar = root.querySelector('.fo-bar .fill');
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = bar = view = null;
      lastKey = '';
    },
  });
})();
