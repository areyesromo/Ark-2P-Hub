// The 3D presentation. Race state and controls still belong to the shared Kart Race game.
(function () {
  const esc = Ark.escapeHtml;
  function clock(ms) {
    if (!Number.isFinite(ms)) return '—';
    const tenths = Math.max(0, Math.floor(ms / 100));
    return Math.floor(tenths / 600) + ':' + String(Math.floor(tenths / 10) % 60).padStart(2, '0') + '.' + tenths % 10;
  }
  function player(v, slot) { return v.players[slot].name; }
  /** Anyone in the race by kart: a player's name, or a computer racer's. */
  function racerName(v, i) { return i < 2 ? player(v, i) : (v.karts[i] && v.karts[i].name) || 'CPU'; }
  function ordinal(n) { return n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); }
  /** The 8-kart Cup's table after the latest race: everyone by points, with this race's place and score. */
  function cupTable(v) {
    const last = v.history[v.history.length - 1];
    const prev = v.history[v.history.length - 2];
    const order = v.cupPoints.map(function (p, i) { return i; }).sort(function (a, b) { return v.cupPoints[b] - v.cupPoints[a] || a - b; });
    return '<table class="kr3d-cup"><thead><tr><th></th><th>Driver</th><th>Race</th><th>+</th><th>Points</th></tr></thead><tbody>' + order.map(function (i, n) {
      const got = last.points[i] - (prev && prev.points ? prev.points[i] : 0);
      return '<tr class="kr3d-cup-row ' + (i < 2 ? 'p' + (i + 1) : 'cpu') + '"><td>' + (n + 1) + '</td><td>' + esc(racerName(v, i)) + (i < 2 ? '' : ' <small>CPU</small>') + '</td><td>' + ordinal(last.places[i]) + '</td><td>+' + got + '</td><td class="kr3d-total">' + v.cupPoints[i] + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  function item(kind) { return window.ArkKartItems && window.ArkKartItems[kind]; }
  function alertFor(k) {
    if (k.jumped) return 'Jump start · 1 s penalty';
    if (k.cut) return 'Shortcut · back to the track';
    if (k.spin) return 'Spun out';
    if (k.offTrack) return 'Off road · losing speed';
    if (k.shield) return 'Shield active';
    if (k.boosting) return 'BOOST';
    if (k.reaction !== null && k.reaction !== undefined) return 'Reaction ' + (k.reaction / 1000).toFixed(2) + ' s';
    return '';
  }
  function ready(v) {
    return '<div class="kr3d-ready">' + [0, 1].map(function (slot) {
      const away = v.players[slot].connected === false;
      return '<div class="p' + (slot + 1) + '"><span>P' + (slot + 1) + ' · ' + esc(player(v, slot)) + '</span><b>' +
        (away ? 'Disconnected' : v.ready && v.ready[slot] ? '✓ Ready' : 'Waiting for ready') + '</b></div>';
    }).join('') + '</div>';
  }
  function prompt(v) {
    if (v.phase === 'setup') return 'Phone: choose your racer & tyres, then Ready · Controller: ↑↓ select · ←→ change · A ready';
    if (v.phase === 'standings') return 'Phone: Ready for the next ' + (v.battle ? 'round' : 'race') + ' · Controller: A ready';
    return 'Phone: Rematch or Change settings · Controller: A rematch · Y settings · Hub menu: lobby';
  }
  function resultCards(v) {
    const last = v.history && v.history[v.history.length - 1];
    if (!last) return '';
    return '<div class="kr3d-results">' + [0, 1].map(function (slot) {
      const won = last.winner === slot;
      return '<div class="p' + (slot + 1) + '"><span class="kr3d-eyebrow">' + (last.winner === null ? 'DRAW' : won ? (last.balloons ? 'ROUND WINNER' : 'RACE WINNER') : 'RUNNER-UP') + '</span><h2>' + esc(player(v, slot)) + '</h2><strong>' +
        (last.balloons ? last.balloons[slot] + ' balloons' : last.times && last.times[slot] !== null ? clock(last.times[slot]) : 'Did not finish') + '</strong>' +
        (last.best && last.best[slot] !== null ? '<p>Best lap ' + clock(last.best[slot]) + '</p>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function create() {
    let element = null;
    let nodes = null;
    let mapKey = '';
    let itemKeys = [];
    function build(el) {
      element = el;
      el.innerHTML = '<div class="kr3d-racebar"><span class="kr3d-course"></span><b class="kr3d-clock"></b><span class="kr3d-series"></span></div>' +
        '<div class="kr3d-drivers">' + [0, 1].map(function (slot) {
          return '<section class="kr3d-driver p' + (slot + 1) + '" aria-label="Player ' + (slot + 1) + ' race information">' +
            '<div class="kr3d-driver-top"><div class="kr3d-identity"><span class="kr3d-eyebrow">PLAYER ' + (slot + 1) + '</span><b class="kr3d-name"></b></div><div class="kr3d-position"></div><div class="kr3d-lap"></div></div>' +
            '<div class="kr3d-alert" role="status"></div>' +
            '<div class="kr3d-driver-bottom"><div class="kr3d-speed"><strong></strong><small>km/h</small><span class="kr3d-coins"></span><span class="kr3d-laptime"></span></div>' +
            '<div class="kr3d-drift"><span></span><div><i></i></div></div><div class="kr3d-item"></div></div>' +
            '<ol class="kr3d-order" aria-label="Running order"></ol><div class="kr3d-driving-hint"></div></section>';
        }).join('') + '</div><div class="kr3d-map"><svg aria-label="Course map: P1 and P2 positions" role="img"><path class="kr3d-map-road"/><path class="kr3d-map-line"/><path class="kr3d-map-start"/><g class="kr3d-map-cpus"></g>' +
        [0, 1].map(function (s) { return '<g class="p' + (s + 1) + '"><circle r="1.4"/><text text-anchor="middle" dy=".4">' + (s + 1) + '</text></g>'; }).join('') + '</svg><span>P1 / P2 · course map</span></div>';
      nodes = [0, 1].map(function (s) { return el.querySelectorAll('.kr3d-driver')[s]; });
      mapKey = '';
      itemKeys = [];
    }
    function map(v, el) {
      const road = window.ArkKartTrack;
      const wrap = el.querySelector('.kr3d-map');
      wrap.hidden = !road || !v.track || !v.track.points;
      if (wrap.hidden) return;
      const key = JSON.stringify([v.field, v.track.points, v.trackWidth, Boolean(v.battle)]);
      const svg = wrap.querySelector('svg');
      if (key !== mapKey) {
        mapKey = key;
        const points = road.centreLine(v.track.points);
        svg.setAttribute('viewBox', '-2 -2 ' + (v.field.w + 4) + ' ' + (v.field.h + 4));
        ['.kr3d-map-road', '.kr3d-map-line'].forEach(function (selector) {
          svg.querySelector(selector).setAttribute('d', road.svgPath(points));
        });
        svg.querySelector('.kr3d-map-road').setAttribute('stroke-width', Math.max(1, v.trackWidth));
        const p = points[0];
        const q = points[1];
        const dx = q[0] - p[0], dy = q[1] - p[1];
        const len = Math.hypot(dx, dy) || 1;
        const half = v.trackWidth / 2;
        svg.querySelector('.kr3d-map-start').setAttribute('d', 'M' + (p[0] - dy / len * half) + ',' + (p[1] + dx / len * half) + 'L' + (p[0] + dy / len * half) + ',' + (p[1] - dx / len * half));
        svg.querySelector('.kr3d-map-start').style.display = v.battle ? 'none' : '';
        // The dots and their numbers in proportion to the field (1.4 and 2 on Kart Race's 32-wide one).
        svg.querySelectorAll('circle').forEach(function (c) { c.setAttribute('r', v.field.w / 23); });
        svg.querySelectorAll('text').forEach(function (t) {
          t.style.fontSize = v.field.w / 16 + 'px';
          t.setAttribute('dy', v.field.w / 80);
        });
      }
      [0, 1].forEach(function (slot) {
        const k = v.karts[slot];
        svg.querySelector('.p' + (slot + 1)).setAttribute('transform', 'translate(' + k.x + ' ' + k.y + ')');
      });
      // The computer racers: small plain dots under the players'.
      svg.querySelector('.kr3d-map-cpus').innerHTML = v.karts.slice(2).map(function (k) {
        return '<circle class="cpu" cx="' + k.x + '" cy="' + k.y + '" r="' + v.field.w / 40 + '"/>';
      }).join('');
    }
    return {
      focus: function (overlay, slot) {
        const row = overlay.querySelector('.focus.p' + (slot + 1));
        if (row) row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      },
      hud: function (v, el) {
        const active = v.karts && ['countdown', 'race'].indexOf(v.phase) !== -1;
        el.hidden = !active;
        if (!active) return;
        if (element !== el) build(el);
        el.querySelector('.kr3d-course').textContent = v.track.name;
        el.querySelector('.kr3d-clock').textContent = v.battle ? Math.ceil(v.battle.msLeft / 1000) + ' s' : clock(v.raceMs);
        const field = v.karts.length;
        el.querySelector('.kr3d-series').textContent = v.cupPoints ? 'CUP · RACE ' + v.race + ' / 5' : v.cup ? 'CUP · ' + (v.suddenDeath ? 'SUDDEN DEATH' : v.race + ' / 4') : v.races > 1 ? 'ROUND ' + v.race + ' · ' + v.scores.join(' : ') : v.battle ? 'BALLOON BATTLE' : 'HEAD TO HEAD';
        nodes.forEach(function (node, slot) {
          const k = v.karts[slot];
          node.querySelector('.kr3d-name').textContent = player(v, slot);
          node.querySelector('.kr3d-position').textContent = v.battle ? k.balloons + ' 🎈' : field > 2 ? ordinal(v.positions[slot]) + ' / ' + field : v.positions[slot] === 1 ? '1st' : '2nd';
          // A pack: everyone in race order, the two players picked out.
          const order = node.querySelector('.kr3d-order');
          order.hidden = field <= 2;
          if (field > 2) {
            order.innerHTML = v.positions.map(function (rank, i) { return { rank: rank, i: i }; }).sort(function (a, b) { return a.rank - b.rank; }).map(function (r) {
              return '<li class="' + (r.i < 2 ? 'p' + (r.i + 1) + (r.i === slot ? ' me' : '') : 'cpu') + '"><b>' + r.rank + '</b> ' + esc(racerName(v, r.i)) + '</li>';
            }).join('');
          }
          node.querySelector('.kr3d-lap').textContent = v.battle ? 'OF ' + v.battle.balloons : k.finished ? 'FINISHED' : 'LAP ' + Math.min(v.laps, k.laps + 1) + ' / ' + v.laps;
          const alert = node.querySelector('.kr3d-alert');
          alert.textContent = alertFor(k);
          alert.hidden = !alert.textContent;
          node.querySelector('.kr3d-speed strong').textContent = (k.speed < -0.05 ? 'R ' : '') + Math.round(Math.abs(k.speed) * 12);
          node.querySelector('.kr3d-coins').textContent = v.battle ? '' : '● ' + (k.coins || 0) + ' / 15';
          node.querySelector('.kr3d-laptime').textContent = v.battle ? '' : 'Lap ' + clock(k.lapMs) + (k.bestLap ? ' · Best ' + clock(k.bestLap) : '');
          const drift = node.querySelector('.kr3d-drift');
          drift.classList.toggle('charged', k.driftCharge >= 1);
          drift.querySelector('span').textContent = k.driftCharge >= 1 ? 'RELEASE · BOOST' : k.drifting ? 'DRIFT · CHARGING' : 'DRIFT BOOST';
          drift.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, k.driftCharge || 0)) * 100) + '%';
          const box = node.querySelector('.kr3d-item');
          box.hidden = !v.itemsOn;
          const key = JSON.stringify([Boolean(k.gold), k.items, Boolean(window.ArkKartItems)]);
          if (key !== itemKeys[slot]) {
            itemKeys[slot] = key;
            const items = k.items || [];
            const first = item(items[0]);
            box.innerHTML = '<span class="kr3d-eyebrow">' + (k.gold ? 'GOLD TURBO' : items.length ? 'ITEM READY' : 'ITEM SLOT') + '</span><b>' + (k.gold ? '🌟' : first ? first.emoji : items.length ? '🎁' : '—') + '</b><small>' +
              (k.gold ? 'Press again to boost' : first ? esc(first.name) : items.length ? 'Use item' : 'Collect a ? box') + '</small><span class="kr3d-queue">' + items.slice(1).map(function (kind) { const it = item(kind); return it ? it.emoji : '🎁'; }).join(' ') + '</span>';
            box.classList.toggle('ready', Boolean(k.gold || items.length));
          }
          node.querySelector('.kr3d-driving-hint').textContent = v.players[slot].local ? 'RT / A gas · LT / B brake · X / RB drift · Y / LB item' : 'Phone controls · hold GAS · release DRIFT to boost';
        });
        map(v, el);
      },
      overlay: function (v, h) {
        if (v.phase === 'setup') return '<div class="panel kr3d-setup"><header><div><span class="kr3d-eyebrow">TWO DRIVERS. ONE FINISH LINE.</span><h1>Kart Race <em>3D</em></h1><p>Choose your ride. Make the grid yours.</p></div><span class="kr3d-tag">' + (v.settings.field === 1 ? '8-KART CUP' : v.settings.mode ? 'BALLOON BATTLE' : 'SPLIT-SCREEN RACING') + '</span></header><div class="kr3d-setup-grid"><section class="kr3d-rules"><h2>Race settings</h2>' + h.settings().replace(/<button /g, '<button tabindex="-1" aria-disabled="true" ') + '</section><section class="kr3d-track"><span class="kr3d-eyebrow">' + (v.settings.field === 1 ? 'THE CUP' : v.settings.mode ? 'THE ARENA' : 'THE CIRCUIT') + '</span>' + h.preview() + '</section></div><section class="kr3d-garage">' + h.picks() + '</section>' + ready(v) + '<footer>' + esc(prompt(v)) + '</footer></div>';
        if (v.phase === 'countdown') {
          let lights = '';
          for (let i = 1; i <= 5; i++) lights += '<span class="light' + (v.lights >= i ? ' on' : '') + '"></span>';
          return '<div class="panel kr3d-countdown"><span class="kr3d-eyebrow">GET READY</span><div class="lights gantry">' + lights + '</div><h2>Lights out. Then GAS.</h2><p>Early starts cost a 1-second penalty.</p></div>';
        }
        if (v.phase === 'race') return v.newRecord ? '<div class="banner kr3d-record">NEW LAP RECORD · ' + esc(player(v, v.newRecord.slot)) + ' · ' + clock(v.newRecord.ms) + '</div>' : '';
        // The 8-kart Cup: the first player home may not have won (computers can be ahead): their place.
        if (v.phase === 'finish' && v.result && v.cupPoints) return '<div class="banner kr3d-finish"><span class="kr3d-eyebrow">CHEQUERED FLAG</span><h2>' + esc(player(v, v.result.winner)) + ' finishes ' + ordinal(v.positions[v.result.winner]) + '</h2><p>' + clock(v.result.time) + '</p></div>';
        if (v.phase === 'finish' && v.result) return '<div class="banner kr3d-finish"><span class="kr3d-eyebrow">' + (v.battle ? 'ROUND COMPLETE' : 'CHEQUERED FLAG') + '</span><h2>' + (v.result.draw ? 'A level finish' : esc(player(v, v.result.winner)) + ' takes it!') + '</h2><p>' + (v.result.draw ? 'Draw round · play again' : v.battle ? 'The balloons have spoken.' : clock(v.result.time)) + '</p></div>';
        if ((v.phase === 'standings' || v.phase === 'over') && v.cupPoints) {
          // The 8-kart Cup: the table, and at the end who won (and any computer that out-scored you both).
          const done = v.phase === 'over';
          const top = v.cupPoints.indexOf(Math.max.apply(null, v.cupPoints));
          return '<div class="panel kr3d-summary"><span class="kr3d-eyebrow">' + (done ? 'THE PODIUM' : 'CUP · AFTER RACE ' + v.race + ' OF 5') + '</span><h1>' + (done ? esc(player(v, v.winner)) + ' wins the cup' : 'The cup table') + '</h1>' +
            (done && top > 1 ? '<p class="kr3d-cpu-top">' + esc(racerName(v, top)) + ' (CPU) topped the table</p>' : '') +
            '<div class="kr3d-table-wrap">' + cupTable(v) + '</div>' +
            (!done && v.next ? '<p class="kr3d-next">NEXT · ' + esc(v.next.track) + '</p>' : '') + ready(v) + '<footer>' + esc(prompt(v)) + '</footer></div>';
        }
        if (v.phase === 'standings' || v.phase === 'over') {
          const over = v.phase === 'over';
          const title = over ? esc(player(v, v.winner)) + (v.cup ? ' wins the cup' : ' wins the match') : v.cup ? 'Cup standings' : 'Round complete';
          return '<div class="panel kr3d-summary"><span class="kr3d-eyebrow">' + (over ? 'THE PODIUM' : 'BACK IN THE PADDOCK') + '</span><h1>' + title + '</h1>' + resultCards(v) +
            (v.races > 1 ? '<div class="kr3d-table-wrap">' + h.board() + '</div>' : '') +
            (!over && v.next ? '<p class="kr3d-next">NEXT · ' + (v.next.suddenDeath ? 'Sudden death · ' : '') + esc(v.next.track) + '</p>' : '') + ready(v) + '<footer>' + esc(prompt(v)) + '</footer></div>';
        }
        return '';
      },
      dispose: function () { element = nodes = null; mapKey = ''; itemKeys = []; },
    };
  }
  window.ArkKart3DUI = { create: create, clock: clock };
})();
