// The Mind Meld dial, drawn as SVG by the TV and the phones: a half circle
// from the left end of the scale (0) to the right end (100), the scoring
// bands around the target (when it's shown) and the guesser's needle.
(function () {
  const CX = 100;
  const CY = 100;
  const R = 90;
  const BAND_COLORS = ['#22c55e', '#facc15', '#fb923c']; // 3, 2 and 1 star(s)

  function point(v, r) {
    const a = Math.PI * (1 - v / 100);
    return (CX + r * Math.cos(a)).toFixed(2) + ' ' + (CY - r * Math.sin(a)).toFixed(2);
  }

  function wedge(from, to, color) {
    const a = Math.max(0, from);
    const b = Math.min(100, to);
    if (b <= a) return '';
    return '<path d="M ' + CX + ' ' + CY + ' L ' + point(a, R) + ' A ' + R + ' ' + R + ' 0 0 1 ' + point(b, R) + ' Z" fill="' + color + '"/>';
  }

  /**
   * svg({ aim, target, bands, needle }) -> markup
   *   target  0-100 or null (hidden)
   *   bands   [{ within, stars }] widest last (drawn widest first)
   *   needle  false to hide the guesser's needle
   */
  function svg(o) {
    let out = '<svg class="md-dial" viewBox="0 0 200 108" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M ' + (CX - R) + ' ' + CY + ' A ' + R + ' ' + R + ' 0 0 1 ' + (CX + R) + ' ' + CY + ' Z" class="face"/>';
    if (o.target !== null && o.target !== undefined) {
      const bands = (o.bands || []).slice().reverse();
      bands.forEach(function (b, i) {
        out += wedge(o.target - b.within, o.target + b.within, BAND_COLORS[bands.length - 1 - i] || '#888');
      });
      out += '<line x1="' + CX + '" y1="' + CY + '" x2="' + point(o.target, R).replace(' ', '" y2="') + '" class="target-line"/>';
    }
    for (let t = 0; t <= 100; t += 10) {
      out += '<line x1="' + point(t, R).replace(' ', '" y1="') + '" x2="' + point(t, R - (t % 50 ? 4 : 8)).replace(' ', '" y2="') + '" class="tick"/>';
    }
    if (o.needle !== false) {
      out += '<line x1="' + CX + '" y1="' + CY + '" x2="' + point(o.aim, R - 6).replace(' ', '" y2="') + '" class="needle"/>' +
        '<circle cx="' + CX + '" cy="' + CY + '" r="7" class="hub"/>';
    }
    return out + '</svg>';
  }

  /** Where on the dial (0-100) a pointer is, given the dial's <svg> element. */
  function valueAt(el, clientX, clientY) {
    const r = el.getBoundingClientRect();
    const s = r.width / 200;
    const x = (clientX - r.left) / s - CX;
    const y = CY - (clientY - r.top) / s;
    const a = Math.atan2(Math.max(0, y), x);
    return Math.max(0, Math.min(100, Math.round(100 * (1 - a / Math.PI))));
  }

  window.ArkDial = { svg: svg, valueAt: valueAt };
})();
