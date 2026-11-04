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
    } else {
      out.push([x, y]);
    }
    return out.filter(function (c) { return c[0] >= 0 && c[1] >= 0 && c[0] < size.w && c[1] < size.h; });
  }

  /**
   * A sea. opts: rows (terrain strings), shots (flat: 0 none, 1 miss, 2 hit), ships ([{ cells,
   * sunk, i }]), selected (a ship's i), shields, spotted (flat indexes), sonar ([{ x, y, count }]),
   * mark ([[x, y]], where an aim lands), last ([{ x, y, result }]), cursor ({ x, y }).
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
    });
    (opts.shields || []).forEach(function (i) { cls[i].push('shield'); });
    (opts.spotted || []).forEach(function (i) { cls[i].push('spotted'); });
    (opts.mark || []).forEach(function (c) { cls[c[1] * w + c[0]].push('mark'); });
    (opts.last || []).forEach(function (c) { if (c.x >= 0 && c.x < w && c.y >= 0 && c.y < h) cls[c.y * w + c.x].push('last', 'r-' + c.result); });
    if (opts.cursor) cls[opts.cursor.y * w + opts.cursor.x].push('cursor');
    const sonar = {};
    (opts.sonar || []).forEach(function (s) { sonar[s.y * w + s.x] = s.count; });
    let html = '<div class="ub-sea" style="--w:' + w + ';--h:' + h + '">';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = y * w + x;
        html += '<span class="cell ' + cls[k].join(' ') + '" data-x="' + x + '" data-y="' + y + '">' + (sonar[k] !== undefined ? '<b class="sonar">' + sonar[k] + '</b>' : '') + '</span>';
      }
    }
    return html + '</div>';
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
    what += sunk.length ? '🔥 sank the ' + sunk.join(' and the ') : hits ? '💥 ' + hits + ' hit' + (hits === 1 ? '' : 's') : '💦 a miss';
    if (blocked) what += ' (🛡️ a shield took a hit)';
    if (l.cells.some(function (c) { return c.result === 'stopped'; })) what += ' (stopped by the ice or land)';
    return who + ': ' + what;
  }

  window.ArkUltimate = { coord: coord, footprint: footprint, seaHtml: seaHtml, shapeHtml: shapeHtml, pips: pips, lastText: lastText };
})();
