// Falling Blocks Battle on the phone (server/games/block-battle.js): ◀ ▶ (hold to keep moving:
// the hub repeats it), rotate either way, hold ▼ to soft drop, DROP to drop it at once.
// Watch your well on the TV. Everything held lets go if the phone locks or switches app.
(function () {
  Ark.loadCss('/games/block-battle/style.css');

  let root = null;
  let info = null;
  let api = null;
  let lastKey = '';
  let held = null; // pointer ids on each hold button: left, right, soft
  let sent = { dir: null, soft: null };

  function send() {
    if (!api) return;
    const dir = (held.right.size ? 1 : 0) - (held.left.size ? 1 : 0);
    const soft = held.soft.size > 0;
    if (dir !== sent.dir) {
      sent.dir = dir;
      api.send({ type: 'shift', dir: dir });
    }
    if (soft !== sent.soft) {
      sent.soft = soft;
      api.send({ type: 'soft', on: soft });
    }
  }

  function holdButton(btn, name) {
    const set = function (on) {
      return function (e) {
        e.preventDefault();
        if (on && btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
        if (on) held[name].add(e.pointerId);
        else held[name].delete(e.pointerId);
        btn.classList.toggle('on', held[name].size > 0);
        send();
      };
    };
    btn.addEventListener('pointerdown', set(true));
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { btn.addEventListener(ev, set(false)); });
  }

  function tapButton(btn, input) {
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (!api) return;
      api.send(input);
      api.vibrate(8);
    });
  }

  function releaseAll() {
    Object.keys(held).forEach(function (k) { held[k].clear(); });
    if (root) root.querySelectorAll('.hold').forEach(function (b) { b.classList.remove('on'); });
    send();
  }
  function onHide() { if (document.hidden) releaseAll(); }

  function render(v) {
    const you = v.you;
    const score = 'Rounds: you ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' them · first to ' + v.winScore;
    let status = '';
    let cls = '';
    if (v.phase === 'countdown') status = 'Round ' + v.round + ' starts in ' + v.countdown + '…';
    else if (v.phase === 'play') status = 'Lines: you ' + v.lines[you] + ' · them ' + v.lines[1 - you] + (v.pending ? ' · ⚠️ ' + v.pending + ' junk coming!' : '');
    else if (v.phase === 'roundEnd' && v.result) status = v.result.draw ? 'Both full: a draw' : v.result.roundWinner === you ? 'Round to you! 🎉' : 'Round to them';
    else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    const key = score + status + v.phase;
    if (key === lastKey) return;
    lastKey = key;
    info.innerHTML = '<div class="score">' + score + '</div><div class="status ' + cls + '">' + status + '</div>';
    if (v.phase === 'over') releaseAll();
    root.querySelector('.bb-pad').classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'block-battle', {
    mount: function (el, a) {
      api = a;
      held = { left: new Set(), right: new Set(), soft: new Set() };
      sent = { dir: null, soft: null };
      send(); // after a reload or reconnect: nothing held
      document.addEventListener('visibilitychange', onHide);
      root = document.createElement('div');
      root.className = 'bb-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="bb-pad">' +
        '<button class="rot ccw">↺</button><button class="rot cw">↻</button>' +
        '<button class="hold left">◀</button><button class="hold right">▶</button>' +
        '<button class="hold soft">▼</button><button class="primary drop">⤓ DROP</button>' +
        '</div><button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      holdButton(root.querySelector('.left'), 'left');
      holdButton(root.querySelector('.right'), 'right');
      holdButton(root.querySelector('.soft'), 'soft');
      tapButton(root.querySelector('.cw'), { type: 'rotate', dir: 1 });
      tapButton(root.querySelector('.ccw'), { type: 'rotate', dir: -1 });
      tapButton(root.querySelector('.drop'), { type: 'drop' });
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
    },
    update: render,
    unmount: function () {
      document.removeEventListener('visibilitychange', onHide);
      api = null;
      releaseAll();
      root = info = null;
      lastKey = '';
    },
  });
})();
