// Shared by the TV and the phone: the board as a grid of squares, and the three balls coming next.
window.ArkLines = (function () {
  const COLOURS = ['#ef4b4b', '#f5a623', '#f4e04d', '#4cc66a', '#3b9cf2', '#a766e8', '#e9edf7'];
  const MARKS = ['●', '■', '▲', '◆', '★', '✚', '○']; // so the colours can be told apart without colour

  function ball(c) {
    return '<i class="ln-ball" style="--c:' + COLOURS[c] + '">' + MARKS[c] + '</i>';
  }

  function board(v, sel, cursor) {
    let h = '';
    for (let i = 0; i < v.board.length; i++) {
      const c = v.board[i];
      h += '<button type="button" data-i="' + i + '" class="ln-sq' + (i === sel ? ' sel' : '') + (i === cursor ? ' cursor' : '') + '">' + (c === null ? '' : ball(c)) + '</button>';
    }
    return h;
  }

  function next(v) {
    return '<span class="muted">Next</span>' + v.next.map(ball).join('');
  }

  return { board: board, next: next, ball: ball };
})();
