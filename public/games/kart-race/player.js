(function () {
  Ark.loadCss('/games/kart-race/style.css');
  const tiltReady = Ark.loadScript('/shared/tilt.js');
  // The racers and tyres (shared with the server): draw the pick cards once it's here.
  Ark.loadScript('/games/kart-race/racers.js').then(function () {
    textKey = '';
    if (view && els) render(view);
  });
  const RACER_KEY = 'ark.kart.racer';
  const TYRE_KEY = 'ark.kart.tyre';
  const STAT_ROWS = [['speed', 'Speed'], ['accel', 'Acceleration'], ['handling', 'Handling'], ['weight', 'Weight']];
  let trackNames = []; // from the server's views
  const ROWS = [
    { key: 'track', title: 'Track', fmt: function (n) { return n === 0 ? 'Mixed' : trackNames[n - 1] || 'Track ' + n; } },
    { key: 'laps', title: 'Laps', fmt: function (n) { return n + ' laps'; } },
    { key: 'races', title: 'Races', fmt: function (n) { return n === 1 ? 'One race' : 'Best of ' + n; } },
    { key: 'items', title: 'Items (? boxes)', fmt: function (n) { return n ? 'On' : 'Off'; } },
  ];
  const ITEM_ICON = { banana: '🍌', turbo: '⚡', shield: '🛡️' };

  // Each phone picks its own controller on the setup screen (remembered on the phone):
  //   buttons   hold ◀ / ▶
  //   joystick  a stick: left/right steers as far as you push it, push up for gas, pull down to brake
  //   slide     put a finger down anywhere on the pad and slide it left/right
  //   tilt      turn the phone like a steering wheel (needs the motion sensor)
  // and a layout: 'auto' follows how the phone is held; 'landscape' turns the
  // controls sideways even if the phone's rotation is locked (steering under
  // the left thumb, the pedals under the right). The pedals are the same in every style: hold
  // GAS to drive, let go to coast; hold BRAKE to stop and then reverse; hold DRIFT through a
  // bend for a mini-boost when you let go.
  const STYLE_KEY = 'ark.kart.controls';
  const STYLES = ['buttons', 'joystick', 'slide', 'tilt'];
  const STYLE_LABEL = { buttons: '🔘 Buttons', joystick: '🕹️ Joystick', slide: '👆 Slide', tilt: '📱 Tilt' };
  const LAYOUT_KEY = 'ark.kart.layout';
  const LAYOUTS = ['auto', 'landscape', 'portrait'];
  const LAYOUT_LABEL = { auto: '🔄 Auto', landscape: '↔ Landscape', portrait: '↕ Portrait' };
  const TILT_FULL = Math.sin(25 * Math.PI / 180); // tilt for full lock
  const DEAD = 0.06; // ignore tiny wobbles of the stick, finger or phone

  function load(key, allowed, fallback) {
    try { const v = localStorage.getItem(key); return allowed.indexOf(v) !== -1 ? v : fallback; } catch (e) { return fallback; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }
  let style = load(STYLE_KEY, STYLES, 'buttons');
  let layout = load(LAYOUT_KEY, LAYOUTS, 'auto');

  let host = null; // the game area the hub gave us
  let fit = null; // ResizeObserver keeping the sideways controller over the game area
  let root = null;
  let els = null;
  let api = null;
  let view = null;
  let textKey = '';
  const held = { left: false, right: false, brake: false, gas: false, drift: false };
  let analog = 0; // steering from the stick, slide or tilt: -1..1
  let stickBrake = false; // stick pulled down
  let stickGas = false; // stick pushed up
  const KMH = 12; // speed units -> km/h, as on the TV's dial
  let sent = '';
  let tiltNote = '';
  let restored = false; // sent this phone's remembered racer and tyres yet?

  const clamp = function (x) { return Math.max(-1, Math.min(1, x)); };
  const dead = function (x) { return Math.abs(x) < DEAD ? 0 : x; };

  /** Send the controls when they change. */
  function send() {
    const steer = style === 'buttons' ? (held.right ? 1 : 0) - (held.left ? 1 : 0) : Math.round(dead(analog) * 10) / 10;
    const brake = held.brake || stickBrake;
    const gas = held.gas || stickGas;
    const drift = held.drift;
    const key = steer + '|' + gas + '|' + brake + '|' + drift;
    if (!els || key === sent) return;
    sent = key;
    api.send({ type: 'drive', steer: steer, gas: gas, brake: brake, drift: drift });
    if (els.left) {
      els.left.classList.toggle('on', held.left);
      els.right.classList.toggle('on', held.right);
    }
    els.brake.classList.toggle('on', brake);
    els.gas.classList.toggle('on', gas);
    els.drift.classList.toggle('on', drift);
  }

  function release() {
    held.left = held.right = held.brake = held.gas = held.drift = false;
    analog = 0;
    stickBrake = stickGas = false;
    send();
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

  /**
   * Where a finger is on an element, from its centre, in the controller's own
   * directions (the landscape layout may have turned it a quarter turn).
   */
  function local(e, el) {
    const r = el.getBoundingClientRect();
    const sx = e.clientX - (r.left + r.width / 2);
    const sy = e.clientY - (r.top + r.height / 2);
    return root.classList.contains('rotated') ? { x: sy, y: -sx, w: r.height, h: r.width } : { x: sx, y: sy, w: r.width, h: r.height };
  }

  /** One finger dragging on the steering pad: onMove(point, start) while down, onUp() after. */
  function dragPad(el, onMove, onUp) {
    let finger = null;
    let start = null;
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (finger !== null) return;
      finger = e.pointerId;
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
      start = local(e, el);
      api.vibrate(10);
      onMove(start, start);
    });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerId === finger) onMove(local(e, el), start);
    });
    const up = function (e) {
      if (e.pointerId !== finger) return;
      finger = null;
      onUp();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  // ---- the steering pad for each style ----

  function buildSteer() {
    release();
    els.left = els.right = els.knob = els.mark = els.wheel = null;
    const pad = els.steer;
    pad.className = 'kr-steer ' + style;
    if (style === 'buttons') {
      pad.innerHTML = '<button class="kr-btn left">◀</button><button class="kr-btn right">▶</button>';
      els.left = pad.querySelector('.left');
      els.right = pad.querySelector('.right');
      holdButton(els.left, 'left');
      holdButton(els.right, 'right');
    } else if (style === 'joystick') {
      pad.innerHTML = '<div class="kr-stick"><div class="kr-knob"></div><span class="kr-hint">◀ ▶ steer · ▲ gas · ▼ brake</span></div>';
      const stick = pad.querySelector('.kr-stick');
      els.knob = pad.querySelector('.kr-knob');
      dragPad(stick, function (p) {
        const reach = Math.min(p.w, p.h) * 0.38; // the knob's travel
        const x = clamp(p.x / reach);
        const y = clamp(p.y / reach);
        analog = x;
        stickBrake = y > 0.6;
        stickGas = y < -0.35;
        els.knob.style.transform = 'translate(' + (x * 70) + '%, ' + (y * 70) + '%)';
        send();
      }, function () {
        analog = 0;
        stickBrake = stickGas = false;
        els.knob.style.transform = '';
        send();
      });
    } else if (style === 'slide') {
      pad.innerHTML = '<div class="kr-slide"><div class="kr-mark"></div><span class="kr-hint">Put a finger down and slide ◀ ▶</span></div>';
      const slide = pad.querySelector('.kr-slide');
      els.mark = pad.querySelector('.kr-mark');
      dragPad(slide, function (p, start) {
        analog = clamp((p.x - start.x) / (p.w * 0.22)); // a short slide for full lock
        els.mark.style.left = (50 + analog * 45) + '%';
        els.mark.classList.add('on');
        send();
      }, function () {
        analog = 0;
        els.mark.style.left = '';
        els.mark.classList.remove('on');
        send();
      });
    } else {
      pad.innerHTML = '<div class="kr-tilt"><div class="kr-wheel"><i></i></div><span class="kr-hint">Turn the phone like a wheel · tap here to re-centre</span></div>';
      els.wheel = pad.querySelector('.kr-wheel');
      pad.querySelector('.kr-tilt').addEventListener('pointerdown', function (e) {
        e.preventDefault();
        tilt.centre = tilt.raw;
        api.vibrate(20);
      });
    }
  }

  // ---- tilt (the motion sensor, see shared/tilt.js) ----
  // Phones only allow the sensor on secure (https) pages: on plain http we
  // fall back to the joystick and offer the hub's https address instead.

  const tilt = { raw: 0, centre: 0, on: false };
  let secureUrl = null; // where to go for tilt, when this page can't

  function onTilt(t) {
    tilt.raw = -t.right; // lower the right side to steer right
    if (style !== 'tilt' || !els) return;
    analog = clamp((tilt.raw - tilt.centre) / TILT_FULL);
    if (els.wheel) els.wheel.style.transform = 'rotate(' + Math.round(dead(analog) * 90) + 'deg)';
    send();
  }

  function stopTilt() {
    tilt.on = false;
    if (window.ArkTilt) ArkTilt.stop();
  }

  function onTiltError(code, message) {
    tilt.on = false;
    if (code === 'ask') {
      tiltNote = message;
      return renderPrefs();
    }
    secureUrl = code === 'insecure' && api ? api.secureUrl({ 'ark.kart.controls': 'tilt', 'ark.kart.layout': layout }) : null;
    tiltNote = message + ' Using the joystick for now.';
    setStyle('joystick', true);
  }

  /** Start reading the sensor. `fromTap`: called from a tap (iPhones need one to ask permission). */
  function startTilt(fromTap) {
    if (tilt.on) return;
    tilt.on = true;
    tiltReady.then(function () {
      if (!els || style !== 'tilt') {
        tilt.on = false;
        return;
      }
      ArkTilt.start(onTilt, onTiltError, {
        fromTap: fromTap,
        extra: function () { return root && root.classList.contains('rotated') ? 90 : 0; },
      });
    });
  }

  function setStyle(next, keepNote) {
    if (next !== 'tilt') stopTilt();
    if (!keepNote) {
      tiltNote = '';
      secureUrl = null;
    }
    style = next;
    store(STYLE_KEY, style);
    if (!els) return;
    buildSteer();
    renderPrefs();
  }

  // ---- the controller settings (setup and end screens) ----

  function renderPrefs() {
    if (!els) return;
    const seg = function (list, labels, on, attr) {
      return '<div class="seg">' + list.map(function (v) {
        return '<button class="opt' + (v === on ? ' on' : '') + '" ' + attr + '="' + v + '">' + labels[v] + '</button>';
      }).join('') + '</div>';
    };
    els.prefs.innerHTML =
      '<div class="title">Your controller <span>(this phone)</span></div>' +
      seg(STYLES, STYLE_LABEL, style, 'data-style') +
      '<div class="title">Layout while racing</div>' +
      seg(LAYOUTS, LAYOUT_LABEL, layout, 'data-layout') +
      (tiltNote ? '<p class="kr-note">' + Ark.escapeHtml(tiltNote) + '</p>' : '') +
      (secureUrl ? '<a class="btn ghost kr-secure" href="' + Ark.escapeHtml(secureUrl) + '">🔒 Switch to the secure page for tilt</a>' +
        '<p class="kr-note muted">Your phone will warn that the page isn\'t private (the hub signs its own certificate): choose Advanced → Proceed, once. You keep your seat.</p>' : '');
  }

  // ---- racer and tyres (setup and end screens) ----

  function remembered(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  /** One stat as a bar of 6 cells: the racer's own, plus (green) or minus (red) for the tyres. */
  function statBar(base, mod) {
    let h = '';
    for (let i = 1; i <= 6; i++) {
      const cls = mod > 0 && i > base && i <= base + mod ? 'plus' : mod < 0 && i > base + mod && i <= base ? 'minus' : i <= base ? 'on' : '';
      h += '<i class="' + cls + '"></i>';
    }
    return h;
  }

  function renderPicks(v) {
    const R = window.ArkKartRacers;
    if (!R) return '';
    const mine = v.picks[v.you];
    const racer = R.racer(mine.racer);
    const tyre = R.tyre(mine.tyre);
    return '<div class="title">Your racer</div><div class="kr-racers">' + R.RACERS.map(function (r) {
      return '<button type="button" class="kr-racer' + (r.id === racer.id ? ' on' : '') + '" data-racer="' + r.id + '"><span>' + r.emoji + '</span>' + r.name + '</button>';
    }).join('') + '</div>' +
      '<div class="title">Tyres</div><div class="kr-tyres">' + R.TYRES.map(function (t) {
        return '<button type="button" class="kr-tyre' + (t.id === tyre.id ? ' on' : '') + '" data-tyre="' + t.id + '"><span>' + t.emoji + '</span>' + t.name + '</button>';
      }).join('') + '</div>' +
      '<div class="kr-stats"><div class="who">' + racer.emoji + ' ' + racer.name + ' · ' + R.TYPES[racer.type].label + ' · ' + tyre.emoji + ' ' + tyre.name + '</div>' +
      STAT_ROWS.map(function (row) {
        return '<div class="stat"><span>' + row[1] + '</span><div class="bar">' + statBar(racer.stats[row[0]], tyre.mod[row[0]] || 0) + '</div></div>';
      }).join('') + '</div>';
  }

  /** Once per visit to the setup screen: ask for this phone's remembered racer and tyres. */
  function restorePicks(v) {
    const R = window.ArkKartRacers;
    if (restored || !R || v.phase !== 'setup') return;
    restored = true;
    const mine = v.picks[v.you];
    const racer = remembered(RACER_KEY);
    const tyre = remembered(TYRE_KEY);
    if (racer && R.racer(racer).id === racer && racer !== mine.racer) api.send({ type: 'racer', id: racer });
    if (tyre && R.tyre(tyre).id === tyre && tyre !== mine.tyre) api.send({ type: 'tyre', id: tyre });
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

  function clock(ms) {
    const t = ms / 1000;
    return Math.floor(t / 60) + ':' + ('0' + (t % 60).toFixed(1)).slice(-4);
  }

  /** The speed bar and lap times (every view: they change all the time). */
  function dash(v) {
    const k = v.karts && v.karts[v.you];
    if (!k) return;
    const f = Math.min(1, Math.abs(k.speed) / v.boostSpeed);
    els.bar.style.width = Math.round(f * 100) + '%';
    els.speed.classList.toggle('boost', k.boosting);
    els.speed.classList.toggle('reverse', k.speed < -0.05);
    els.speed.classList.toggle('charged', k.driftCharge >= 1);
    els.kmh.textContent = (k.speed < -0.05 ? 'R ' : '') + Math.round(Math.abs(k.speed) * KMH) + ' km/h';
    els.lap.textContent = (k.lapMs !== null ? '⏱ ' + clock(k.lapMs) : '') + (k.lastLap ? ' · last ' + clock(k.lastLap) : '') + (k.bestLap ? ' · best ' + clock(k.bestLap) : '');
  }

  /** Lay the controls out for the chosen layout and how the phone is held. */
  function applyLayout() {
    if (!root) return;
    const tall = window.innerHeight > window.innerWidth;
    const racing = Boolean(view) && view.phase !== 'setup' && view.phase !== 'over';
    const landscape = layout === 'landscape' || (layout === 'auto' && !tall);
    const rotated = layout === 'landscape' && tall && racing; // turn the controls sideways
    root.classList.toggle('landscape', landscape && racing);
    root.classList.toggle('rotated', rotated);
    // Sideways, the controller covers the game area (not the hub's bar above it):
    // a quarter turn about its top-left corner, moved over by the area's width.
    const r = rotated ? host.getBoundingClientRect() : null;
    root.style.top = r ? r.top + 'px' : '';
    root.style.left = r ? r.right + 'px' : '';
    root.style.width = r ? r.height + 'px' : '';
    root.style.height = r ? r.width + 'px' : '';
  }

  function render(v) {
    view = v;
    applyLayout();
    trackNames = v.trackNames || trackNames;
    dash(v);
    const me = v.you;
    const k = v.karts && v.karts[me];
    const key = JSON.stringify([Boolean(window.ArkKartRacers), v.picks, v.phase, v.race, v.countdown, v.scores, v.settings, v.positions && v.positions[me], k && [k.laps, k.offTrack, k.boosting, k.cut, k.item, k.spin, k.shield], v.result]);
    if (key === textKey) return;
    textKey = key;
    const setup = v.phase === 'setup';
    const between = setup || v.phase === 'over';
    els.status.innerHTML = status(v);
    els.setup.innerHTML = setup ? Ark.setup.html(v, ROWS) : '';
    els.picks.innerHTML = between ? renderPicks(v) : '';
    els.picks.classList.toggle('hidden', !between);
    if (setup) restorePicks(v);
    else restored = false; // ask again next time we're back at setup
    els.prefs.classList.toggle('hidden', !between);
    els.go.classList.toggle('hidden', !setup);
    els.controls.classList.toggle('hidden', between);
    els.rematch.classList.toggle('hidden', v.phase !== 'over');
    // The item button shows what you're holding.
    const item = k && k.item;
    els.item.textContent = item ? ITEM_ICON[item] : '—';
    els.item.classList.toggle('ready', Boolean(item));
    els.item.classList.toggle('hidden', !v.settings.items);
    els.bottom.classList.toggle('noitem', !v.settings.items);
    els.change.classList.toggle('hidden', v.phase !== 'over');
    if (between) release();
  }

  Ark.register('player', 'kart-race', {
    mount: function (el, a) {
      api = a;
      host = el;
      root = document.createElement('div');
      root.className = 'kr-phone';
      root.innerHTML =
        '<div class="status"></div>' +
        '<div class="kr-setup-box"></div>' +
        '<div class="ark-setup kr-picks hidden"></div>' +
        '<div class="ark-setup kr-prefs hidden"></div>' +
        '<button class="primary go hidden">Start</button>' +
        '<div class="kr-controls">' +
        '<div class="kr-dash"><div class="kr-speed"><i></i></div><div class="kr-read"><b class="kmh">0 km/h</b><span class="lapt"></span></div></div>' +
        '<div class="kr-steer"></div>' +
        '<div class="kr-bottom"><button class="kr-btn item">🎁</button><button class="kr-btn drift">DRIFT</button>' +
        '<button class="kr-btn brake">BRAKE<small>hold: reverse</small></button><button class="kr-btn gas">GAS</button></div>' +
        '</div>' +
        '<button class="primary rematch hidden">Rematch</button>' +
        '<button class="ghost change hidden">Change settings</button>';
      el.appendChild(root);
      els = {
        status: root.querySelector('.status'),
        setup: root.querySelector('.kr-setup-box'),
        picks: root.querySelector('.kr-picks'),
        prefs: root.querySelector('.kr-prefs'),
        go: root.querySelector('.go'),
        controls: root.querySelector('.kr-controls'),
        steer: root.querySelector('.kr-steer'),
        brake: root.querySelector('.brake'),
        gas: root.querySelector('.gas'),
        drift: root.querySelector('.drift'),
        bottom: root.querySelector('.kr-bottom'),
        speed: root.querySelector('.kr-speed'),
        bar: root.querySelector('.kr-speed i'),
        kmh: root.querySelector('.kmh'),
        lap: root.querySelector('.lapt'),
        item: root.querySelector('.item'),
        rematch: root.querySelector('.rematch'),
        change: root.querySelector('.change'),
      };
      els.prefs.addEventListener('click', function (e) {
        const s = e.target.closest('[data-style]');
        const l = e.target.closest('[data-layout]');
        if (s) {
          setStyle(s.getAttribute('data-style'));
          if (style === 'tilt') startTilt(true);
        }
        if (l) {
          layout = l.getAttribute('data-layout');
          store(LAYOUT_KEY, layout);
          renderPrefs();
          applyLayout();
        }
      });
      window.addEventListener('resize', applyLayout);
      if (window.ResizeObserver) {
        fit = new ResizeObserver(applyLayout); // e.g. the hub's menu opening above us
        fit.observe(el);
      }
      buildSteer();
      renderPrefs();
      if (style === 'tilt') startTilt(false);
      applyLayout();
      holdButton(els.brake, 'brake');
      holdButton(els.gas, 'gas');
      holdButton(els.drift, 'drift');
      els.item.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (!view || !view.karts || !view.karts[view.you].item) return;
        api.send({ type: 'item' });
        api.vibrate(30);
      });
      Ark.setup.bind(els.setup, api);
      els.picks.addEventListener('click', function (e) {
        const r = e.target.closest('[data-racer]');
        const t = e.target.closest('[data-tyre]');
        if (r) {
          store(RACER_KEY, r.getAttribute('data-racer'));
          api.send({ type: 'racer', id: r.getAttribute('data-racer') });
        }
        if (t) {
          store(TYRE_KEY, t.getAttribute('data-tyre'));
          api.send({ type: 'tyre', id: t.getAttribute('data-tyre') });
        }
      });
      els.go.addEventListener('click', function () { api.send({ type: 'go' }); });
      els.rematch.addEventListener('click', function () { api.send({ type: 'rematch' }); });
      els.change.addEventListener('click', function () { api.send({ type: 'setup' }); });
    },
    update: render,
    unmount: function () {
      window.removeEventListener('resize', applyLayout);
      if (fit) fit.disconnect();
      stopTilt();
      root = els = view = host = fit = null;
      held.left = held.right = held.brake = held.gas = held.drift = false;
      analog = 0;
      stickBrake = stickGas = false;
      sent = textKey = '';
      restored = false;
    },
  });
})();
