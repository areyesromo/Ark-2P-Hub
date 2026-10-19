(function () {
  Ark.loadCss('/games/bomb-squad/style.css');
  const esc = Ark.escapeHtml;
  const MODULE_NAMES = { wires: 'Wires', button: 'Button', symbols: 'Symbols', password: 'Password', simon: 'Simon', maze: 'Maze', switches: 'Switches' };

  let root = null;
  let els = null;
  let view = null;
  let viewAt = 0;
  let raf = null;
  let textKey = '';
  let lastSecond = null;

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function timeLeft() {
    if (!view) return 0;
    return view.running ? Math.max(0, view.timeLeftMs - (performance.now() - viewAt)) : view.timeLeftMs;
  }

  /** The timer runs here between views; the last ten seconds tick. */
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!view || !els) return;
    const left = timeLeft();
    els.clock.textContent = clock(left);
    els.case.classList.toggle('hurry', view.running && left < 30000);
    const s = Math.ceil(left / 1000);
    if (view.running && s !== lastSecond && s <= 10 && s > 0) window.ArkSound && ArkSound.play('tick');
    lastSecond = s;
  }

  function strikesHtml(v) {
    let s = '';
    for (let i = 0; i < v.maxStrikes; i++) s += '<span class="strike' + (i < v.strikes ? ' on' : '') + '">✖</span>';
    return s;
  }

  function overlayHtml(v) {
    if (v.phase === 'brief') {
      return '<div class="panel"><div class="title">💣 Bomb ' + v.bombIndex + ' of ' + v.bombs + '</div>' +
        '<p>🔧 ' + nameOf(v, v.defuser) + ' has the <strong>bomb</strong> · 📖 ' + nameOf(v, 1 - v.defuser) + ' has the <strong>manual</strong></p>' +
        '<p class="muted">No peeking at each other\'s phones: talk it through!</p>' +
        '<div class="count">' + v.countdown + '</div></div>';
    }
    if (v.phase === 'result' && v.result) {
      const r = v.result;
      if (!r.defused) {
        return '<div class="panel boom"><div class="title">💥 BOOM</div><p>' +
          (r.reason === 'time' ? 'Out of time.' : 'Three strikes.') + '</p></div>';
      }
      return '<div class="panel won"><div class="title">✅ Defused!</div><p>' + clock(r.timeLeftMs) + ' to spare · ' +
        (r.strikes ? r.strikes + ' strike' + (r.strikes > 1 ? 's' : '') + ' · ' : '') + '+' + r.stars + ' ⭐</p></div>';
    }
    if (v.phase === 'over') {
      const rows = v.history.map(function (h, i) {
        return '<tr><td>Bomb ' + (i + 1) + '</td><td>🔧 ' + nameOf(v, h.defuser) + '</td><td>' +
          (h.defused ? '✅ ' + clock(h.timeLeftMs) + ' left' : '💥 ' + (h.reason === 'time' ? 'out of time' : '3 strikes')) +
          '</td><td>' + (h.stars ? new Array(h.stars + 1).join('⭐') : '—') + '</td></tr>';
      }).join('');
      return '<div class="panel"><div class="title">' + v.stars + ' of ' + v.maxStars + ' ⭐</div>' +
        '<table>' + rows + '</table><p class="muted">Rematch on a phone (or ⚙ change the settings).</p></div>';
    }
    return '';
  }

  function render(v) {
    const prev = view;
    view = v;
    viewAt = performance.now();
    if (prev && v.lastStrikeAt && v.lastStrikeAt !== prev.lastStrikeAt) {
      els.case.classList.remove('struck');
      void els.case.offsetWidth; // restart the flash
      els.case.classList.add('struck');
    }
    const key = JSON.stringify([v.phase, v.bombIndex, v.strikes, v.modules, v.countdown, v.result, v.stars]);
    if (key === textKey) return;
    textKey = key;
    root.className = 'bs-host phase-' + v.phase;
    els.top.innerHTML =
      '<span>💣 Bomb ' + Math.max(1, v.bombIndex) + ' / ' + v.bombs + ' <span class="muted">· ' + esc(v.levelName) + '</span></span>' +
      '<span class="stars">' + v.stars + ' ⭐</span>';
    els.roles.innerHTML = v.defuser === null ? '' :
      '🔧 ' + nameOf(v, v.defuser) + ' defuses · 📖 ' + nameOf(v, 1 - v.defuser) + ' reads the manual';
    els.strikes.innerHTML = strikesHtml(v);
    els.modules.innerHTML = v.modules.map(function (m) {
      return '<div class="mod' + (m.solved ? ' solved' : '') + '"><i class="led"></i>' + MODULE_NAMES[m.type] + '</div>';
    }).join('');
    els.overlay.innerHTML = overlayHtml(v);
  }

  Ark.register('host', 'bomb-squad', {
    // A strike buzzes, a solved module chimes, and the end of a bomb booms or cheers.
    sounds: function (prev, v) {
      const out = [];
      if (v.strikes > prev.strikes && v.phase === 'live') out.push('wrong');
      const solved = function (x) { return x.modules.filter(function (m) { return m.solved; }).length; };
      if (v.bombIndex === prev.bombIndex && solved(v) > solved(prev) && v.phase === 'live') out.push('correct');
      if (v.phase === 'result' && prev.phase !== 'result' && v.result) out.push(v.result.defused ? 'reveal' : 'boom');
      return out;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'bs-host';
      root.innerHTML =
        '<div class="bs-top"></div>' +
        '<div class="bs-roles"></div>' +
        '<div class="bs-stage">' +
        '<div class="bs-case"><div class="bs-clock">0:00</div><div class="bs-strikes"></div><div class="bs-modules"></div></div>' +
        '<div class="bs-overlay"></div>' +
        '</div>';
      el.appendChild(root);
      els = {
        top: root.querySelector('.bs-top'),
        roles: root.querySelector('.bs-roles'),
        case: root.querySelector('.bs-case'),
        clock: root.querySelector('.bs-clock'),
        strikes: root.querySelector('.bs-strikes'),
        modules: root.querySelector('.bs-modules'),
        overlay: root.querySelector('.bs-overlay'),
      };
      raf = requestAnimationFrame(frame);
    },
    update: render,
    unmount: function () {
      cancelAnimationFrame(raf);
      root = els = view = null;
      textKey = '';
      lastSecond = null;
    },
  });
})();
