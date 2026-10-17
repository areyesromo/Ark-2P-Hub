// Movement pad for phone games that move in any direction (Tanks, Sumo).
// Each phone picks how it moves, remembered per game:
//   joystick  touch anywhere and drag away from where you touched
//   dpad      hold a side of the pad: eight directions, full speed
//   tilt      tilt the phone like a marble maze (needs the motion sensor;
//             see shared/tilt.js); tap the pad to re-centre
(function () {
  const STICK_PX = 60; // drag this far from where you touched for full speed
  const TILT_FULL = Math.sin(20 * Math.PI / 180); // tilt for full speed
  const DEAD = 0.08;
  const STYLES = ['joystick', 'dpad', 'tilt'];
  const LABEL = { joystick: '🕹️ Joystick', dpad: '✛ D-pad', tilt: '📱 Tilt' };
  const tiltReady = Ark.loadScript('/shared/tilt.js');

  function load(key) {
    try { const v = localStorage.getItem(key); return STYLES.indexOf(v) !== -1 ? v : 'joystick'; } catch (e) { return 'joystick'; }
  }

  /**
   * create({ api, key, verb, onMove(x, y, now) }) -> { el, destroy() }
   *   key     localStorage key for this game's choice, e.g. 'ark.tanks.controls'
   *   verb    for the hints: 'drive', 'move'
   *   onMove  called with the direction (-1..1 each, down is +y); `now`
   *           when it should be sent right away (letting go)
   * el holds the controls chooser and the pad (it fills the space it's given).
   */
  function create(opts) {
    const api = opts.api;
    let style = load(opts.key);
    let note = '';
    let secureUrl = null;
    let origin = null;
    let tiltCentre = null;
    let lastTilt = null;
    let tiltOn = false;

    const el = document.createElement('div');
    el.className = 'mp';
    el.innerHTML = '<div class="mp-bar"></div><div class="mp-note"></div><div class="mp-pad"></div>';
    const bar = el.querySelector('.mp-bar');
    const noteEl = el.querySelector('.mp-note');
    const pad = el.querySelector('.mp-pad');

    function move(x, y, now) {
      const d = Math.hypot(x, y);
      if (d > 1) {
        x /= d;
        y /= d;
      }
      if (d < DEAD) x = y = 0;
      opts.onMove(x, y, now);
    }

    function renderBar() {
      bar.innerHTML = STYLES.map(function (s) {
        return '<button class="opt' + (s === style ? ' on' : '') + '" data-mp="' + s + '">' + LABEL[s] + '</button>';
      }).join('');
      noteEl.innerHTML = (note ? '<span>' + Ark.escapeHtml(note) + '</span>' : '') +
        (secureUrl ? ' <a class="btn ghost" href="' + Ark.escapeHtml(secureUrl) + '">🔒 Secure page for tilt</a>' +
          '<span class="muted">Your phone will warn about the hub\'s own certificate: Advanced → Proceed, once. You keep your seat.</span>' : '');
      noteEl.classList.toggle('hidden', !note && !secureUrl);
    }

    function buildPad() {
      pad.className = 'mp-pad ' + style;
      if (style === 'joystick') pad.innerHTML = '<div class="base"></div><div class="knob"></div><div class="hint">Touch and drag to ' + opts.verb + '</div>';
      else if (style === 'dpad') pad.innerHTML = '<span class="arrow up">▲</span><span class="arrow down">▼</span><span class="arrow left">◀</span><span class="arrow right">▶</span><div class="hint">Hold a side to ' + opts.verb + '</div>';
      else pad.innerHTML = '<div class="ball"></div><div class="hint">Tilt the phone to ' + opts.verb + ' · tap to re-centre</div>';
    }

    // ---- joystick and D-pad (touch) ----

    function showDpad(x, y) {
      pad.querySelectorAll('.arrow').forEach(function (a) {
        const on = (a.classList.contains('up') && y < -0.3) || (a.classList.contains('down') && y > 0.3) ||
          (a.classList.contains('left') && x < -0.3) || (a.classList.contains('right') && x > 0.3);
        a.classList.toggle('on', on);
      });
    }

    function touch(e) {
      const r = pad.getBoundingClientRect();
      if (style === 'joystick') {
        let dx = e.clientX - origin.x;
        let dy = e.clientY - origin.y;
        const d = Math.hypot(dx, dy);
        if (d > STICK_PX) {
          dx *= STICK_PX / d;
          dy *= STICK_PX / d;
        }
        const knob = pad.querySelector('.knob');
        knob.style.left = origin.x - r.left + dx + 'px';
        knob.style.top = origin.y - r.top + dy + 'px';
        move(dx / STICK_PX, dy / STICK_PX);
      } else if (style === 'dpad') {
        // The side of the pad you're holding, snapped to one of eight directions.
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) < Math.min(r.width, r.height) * 0.08) return move(0, 0);
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const x = Math.round(Math.cos(a) * 100) / 100;
        const y = Math.round(Math.sin(a) * 100) / 100;
        showDpad(x, y);
        move(x, y);
      }
    }

    pad.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (style === 'tilt') {
        tiltCentre = lastTilt; // re-centre on how the phone is held now
        api.vibrate(20);
        return;
      }
      if (pad.setPointerCapture) pad.setPointerCapture(e.pointerId);
      origin = { x: e.clientX, y: e.clientY };
      if (style === 'joystick') {
        const r = pad.getBoundingClientRect();
        const base = pad.querySelector('.base');
        const knob = pad.querySelector('.knob');
        base.style.left = knob.style.left = e.clientX - r.left + 'px';
        base.style.top = knob.style.top = e.clientY - r.top + 'px';
      }
      touch(e);
    });
    pad.addEventListener('pointermove', function (e) {
      if (origin) touch(e);
    });
    function up() {
      if (!origin) return;
      origin = null;
      if (style === 'joystick') {
        const base = pad.querySelector('.base');
        const knob = pad.querySelector('.knob');
        base.style.left = knob.style.left = '50%';
        base.style.top = knob.style.top = '50%';
      }
      showDpad(0, 0);
      move(0, 0, true); // stop right away
    }
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);

    // ---- tilt ----

    function onTilt(t) {
      lastTilt = t;
      if (!tiltCentre) tiltCentre = t; // however it's held when it starts is "level"
      if (style !== 'tilt') return;
      const x = (tiltCentre.right - t.right) / TILT_FULL; // lower the right side: go right
      const y = (t.top - tiltCentre.top) / TILT_FULL; // lower the top (tip it away): go up the screen
      move(x, y);
      const ball = pad.querySelector('.ball');
      const c = function (v) { return Math.max(-1, Math.min(1, v)) * 40; };
      if (ball) ball.style.transform = 'translate(' + c(x) + 'px, ' + c(y) + 'px)';
    }

    function onTiltError(code, message) {
      tiltOn = false;
      if (code === 'ask') {
        note = message;
        return renderBar();
      }
      const prefs = {};
      prefs[opts.key] = 'tilt';
      secureUrl = code === 'insecure' ? api.secureUrl(prefs) : null;
      note = message + ' Using the joystick for now.';
      setStyle('joystick', true);
    }

    function startTilt(fromTap) {
      if (tiltOn) return;
      tiltOn = true;
      tiltCentre = null;
      tiltReady.then(function () {
        if (style !== 'tilt' || !tiltOn) return;
        ArkTilt.start(onTilt, onTiltError, { fromTap: fromTap });
      });
    }

    function stopTilt() {
      tiltOn = false;
      if (window.ArkTilt) ArkTilt.stop();
    }

    function setStyle(next, keepNote) {
      if (next !== 'tilt') stopTilt();
      if (!keepNote) {
        note = '';
        secureUrl = null;
      }
      style = next;
      try { localStorage.setItem(opts.key, style); } catch (e) { /* private mode */ }
      origin = null;
      move(0, 0, true);
      buildPad();
      renderBar();
    }

    bar.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-mp]');
      if (!btn) return;
      setStyle(btn.getAttribute('data-mp'));
      if (style === 'tilt') startTilt(true);
    });

    buildPad();
    renderBar();
    if (style === 'tilt') startTilt(false);

    return {
      el: el,
      destroy: function () {
        stopTilt();
        origin = null;
      },
    };
  }

  window.ArkMovePad = { create: create, STYLES: STYLES };
})();
