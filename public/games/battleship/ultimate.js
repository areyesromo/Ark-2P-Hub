// Ultimate Battleship (server/games/battleship-ultimate.js), shared by the TV and the phones:
// a sea drawn with its terrain, ships of any shape, shots, shields, spotted cells and sonar
// readings, and where a skill would land. ArkUltimate.player and ArkUltimate.host (in
// ultimate-player.js and ultimate-host.js) are the screens.
(function () {
  const ROWS = 'ABCDEFGHIJKLMNOP';

  function coord(x, y) {
    return ROWS[y] + (x + 1);
  }

  /** The cells an aim covers (as the server works them out): see footprint() there. */
  function footprint(aim, a, size) {
    const out = [];
    const x = a.x;
    const y = a.y;
    if (aim === 'line3' || aim === 'line5') {
      const n = aim === 'line3' ? 3 : 5;
      for (let i = 0; i < n; i++) out.push(a.dir === 'v' ? [x, y + i] : [x + i, y]);
    } else if (aim === 'plus') {
      out.push([x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
    } else if (aim === 'box3' || aim === 'box5') {
      const r = aim === 'box3' ? 1 : 2;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) out.push([x + dx, y + dy]);
    } else if (aim === 'own2') {
      out.push([x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]);
    } else if (aim === 'row' || aim === 'rows3') {
      const rows = aim === 'row' ? [y] : [y - 1, y, y + 1];
      rows.forEach(function (r) { for (let i = 0; i < size.w; i++) out.push([i, r]); });
    } else if (aim === 'two' && a.x2 !== undefined) {
      out.push([x, y], [a.x2, a.y2]);
    } else if (aim === 'col') {
      for (let i = 0; i < size.h; i++) out.push([x, i]);
    } else if (aim === 'checker4') {
      for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) if ((dx + dy) % 2 === 0) out.push([x + dx, y + dy]);
    } else {
      out.push([x, y]);
    }
    return out.filter(function (c) { return c[0] >= 0 && c[1] >= 0 && c[0] < size.w && c[1] < size.h; });
  }

  /**
   * A sea. opts: rows (terrain strings), shots (flat: 0 none, 1 miss, 2 hit), ships ([{ cells,
   * sunk, i }]), selected (a ship's i), shields, spotted (flat indexes), sonar ([{ x, y, count }]),
   * mark ([[x, y]], where an aim lands), last ([{ x, y, result }]), cursor ({ x, y }),
   * fx (the move that just landed here, for its effect: explosions one after another, a
   * torpedo's wake, a sonar or scan sweep, a ship going down) and frozen (frost over the sea).
   * id names the sea on this screen, so an effect plays once, not again on every redraw.
   */
  function seaHtml(opts) {
    const rows = opts.rows;
    const w = rows[0].length;
    const h = rows.length;
    const cls = [];
    for (let i = 0; i < w * h; i++) cls.push([]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = rows[y][x];
        if (t === '#') cls[y * w + x].push('land');
        else if (t === '~') cls[y * w + x].push('shallow');
        else if (t === '*') cls[y * w + x].push('ice');
        else if (t === '%') cls[y * w + x].push('fog');
        else if (t === '^') cls[y * w + x].push('lava');
      }
    }
    (opts.ships || []).forEach(function (s) {
      s.cells.forEach(function (c) {
        const k = c[1] * w + c[0];
        if (!cls[k]) return;
        cls[k].push('ship');
        if (s.sunk) cls[k].push('sunk');
        if (opts.selected === s.i) cls[k].push('selected');
      });
    });
    (opts.shots || []).forEach(function (v, i) {
      if (v === 1) cls[i].push('miss');
      if (v === 2) cls[i].push('hit');
      if (v === 3) cls[i].push('fogged');
    });
    (opts.shields || []).forEach(function (i) { cls[i].push('shield'); });
    (opts.spotted || []).forEach(function (i) { cls[i].push('spotted'); });
    const on = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h; };
    (opts.mark || []).forEach(function (c) { if (on(c[0], c[1])) cls[c[1] * w + c[0]].push('mark'); });
    // The move that just landed: each cell in turn (--d), so a strike runs along its line.
    const delay = {};
    const fx = opts.fx || null;
    const landed = fx ? fx.cells : opts.last || [];
    landed.forEach(function (c, i) {
      if (c.x >= 0 && c.x < w && c.y >= 0 && c.y < h) {
        cls[c.y * w + c.x].push('last', 'r-' + c.result);
        delay[c.y * w + c.x] = i;
      }
    });
    // A sonar or scan sweeps its area, from the middle out.
    if (fx && fx.at && (fx.skill === 'sonar' || fx.aim === 'box5')) {
      footprint(fx.skill === 'sonar' ? 'box3' : 'box5', fx.at, { w: w, h: h }).forEach(function (c) {
        const k = c[1] * w + c[0];
        cls[k].push('scan');
        delay[k] = Math.max(Math.abs(c[0] - fx.at.x), Math.abs(c[1] - fx.at.y));
      });
    }
    // A ship sunk by this move goes down whole.
    if (fx) {
      const sunkHere = fx.cells.filter(function (c) { return c.result === 'sunk'; });
      (opts.ships || []).forEach(function (sh) {
        if (!sh.sunk || !sh.cells.some(function (c) { return sunkHere.some(function (d) { return d.x === c[0] && d.y === c[1]; }); })) return;
        sh.cells.forEach(function (c) { const k = c[1] * w + c[0]; if (cls[k]) cls[k].push('sinking'); });
      });
    }
    if (opts.cursor && on(opts.cursor.x, opts.cursor.y)) cls[opts.cursor.y * w + opts.cursor.x].push('cursor');
    const sonar = {};
    (opts.sonar || []).forEach(function (s) { sonar[s.y * w + s.x] = s.count; });
    const kind = fx ? ' fx-' + (fx.skill || (fx.aim === 'row' || fx.aim === 'rows3' ? 'torpedo' : fx.kind)) : '';
    let html = '<div class="ub-sea' + kind + (opts.frozen ? ' frozen' : '') + (seen(opts.id, fx, opts.frozen) ? ' played' : '') + '" style="--w:' + w + ';--h:' + h + '">';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = y * w + x;
        html += '<span class="cell ' + cls[k].join(' ') + '"' + (delay[k] !== undefined ? ' style="--d:' + delay[k] + '"' : '') + ' data-x="' + x + '" data-y="' + y + '">' + (sonar[k] !== undefined ? '<b class="sonar">' + sonar[k] + '</b>' : '') + '</span>';
      }
    }
    return html + '</div>';
  }

  const played = {}; // sea id -> the effect last drawn on it

  /** True if this sea's effect (its move, or its frost) was already drawn: it isn't played again. */
  function seen(id, fx, frozen) {
    if (!id || (!fx && !frozen)) {
      if (id) delete played[id];
      return false;
    }
    const key = JSON.stringify(fx) + (frozen ? '❄' : '');
    if (played[id] === key) return true;
    played[id] = key;
    return false;
  }

  /** A ship's shape, small: its cells as a mini grid. */
  function shapeHtml(cells) {
    const w = Math.max.apply(null, cells.map(function (c) { return c[0]; })) + 1;
    const h = Math.max.apply(null, cells.map(function (c) { return c[1]; })) + 1;
    const on = {};
    cells.forEach(function (c) { on[c[1] * w + c[0]] = true; });
    let html = '<span class="ub-shape" style="--w:' + w + '">';
    for (let i = 0; i < w * h; i++) html += '<i' + (on[i] ? ' class="on"' : '') + '></i>';
    return html + '</span>';
  }

  /** A row of pips: n of max lit (energy, or a special's charge). */
  function pips(n, max, cls) {
    let html = '<span class="ub-pips ' + cls + '">';
    for (let i = 0; i < max; i++) html += '<i' + (i < n ? ' class="on"' : '') + '></i>';
    return html + '</span>';
  }

  /** What the last action did, in words, from `you`'s side (you: -1 on the TV, with names). */
  function lastText(v, you, nameOf) {
    const l = v.last;
    if (!l) return '';
    const who = you === -1 ? nameOf(l.by) : l.by === you ? 'You' : 'They';
    if (l.kind === 'frozen') return '🧊 ' + (you === -1 ? nameOf(l.by) + ' is' : l.by === you ? 'You were' : 'They were') + ' frozen: a turn missed';
    const hits = l.cells.filter(function (c) { return c.result === 'hit' || c.result === 'sunk'; }).length;
    const sunk = l.cells.filter(function (c) { return c.result === 'sunk'; }).map(function (c) { return c.ship; });
    const blocked = l.cells.some(function (c) { return c.result === 'blocked'; });
    let what = l.kind === 'shot' ? '' : (l.kind === 'special' ? '⭐ ' : '') + l.name + ': ';
    if (l.skill === 'sonar') return '📡 ' + who + ' used Sonar at ' + coord(l.at.x, l.at.y) + ': ' + l.count + ' ship cell' + (l.count === 1 ? '' : 's') + ' nearby';
    if (l.skill === 'shield') return '🛡️ ' + who + ' raised a shield';
    if (l.name === 'Full Scan') return '🛰️ ' + who + ' scanned a 5×5';
    if (l.name === 'Deep Freeze') return '🧊 ' + who + ' froze the enemy fleet: they miss a turn';
    const fog = l.cells.filter(function (c) { return c.result === 'fog'; }).length;
    if (l.cells.length && fog === l.cells.length) return who + ': ' + what + '🌫️ into the fog (it shows next turn)';
    what += sunk.length ? '🔥 sank the ' + sunk.join(' and the ') : hits ? '💥 ' + hits + ' hit' + (hits === 1 ? '' : 's') : fog ? '💦 no hits in the open' : l.cells.length > 1 ? '💦 all missed' : '💦 a miss';
    if (fog) what += ' (🌫️ ' + fog + ' into the fog)';
    if (blocked) what += ' (🛡️ a shield took a hit)';
    if (l.cells.some(function (c) { return c.result === 'stopped'; })) what += ' (stopped by land, ice or fog)';
    return who + ': ' + what;
  }

  window.ArkUltimate = { coord: coord, footprint: footprint, seaHtml: seaHtml, shapeHtml: shapeHtml, pips: pips, lastText: lastText };
})();
