// Who Is It faces, drawn in SVG from their features (the colours are the faces' own: hair, eyes,
// skin). Sets window.ArkFaces.
(function () {
  const SKIN = ['#f6d3b3', '#d9a273', '#8d5a3b'];
  const HAIR = { black: '#1f1b1a', brown: '#6b3f1f', blonde: '#e8c15a', red: '#c4512a', grey: '#a8a8a8', bald: null };
  const EYES = { brown: '#5b3a1f', blue: '#3b82f6', green: '#16a34a' };

  /** One face as SVG. `f`: its features. */
  function svg(f) {
    const skin = SKIN[f.skin] || SKIN[0];
    const hair = HAIR[f.hair];
    const beardColour = hair || '#6b3f1f';
    let s = '<svg class="wi-face" viewBox="0 0 40 44">';
    if (hair && f.long) s += '<path d="M8 20 Q6 38 12 40 L28 40 Q34 38 32 20 Z" fill="' + hair + '"/>'; // long hair behind
    s += '<ellipse cx="20" cy="22" rx="11" ry="13" fill="' + skin + '"/>';
    s += '<ellipse cx="8.5" cy="23" rx="2" ry="3" fill="' + skin + '"/><ellipse cx="31.5" cy="23" rx="2" ry="3" fill="' + skin + '"/>';
    if (f.earrings) s += '<circle cx="8.5" cy="27" r="1.4" fill="#facc15"/><circle cx="31.5" cy="27" r="1.4" fill="#facc15"/>';
    if (hair) s += '<path d="M9 19 Q9 8 20 8 Q31 8 31 19 Q26 13 20 14 Q14 13 9 19 Z" fill="' + hair + '"/>';
    if (f.rosy) s += '<circle cx="13.5" cy="27" r="2.2" fill="#f87171" opacity="0.55"/><circle cx="26.5" cy="27" r="2.2" fill="#f87171" opacity="0.55"/>';
    s += '<circle cx="15.5" cy="21.5" r="2.1" fill="#fff"/><circle cx="24.5" cy="21.5" r="2.1" fill="#fff"/>';
    s += '<circle cx="15.5" cy="21.7" r="1.2" fill="' + EYES[f.eyes] + '"/><circle cx="24.5" cy="21.7" r="1.2" fill="' + EYES[f.eyes] + '"/>';
    if (f.glasses) s += '<g fill="none" stroke="#111827" stroke-width="0.9"><circle cx="15.5" cy="21.5" r="3.4"/><circle cx="24.5" cy="21.5" r="3.4"/><path d="M18.9 21.5h2.2"/></g>';
    if (f.beard) s += '<path d="M10.5 26 Q11 36 20 36.5 Q29 36 29.5 26 Q26 31 20 31 Q14 31 10.5 26 Z" fill="' + beardColour + '"/>';
    s += '<path d="M16.5 30 Q20 32.5 23.5 30" fill="none" stroke="#7f1d1d" stroke-width="1" stroke-linecap="round"/>';
    if (f.hat) s += '<path d="M6 13 L34 13 L34 15 L6 15 Z" fill="#7c3aed"/><path d="M11 13 Q11 3 20 3 Q29 3 29 13 Z" fill="#7c3aed"/><path d="M11 11 L29 11 L29 13 L11 13 Z" fill="#facc15"/>';
    return s + '</svg>';
  }

  /** A card: the face and its name. `cls`: extra classes; `attr`: extra attributes. */
  function card(f, cls, attr) {
    return '<div class="wi-card' + (cls ? ' ' + cls : '') + '"' + (attr || '') + '>' + svg(f) + '<span>' + Ark.escapeHtml(f.name) + '</span></div>';
  }

  window.ArkFaces = { svg: svg, card: card };
})();
