// Gem Swap's board, drawn the same way on the TV and the phone. A swap is
// played back step by step: the two gems trade places, each line pops, the
// gems fall and new ones drop in, then the next step of a chain.
(function () {
  // Each gem also has its own shape, in every look, so the gems tell apart without colour too.
  // The unlockable looks (see server/games/looks.js) change the shapes and colours; these are the gems themselves.
  const THEMES = {
    classic: [
      { c: '#ef4444', s: '♥' }, { c: '#3b82f6', s: '◆' }, { c: '#22c55e', s: '●' },
      { c: '#eab308', s: '★' }, { c: '#a855f7', s: '▲' }, { c: '#f97316', s: '■' },
    ],
    fruit: [
      { c: '#fecaca', s: '🍒' }, { c: '#bfdbfe', s: '🫐' }, { c: '#bbf7d0', s: '🍏' },
      { c: '#fef08a', s: '🍋' }, { c: '#e9d5ff', s: '🍇' }, { c: '#fed7aa', s: '🍊' },
    ],
    space: [
      { c: '#1e40af', s: '🌍' }, { c: '#475569', s: '🌙' }, { c: '#a16207', s: '⭐' },
      { c: '#9a3412', s: '🪐' }, { c: '#6b21a8', s: '☄️' }, { c: '#be123c', s: '🚀' },
    ],
    candy: [
      { c: '#fbcfe8', s: '🍬' }, { c: '#ddd6fe', s: '🍭' }, { c: '#fde68a', s: '🍩' },
      { c: '#fed7aa', s: '🍪' }, { c: '#a5f3fc', s: '🧁' }, { c: '#d6b9a0', s: '🍫' },
    ],
  };
  const STEP_MS = 230;

  function create(el) {
    let size = 0;
    let shown = null; // the board on screen now
    let lastN = null;
    let nope = null;
    let timers = [];
    let marks = { selected: null, cursor: null };
    let cells = [];
    let gems = THEMES.classic;

    function build(n) {
      size = n;
      el.className = 'gem-board';
      el.style.setProperty('--n', n);
      el.innerHTML = '';
      cells = [];
      for (let i = 0; i < n * n; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gem';
        b.setAttribute('data-cell', i);
        b.innerHTML = '<span></span>';
        el.appendChild(b);
        cells.push(b);
      }
    }

    function paint(board, cls) {
      board.forEach(function (g, i) {
        const span = cells[i].firstChild;
        const gem = gems[g] || { c: 'transparent', s: '' };
        if (span.textContent !== gem.s || span.style.getPropertyValue('--c') !== gem.c) {
          span.textContent = gem.s;
          span.style.setProperty('--c', gem.c);
        }
        cells[i].className = 'gem' + (cls && cls[i] ? ' ' + cls[i] : '') + (marks.selected === i ? ' selected' : '') + (marks.cursor === i ? ' cursor' : '');
      });
      shown = board.slice();
    }

    function later(fn, ms) {
      timers.push(setTimeout(fn, ms));
    }

    /** Play a swap: trade, then pop / fall for each step of the chain. */
    function play(last, final) {
      timers.forEach(clearTimeout);
      timers = [];
      const start = shown ? shown.slice() : final.slice();
      [start[last.a], start[last.b]] = [start[last.b], start[last.a]];
      const swapped = {};
      swapped[last.a] = swapped[last.b] = 'moved';
      paint(start, swapped);
      let t = STEP_MS;
      last.steps.forEach(function (step) {
        const pop = {};
        step.cleared.forEach(function (i) { pop[i] = 'pop'; });
        later(function () { paint(shown, pop); }, t);
        t += STEP_MS;
        later(function () {
          const fell = {};
          step.cleared.forEach(function (i) { fell[i] = 'drop'; });
          paint(step.board, fell);
        }, t);
        t += STEP_MS;
      });
      later(function () {
        timers = [];
        paint(final);
      }, t);
    }

    return {
      /** marks: { selected, cursor } cells to outline. */
      show: function (v, m) {
        marks = m || marks;
        gems = THEMES[v.look] || THEMES.classic;
        if (v.size !== size) build(v.size);
        if (v.last && !v.last.nope && v.last.n !== lastN) {
          const first = lastN === null;
          lastN = v.last.n;
          if (!first) return play(v.last, v.board);
        }
        if (v.nope !== nope && nope !== null && v.last && v.last.nope) {
          const shake = {};
          shake[v.last.a] = shake[v.last.b] = 'shake';
          nope = v.nope;
          return paint(v.board, shake);
        }
        nope = v.nope;
        if (!timers.length) paint(v.board); // (while a swap plays back, its last step paints the board)
      },
      busy: function () { return timers.length > 0; },
      stop: function () { timers.forEach(clearTimeout); timers = []; },
    };
  }

  window.ArkGems = { create: create };
})();
