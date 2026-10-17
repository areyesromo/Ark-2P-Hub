(function () {
  Ark.loadCss('/games/kart-race/style.css');
  let trackNames = []; // from the server's views
  const ROWS = [
    { key: 'track', title: 'Track', fmt: function (n) { return n === 0 ? 'Mixed' : trackNames[n - 1] || 'Track ' + n; } },
    { key: 'laps', title: 'Laps', fmt: function (n) { return n + ' laps'; } },
    { key: 'races', title: 'Races', fmt: function (n) { return n === 1 ? 'One race' : 'Best of ' + n; } },
    { key: 'items', title: 'Items (? boxes)', fmt: function (n) { return n ? 'On' : 'Off'; } },
  ];
  const ITEM_ICON = { banana: '🍌', turbo: '⚡', shield: '🛡️' };

  let root = null;
  let els = null;
  let api = null;
  let view = null;
  let textKey = '';
  const held = { left: false, right: false, brake: false };
  let sent = '';

  /** Send the controls when they change (hold ◀ / ▶ to steer, both cancel out). */
  function send() {
    const steer = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const key = steer + '|' + held.brake;
    if (key === sent) return;
    sent = key;
    api.send({ type: 'drive', steer: steer, brake: held.brake });
    els.left.classList.toggle('on', held.left);
    els.right.classList.toggle('on', held.right);
    els.brake.classList.toggle('on', held.brake);
  }

  /** A hold button (multi-touch: each button tracks its own finger). */
  function holdButton(el, name) {
    const down = function (e) {
      e.preventDefault();
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
      held[name] = true;
      api.vibrate(10);
      send();
    };
    const up = function () {
      held[name] = false;
      send();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  function status(v) {
    const me = v.you;
    if (v.phase === 'setup') return '<span class="big">🏎️ Kart Race</span><br>Pick the settings (either of you can), then start.';
    if (v.phase === 'over') {
      return '<span class="big ' + (v.winner === me ? 'won' : 'lost') + '">' + (v.winner === me ? 'You win! 🏆' : 'You lose') + '</span>' +
        (v.races > 1 ? '<br>You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' them' : '');
    }
    const k = v.karts[me];
    const pos = v.positions[me] === 1 ? '1st' : '2nd';
    if (v.phase === 'countdown') return '<span class="big">' + (v.countdown > 3 ? 'Get ready' : v.countdown) + '</span><br>' + v.track.name + ' · ' + v.laps + ' laps';
    if (v.phase === 'finish' && v.result) {
      return '<span class="big ' + (v.result.winner === me ? 'won">🏁 You win' : 'lost">They win') + (v.races > 1 ? ' race ' + v.race : '') + '!</span>';
    }
    return '<span class="big pos">' + pos + '</span><br>Lap ' + Math.min(v.laps, k.laps + 1) + ' / ' + v.laps + (k.spin ? ' · <span class="lost">🍌 Spun out!</span>' : k.shield ? ' · <span class="won">🛡️ Shielded</span>' : k.cut ? ' · <span class="lost">⛔ Shortcut! Back you go</span>' : k.offTrack ? ' · <span class="lost">on the grass!</span>' : k.boosting ? ' · <span class="won">BOOST!</span>' : '');
  }

  function render(v) {
    view = v;
    trackNames = v.trackNames || trackNames;
    const me = v.you;
    const k = v.karts && v.karts[me];
    const key = JSON.stringify([v.phase, v.race, v.countdown, v.scores, v.settings, v.positions && v.positions[me], k && [k.laps, k.offTrack, k.boosting, k.cut, k.item, k.spin, k.shield], v.result]);
    if (key === textKey) return;
    textKey = key;
    const setup = v.phase === 'setup';
    els.status.innerHTML = status(v);
    els.setup.innerHTML = setup ? Ark.setup.html(v, ROWS) : '';
    els.go.classList.toggle('hidden', !setup);
    els.controls.classList.toggle('hidden', setup || v.phase === 'over');
    els.rematch.classList.toggle('hidden', v.phase !== 'over');
    // The item button shows what you're holding.
    const item = k && k.item;
    els.item.textContent = item ? ITEM_ICON[item] : '—';
    els.item.classList.toggle('ready', Boolean(item));
    els.item.classList.toggle('hidden', !v.settings.items);
    els.change.classList.toggle('hidden', v.phase !== 'over');
    if (setup || v.phase === 'over') {
      held.left = held.right = held.brake = false;
      send();
    }
  }

  Ark.register('player', 'kart-race', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'kr-phone';
      root.innerHTML =
        '<div class="status"></div>' +
        '<div class="kr-setup-box"></div>' +
        '<button class="primary go hidden">Start</button>' +
        '<div class="kr-controls">' +
        '<div class="kr-steer"><button class="kr-btn left">◀</button><button class="kr-btn right">▶</button></div>' +
        '<div class="kr-bottom"><button class="kr-btn item">🎁</button><button class="kr-btn brake">BRAKE</button></div>' +
        '</div>' +
        '<button class="primary rematch hidden">Rematch</button>' +
        '<button class="ghost change hidden">Change settings</button>';
      el.appendChild(root);
      els = {
        status: root.querySelector('.status'),
        setup: root.querySelector('.kr-setup-box'),
        go: root.querySelector('.go'),
        controls: root.querySelector('.kr-controls'),
        left: root.querySelector('.left'),
        right: root.querySelector('.right'),
        brake: root.querySelector('.brake'),
        item: root.querySelector('.item'),
        rematch: root.querySelector('.rematch'),
        change: root.querySelector('.change'),
      };
      holdButton(els.left, 'left');
      holdButton(els.right, 'right');
      holdButton(els.brake, 'brake');
      els.item.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (!view || !view.karts || !view.karts[view.you].item) return;
        api.send({ type: 'item' });
        api.vibrate(30);
      });
      Ark.setup.bind(els.setup, api);
      els.go.addEventListener('click', function () { api.send({ type: 'go' }); });
      els.rematch.addEventListener('click', function () { api.send({ type: 'rematch' }); });
      els.change.addEventListener('click', function () { api.send({ type: 'setup' }); });
    },
    update: render,
    unmount: function () {
      root = els = view = null;
      held.left = held.right = held.brake = false;
      sent = textKey = '';
    },
  });
})();
