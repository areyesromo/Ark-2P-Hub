(function () {
  Ark.loadCss('/games/make-24/style.css');
  const SIGN = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  let root = null;
  let api = null;
  let view = null;
  let key = ''; // the puzzle being worked (a new one starts afresh)
  // Your working: items in the server's order (a join takes two out and puts the result on the
  // end), each with the grid spot it shows in. history holds the working before each join.
  let items = [];
  let steps = [];
  let history = [];
  let picked = null; // index into items
  let op = null;
  let wrong = false;
  let sent = false;

  const gcd = function (a, b) { return b ? gcd(b, a % b) : Math.abs(a); };
  function frac(n, d) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    return [n / g, d / g];
  }
  function apply(a, o, b) {
    if (o === '+') return frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
    if (o === '-') return frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
    if (o === '*') return frac(a[0] * b[0], a[1] * b[1]);
    return b[0] === 0 ? null : frac(a[0] * b[1], a[1] * b[0]);
  }
  function show(f) {
    if (f[1] === 1) return String(f[0]);
    return '<span class="m24-frac"><sup>' + f[0] + '</sup><sub>' + f[1] + '</sub></span>';
  }

  function reset() {
    items = view.numbers.map(function (n, i) { return { v: [n, 1], pos: i, fresh: false }; });
    steps = [];
    history = [];
    picked = op = null;
    wrong = sent = false;
  }

  function progress() {
    if (steps.length < 3) api.send({ type: 'progress', joined: steps.length });
  }

  function tapNumber(i) {
    if (wrong) return;
    if (picked === null || op === null) {
      picked = picked === i ? null : i;
      return render();
    }
    if (i === picked) { picked = null; op = null; return render(); }
    const v = apply(items[picked].v, op, items[i].v);
    if (!v) { api.vibrate([30, 30, 30]); op = null; return render(); } // (÷ 0)
    history.push({ items: items, steps: steps });
    const joined = { v: v, pos: items[i].pos, fresh: true };
    steps = steps.concat([[picked, op, i]]);
    items = items.filter(function (_, k) { return k !== picked && k !== i; }).map(function (x) { return Object.assign({}, x, { fresh: false }); }).concat(joined);
    picked = items.length - 1;
    op = null;
    api.vibrate(12);
    if (items.length === 1) {
      picked = null;
      if (v[0] === 24 && v[1] === 1) {
        sent = true;
        api.send({ type: 'solve', steps: steps });
        api.vibrate([40, 30, 40]);
      } else {
        wrong = true;
        api.vibrate(150);
        progress();
      }
    } else {
      progress();
    }
    render();
  }

  function onClick(e) {
    if (!view) return;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (view.phase !== 'play' || sent) return;
    const n = e.target.closest('[data-item]');
    if (n) return tapNumber(Number(n.getAttribute('data-item')));
    const o = e.target.closest('[data-op]');
    if (o && picked !== null && !wrong) {
      op = o.getAttribute('data-op');
      return render();
    }
    if (e.target.closest('.m24-undo') && history.length) {
      const h = history.pop();
      items = h.items.map(function (x) { return Object.assign({}, x, { fresh: false }); });
      steps = h.steps;
      picked = op = null;
      wrong = false;
      progress();
      return render();
    }
    if (e.target.closest('.m24-reset')) {
      reset();
      progress();
      return render();
    }
    if (e.target.closest('.m24-skip')) api.send({ type: 'skip' });
  }

  /** Your numbers in their spots (the gaps close up as they're joined). */
  function grid() {
    const order = items.map(function (x, i) { return i; }).sort(function (a, b) { return items[a].pos - items[b].pos; });
    return '<div class="m24-grid n' + items.length + '">' + order.map(function (i) {
      const it = items[i];
      return '<button class="m24-tile' + (picked === i ? ' picked' : '') + (it.fresh ? ' fresh' : '') +
        (items.length === 1 ? (wrong ? ' wrong' : ' right') : '') + '" data-item="' + i + '">' + show(it.v) + '</button>';
    }).join('') + '</div>';
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="ark-result won">You win! 🏆</span>' : '<span class="ark-result lost">You lose</span>';
    if (v.phase === 'roundEnd') {
      const r = v.result;
      return (r.solved ? (r.winner === me ? '<span class="won">You made 24!</span>' : '<span class="lost">They made it first</span>') : 'Nobody got it') +
        '<small>' + Ark.escapeHtml(r.text) + ' = 24</small>';
    }
    if (sent) return '<span class="won">24! ✓</span>';
    if (wrong) return '<span class="lost">That makes ' + show(items[0].v) + ', not 24</span><small>Undo, or start over</small>';
    if (picked === null) return 'Tap a number';
    if (op === null) return 'Now + − × or ÷';
    return 'Now another number';
  }

  function render() {
    if (!root || !view) return;
    const v = view;
    const me = v.you;
    const playing = v.phase === 'play';
    let html = '<div class="m24-top"><span>You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them</span><span>Puzzle ' + v.round + '</span></div>' +
      '<p class="m24-msg">' + message(v) + '</p>';
    if (v.phase === 'over') {
      html += '<button class="primary rematch">Rematch</button>';
    } else {
      html += grid() +
        '<div class="m24-ops">' + ['+', '-', '*', '/'].map(function (o) {
          return '<button class="m24-op' + (op === o ? ' on' : '') + '" data-op="' + o + '"' + (picked === null || wrong || !playing ? ' disabled' : '') + '>' + SIGN[o] + '</button>';
        }).join('') + '</div>' +
        '<div class="m24-tools"><button class="m24-undo"' + (history.length && playing ? '' : ' disabled') + '>↶ Undo</button>' +
        '<button class="m24-reset"' + (history.length && playing ? '' : ' disabled') + '>Start over</button>' +
        '<button class="m24-skip' + (v.skips[me] ? ' on' : '') + '"' + (playing ? '' : ' disabled') + '>' + (v.skips[me] ? 'Gave up ✓' : 'Give up') + '</button></div>' +
        (v.skips[me] && !v.skips[1 - me] ? '<p class="m24-small">It moves on if they give up too' + (v.timed ? ', or when the time is up' : '') + '</p>' : '');
    }
    root.innerHTML = html;
  }

  Ark.register('player', 'make-24', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'm24-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
    },
    update: function (v) {
      const prev = view;
      view = v;
      const k = v.round + ':' + v.numbers.join();
      if (k !== key) { key = k; reset(); }
      if (prev && prev.phase === 'play' && v.phase !== 'play' && v.result) api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
    },
  });
})();
