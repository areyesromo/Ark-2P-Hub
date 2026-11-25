// Stack, the 1 player mode of Tower Stack (view.solo): the TV's and the phone's screens.
// The game's own renderers hand over to these (window.ArkStackSolo.host / .player).
(function () {

  function tracker() {
    let key = '';
    let base = 0; // performance.now() when the block started (less any paused time)
    let moving = null;
    let pausedAt = null;

    return {
      update: function (v) {
        moving = v.moving;
        const k = JSON.stringify([v.height, v.phase === 'over', moving && [moving.from, moving.dir, moving.speed]]);
        const now = performance.now();
        if (k !== key || (v.phase === 'play' && pausedAt !== null)) {
          // A new block (or carrying on after a pause): pick up where the server says it is.
          key = k;
          base = now - (moving ? moving.elapsed : 0);
        }
        pausedAt = v.phase === 'paused' ? (pausedAt === null ? now : pausedAt) : null;
      },
      /** How long the block has been moving, as this screen sees it (ms). */
      t: function () {
        return (pausedAt !== null ? pausedAt : performance.now()) - base;
      },
      /** Its left edge now. */
      x: function () {
        const m = moving;
        if (!m || m.span <= 0) return 0;
        const start = m.dir > 0 ? m.from : 2 * m.span - m.from;
        const d = (start + (m.speed * this.t()) / 1000) % (2 * m.span);
        return d <= m.span ? d : 2 * m.span - d;
      },
    };
  }

  // ---- the TV ----
  const host = (function () {

    const ready = Promise.resolve();
    const BLOCK_H = 7; // a block's height, in the same units as the field's width (100)

    let root = null;
    let canvas = null;
    let overlay = null;
    let stats = null;
    let view = null;
    let track = null;
    let raf = 0;
    let falling = []; // cut-off pieces dropping away: { x, w, level, at }
    let camera = 0; // the level the view is centred on, eased towards the top

    const hue = function (level) { return (200 + level * 13) % 360; };
    // The unlockable looks (see server/games/looks.js): each block's body and top edge, by level.
    // These colours are the blocks themselves.
    const THEMES = {
      classic: function (level) { return { body: 'hsl(' + hue(level) + ', 70%, 55%)', top: 'hsl(' + hue(level) + ', 75%, 70%)' }; },
      candy: function (level) { return level % 2 ? { body: '#f472b6', top: '#fbcfe8' } : { body: '#fef3c7', top: '#ffffff' }; },
      glass: function (level) { return { body: 'hsla(' + (190 + (level % 4) * 8) + ', 90%, 65%, 0.45)', top: 'rgba(255, 255, 255, 0.85)', edge: 'rgba(224, 242, 254, 0.9)' }; },
      gold: function (level) { return level % 2 ? { body: '#eab308', top: '#fde047' } : { body: '#ca8a04', top: '#facc15' }; },
    };
    const themeOf = function (v) { return THEMES[v.look] || THEMES.classic; };

    function draw(now) {
      raf = requestAnimationFrame(draw);
      const v = view;
      if (!v || !canvas || !track) return;
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr)) canvas.width = Math.round(W * dpr);
      if (canvas.height !== Math.round(H * dpr)) canvas.height = Math.round(H * dpr);
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // A sky that warms up as the tower grows.
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, 'hsl(' + hue(v.height + 6) + ', 45%, 16%)');
      sky.addColorStop(1, 'hsl(' + hue(v.height) + ', 40%, 8%)');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);

      // The field is 100 wide, in the middle 60% of the screen.
      const s = Math.min((W * 0.6) / 100, H / 70);
      const ox = (W - 100 * s) / 2;
      const topLevel = v.height - 1; // the level of the top block (the base is 0)
      camera += (topLevel - camera) * 0.12;
      const yOf = function (level) { return H * 0.62 - (level - camera) * BLOCK_H * s; };

      const theme = themeOf(v);
      const block = function (x, w, level, alpha) {
        const y = yOf(level);
        const c = theme(level);
        g.globalAlpha = alpha === undefined ? 1 : alpha;
        g.fillStyle = c.body;
        g.fillRect(ox + x * s, y - BLOCK_H * s, w * s, BLOCK_H * s);
        g.fillStyle = c.top;
        g.fillRect(ox + x * s, y - BLOCK_H * s, w * s, Math.max(2, BLOCK_H * s * 0.18));
        if (c.edge) {
          g.strokeStyle = c.edge;
          g.lineWidth = 1.5;
          g.strokeRect(ox + x * s, y - BLOCK_H * s, w * s, BLOCK_H * s);
        }
        g.globalAlpha = 1;
      };

      // The tower (only its top part is sent: the levels count down from the top).
      const first = v.height - v.tower.length;
      v.tower.forEach(function (b, i) { block(b.x, b.w, first + i); });
      // Below the oldest one we have, the tower carries on down to the ground.
      if (first > 0) {
        const b = v.tower[0];
        g.fillStyle = theme(first - 1).body;
        g.globalAlpha = 0.6;
        g.fillRect(ox + b.x * s, yOf(first - 1), b.w * s, H);
        g.globalAlpha = 1;
      }

      // Cut-off pieces fall and fade.
      falling = falling.filter(function (p) { return now - p.at < 900; });
      falling.forEach(function (p) {
        const k = (now - p.at) / 900;
        const y = yOf(p.level) + k * k * H * 0.8;
        g.globalAlpha = 1 - k;
        g.fillStyle = theme(p.level).body;
        g.fillRect(ox + p.x * s, y - BLOCK_H * s, p.w * s, BLOCK_H * s);
        g.globalAlpha = 1;
      });

      // The sliding block, one level above the top.
      if (v.moving && v.phase !== 'over') block(track.x(), v.moving.w, v.height);
    }

    function renderStats(v) {
      stats.innerHTML = '<span><strong>' + v.score + '</strong> blocks</span>' +
        (v.perfects > 1 ? '<span>🎯 <strong>' + v.perfects + '</strong> perfect in a row</span>' : '');
    }

    let cheerUntil = 0; // a "Perfect!" stays up until it has faded
    function renderOverlay(v) {
      if (performance.now() < cheerUntil && v.phase === 'play') return;
      let html = '';
      if (v.phase === 'paused') html = '<div class="sub">⏸ Paused</div>';
      else if (v.phase === 'play' && v.drops === 0) html = '<div class="sub">Drop it on the tower!</div>';
      if (overlay.getAttribute('data-k') !== html) {
        overlay.setAttribute('data-k', html);
        overlay.innerHTML = html;
      }
    }

    function cheer() {
      cheerUntil = performance.now() + 700;
      overlay.innerHTML = '<div class="perfect">Perfect!</div>';
      overlay.setAttribute('data-k', 'perfect');
    }

    // Any face button, bumper or trigger drops (like Flappy's flap).
    const DROP = ['A', 'B', 'X', 'Y', 'UP', 'RB', 'LB', 'RT', 'LT'];


    return {
      sounds: function (prev, v) {
        if (v.phase === 'over' && prev.phase !== 'over') return ['wrong'];
        if (v.score > prev.score) return [v.perfects > prev.perfects ? 'point' : 'lock'];
        return [];
      },
      padHint: 'A (or any face button) drops the block · Start pause',
      pad: function (btn, v) {
        if (btn === 'START') return { type: 'pause' };
        if (v.phase === 'play' && DROP.indexOf(btn) !== -1 && track) return { type: 'drop', t: Math.round(track.t()) };
        return null;
      },
      overHtml: function (v) {
        return v.score + ' blocks high · best run of perfect drops: ' + v.bestPerfects;
      },
      mount: function (el) {
        root = document.createElement('div');
        root.className = 'stack-host';
        root.innerHTML = '<div class="stack-stats"></div><div class="stack-arena"><canvas></canvas><div class="stack-overlay"></div></div>';
        el.appendChild(root);
        canvas = root.querySelector('canvas');
        overlay = root.querySelector('.stack-overlay');
        stats = root.querySelector('.stack-stats');
        ready.then(function () {
          if (!root) return;
          track = tracker();
          if (view) track.update(view);
          raf = requestAnimationFrame(draw);
        });
      },
      update: function (v) {
        const prev = view;
        view = v;
        if (track) track.update(v);
        if (!prev || v.height < prev.height) camera = v.height - 1;
        // A piece cut off this drop falls away from the level it was dropped at.
        if (prev && v.cut && (v.drops !== prev.drops)) falling.push({ x: v.cut.x, w: v.cut.w, level: v.cut.all ? v.height : v.height - 1, at: performance.now() });
        renderStats(v);
        if (prev && v.perfects > prev.perfects) cheer();
        else renderOverlay(v);
      },
      unmount: function () {
        cancelAnimationFrame(raf);
        root = canvas = overlay = stats = view = track = null;
        falling = [];
        camera = 0;
      },
};
  })();

  // ---- the phone ----
  const player = (function () {

    const ready = Promise.resolve();

    let root = null;
    let api = null;
    let info = null;
    let view = null;
    let track = null;

    function render() {
      if (!root || !view) return;
      const v = view;
      info.innerHTML = '<strong>' + v.score + '</strong> blocks' + (v.perfects > 1 ? ' · 🎯 ' + v.perfects + ' perfect' : '') +
        (v.best === null || v.best === undefined ? '' : ' · best ' + v.best);
      root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    }


    return {
      mount: function (el, a) {
        api = a;
        root = document.createElement('div');
        root.className = 'stack-phone';
        root.innerHTML = '<div class="info"></div><button type="button" class="drop">DROP</button><button type="button" class="ghost pause">⏸ Pause</button>';
        el.appendChild(root);
        info = root.querySelector('.info');
        // On the finger going down, not up: a tap is a moment.
        root.querySelector('.drop').addEventListener('pointerdown', function (e) {
          e.preventDefault();
          if (!view || view.phase !== 'play') return;
          api.send(track && window.ArkStack ? { type: 'drop', t: Math.round(track.t()) } : { type: 'drop' });
          api.vibrate(10);
        });
        root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
        ready.then(function () {
          if (!root) return;
          track = tracker();
          if (view) track.update(view);
        });
        render();
      },
      update: function (v) {
        if (view && v.phase === 'over' && view.phase !== 'over') api.vibrate([80, 40, 80]);
        view = v;
        if (track) track.update(v);
        render();
      },
      unmount: function () {
        root = info = view = track = api = null;
      },
};
  })();

  window.ArkStackSolo = { host: host, player: player };
})();
