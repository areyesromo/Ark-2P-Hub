(function () {
  Ark.loadCss('/games/bomb-squad/style.css');
  const esc = Ark.escapeHtml;
  const NAMES = { wires: 'Wires', button: 'Button', symbols: 'Symbols', password: 'Password' };

  let root = null;
  let els = null;
  let api = null;
  let view = null;
  let viewAt = 0;
  let raf = null;
  let textKey = '';
  let tab = 0; // the defuser's module, or the expert's manual page
  let tabBomb = 0; // which bomb `tab` belongs to
  let pressing = null; // the button module being held down

  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function timeLeft() {
    if (!view) return 0;
    return view.running ? Math.max(0, view.timeLeftMs - (performance.now() - viewAt)) : view.timeLeftMs;
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!els) return;
    const t = clock(timeLeft());
    root.querySelectorAll('.bs-time').forEach(function (e) { if (e.textContent !== t) e.textContent = t; });
  }

  function strikes(v) {
    let s = '';
    for (let i = 0; i < v.maxStrikes; i++) s += '<span class="strike' + (i < v.strikes ? ' on' : '') + '">✖</span>';
    return s;
  }

  function tabs(list, labelOf, doneOf) {
    return '<div class="bs-tabs">' + list.map(function (x, i) {
      return '<button class="' + (i === tab ? 'on' : '') + (doneOf && doneOf(x) ? ' done' : '') + '" data-tab="' + i + '">' +
        (doneOf && doneOf(x) ? '✓ ' : '') + labelOf(x) + '</button>';
    }).join('') + '</div>';
  }

  // ---- the defuser: the bomb ----

  function moduleHtml(m, i) {
    if (m.solved) return '<div class="bs-solved">✓ ' + NAMES[m.type] + ' defused</div>';
    if (m.type === 'wires') {
      return '<p class="bs-help">Tap a wire to cut it.</p><div class="bs-wires">' + m.wires.map(function (c, w) {
        const cut = m.cut.indexOf(w) !== -1;
        return '<button class="wire w-' + c + (cut ? ' cut' : '') + '" data-mod="' + i + '" data-wire="' + w + '"' + (cut ? ' disabled' : '') + '>' +
          '<span class="n">' + (w + 1) + '</span><i></i></button>';
      }).join('') + '</div>';
    }
    if (m.type === 'button') {
      return '<p class="bs-help">Tap it, or press and hold.</p><div class="bs-button-row">' +
        '<button class="big-btn b-' + m.color + (m.pressed ? ' down' : '') + '" data-mod="' + i + '" data-press="1">' + esc(m.label) + '</button>' +
        '<div class="strip' + (m.strip ? ' s-' + m.strip : '') + '"></div></div>' +
        '<div class="bs-time big">' + clock(timeLeft()) + '</div>';
    }
    if (m.type === 'symbols') {
      return '<p class="bs-help">Press the four symbols in the right order.</p><div class="bs-keys">' + m.symbols.map(function (s, k) {
        const done = m.pressed.indexOf(k) !== -1;
        return '<button class="key' + (done ? ' done' : '') + '" data-mod="' + i + '" data-key="' + k + '"' + (done ? ' disabled' : '') + '><i class="led"></i>' + esc(s) + '</button>';
      }).join('') + '</div>';
    }
    return '<p class="bs-help">Spin the wheels to spell the password, then submit.</p><div class="bs-wheels">' + m.letters.split('').map(function (ch, w) {
      return '<div class="wheel"><button data-mod="' + i + '" data-spin="' + w + '" data-dir="-1">▲</button><span>' + esc(ch) + '</span>' +
        '<button data-mod="' + i + '" data-spin="' + w + '" data-dir="1">▼</button></div>';
    }).join('') + '</div><button class="primary bs-submit" data-mod="' + i + '" data-submit="1">SUBMIT</button>';
  }

  function batteries(n) {
    return n ? new Array(n + 1).join('<i class="battery"></i>') : '<span class="muted">none</span>';
  }

  function defuserHtml(v) {
    const b = v.bomb;
    if (tab >= b.modules.length) tab = 0;
    return '<div class="bs-edge"><span>SERIAL <strong>' + esc(b.edge.serial) + '</strong></span><span>BATTERIES ' + batteries(b.edge.batteries) + '</span></div>' +
      tabs(b.modules, function (m) { return NAMES[m.type]; }, function (m) { return m.solved; }) +
      '<div class="bs-module">' + moduleHtml(b.modules[tab], tab) + '</div>';
  }

  // ---- the expert: the manual ----

  const PAGES = ['wires', 'button', 'symbols', 'password'];

  function manualHtml(v) {
    const m = v.manual;
    const on = v.modules.map(function (x) { return x.type; });
    const page = PAGES[tab] || 'wires';
    let body = '';
    if (page === 'wires') {
      body = '<p>Wires are counted from the top: the first wire is the top one. Find the rules for the number of wires; the first rule that fits says which wire to cut.</p>' +
        Object.keys(m.wires).map(function (n) {
          return '<h4>' + n + ' wires</h4><ol>' + m.wires[n].map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ol>';
        }).join('');
    } else if (page === 'button') {
      body = '<p>The first rule that fits says whether to tap the button or hold it.</p><ol>' +
        m.button.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ol>' +
        '<h4>Holding the button</h4><p>A coloured strip lights up beside it. Let go when the timer shows this digit anywhere (e.g. 4 in 1:42):</p>' +
        '<div class="bs-strips">' + Object.keys(m.strip).map(function (c) {
          return '<span class="chip s-' + c + '">' + c + ' → <strong>' + m.strip[c] + '</strong></span>';
        }).join('') + '</div>';
    } else if (page === 'symbols') {
      body = '<p>Only one column has all four symbols on the bomb. Press them in the order they appear in that column, top to bottom.</p>' +
        '<div class="bs-columns">' + m.symbols.map(function (col) {
          return '<div class="col">' + col.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') + '</div>';
        }).join('') + '</div>';
    } else {
      body = '<p>The bomb has five letter wheels. Only one of these words can be spelled with them: find it and have the defuser set it, then submit.</p>' +
        '<div class="bs-words">' + m.passwords.map(function (w) { return '<span>' + esc(w.toUpperCase()) + '</span>'; }).join('') + '</div>';
    }
    return '<p class="bs-help">📖 Ask the defuser what they see. The serial number and batteries are on the bomb.</p>' +
      tabs(PAGES, function (p) { return (on.indexOf(p) !== -1 ? '<i class="on-bomb"></i>' : '') + NAMES[p]; }) +
      '<div class="bs-manual">' + body + '</div>';
  }

  // ---- screens ----

  function bodyHtml(v) {
    if (v.phase === 'needPhones') return '<div class="bs-card"><div class="big">📱 Two phones needed</div><p>The bomb and the manual are both secret, so each of you needs a phone. Go back to the lobby and join with phones.</p></div>';
    if (v.phase === 'over') {
      return '<div class="bs-card"><div class="big">' + v.stars + ' of ' + v.maxStars + ' ⭐</div><p>' +
        v.history.filter(function (h) { return h.defused; }).length + ' of ' + v.bombs + ' bombs defused.</p>' +
        '<button class="primary bs-rematch">Play again</button></div>';
    }
    const top = '<div class="bs-bar"><span class="bs-time">' + clock(timeLeft()) + '</span><span class="bs-strikes">' + strikes(v) + '</span></div>';
    if (v.phase === 'brief') {
      return top + '<div class="bs-card"><div class="big">' + (v.role === 'defuser' ? '🔧 You have the bomb' : '📖 You have the manual') + '</div><p>' +
        (v.role === 'defuser'
          ? 'Describe what you see. Only you can touch the bomb.'
          : 'You can\'t see the bomb: ask questions and tell them what to do.') +
        ' Keep your screen to yourself!</p><div class="count">' + v.countdown + '</div></div>';
    }
    if (v.phase === 'result' && v.result) {
      return top + '<div class="bs-card ' + (v.result.defused ? 'won' : 'boom') + '"><div class="big">' +
        (v.result.defused ? '✅ Defused! +' + v.result.stars + ' ⭐' : '💥 BOOM') + '</div><p>' +
        (v.bombIndex < v.bombs ? 'Swap roles for the next bomb…' : 'That was the last bomb.') + '</p></div>';
    }
    if (v.role === 'defuser') return top + defuserHtml(v);
    if (v.role === 'expert') return top + manualHtml(v);
    return '';
  }

  function render(v) {
    const prev = view;
    view = v;
    viewAt = performance.now();
    if (v.bombIndex !== tabBomb) {
      tabBomb = v.bombIndex;
      tab = 0;
      if (v.role === 'expert') tab = Math.max(0, PAGES.indexOf(v.modules.length ? v.modules[0].type : 'wires'));
    }
    // Defuser: when a module is done, go on to the next one still armed.
    if (v.role === 'defuser' && v.bomb && v.bomb.modules[tab] && v.bomb.modules[tab].solved) {
      const next = v.bomb.modules.findIndex(function (m) { return !m.solved; });
      if (next !== -1) tab = next;
    }
    if (prev && v.strikes > prev.strikes && v.phase !== 'brief') api.vibrate([120, 60, 120]);
    const key = JSON.stringify([v.phase, v.bombIndex, v.strikes, v.countdown, v.role, v.bomb, v.modules, v.result, v.stars, tab]);
    if (key === textKey) return;
    textKey = key;
    root.className = 'bs-phone phase-' + v.phase + (v.role ? ' role-' + v.role : '');
    els.body.innerHTML = bodyHtml(v);
  }

  function rerender() {
    textKey = '';
    if (view) render(view);
  }

  function release() {
    if (pressing === null) return;
    api.send({ type: 'release', module: pressing });
    pressing = null;
  }

  Ark.register('player', 'bomb-squad', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'bs-phone';
      root.innerHTML = '<div class="bs-body"></div>';
      el.appendChild(root);
      els = { body: root.querySelector('.bs-body') };
      root.addEventListener('click', function (e) {
        const t = e.target.closest('button');
        if (!t || t.disabled) return;
        if (t.hasAttribute('data-tab')) {
          tab = Number(t.getAttribute('data-tab'));
          return rerender();
        }
        if (t.classList.contains('bs-rematch')) return api.send({ type: 'rematch' });
        const mod = Number(t.getAttribute('data-mod'));
        if (t.hasAttribute('data-wire')) {
          api.send({ type: 'cut', module: mod, wire: Number(t.getAttribute('data-wire')) });
          api.vibrate(30);
        } else if (t.hasAttribute('data-key')) {
          api.send({ type: 'symbol', module: mod, index: Number(t.getAttribute('data-key')) });
          api.vibrate(15);
        } else if (t.hasAttribute('data-spin')) {
          api.send({ type: 'spin', module: mod, wheel: Number(t.getAttribute('data-spin')), dir: Number(t.getAttribute('data-dir')) });
        } else if (t.hasAttribute('data-submit')) {
          api.send({ type: 'submit', module: mod });
        }
      });
      // The big button: press on touch, release when the finger lifts anywhere
      // (the button may be redrawn while it's held).
      root.addEventListener('pointerdown', function (e) {
        const t = e.target.closest('[data-press]');
        if (!t || pressing !== null) return;
        e.preventDefault();
        pressing = Number(t.getAttribute('data-mod'));
        api.send({ type: 'press', module: pressing });
        api.vibrate(20);
      });
      document.addEventListener('pointerup', release);
      document.addEventListener('pointercancel', release);
      raf = requestAnimationFrame(frame);
    },
    update: render,
    unmount: function () {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointerup', release);
      document.removeEventListener('pointercancel', release);
      root = els = view = null;
      textKey = '';
      tabBomb = 0;
      pressing = null;
    },
  });
})();
