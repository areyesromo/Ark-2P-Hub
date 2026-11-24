(function () {
  Ark.loadCss('/games/mastermind-1p/style.css');
  const ready = Ark.loadScript('/games/mastermind-1p/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let draft = [];
  let guesses = 0;

  function fresh(v) {
    draft = Array(v.pegs).fill(-1);
  }

  function render() {
    const v = view;
    if (!v || !root || !window.ArkMaster) return;
    if (v.guesses.length !== guesses || draft.length !== v.pegs) {
      guesses = v.guesses.length;
      fresh(v);
    }
    const k = JSON.stringify([v.guesses, v.phase, draft, v.best]);
    if (k === key) return;
    key = k;
    const play = v.phase === 'play';
    root.querySelector('.info').innerHTML = 'Guess <strong>' + Math.min(v.guesses.length + 1, v.maxGuesses) + '</strong> / ' + v.maxGuesses + (v.best === null || v.best === undefined ? '' : ' · best ' + v.best);
    root.querySelector('.mm1-main').innerHTML = window.ArkMaster.rows(v, draft, draft.indexOf(-1)) + window.ArkMaster.code(v);
    let pal = '';
    for (let c = 0; c < v.colours; c++) pal += '<button type="button" data-c="' + c + '">' + window.ArkMaster.peg(c) + '</button>';
    root.querySelector('.mm1-pal').innerHTML = pal + '<button type="button" class="back" data-back>⌫</button>';
    root.querySelector('.mm1-pal').classList.toggle('off', !play);
    root.querySelector('.go').disabled = !play || draft.indexOf(-1) !== -1;
  }

  Ark.register('player', 'mastermind-1p', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'mm1-phone';
      root.innerHTML = '<div class="info"></div><div class="mm1-main"></div><div class="mm1-pal"></div><button class="primary go">Guess</button>';
      el.appendChild(root);
      // Tapping a colour fills the next empty peg; tapping a peg in the row being made clears it.
      root.addEventListener('pointerdown', function (e) {
        if (!view || view.phase !== 'play') return;
        const c = e.target.closest('[data-c]');
        if (c) {
          e.preventDefault();
          const at = draft.indexOf(-1);
          if (at !== -1) draft[at] = Number(c.getAttribute('data-c'));
          api.vibrate(5);
          return render();
        }
        if (e.target.closest('[data-back]')) {
          e.preventDefault();
          const last = draft.lastIndexOf(-1) === -1 ? draft.length - 1 : draft.indexOf(-1) - 1;
          if (last >= 0) draft[last] = -1;
          return render();
        }
        const p = e.target.closest('.mm1-row.now .mm1-peg');
        if (p) {
          const i = Array.prototype.indexOf.call(p.parentNode.children, p);
          draft[i] = -1;
          render();
        }
      });
      root.querySelector('.go').addEventListener('click', function () {
        if (!view || view.phase !== 'play' || draft.indexOf(-1) !== -1) return;
        api.send({ type: 'guess', pegs: draft.slice() });
        api.vibrate(10);
      });
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
      draft = [];
      guesses = 0;
    },
  });
})();
