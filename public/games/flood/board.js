// Shared by the TV and the phone: the colours, the board (a canvas) and the colour buttons.
window.ArkFlood = (function () {
  const COLOURS = ['#ef4b4b', '#f5a623', '#f4e04d', '#4cc66a', '#3b9cf2', '#a766e8'];
  const MARKS = ['●', '■', '▲', '◆', '★', '✚']; // so the colours can be told apart without colour

  function draw(canvas, v) {
    const px = Math.min(canvas.clientWidth || 360, 720) * (window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(px)) canvas.width = canvas.height = Math.round(px);
    const g = canvas.getContext('2d');
    const s = canvas.width / v.n;
    for (let i = 0; i < v.board.length; i++) {
      const x = (i % v.n) * s;
      const y = Math.floor(i / v.n) * s;
      g.fillStyle = COLOURS[v.board[i]];
      g.fillRect(x, y, Math.ceil(s), Math.ceil(s));
    }
    // The corner you own.
    g.strokeStyle = '#fff';
    g.lineWidth = Math.max(2, s / 6);
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, s - g.lineWidth, s - g.lineWidth);
  }

  function buttons(v, cursor) {
    let h = '';
    for (let c = 0; c < v.colours; c++) {
      h += '<button type="button" data-c="' + c + '" style="--c:' + COLOURS[c] + '" class="' + (c === v.own ? 'own ' : '') + (c === cursor ? 'cursor' : '') + '"' + (c === v.own || v.phase !== 'play' ? ' disabled' : '') + '><b>' + (c + 1) + '</b> ' + MARKS[c] + '</button>';
    }
    return h;
  }

  function info(v) {
    const left = Math.max(0, v.limit - v.moves);
    return '<span>Moves <strong>' + v.moves + '</strong> / ' + v.limit + '</span><span class="' + (left <= 3 && v.phase === 'play' ? 'fld-low' : 'muted') + '">' + Math.round((100 * v.area) / (v.n * v.n)) + '% flooded</span>';
  }

  return { draw: draw, buttons: buttons, info: info };
})();
