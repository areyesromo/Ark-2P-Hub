// Dog Park's park, drawn the same way on the TV and the phone: a square per cell,
// a thick fence between areas (so the areas show without colour too), the dogs and
// the balls. The dogs are drawn here, golden retriever or Aussie (the look).
(function () {
  // The areas' colours are the park itself.
  const AREAS = ['#b9a2e8', '#8fc0e8', '#e79ab4', '#8fd18a', '#5fc2c2', '#f2c879', '#f3a07f', '#d4e36a', '#c9a37c', '#e3a6e8', '#6f86c9', '#d9d9cf', '#9aa86b'];

  const GOLDEN =
    '<svg viewBox="0 0 40 40" aria-label="dog">' +
    '<ellipse cx="9" cy="20" rx="6" ry="11" fill="#b9792a" transform="rotate(14 9 20)"/>' +
    '<ellipse cx="31" cy="20" rx="6" ry="11" fill="#b9792a" transform="rotate(-14 31 20)"/>' +
    '<circle cx="20" cy="19" r="12" fill="#e2a64b"/>' +
    '<ellipse cx="20" cy="26" rx="7.5" ry="6" fill="#f6d9a3"/>' +
    '<circle cx="15.3" cy="17" r="1.9" fill="#2b1a0e"/><circle cx="24.7" cy="17" r="1.9" fill="#2b1a0e"/>' +
    '<circle cx="15.9" cy="16.4" r="0.6" fill="#fff"/><circle cx="25.3" cy="16.4" r="0.6" fill="#fff"/>' +
    '<ellipse cx="20" cy="23.4" rx="2.7" ry="2" fill="#2b1a0e"/>' +
    '<path d="M18.2 28 q1.8 4 3.6 0 z" fill="#ef7f8a"/></svg>';

  // A blue merle Aussie: grey with dark patches, a white blaze, copper cheeks, one blue eye.
  const AUSSIE =
    '<svg viewBox="0 0 40 40" aria-label="dog">' +
    '<path d="M7 15 L10 4 L17 10 Z" fill="#3f4856"/><path d="M33 15 L30 4 L23 10 Z" fill="#59606c"/>' +
    '<circle cx="20" cy="20" r="12" fill="#9aa6b6"/>' +
    '<ellipse cx="13.5" cy="14" rx="5" ry="4.2" fill="#3f4856"/><ellipse cx="27.5" cy="23" rx="3" ry="2.4" fill="#4d5562"/>' +
    '<path d="M18.3 8.3 h3.4 l2.6 12 h-8.6 z" fill="#f8fafc"/>' +
    '<ellipse cx="20" cy="26.3" rx="7" ry="5.6" fill="#f8fafc"/>' +
    '<ellipse cx="12.7" cy="24" rx="2.3" ry="1.7" fill="#c2703d"/><ellipse cx="27.3" cy="24" rx="2.3" ry="1.7" fill="#c2703d"/>' +
    '<circle cx="15.2" cy="17.5" r="2" fill="#38bdf8"/><circle cx="15.2" cy="17.5" r="0.9" fill="#0b1220"/>' +
    '<circle cx="24.8" cy="17.5" r="2" fill="#6b3f1d"/><circle cx="24.8" cy="17.5" r="0.9" fill="#0b1220"/>' +
    '<ellipse cx="20" cy="24" rx="2.6" ry="1.9" fill="#1f2328"/>' +
    '<path d="M18.4 28.4 q1.6 3.6 3.2 0 z" fill="#ef7f8a"/></svg>';

  // "No dog here": a tennis ball for the golden, a bone for the Aussie.
  const BALL =
    '<svg viewBox="0 0 40 40" aria-label="ball"><circle cx="20" cy="20" r="9" fill="#d9f046"/>' +
    '<path d="M12.5 15 q7.5 5 0 10 M27.5 15 q-7.5 5 0 10" stroke="#fff" stroke-width="1.8" fill="none"/></svg>';
  const BONE =
    '<svg viewBox="0 0 40 40" aria-label="bone"><g fill="#f4ead6" stroke="#c9b48c" stroke-width="1">' +
    '<circle cx="11" cy="16.5" r="3.6"/><circle cx="11" cy="23.5" r="3.6"/><circle cx="29" cy="16.5" r="3.6"/><circle cx="29" cy="23.5" r="3.6"/>' +
    '<rect x="11" y="16.5" width="18" height="7" rx="2"/></g></svg>';

  function art(look) {
    return look === 'aussie' ? { dog: AUSSIE, ball: BONE } : { dog: GOLDEN, ball: BALL };
  }

  /** The park's squares as HTML. opts: { cursor, picked }. */
  function html(v, opts) {
    const n = v.n;
    const a = art(v.look);
    const clash = {};
    (v.clashes || []).forEach(function (c) { clash[c] = true; });
    const r = v.regions;
    let out = '';
    for (let i = 0; i < n * n; i++) {
      const x = i % n;
      const y = Math.floor(i / n);
      const area = r[i];
      // A fence on each side where the next square is in another area (or the edge).
      const fence = (y === 0 || r[i - n] !== area ? ' ft' : '') + (x === n - 1 || r[i + 1] !== area ? ' fr' : '') +
        (y === n - 1 || r[i + n] !== area ? ' fb' : '') + (x === 0 || r[i - 1] !== area ? ' fl' : '');
      let cls = 'dgp-sq' + fence;
      let inner = '';
      let style = '';
      if (area === -1) {
        cls += ' tree';
        inner = '🌳';
      } else if (area === -2) {
        cls += ' water';
      } else {
        style = ' style="--a:' + (v.phase === 'paused' ? '#5b6577' : AREAS[area % AREAS.length]) + '"';
        const m = v.marks[i];
        if (m === 2) {
          cls += ' dog' + (clash[i] ? ' clash' : '');
          inner = a.dog;
        } else if (m === 1) {
          cls += ' ball';
          inner = a.ball;
        }
      }
      if (v.hint === i && v.phase === 'play') cls += ' hint';
      if (opts && opts.cursor === i) cls += ' cursor';
      out += '<button type="button" class="' + cls + '" data-i="' + i + '"' + style + '>' + inner + '</button>';
    }
    return out;
  }

  /** A par time (seconds) as m:ss. */
  function par(sec) {
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  /** The rules, short, for under the park. */
  const RULES = '1 dog per row · 1 per column · 1 per colour · no two dogs touching';

  window.ArkDogPark = { html: html, art: art, par: par, RULES: RULES };
})();
