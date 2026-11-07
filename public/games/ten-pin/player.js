// Bowling on the phone: the lane from above, the pins at the far end and your ball at the foul
// line. On your turn, drag the ball sideways to where you want to stand, then swipe it up the
// lane: the swipe's angle aims, its speed is the power, and a curve in it puts spin on the ball
// (curve left and it hooks back right, as a real one does). With motion (the https page), you
// can swing the phone instead: hold the button, swing forward, let go.
(function () {
  Ark.loadCss('/games/ten-pin/style.css');
  const motionReady = Ark.loadScript('/shared/motion.js');
  const MAX_ANGLE = 0.35; // radians either side of straight up the screen = full aim
  const FULL_SPEED = 2.6; // lane heights a second = full power
  const STANCE_EVERY_MS = 80;

  let root = null;
  let els = null;
  let api = null;
  let view = null;
  let textKey = '';
  let drag = null; // { pts: [{ x, y, t }], swiping } while the finger's down
  let stance = 0;
  let lastStanceSent = 0;
  let swing = null; // { readings: [], stop } while the swing button is held

  function myTurn() {
    return view && view.phase === 'aim' && view.turn === view.you;
  }

  function laneBox() {
    return els.lane.getBoundingClientRect();
  }

  /** Stance (metres from the middle) <-> pixels across the lane drawing. */
  function stanceToPx(x) {
    const w = laneBox().width;
    return w / 2 + (x / view.lane.hw) * (w / 2 - 6);
  }
  function pxToStance(px) {
    const w = laneBox().width;
    const x = ((px - w / 2) / (w / 2 - 6)) * view.lane.hw;
    return Math.max(-view.lane.maxStance, Math.min(view.lane.maxStance, Math.round(x * 100) / 100));
  }

  function placeBall(x, y) {
    els.ball.style.left = x + 'px';
    els.ball.style.top = y === undefined ? '' : y + 'px';
    els.ball.classList.toggle('free', y !== undefined);
  }

  function sendStance(force) {
    const now = Date.now();
    if (!force && now - lastStanceSent < STANCE_EVERY_MS) return;
    lastStanceSent = now;
    api.send({ type: 'stance', x: stance });
  }

  /**
   * A swipe up the lane, from its points: the angle of the throw (start to end), its speed over
   * the last part, and how much it curved (the middle of the path to one side of the straight line).
   */
  function swipeThrow(pts) {
    const h = laneBox().height;
    const end = pts[pts.length - 1];
    let i = pts.length - 1;
    while (i > 0 && end.t - pts[i - 1].t < 140) i--; // the last ~140 ms: the throw itself
    const a = pts[i];
    const start = pts[0];
    const cx = end.x - start.x;
    const cy = end.y - start.y;
    const len = Math.hypot(cx, cy);
    if (-cy < h * 0.15 || len < 40) return null; // not up the lane (or too short)
    const speed = Math.hypot(end.x - a.x, end.y - a.y) / Math.max(16, end.t - a.t); // px per ms
    // Which way it bowed: the point furthest from the straight line, signed.
    let bow = 0;
    pts.forEach(function (p) {
      const d = (cx * (p.y - start.y) - cy * (p.x - start.x)) / len;
      if (Math.abs(d) > Math.abs(bow)) bow = d;
    });
    const r2 = function (n) { return Math.round(n * 100) / 100; };
    return {
      type: 'throw',
      stance: stance,
      aim: r2(Math.max(-1, Math.min(1, Math.atan2(cx, -cy) / MAX_ANGLE))),
      power: r2(Math.max(0, Math.min(1, (speed * 1000) / (h * FULL_SPEED)))),
      spin: r2(Math.max(-1, Math.min(1, (-bow / len) * 5))),
    };
  }

  function onDown(e) {
    if (!myTurn()) return;
    e.preventDefault();
    els.lane.setPointerCapture(e.pointerId);
    const r = laneBox();
    drag = { pts: [{ x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp }], swiping: false, x0: e.clientX - r.left, y0: e.clientY - r.top };
  }

  function onMove(e) {
    if (!drag) return;
    const r = laneBox();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp };
    drag.pts.push(p);
    if (drag.pts.length > 80) drag.pts.shift();
    // Mostly sideways (and not yet up the lane): moving where you stand.
    if (!drag.swiping && drag.y0 - p.y > 28) {
      drag.swiping = true;
      drag.pts = drag.pts.slice(-3);
    }
    if (drag.swiping) placeBall(p.x, p.y);
    else if (myTurn()) {
      stance = pxToStance(p.x);
      placeBall(stanceToPx(stance));
      sendStance(false);
    }
  }

  function onUp() {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.swiping) return sendStance(true);
    const t = d.pts.length > 2 && swipeThrow(d.pts);
    if (!t || !myTurn()) {
      placeBall(stanceToPx(stance));
      if (myTurn()) els.tip.textContent = 'Swipe up the lane, a bit faster (start at the ball).';
      return;
    }
    api.send(t);
    if (navigator.vibrate) navigator.vibrate(25);
    els.tip.textContent = describe(t);
    els.ball.classList.add('thrown');
  }

  function describe(t) {
    const side = Math.abs(t.aim) < 0.1 ? 'straight' : (t.aim > 0 ? 'right' : 'left');
    const spin = Math.abs(t.spin) < 0.1 ? 'no spin' : 'spin ' + (t.spin > 0 ? '↪' : '↩');
    return 'Power ' + Math.round(t.power * 100) + '% · ' + side + ' · ' + spin;
  }

  // ---- the swing (motion) ----

  function swingStart(e) {
    e.preventDefault();
    if (!myTurn() || !window.ArkMotion) return;
    ArkMotion.ask();
    const readings = [];
    swing = { readings: readings, t0: performance.now(), stop: ArkMotion.on(function (r) { readings.push({ t: performance.now(), r: r }); if (readings.length > 120) readings.shift(); }) };
    els.swing.classList.add('on');
  }

  function swingEnd() {
    if (!swing) return;
    const s = swing;
    swing = null;
    s.stop();
    els.swing.classList.remove('on');
    if (!myTurn()) return;
    if (!s.readings.length) {
      els.tip.textContent = 'No motion here (it needs the https page): swipe the ball instead.';
      return;
    }
    // The swing's hardest moment is the power; the phone's lean as you let go aims; a sideways
    // flick at the end is spin.
    const now = performance.now();
    const recent = s.readings.filter(function (x) { return now - x.t < 700; });
    const peak = recent.reduce(function (m, x) { return Math.max(m, x.r.jolt); }, 0);
    const last = s.readings[s.readings.length - 1].r;
    const side = recent.slice(-6).reduce(function (m, x) { return m + x.r.move.x; }, 0) / Math.max(1, recent.slice(-6).length);
    if (peak < 6) {
      els.tip.textContent = 'Swing harder (hold the button, swing forward, let go).';
      return;
    }
    const r2 = function (n) { return Math.round(n * 100) / 100; };
    const t = {
      type: 'throw',
      stance: stance,
      aim: r2(Math.max(-1, Math.min(1, last.tilt.right * 3))),
      power: r2(Math.max(0, Math.min(1, (peak - 6) / 22))),
      spin: r2(Math.max(-1, Math.min(1, side / 8))),
    };
    api.send(t);
    if (navigator.vibrate) navigator.vibrate(25);
    els.tip.textContent = describe(t);
    els.ball.classList.add('thrown');
  }

  // ---- drawing ----

  function render(v) {
    const was = view;
    view = v;
    if (!els) return;
    const me = v.you;
    const them = 1 - me;
    const mine = v.cards[me].total;
    const theirs = v.cards[them].total;
    let status;
    if (v.phase === 'intro') status = '🎳 Get ready…';
    else if (v.phase === 'over') status = v.draw ? '🤝 A tie: ' + mine + ' each' : v.winner === me ? '<span class="won">🏆 You win, ' + mine + ' to ' + theirs + '!</span>' : '<span class="lost">They win, ' + theirs + ' to ' + mine + '</span>';
    else if (myTurn()) status = '<strong>Your turn</strong> · frame ' + (v.next.frame + 1) + (v.next.ball ? ', ball ' + (v.next.ball + 1) : '');
    else if (v.phase === 'rolling' && v.turn === me) status = 'Rolling…';
    else status = 'Their turn' + (v.phase === 'rolling' ? ': rolling…' : '…');
    const html = '<div class="tp-scores"><span class="me">You <strong>' + mine + '</strong></span><span class="them">Them <strong>' + theirs + '</strong></span></div><div class="tp-status">' + status + '</div>';
    if (html !== textKey) {
      textKey = html;
      els.text.innerHTML = html;
    }
    // The pins still standing (or the fresh rack), seen from above.
    const pinKey = JSON.stringify(v.phase === 'rolling' ? null : v.standing);
    if (pinKey !== els.pins.dataset.key) {
      els.pins.dataset.key = pinKey;
      els.pins.innerHTML = (v.phase === 'rolling' ? [] : v.standing).map(function (p) {
        const left = 50 + (p.x / v.lane.hw) * 46;
        const top = 8 + (p.z - v.lane.headPin) * 26;
        return '<span class="pin" style="left:' + left.toFixed(1) + '%;top:' + top.toFixed(1) + '%"></span>';
      }).join('');
    }
    // My turn starting (or the next ball): the ball back at my stance.
    const turnStarts = myTurn() && !(was && was.phase === 'aim' && was.turn === me && was.next && v.next && was.next.frame === v.next.frame && was.next.ball === v.next.ball);
    if (turnStarts) {
      stance = v.stance;
      els.ball.classList.remove('thrown');
      placeBall(stanceToPx(stance));
      els.tip.textContent = 'Drag the ball to where you stand, then swipe it up the lane.';
    }
    if (!myTurn() && v.phase !== 'rolling') els.tip.textContent = v.phase === 'over' ? '' : 'Watch the TV.';
    if (!myTurn() && !drag && v.phase !== 'rolling') placeBall(stanceToPx(v.stance));
    els.lane.classList.toggle('waiting', !myTurn());
    els.swing.classList.toggle('hidden', !myTurn() || !window.ArkMotion || !ArkMotion.live());
    els.rematch.classList.toggle('hidden', v.phase !== 'over');
    els.last.textContent = lastText(v);
  }

  function lastText(v) {
    const l = v.last;
    if (!l || v.phase === 'rolling') return '';
    const who = l.slot === v.you ? 'You' : 'They';
    if (l.kind === 'strike') return '🎳 ' + who + ' bowled a strike!';
    if (l.kind === 'spare') return '✨ ' + who + ' picked up the spare!';
    if (l.kind === 'gutter') return who + ' rolled a gutter ball.';
    if (l.kind === 'split') return who + ' left a split: ' + l.count + ' down.';
    return who + ' knocked down ' + l.count + '.';
  }

  Ark.register('player', 'ten-pin', {
    zoomable: function (v) { return v.phase === 'over'; },
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'tp-phone';
      root.innerHTML =
        '<div class="tp-text"></div>' +
        '<div class="tp-lane"><div class="tp-pins"></div><div class="tp-arrows">▲ ▲ ▲</div><span class="tp-ball keep-motion"></span><div class="tp-foul"></div></div>' +
        '<div class="tp-tip"></div><div class="tp-last"></div>' +
        '<button class="tp-swing hidden">🤸 Hold, swing, let go</button>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      els = {
        text: root.querySelector('.tp-text'),
        lane: root.querySelector('.tp-lane'),
        pins: root.querySelector('.tp-pins'),
        ball: root.querySelector('.tp-ball'),
        tip: root.querySelector('.tp-tip'),
        last: root.querySelector('.tp-last'),
        swing: root.querySelector('.tp-swing'),
        rematch: root.querySelector('.rematch'),
      };
      els.ball.classList.add('p' + (a.slot + 1));
      els.lane.addEventListener('pointerdown', onDown);
      els.lane.addEventListener('pointermove', onMove);
      els.lane.addEventListener('pointerup', onUp);
      els.lane.addEventListener('pointercancel', onUp);
      els.swing.addEventListener('pointerdown', swingStart);
      els.swing.addEventListener('pointerup', swingEnd);
      els.swing.addEventListener('pointercancel', swingEnd);
      els.rematch.addEventListener('click', function () { api.send({ type: 'rematch' }); });
      // Motion turns up after a tap on iPhones: ask on the first touch, then offer the swing once it reads.
      el.addEventListener('pointerdown', function () { if (window.ArkMotion) ArkMotion.ask(); }, { once: true });
      motionReady.then(function () {
        if (!window.ArkMotion) return;
        const stop = ArkMotion.on(function () {
          stop();
          if (view && els) render(view);
        });
      });
      if (view) render(view);
    },
    update: render,
    unmount: function () {
      if (swing) swing.stop();
      root = els = view = drag = swing = null;
      textKey = '';
    },
  });
})();
