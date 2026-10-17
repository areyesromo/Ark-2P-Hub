// ArkMini: the client side of the minigame engine (server/games/minis/).
// Each minigame's renderer, public/games/minis/<id>.js, calls
//   ArkMini.register(id, {
//     host:  { mount(el, mctx), update(state, view), unmount() },
//     phone: { mount(el, mctx), update(state, view), unmount() },
//     pad(btn, state, slot, view)?      -> input or null (controller presses)
//     padPoll(pad, state, slot, view)?  -> input or null (held sticks; return
//                                         only discrete events, e.g. one shake)
//     sounds(prevState, state)?         -> sound names
//   })
// mctx: { t() ms since this screen saw the minigame start (0 before),
//         slot (phone), players, send(input) (phone; adds t), vibrate }.
// The lobby games (micro-mayhem, party-minis) draw the frame around it with
// ArkMini.hostFrame / ArkMini.phoneFrame and mount the current minigame.
(function () {
  const esc = Ark.escapeHtml;
  const regs = {};
  const loading = {};

  function load(id) {
    if (regs[id]) return Promise.resolve(regs[id]);
    if (!loading[id]) loading[id] = Ark.loadScript('/games/minis/' + id + '.js').then(function () { return regs[id]; });
    return loading[id];
  }

  const keyOf = function (v) { return v.count + ':' + v.mini.id; };
  const nameOf = function (v, slot) { return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>'; };

  /** Tracks when this screen first saw each minigame in play, for input times. */
  function clock() {
    let key = null;
    let at = 0;
    return {
      see: function (v) {
        if (v.phase === 'play' && key !== keyOf(v)) { key = keyOf(v); at = performance.now(); }
      },
      t: function (v) { return v && key === keyOf(v) ? Math.round(performance.now() - at) : 0; },
    };
  }

  /**
   * One minigame mounted in a frame: remounts when the minigame changes.
   * side: 'host' | 'phone'.
   */
  function slotFor(side, makeCtx) {
    let current = null; // { key, r, el }
    let pendingKey = null;
    let lastView = null;
    return {
      show: function (stage, v) {
        lastView = v;
        const key = keyOf(v);
        if (current && current.key === key) {
          if (current.r) current.r[side].update(v.state, v);
          return;
        }
        if (pendingKey === key) return;
        this.clear(stage);
        pendingKey = key;
        load(v.mini.id).then(function (r) {
          if (pendingKey !== key || !r) return;
          pendingKey = null;
          const el = document.createElement('div');
          el.className = 'mi-mini mi-' + v.mini.id;
          stage.appendChild(el);
          current = { key: key, r: r, el: el };
          r[side].mount(el, makeCtx());
          r[side].update(lastView.state, lastView);
        });
      },
      clear: function (stage) {
        if (current && current.r) current.r[side].unmount();
        current = null;
        pendingKey = null;
        if (stage) stage.innerHTML = '';
      },
      get r() { return current && current.r; },
    };
  }

  function timerBar(el, v, receivedAt) {
    const left = v.phase === 'play' ? Math.max(0, v.timeLeftMs - (performance.now() - receivedAt)) : 0;
    el.style.width = (v.phase === 'play' ? (100 * left) / v.durationMs : v.phase === 'intro' ? 100 : 0) + '%';
    el.classList.toggle('hurry', v.phase === 'play' && left < 1500);
  }

  /**
   * The TV renderer for a lobby game built on minigames. cfg:
   *   top(v) -> { left, mid, right } html for the score strip
   *   result(v) -> html for the result card
   *   over(v) -> html for the end card
   */
  function hostFrame(cfg) {
    let root = null;
    let els = null;
    let view = null;
    let receivedAt = 0;
    let raf = null;
    let cardKey = '';
    const clk = clock();
    const mini = slotFor('host', function () {
      return { t: function () { return clk.t(view); }, players: view.players };
    });

    function frame() {
      raf = requestAnimationFrame(frame);
      if (view && els) timerBar(els.bar, view, receivedAt);
    }

    function card(v) {
      if (v.phase === 'intro') {
        return '<div class="mi-card-in intro"><div class="order">' + esc(v.mini.order) + '</div><div class="how">' + esc(v.mini.howTo) + '</div>' +
          (v.mini.kind === 'party' ? '<div class="mi-ready">' + [0, 1].map(function (s) {
            return '<span class="' + (v.ready[s] ? 'on' : '') + '">' + nameOf(v, s) + (v.ready[s] ? ' ✔' : ' …') + '</span>';
          }).join('') + '</div><div class="muted">Ready on your phone (or A)</div>' : '') + '</div>';
      }
      if (v.phase === 'result') return '<div class="mi-card-in result">' + cfg.result(v) + '</div>';
      if (v.phase === 'over') return '<div class="mi-card-in over">' + cfg.over(v) + '<div class="muted">Rematch on a phone or press A (or ⚙ change the settings).</div></div>';
      return '';
    }

    return {
      mount: function (el) {
        root = document.createElement('div');
        root.className = 'mi-host ' + cfg.cls;
        root.innerHTML = '<div class="mi-top"><div class="l"></div><div class="m"></div><div class="r"></div></div>' +
          '<div class="mi-timer"><i></i></div><div class="mi-stage"></div><div class="mi-card"></div>';
        el.appendChild(root);
        els = {
          l: root.querySelector('.mi-top .l'), m: root.querySelector('.mi-top .m'), r: root.querySelector('.mi-top .r'),
          bar: root.querySelector('.mi-timer i'), stage: root.querySelector('.mi-stage'), card: root.querySelector('.mi-card'),
        };
        raf = requestAnimationFrame(frame);
        if (view) this.update(view);
      },
      update: function (v) {
        view = v;
        receivedAt = performance.now();
        clk.see(v);
        if (!root) return;
        const top = cfg.top(v);
        els.l.innerHTML = top.left;
        els.m.innerHTML = top.mid;
        els.r.innerHTML = top.right;
        root.setAttribute('data-phase', v.phase);
        const k = JSON.stringify([v.phase, v.count, v.ready, v.lastResult]);
        if (k !== cardKey) {
          cardKey = k;
          els.card.innerHTML = card(v);
        }
        if (v.phase === 'over') mini.clear(els.stage);
        else mini.show(els.stage, v);
      },
      unmount: function () {
        cancelAnimationFrame(raf);
        mini.clear(null);
        root = els = view = null;
        cardKey = '';
      },
      pad: function (btn, v, slot) {
        if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
        if (v.phase === 'intro') return v.mini.kind === 'party' && (btn === 'A' || btn === 'START') ? { type: 'ready' } : null;
        const r = mini.r;
        if (v.phase !== 'play' || !r || !r.pad) return null;
        const input = r.pad(btn, v.state, slot, v);
        if (input) input.t = clk.t(v);
        return input;
      },
      padPoll: function (pad, v, slot) {
        const r = mini.r;
        if (v.phase !== 'play' || !r || !r.padPoll) return null;
        const input = r.padPoll(pad, v.state, slot, v);
        if (input) input.t = clk.t(v);
        return input;
      },
    };
  }

  /** The minigame's own sounds while it's in play (merged into the lobby game's sounds hook). */
  function miniSounds(prev, v) {
    if (v.phase !== 'play' || prev.phase !== 'play' || keyOf(v) !== keyOf(prev)) return [];
    const r = regs[v.mini.id];
    return r && r.sounds ? r.sounds(prev.state, v.state) || [] : [];
  }

  /**
   * The phone renderer. cfg:
   *   top(v, me) -> html for the score strip
   *   result(v, me) -> html for the result card
   *   over(v, me) -> html for the end card (a Rematch button is added)
   */
  function phoneFrame(cfg) {
    let root = null;
    let els = null;
    let api = null;
    let view = null;
    let receivedAt = 0;
    let raf = null;
    let cardKey = '';
    const clk = clock();
    const mini = slotFor('phone', function () {
      return {
        t: function () { return clk.t(view); },
        slot: view.you,
        players: view.players,
        vibrate: api.vibrate,
        secureUrl: api.secureUrl,
        send: function (input) {
          if (!view || view.phase !== 'play') return;
          input.t = clk.t(view);
          api.send(input);
        },
      };
    });

    function frame() {
      raf = requestAnimationFrame(frame);
      if (view && els) timerBar(els.bar, view, receivedAt);
    }

    function card(v) {
      const me = v.you;
      if (v.phase === 'intro') {
        return '<div class="mi-card-in intro"><div class="order">' + esc(v.mini.order) + '</div><div class="how">' + esc(v.mini.howTo) + '</div>' +
          (v.mini.kind === 'party' ? (v.ready[me] ? '<div class="muted">Waiting for the other player…</div>' : '<button class="primary mi-ready-btn">Ready!</button>') : '') + '</div>';
      }
      if (v.phase === 'result') return '<div class="mi-card-in result">' + cfg.result(v, me) + '</div>';
      if (v.phase === 'over') return '<div class="mi-card-in over">' + cfg.over(v, me) + '<button class="primary mi-rematch">Rematch</button></div>';
      return '';
    }

    return {
      mount: function (el, a) {
        api = a;
        root = document.createElement('div');
        root.className = 'mi-phone ' + cfg.cls;
        root.innerHTML = '<div class="mi-top"></div><div class="mi-timer"><i></i></div><div class="mi-stage"></div><div class="mi-card"></div>';
        el.appendChild(root);
        els = { top: root.querySelector('.mi-top'), bar: root.querySelector('.mi-timer i'), stage: root.querySelector('.mi-stage'), card: root.querySelector('.mi-card') };
        els.card.addEventListener('click', function (e) {
          const b = e.target.closest('button');
          if (!b) return;
          if (b.classList.contains('mi-ready-btn')) { api.send({ type: 'ready' }); api.vibrate(15); }
          if (b.classList.contains('mi-rematch')) api.send({ type: 'rematch' });
        });
        raf = requestAnimationFrame(frame);
        if (view) this.update(view);
      },
      update: function (v) {
        view = v;
        receivedAt = performance.now();
        clk.see(v);
        if (!root) return;
        els.top.innerHTML = cfg.top(v, v.you);
        root.setAttribute('data-phase', v.phase);
        const k = JSON.stringify([v.phase, v.count, v.ready, v.lastResult]);
        if (k !== cardKey) {
          cardKey = k;
          els.card.innerHTML = card(v);
          if (v.phase === 'result') api.vibrate(cfg.buzz ? cfg.buzz(v, v.you) : 30);
        }
        if (v.phase === 'over') mini.clear(els.stage);
        else mini.show(els.stage, v);
      },
      unmount: function () {
        cancelAnimationFrame(raf);
        mini.clear(null);
        root = els = view = api = null;
        cardKey = '';
      },
    };
  }

  // Small helpers the minigame renderers share.
  const DIR_ARROW = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };
  /** ✓ / ✗ for a player's verdict in a micro (null: still playing). */
  function mark(res) { return res === null || res === undefined ? '' : res ? '<b class="mi-ok">✔</b>' : '<b class="mi-bad">✖</b>'; }
  /** A D-pad cursor over n choices laid out `cols` wide; returns the new index. */
  function moveCursor(i, btn, n, cols) {
    const d = { LEFT: -1, RIGHT: 1, UP: -cols, DOWN: cols }[btn];
    if (d === undefined) return i;
    const j = i + d;
    return j < 0 || j >= n ? i : j;
  }

  window.ArkMini = {
    register: function (id, r) { regs[id] = r; },
    load: load,
    hostFrame: hostFrame,
    phoneFrame: phoneFrame,
    miniSounds: miniSounds,
    nameOf: nameOf,
    mark: mark,
    moveCursor: moveCursor,
    DIR_ARROW: DIR_ARROW,
  };
})();
