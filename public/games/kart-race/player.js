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

  // Each phone picks its own controller on the setup screen (remembered on the phone):
  //   buttons   hold ◀ / ▶
  //   joystick  a stick: left/right steers as far as you push it, pull down to brake
  //   slide     put a finger down anywhere on the pad and slide it left/right
  //   tilt      turn the phone like a steering wheel (needs the motion sensor)
  // and a layout: 'auto' follows how the phone is held; 'landscape' turns the
  // controls sideways even if the phone's rotation is locked (steering under
  // the left thumb, ITEM / BRAKE under the right).
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
  const held = { left: false, right: false, brake: false };
  let analog = 0; // steering from the stick, slide or tilt: -1..1
  let stickBrake = false; // stick pulled down
  let sent = '';
  let tiltNote = '';

  const clamp = function (x) { return Math.max(-1, Math.min(1, x)); };
  const dead = function (x) { return Math.abs(x) < DEAD ? 0 : x; };

  /** Send the controls when they change. */
  function send() {
    const steer = style === 'buttons' ? (held.right ? 1 : 0) - (held.left ? 1 : 0) : Math.round(dead(analog) * 10) / 10;
    const brake = held.brake || stickBrake;
    const key = steer + '|' + brake;
    if (!els || key === sent) return;
    sent = key;
    api.send({ type: 'drive', steer: steer, brake: brake });
    if (els.left) {
      els.left.classList.toggle('on', held.left);
      els.right.classList.toggle('on', held.right);
    }
    els.brake.classList.toggle('on', brake);
  }

  function release() {
    held.left = held.right = held.brake = false;
    analog = 0;
    stickBrake = false;
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
      pad.innerHTML = '<div class="kr-stick"><div class="kr-knob"></div><span class="kr-hint">◀ ▶ steer · ▼ brake</span></div>';
      const stick = pad.querySelector('.kr-stick');
      els.knob = pad.querySelector('.kr-knob');
      dragPad(stick, function (p) {
        const reach = Math.min(p.w, p.h) * 0.38; // the knob's travel
        const x = clamp(p.x / reach);
        const y = clamp(p.y / reach);
        analog = x;
        stickBrake = y > 0.6;
        els.knob.style.transform = 'translate(' + (x * 70) + '%, ' + (y * 70) + '%)';
        send();
      }, function () {
        analog = 0;
        stickBrake = false;
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

  // ---- tilt (the motion sensor) ----
  // Phones only let a web page read the motion sensor on a secure (https://)
  // page, and on iPhones only after asking; the hub is plain http, so tilt
  // works on some phones and not others. If no reading comes, fall back to
  // the joystick and say why.

  const tilt = { listening: false, got: false, raw: 0, centre: 0, timer: null };

  /** The screen's rotation: 0, 90, 180 or 270 (counter-clockwise turns of the phone). */
  function screenAngle() {
    const a = window.screen && screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : Number(window.orientation) || 0;
    return ((a % 360) + 360) % 360;
  }

  function onTilt(e) {
    if (e.beta === null || e.beta === undefined || e.gamma === null || e.gamma === undefined) return;
    tilt.got = true;
    const b = e.beta * Math.PI / 180;
    const g = e.gamma * Math.PI / 180;
    // How far up the phone's own x and y axes point (from the W3C angles).
    const xUp = -Math.cos(b) * Math.sin(g);
    const yUp = Math.sin(b);
    // ...and so how far up the right-hand side of the controller points.
    const a = (screenAngle() + (root && root.classList.contains('rotated') ? 90 : 0)) % 360;
    const rightUp = a === 0 ? xUp : a === 90 ? -yUp : a === 180 ? -xUp : yUp;
    tilt.raw = -rightUp; // lower the right side to steer right
    if (style !== 'tilt' || !els) return;
    analog = clamp((tilt.raw - tilt.centre) / TILT_FULL);
    if (els.wheel) els.wheel.style.transform = 'rotate(' + Math.round(dead(analog) * 90) + 'deg)';
    send();
  }

  function stopTilt() {
    clearTimeout(tilt.timer);
    if (tilt.listening) window.removeEventListener('deviceorientation', onTilt);
    tilt.listening = false;
  }

  function tiltUnavailable(why) {
    stopTilt();
    tiltNote = why + ' Using the joystick instead.';
    setStyle('joystick', true);
  }

  /** Start reading the sensor. `asked` when called from a tap (iPhones need one to ask permission). */
  function startTilt(asked) {
    if (tilt.listening) return;
    const insecure = window.isSecureContext === false;
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      return tiltUnavailable(insecure
        ? 'Phones only let web pages use the motion sensor over a secure (https) connection, and the hub runs on plain http.'
        : 'This phone has no motion sensor the browser can read.');
    }
    const listen = function () {
      tilt.listening = true;
      tilt.got = false;
      window.addEventListener('deviceorientation', onTilt);
      tilt.timer = setTimeout(function () {
        if (tilt.got) return;
        tiltUnavailable(insecure
          ? 'Phones only let web pages use the motion sensor over a secure (https) connection, and the hub runs on plain http.'
          : 'No reading from the motion sensor.');
      }, 1500);
    };
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      if (!asked) {
        tiltNote = 'Tap 📱 Tilt again to allow the motion sensor.';
        return renderPrefs();
      }
      DeviceOrientationEvent.requestPermission().then(function (answer) {
        if (answer === 'granted') listen();
        else tiltUnavailable('Motion sensor access was not allowed.');
      }).catch(function () {
        tiltUnavailable(insecure
          ? 'iPhones only allow the motion sensor on secure (https) pages, and the hub runs on plain http.'
          : 'Motion sensor access was not allowed.');
      });
      return;
    }
    listen();
  }

  function setStyle(next, keepNote) {
    if (next !== 'tilt') stopTilt();
    if (!keepNote) tiltNote = '';
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
      (tiltNote ? '<p class="kr-note">' + Ark.escapeHtml(tiltNote) + '</p>' : '');
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
    const me = v.you;
    const k = v.karts && v.karts[me];
    const key = JSON.stringify([v.phase, v.race, v.countdown, v.scores, v.settings, v.positions && v.positions[me], k && [k.laps, k.offTrack, k.boosting, k.cut, k.item, k.spin, k.shield], v.result]);
    if (key === textKey) return;
    textKey = key;
    const setup = v.phase === 'setup';
    const between = setup || v.phase === 'over';
    els.status.innerHTML = status(v);
    els.setup.innerHTML = setup ? Ark.setup.html(v, ROWS) : '';
    els.prefs.classList.toggle('hidden', !between);
    els.go.classList.toggle('hidden', !setup);
    els.controls.classList.toggle('hidden', between);
    els.rematch.classList.toggle('hidden', v.phase !== 'over');
    // The item button shows what you're holding.
    const item = k && k.item;
    els.item.textContent = item ? ITEM_ICON[item] : '—';
    els.item.classList.toggle('ready', Boolean(item));
    els.item.classList.toggle('hidden', !v.settings.items);
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
        '<div class="ark-setup kr-prefs hidden"></div>' +
        '<button class="primary go hidden">Start</button>' +
        '<div class="kr-controls">' +
        '<div class="kr-steer"></div>' +
        '<div class="kr-bottom"><button class="kr-btn item">🎁</button><button class="kr-btn brake">BRAKE</button></div>' +
        '</div>' +
        '<button class="primary rematch hidden">Rematch</button>' +
        '<button class="ghost change hidden">Change settings</button>';
      el.appendChild(root);
      els = {
        status: root.querySelector('.status'),
        setup: root.querySelector('.kr-setup-box'),
        prefs: root.querySelector('.kr-prefs'),
        go: root.querySelector('.go'),
        controls: root.querySelector('.kr-controls'),
        steer: root.querySelector('.kr-steer'),
        brake: root.querySelector('.brake'),
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
      window.removeEventListener('resize', applyLayout);
      if (fit) fit.disconnect();
      stopTilt();
      root = els = view = host = fit = null;
      held.left = held.right = held.brake = false;
      analog = 0;
      stickBrake = false;
      sent = textKey = '';
    },
  });
})();
