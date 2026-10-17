// Party Board on the TV: the island, both tokens, a HUD per player, the dice,
// messages and whoever's choice is open. Minigames play in the minigame frame
// (public/games/minis/mini.js).
(function () {
  Ark.loadCss('/games/minis/style.css');
  Ark.loadCss('/games/party-board/style.css');
  const miniReady = Ark.loadScript('/games/minis/mini.js');
  const esc = Ark.escapeHtml;
  const ICON = { start: '🏁', blue: '', red: '', event: '❓', bonus: '🎰', shop: '🛒', warp: '🌀', thunder: '⚡', skull: '💀', tornado: '🌪️' };
  // A path preview: what each kind of space looks like in a line of icons.
  const PEEK = { start: '🏁', blue: '🔵', red: '🔴', event: '❓', bonus: '🎰', shop: '🛒', warp: '🌀', thunder: '⚡', skull: '💀', tornado: '🌪️', star: '⭐' };
  const KIND = { item: 'Use an item?', roll: 'Roll!', star: 'Buy a ⭐?', shop: '🛒 The shop', slot: '🎰 Stop the reels!', path: '🔀 Which way?' };
  const TIER = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

  /** A short label for a prompt option (the phone shows the long one). */
  function label(v, kind, value) {
    if (value === 'none') return kind === 'item' ? 'Just roll' : 'Nothing';
    if (value === 'roll') return '🎲 Roll';
    if (value === 'yes') return 'Yes';
    if (value === 'no') return 'No';
    if (value === 'stop') return 'STOP';
    if (kind === 'path') return 'Path ' + (Number(value) + 1) + ': ' + v.prompt.extra.previews[Number(value)].map(function (t) { return PEEK[t] || '·'; }).join(' ');
    if (kind === 'star' && value === 'yes') return 'Yes · ' + v.board.starPrice + ' 🪙';
    const it = v.items[value];
    return it ? it.name + (kind === 'shop' ? ' · ' + it.price + ' 🪙' : '') : value;
  }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.names[slot]) + '</span>';
  }

  function hud(v, slot) {
    const p = v.players[slot];
    return '<div class="pb-hud p' + (slot + 1) + (v.phase === 'board' && v.turn === slot ? ' active' : '') + '">' +
      '<div class="name">' + nameOf(v, slot) + '</div>' +
      '<div class="big">⭐ ' + p.stars + '</div><div class="coins">🪙 ' + p.coins + '</div>' +
      '<div class="items">' + (p.items.length ? p.items.map(function (id) { return '<span title="' + esc(v.items[id].name) + '">' + v.items[id].name.split(' ')[0] + '</span>'; }).join('') : '<span class="muted">no items</span>') + '</div></div>';
  }

  // Controller cursors over the open prompt's options, per slot.
  const cursors = [0, 0];
  let promptKey = '';

  let root = null;
  let els = null;
  let view = null;
  let frame = null; // the minigame frame (ArkMini.hostFrame)
  let frameMounted = false;
  let receivedAt = 0;
  let ticker = null;

  function frameCfg() {
    return {
      cls: 'pm',
      top: function () {
        const b = view;
        const side = function (s) { return nameOf(b, s) + ' ⭐' + b.players[s].stars + ' 🪙' + b.players[s].coins; };
        return { left: side(0), mid: '<span class="pm-round">Minigame · turn ' + b.round + ' / ' + b.turns + '</span>', right: side(1) };
      },
      result: function (m) {
        const w = m.lastResult.winner;
        return '<div class="title">' + (w === null ? '🤝 A draw: +3 🪙 each' : '🏆 ' + nameOf(view, w) + ' wins +10 🪙') + '</div>';
      },
      over: function () { return ''; },
    };
  }

  /** The links between spaces (arrows at forks) and the warps' dashed jumps, under the spaces. */
  function links(spaces) {
    let l = '';
    spaces.forEach(function (s) {
      s.next.forEach(function (n) {
        const t = spaces[n];
        l += '<line x1="' + s.x * 100 + '" y1="' + s.y * 100 + '" x2="' + t.x * 100 + '" y2="' + t.y * 100 + '"' + (s.next.length > 1 ? ' class="fork" marker-end="url(#pb-arrow)"' : '') + '/>';
      });
      if (s.type === 'warp') {
        const w = spaces[s.warp];
        const mx = (s.x + w.x) * 50;
        const my = Math.min(s.y, w.y) * 100 - 12;
        l += '<path class="warp" d="M' + s.x * 100 + ' ' + s.y * 100 + ' Q' + mx + ' ' + my + ' ' + w.x * 100 + ' ' + w.y * 100 + '"/>';
      }
    });
    return '<svg class="pb-links" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><marker id="pb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker></defs>' + l + '</svg>';
  }

  function drawBoard(v) {
    const spaces = v.board.spaces;
    let h = links(spaces);
    spaces.forEach(function (s, i) {
      h += '<div class="pb-space ' + s.type + (i === v.board.star ? ' star' : '') + '" style="left:' + s.x * 100 + '%;top:' + s.y * 100 + '%">' +
        (i === v.board.star ? '⭐' : ICON[s.type]) + '</div>';
    });
    v.players.forEach(function (p, slot) {
      const s = spaces[p.space];
      const shared = v.players[1 - slot].space === p.space;
      h += '<div class="pb-token p' + (slot + 1) + '" style="left:calc(' + s.x * 100 + '% + ' + (shared ? (slot ? 14 : -14) : 0) + 'px);top:calc(' + s.y * 100 + '% - 18px)">' + esc(v.names[slot].slice(0, 1).toUpperCase()) + '</div>';
    });
    return h;
  }

  function centre(v) {
    if (v.phase === 'bonus') {
      return '<div class="pb-msg">🌟 Bonus stars!</div>' + v.bonusStars.map(function (b) {
        return '<div class="pb-sub">' + (b.kind === 'minigame' ? '🎮 Minigame star' : '🪙 Coin star') + ': ' + b.slots.map(function (s) { return nameOf(v, s); }).join(' & ') + '</div>';
      }).join('');
    }
    if (v.phase === 'over') {
      return '<div class="pb-msg">' + (v.draw ? '🤝 A draw!' : '🏆 ' + nameOf(v, v.winner) + ' wins!') + '</div>' +
        '<div class="pb-sub">⭐ ' + v.players[0].stars + ' – ' + v.players[1].stars + ' ⭐ · 🪙 ' + v.players[0].coins + ' – ' + v.players[1].coins + ' 🪙</div>' +
        '<div class="pb-sub muted">Rematch on a phone or press A (or ⚙ change the settings).</div>';
    }
    let h = '<div class="pb-mapname ' + v.board.tier + '">' + esc(v.board.name) + ' · ' + TIER[v.board.tier] + '</div>' +
      '<div class="pb-turn">Turn ' + v.round + ' / ' + v.turns + ' · ' + nameOf(v, v.turn) + '</div>';
    if (v.dice) h += '<div class="pb-dice">' + v.dice.values.map(function (d) { return '<span>' + d + '</span>'; }).join('') + (v.dice.bonus ? '<em>+' + v.dice.bonus + '</em>' : '') + '</div>';
    if (v.message) h += '<div class="pb-msg">' + esc(v.message) + '</div>';
    const p = v.prompt;
    if (p) {
      const local = v.localPlayers[p.slot];
      h += '<div class="pb-ask">' + nameOf(v, p.slot) + ': ' + KIND[p.kind] + (p.kind === 'slot' ? ' <b>' + p.extra.reels.concat(['?', '?', '?']).slice(0, 3).join(' ') + '</b>' : '') + '</div>' +
        '<div class="pb-opts">' + p.options.map(function (o, i) {
          return '<span class="' + (local && cursors[p.slot] === i ? 'cur' : '') + '">' + esc(label(v, p.kind, o)) + '</span>';
        }).join('') + '</div><div class="pb-time" data-end="' + (receivedAt + p.msLeft) + '">' + Math.ceil(p.msLeft / 1000) + ' s</div>';
    }
    return h;
  }

  function render() {
    const v = view;
    if (!root || !v) return;
    const key = v.prompt ? [v.prompt.slot, v.prompt.kind, v.prompt.options.join()].join('|') : '';
    if (key !== promptKey) { promptKey = key; cursors[0] = cursors[1] = 0; }
    root.setAttribute('data-phase', v.phase);
    if (v.phase === 'minigame') {
      if (frame && !frameMounted) { els.mini.innerHTML = ''; frame.mount(els.mini); frameMounted = true; }
      if (frame) frame.update(v.mini);
      return;
    }
    if (frameMounted) { frame.unmount(); frameMounted = false; els.mini.innerHTML = ''; }
    els.left.innerHTML = hud(v, 0);
    els.right.innerHTML = hud(v, 1);
    els.board.innerHTML = drawBoard(v);
    els.centre.innerHTML = centre(v);
  }

  /** Count the open choice's time down between views (none arrive while waiting). */
  function tickDown(el) {
    if (!el) return;
    el.querySelectorAll('.pb-time[data-end]').forEach(function (t) {
      t.textContent = Math.max(0, Math.ceil((Number(t.getAttribute('data-end')) - performance.now()) / 1000)) + ' s';
    });
  }

  miniReady.then(function () {
    frame = ArkMini.hostFrame(frameCfg());
    render();
  });

  Ark.register('host', 'party-board', {
    padHint: '←→ pick · A choose · in minigames: as shown · A: rematch at the end',
    sounds: function (prev, v) {
      if (v.phase === 'minigame' && prev.phase === 'minigame') {
        const out = [];
        if (v.mini.phase === 'play' && prev.mini.phase !== 'play') out.push('go');
        if (v.mini.phase === 'result' && prev.mini.phase !== 'result' && v.mini.lastResult.winner !== null) out.push('point');
        if (window.ArkMini) out.push.apply(out, ArkMini.miniSounds(prev.mini, v.mini));
        return out;
      }
      if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
      if (v.phase === 'bonus' && prev.phase !== 'bonus') return ['reveal'];
      if (v.phase !== 'board' || prev.phase !== 'board') return [];
      const out = [];
      if (v.players.some(function (p, i) { return p.space !== prev.players[i].space; })) out.push('tick');
      const bought = v.players.some(function (p, i) { return p.stars > prev.players[i].stars || p.items.length > prev.players[i].items.length; });
      if (bought) out.push('lock');
      else {
        const delta = v.players.reduce(function (a, p, i) { return a + p.coins - prev.players[i].coins; }, 0);
        if (delta > 0) out.push('point');
        if (delta < 0) out.push('wrong');
      }
      return out;
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'minigame') return frame ? frame.pad(btn, v.mini, slot) : null;
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      const p = v.prompt;
      if (v.phase !== 'board' || !p || p.slot !== slot) return null;
      if (btn === 'A' || btn === 'START') return { type: 'choose', value: p.options[cursors[slot]] || p.options[0] };
      const d = btn === 'LEFT' || btn === 'UP' ? -1 : btn === 'RIGHT' || btn === 'DOWN' ? 1 : 0;
      if (d) {
        cursors[slot] = (cursors[slot] + d + p.options.length) % p.options.length;
        render();
      }
      return null;
    },
    padPoll: function (pad, v, slot) {
      return v.phase === 'minigame' && frame ? frame.padPoll(pad, v.mini, slot) : null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'pb-host';
      root.innerHTML = '<div class="pb-left"></div><div class="pb-mid"><div class="pb-boardbox"><div class="pb-board"></div></div><div class="pb-centre"></div></div><div class="pb-right"></div><div class="pb-mini"></div>';
      el.appendChild(root);
      ticker = setInterval(function () { tickDown(root); }, 250);
      els = {
        left: root.querySelector('.pb-left'), right: root.querySelector('.pb-right'),
        board: root.querySelector('.pb-board'), centre: root.querySelector('.pb-centre'), mini: root.querySelector('.pb-mini'),
      };
      render();
    },
    update: function (v) {
      view = v;
      receivedAt = performance.now();
      render();
    },
    unmount: function () {
      clearInterval(ticker);
      if (frameMounted) frame.unmount();
      frameMounted = false;
      root = els = view = null;
      promptKey = '';
    },
  });
})();
