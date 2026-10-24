// Cannon Lob (server/games/minis/cannon-lob.js): aim, charge, lob it over the wall.
// Phones drag on the aim pad (up is higher) and hold FIRE to charge; controllers turn the cannon
// with the stick or D-pad up / down and hold A to charge. The TV draws the field from the view's
// own sizes (y is up there, down in the SVG).
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const lastTurn = [0, 0];
  const holdA = [false, false];

  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }
  /** The wind as arrows: one per few units, pointing the way it blows. */
  function windText(w) {
    if (!w) return '🏳️ No wind';
    const n = Math.max(1, Math.round(Math.abs(w) / 3));
    return (w < 0 ? '←'.repeat(n) + ' ' : '') + '🚩 Wind ' + Math.abs(w) + (w > 0 ? ' ' + '→'.repeat(n) : '');
  }

  /** The field, built once from the first view; draw() moves what moves. */
  function buildField(svg, s) {
    const H = s.field.h;
    svg.setAttribute('viewBox', '0 0 ' + s.field.w + ' ' + H);
    svg.appendChild(svgEl('rect', { class: 'ground', x: -5, y: H, width: s.field.w + 10, height: 4 }));
    svg.appendChild(svgEl('rect', { class: 'wall', x: s.wall.x - s.wall.w / 2, y: H - s.wall.h, width: s.wall.w, height: s.wall.h, rx: 0.6 }));
    const parts = { towers: [], cannons: [], shots: svgEl('g'), mark: svgEl('g') };
    s.towers.forEach(function (t, i) {
      const g = svgEl('g', { class: 'tower p' + (i + 1) });
      for (let b = 0; b < s.blocks; b++) {
        g.appendChild(svgEl('rect', { class: 'block', x: t.x - s.block.w / 2 + 0.2, y: H - (b + 1) * s.block.h + 0.2, width: s.block.w - 0.4, height: s.block.h - 0.4, rx: 0.5 }));
      }
      svg.appendChild(g);
      parts.towers.push(g);
    });
    s.cannons.forEach(function (c, i) {
      const g = svgEl('g', { class: 'cannon p' + (i + 1), transform: 'translate(' + c.x + ' ' + (H - c.y) + ')' });
      const barrel = svgEl('rect', { class: 'barrel', x: 0, y: -1.1, width: 7.5, height: 2.2, rx: 0.8 });
      g.appendChild(barrel);
      g.appendChild(svgEl('circle', { class: 'base', r: 2.6 }));
      const label = svgEl('text', { class: 'angle', y: -9, 'text-anchor': 'middle' });
      g.appendChild(label);
      svg.appendChild(g);
      parts.cannons.push({ g: g, barrel: barrel, label: label });
    });
    svg.appendChild(parts.shots);
    svg.appendChild(parts.mark);
    return parts;
  }

  function drawField(parts, s) {
    const H = s.field.h;
    parts.towers.forEach(function (g, i) {
      g.querySelectorAll('.block').forEach(function (b, k) { b.classList.toggle('gone', k >= s.towers[i].blocks); });
    });
    parts.cannons.forEach(function (c, i) {
      const cn = s.cannons[i];
      // The barrel points up and towards the rival: right for the left cannon, left for the right one.
      const deg = i === 0 ? -cn.angle : 180 + cn.angle;
      c.barrel.setAttribute('transform', 'rotate(' + deg + ')');
      c.label.textContent = cn.angle + '°';
      c.g.classList.toggle('reloading', !cn.ready);
      c.g.classList.toggle('charging', cn.charging);
    });
    ArkMini.keyed(parts.shots, s.shots, function (sh) { return sh.id; }, function (sh) {
      return svgEl('circle', { class: 'shot p' + (sh.slot + 1), r: 1.2 });
    }, function (el, sh) {
      el.setAttribute('cx', sh.x);
      el.setAttribute('cy', H - sh.y);
    });
    ArkMini.keyed(parts.mark, s.last ? [s.last] : [], function (l) { return l.n; }, function (l) {
      const el = svgEl('circle', { class: 'puff ' + l.kind, cx: l.x, cy: H - l.y, r: l.kind === 'hit' ? 5 : 3 });
      return el;
    });
  }

  let host = null;
  let phone = null;

  ArkMini.register('cannon-lob', {
    host: {
      mount: function (el, mctx) {
        lastTurn[0] = lastTurn[1] = 0;
        holdA[0] = holdA[1] = false;
        el.innerHTML = '<div class="mi-cl"><div class="top"><span class="score p1"></span><span class="wind"></span><span class="score p2"></span></div>' +
          '<div class="power-row"><div class="power p1"><i></i></div><div class="power p2"><i></i></div></div><svg class="mi-cl-field"></svg></div>';
        host = { el: el, players: mctx.players, parts: null };
      },
      update: function (s) {
        if (!host) return;
        const svg = host.el.querySelector('.mi-cl-field');
        if (!host.parts) host.parts = buildField(svg, s);
        drawField(host.parts, s);
        host.el.querySelector('.wind').textContent = windText(s.wind);
        host.el.querySelectorAll('.score').forEach(function (e, i) {
          e.innerHTML = ArkMini.nameOf({ players: host.players }, i) + ' · 💥 ' + s.knocked[i] + ' / ' + s.blocks; // the name comes escaped
        });
        host.el.querySelectorAll('.power').forEach(function (bar, i) { charge(bar, s.cannons[i].charging, s.chargeMs); });
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-cl-phone"><div class="msg"></div><div class="wind"></div>' +
          '<div class="aim side' + mctx.slot + '"><span class="barrel"></span><b class="deg"></b><span class="hint">Drag to aim</span></div>' +
          '<div class="power"><i></i></div><button class="primary mi-big-btn fire">💣 Hold to FIRE</button></div>';
        phone = { el: el, slot: mctx.slot, s: null, angle: null, timer: null, pending: null };
        const p = phone;
        const aim = el.querySelector('.aim');
        // The angle from the cannon's corner (bottom left, or bottom right on the right-hand side).
        function angleAt(e) {
          const r = aim.getBoundingClientRect();
          const dx = p.slot === 0 ? e.clientX - r.left : r.right - e.clientX;
          const dy = r.bottom - e.clientY;
          return Math.round((Math.atan2(Math.max(0, dy), Math.max(1, dx)) * 180) / Math.PI);
        }
        function sendAim() {
          p.timer = null;
          if (p.pending === null || phone !== p) return;
          mctx.send({ type: 'aim', angle: p.pending });
          p.pending = null;
        }
        function setAim(e) {
          const s = p.s;
          if (!s) return;
          const a = Math.max(s.angleMin, Math.min(s.angleMax, angleAt(e)));
          if (a === p.angle) return;
          p.angle = a;
          p.pending = a;
          showAim();
          if (!p.timer) p.timer = setTimeout(sendAim, 60);
        }
        aim.addEventListener('pointerdown', function (e) { aim.setPointerCapture(e.pointerId); p.dragging = true; setAim(e); });
        aim.addEventListener('pointermove', function (e) { if (p.dragging) setAim(e); });
        ['pointerup', 'pointercancel'].forEach(function (ev) { aim.addEventListener(ev, function () { p.dragging = false; }); });
        const fire = el.querySelector('.fire');
        fire.addEventListener('pointerdown', function (e) { e.preventDefault(); fire.setPointerCapture(e.pointerId); p.held = true; mctx.send({ type: 'charge' }); });
        ['pointerup', 'pointercancel'].forEach(function (ev) {
          fire.addEventListener(ev, function () {
            if (!p.held) return;
            p.held = false;
            mctx.send({ type: 'fire' });
            mctx.vibrate(30);
          });
        });
      },
      update: function (s) {
        if (!phone) return;
        const p = phone;
        const me = s.cannons[p.slot];
        p.s = s;
        // Your drag wins over the echo of an older aim on its way back.
        if (!p.dragging && p.pending === null) p.angle = me.angle;
        showAim();
        p.el.querySelector('.msg').textContent = '💥 ' + s.knocked[p.slot] + ' / ' + s.blocks + ' · them ' + s.knocked[1 - p.slot];
        p.el.querySelector('.wind').textContent = windText(s.wind);
        const btn = p.el.querySelector('.fire');
        btn.classList.toggle('waiting', !me.ready && !me.charging);
        btn.textContent = me.charging ? '💣 Let go to FIRE' : me.ready ? '💣 Hold to FIRE' : '⏳ Reloading…';
        charge(p.el.querySelector('.power'), me.charging, s.chargeMs);
      },
      unmount: function () {
        if (phone) clearTimeout(phone.timer);
        phone = null;
      },
    },
    // Controllers: the stick or D-pad up / down turns the cannon; hold A to charge, let go to fire.
    padPoll: function (pad, s, slot) {
      const a = pad.held.indexOf('A') !== -1;
      if (a !== holdA[slot]) {
        holdA[slot] = a;
        return { type: a ? 'charge' : 'fire' };
      }
      let v = Math.abs(pad.stick.y) > 0.25 ? -pad.stick.y : 0;
      if (pad.held.indexOf('UP') !== -1) v = 1;
      if (pad.held.indexOf('DOWN') !== -1) v = -1;
      v = Math.round(v * 10) / 10;
      if (v === lastTurn[slot]) return null;
      lastTurn[slot] = v;
      return { type: 'turn', v: v };
    },
    sounds: function (prev, s) {
      const out = [];
      if (s.shots.some(function (sh) { return !prev.shots.some(function (o) { return o.id === sh.id; }); })) out.push('shoot');
      if (s.last && !(prev.last && prev.last.n === s.last.n)) out.push(s.last.kind === 'hit' ? 'boom' : s.last.kind === 'wall' ? 'wall' : 'drop');
      return out;
    },
  });

  /** Fills a power bar over the charge time while charging (updates only come on changes). */
  function charge(bar, on, ms) {
    if (bar.classList.contains('on') === on) return;
    bar.style.setProperty('--ms', ms + 'ms');
    bar.classList.toggle('on', on);
  }

  function showAim() {
    const p = phone;
    if (!p || p.angle === null) return;
    const deg = p.slot === 0 ? -p.angle : 180 + p.angle;
    p.el.querySelector('.aim .barrel').style.transform = 'rotate(' + deg + 'deg)';
    p.el.querySelector('.aim .deg').textContent = p.angle + '°';
  }
})();
