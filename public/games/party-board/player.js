// Party Board on a phone: your coins, stars and items, and big buttons for
// your choices. Minigames play in the minigame frame.
(function () {
  Ark.loadCss('/games/minis/style.css');
  Ark.loadCss('/games/party-board/style.css');
  const miniReady = Ark.loadScript('/games/minis/mini.js');
  const esc = Ark.escapeHtml;

  function option(v, kind, value) {
    if (value === 'none') return kind === 'item' ? '🎲 Just roll' : '🙅 Nothing';
    if (value === 'roll') return '🎲 ROLL!';
    if (value === 'yes') return '⭐ Buy a star (' + v.board.starPrice + ' 🪙)';
    if (kind === 'path') return 'Path ' + (Number(value) + 1) + ': ' + v.prompt.extra.previews[Number(value)].map(function (t) { return PEEK[t] || '·'; }).join(' ');
    if (value === 'no') return 'No thanks';
    if (value === 'stop') return '🎰 STOP!';
    const it = v.items[value];
    return it ? it.name + (kind === 'shop' ? ' · ' + it.price + ' 🪙' : '') + '<small>' + esc(it.what) + '</small>' : esc(value);
  }

  const ASK = { item: 'Use an item before you roll?', roll: 'Your turn!', star: 'You reached the star!', shop: 'Welcome to the shop!', slot: 'Stop the reels!', path: '🔀 A fork! Which way?' };
  const PEEK = { start: '🏁', blue: '🔵', red: '🔴', event: '❓', bonus: '🎰', shop: '🛒', warp: '🌀', thunder: '⚡', skull: '💀', tornado: '🌪️', star: '⭐' };

  const RECAP = [['stars', '⭐ Stars'], ['coins', '🪙 Coins'], ['minigames', '🎮 Minigames won'], ['earned', '💰 Earned'],
    ['spent', '🛍️ Spent'], ['lost', '💸 Lost'], ['bought', '🛒 Stars bought'], ['stolen', '🦹 Stars stolen'], ['warps', '🌀 Warps']];
  const BONUS = { minigame: '🎮', coin: '🪙' };

  /** You vs them, one line per number. */
  function recap(v) {
    if (!v.recap) return '';
    const mine = v.recap[v.you];
    const them = v.recap[1 - v.you];
    const bonus = function (r) { return r.bonus.map(function (k) { return BONUS[k] + '⭐'; }).join(' ') || '—'; };
    return '<table class="pb-recap-list"><tr><th></th><th>You</th><th>Them</th></tr>' +
      RECAP.map(function (row) { return '<tr><th>' + row[1] + '</th><td>' + mine[row[0]] + '</td><td>' + them[row[0]] + '</td></tr>'; }).join('') +
      (v.bonusStars ? '<tr><th>🌟 Bonus</th><td>' + bonus(mine) + '</td><td>' + bonus(them) + '</td></tr>' : '') + '</table>';
  }

  const CHARACTER = { engineer: '⚙️ Engineer', mechanic: '🔧 Mechanic' };

  let root = null;
  let api = null;
  let view = null;
  let frame = null;
  let frameMounted = false;
  let key = '';
  let receivedAt = 0;
  let ticker = null;

  function frameCfg() {
    return {
      cls: 'pm',
      top: function (m, me) {
        const b = view;
        return '<span>You ⭐' + b.players[me].stars + ' 🪙' + b.players[me].coins + '</span><span class="pm-round">Minigame</span><span>Them ⭐' + b.players[1 - me].stars + ' 🪙' + b.players[1 - me].coins + '</span>';
      },
      result: function (m, me) {
        const w = m.lastResult.winner;
        return '<div class="big ' + (w === me ? 'ok' : w === null ? '' : 'bad') + '">' + (w === null ? '🤝 Draw: +3 🪙' : w === me ? '🏆 +10 🪙!' : 'They win +10 🪙') + '</div>';
      },
      over: function () { return ''; },
      buzz: function (m, me) { return m.lastResult.winner === me ? [30, 30, 30] : 40; },
    };
  }

  function render() {
    const v = view;
    if (!root || !v) return;
    const me = v.you;
    if (v.phase === 'minigame') {
      if (frame && !frameMounted) { root.innerHTML = ''; frame.mount(root, api); frameMounted = true; key = ''; }
      if (frame) frame.update(v.mini);
      return;
    }
    if (frameMounted) { frame.unmount(); frameMounted = false; }
    const p = v.prompt;
    const k = JSON.stringify([v.phase, v.players, p && [p.slot, p.kind, p.options, p.extra], v.message, v.dice, v.round, v.winner, v.pick && v.pick.picks]);
    if (k === key) return;
    key = k;
    const mine = v.players[me];
    const them = v.players[1 - me];
    let h = '<div class="pb-phone"><div class="pb-me"><span>⭐ ' + mine.stars + '</span><span>🪙 ' + mine.coins + '</span><span class="muted">Them ⭐ ' + them.stars + ' · 🪙 ' + them.coins + '</span></div>' +
      '<div class="pb-items">' + (mine.items.length ? mine.items.map(function (id) { return '<span>' + esc(v.items[id].name) + '</span>'; }).join('') : '<span class="muted">No items: the 🛒 shop sells them</span>') + '</div>';
    if (v.phase === 'pick') {
      const mine = v.pick.picks[me];
      h += '<div class="pb-ask">' + (mine ? 'You picked the ' + CHARACTER[mine] + '!' : 'Pick your character') + '</div><div class="pb-pick">' +
        v.pick.options.map(function (c) {
          return '<button class="pb-char' + (mine === c ? ' picked' : '') + (mine && mine !== c ? ' ghost' : '') + '" data-pick="' + c + '"' + (mine ? ' disabled' : '') + '>' +
            '<img src="/games/party-board/figures/' + c + '.webp" alt=""><span>' + CHARACTER[c] + '</span></button>';
        }).join('') + '</div>' +
        (mine ? '<div class="pb-wait">' + (v.pick.picks[1 - me] ? '' : 'Waiting for them…') + '</div>' : '<div class="pb-time" data-end="' + (receivedAt + v.pick.msLeft) + '">' + Math.ceil(v.pick.msLeft / 1000) + ' s</div>');
    } else if (v.phase === 'over') {
      h += '<div class="pb-big">' + (v.draw ? '🤝 A draw' : v.winner === me ? '🏆 You win!' : 'You lose') + '</div>' + recap(v) + '<button class="primary pb-rematch">Rematch</button>';
    } else if (v.phase === 'bonus') {
      h += '<div class="pb-big">🌟 Bonus stars…</div>';
    } else {
      h += '<div class="pb-turn">Turn ' + v.round + ' / ' + v.turns + '</div>';
      if (v.dice) h += '<div class="pb-dice small">' + v.dice.values.map(function (d) { return '<span>' + d + '</span>'; }).join('') + (v.dice.bonus ? '<em>+' + v.dice.bonus + '</em>' : '') + '</div>';
      if (v.message) h += '<div class="pb-msg small">' + esc(v.message) + '</div>';
      if (p && p.slot === me) {
        h += '<div class="pb-ask">' + ASK[p.kind] + (p.kind === 'slot' ? ' <b>' + p.extra.reels.concat(['?', '?', '?']).slice(0, 3).join(' ') + '</b>' : '') + '</div><div class="pb-choices">' +
          p.options.map(function (o, i) { return '<button class="' + (o === 'none' || o === 'no' ? 'ghost' : 'primary') + (p.kind === 'path' ? ' route r' + i : '') + '" data-v="' + esc(o) + '">' + option(v, p.kind, o) + '</button>'; }).join('') + '</div>' +
          (p.kind === 'path' ? '<div class="pb-sub">The TV numbers each path ① ② on the board.</div>' : '') +
          '<div class="pb-time" data-end="' + (receivedAt + p.msLeft) + '">' + Math.ceil(p.msLeft / 1000) + ' s</div>';
      } else if (v.turn !== me || !p) {
        h += '<div class="pb-wait">' + (v.turn === me ? '…' : 'Their turn…') + '</div>';
      }
    }
    root.innerHTML = h + '</div>';
  }

  miniReady.then(function () {
    frame = ArkMini.phoneFrame(frameCfg());
    render();
  });

  Ark.register('player', 'party-board', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'pb-phone-root';
      el.appendChild(root);
      // Count the open choice's time down between views (none arrive while waiting).
      ticker = setInterval(function () {
        if (!root) return;
        root.querySelectorAll('.pb-time[data-end]').forEach(function (t) {
          t.textContent = Math.max(0, Math.ceil((Number(t.getAttribute('data-end')) - performance.now()) / 1000)) + ' s';
        });
      }, 250);
      root.addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (!b || !view || view.phase === 'minigame') return;
        if (b.classList.contains('pb-rematch')) return api.send({ type: 'rematch' });
        if (b.hasAttribute('data-pick')) {
          api.send({ type: 'pick', value: b.getAttribute('data-pick') });
          return api.vibrate(15);
        }
        const value = b.getAttribute('data-v');
        if (value === null) return;
        api.send({ type: 'choose', value: value });
        api.vibrate(15);
      });
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
      root = view = null;
      key = '';
    },
  });
})();
