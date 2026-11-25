// Mastermind, the 1 player mode of Code Breaker (view.solo): the TV's and the phone's screens.
// The game's own renderers hand over to these (window.ArkMastermind.host / .player).
(function () {

  // The pegs' colours are the pegs themselves.
  const COLOURS = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];

  function peg(c, extra) {
    if (c === null || c === undefined || c < 0) return '<span class="mm1-peg empty' + (extra || '') + '"></span>';
    return '<span class="mm1-peg' + (extra || '') + '" style="--c:' + COLOURS[c] + '">' + (c + 1) + '</span>';
  }

  /** The little black and white pins that say how a guess did. */
  function pins(g, n) {
    let out = '<span class="mm1-pins" style="--n:' + Math.ceil(n / 2) + '">';
    for (let i = 0; i < n; i++) out += '<i class="' + (i < g.exact ? 'black' : i < g.exact + g.colour ? 'white' : '') + '"></i>';
    return out + '</span>';
  }

  /** The guesses so far, then (for the one building a guess) the row being made. */
  function rows(v, draft, cursor) {
    let out = '<div class="mm1-rows">';
    for (let r = 0; r < v.maxGuesses; r++) {
      const g = v.guesses[r];
      const building = !g && draft && r === v.guesses.length && v.phase === 'play';
      out += '<div class="mm1-row' + (g ? ' done' : '') + (building ? ' now' : '') + '"><span class="no">' + (r + 1) + '</span><span class="pegs">';
      for (let i = 0; i < v.pegs; i++) {
        out += peg(g ? g.pegs[i] : building ? draft[i] : -1, building && cursor === i ? ' cursor' : '');
      }
      out += '</span>' + (g ? pins(g, v.pegs) : '<span class="mm1-pins"></span>') + '</div>';
    }
    return out + '</div>';
  }

  /** The secret code, once the run is over. */
  function code(v) {
    if (!v.code) return '';
    return '<div class="mm1-code">' + (v.won ? '🎉 Cracked it' : 'The code was') + '<span class="pegs">' + v.code.map(function (c) { return peg(c); }).join('') + '</span></div>';
  }


  // ---- the TV ----
  const host = (function () {

    const ready = Promise.resolve();

    let root = null;
    let view = null;
    let key = '';
    let draft = []; // the guess a controller or the keyboard is building
    let slot = 0;
    let guesses = 0;

    function fresh(v) {
      draft = Array(v.pegs).fill(-1);
      slot = 0;
    }

    function render() {
      const v = view;
      if (!v || !root) return;
      if (v.guesses.length !== guesses) {
        guesses = v.guesses.length;
        fresh(v);
      }
      if (draft.length !== v.pegs) fresh(v);
      const local = v.player && v.player.local && v.phase === 'play';
      const k = JSON.stringify([v.guesses, v.phase, local && draft, local && slot]);
      if (k === key) return;
      key = k;
      root.querySelector('.mm1-top').innerHTML = '<span>Guess <strong>' + Math.min(v.guesses.length + 1, v.maxGuesses) + '</strong> / ' + v.maxGuesses + '</span><span class="muted">⚫ right colour and place · ⚪ right colour, wrong place</span>';
      root.querySelector('.mm1-main').innerHTML = rows(v, local ? draft : null, slot) + code(v);
    }

    function submit() {
      if (draft.some(function (c) { return c < 0; })) return null;
      return { type: 'guess', pegs: draft.slice() };
    }


    return {
      sounds: function (prev, v) {
        if (v.phase === 'over' && prev.phase !== 'over') return [v.won ? 'fanfare' : 'end'];
        if (v.guesses.length > prev.guesses.length) return ['lock'];
        return [];
      },
      padHint: '← → pick a peg · ↑ ↓ its colour · A guess · B clear the peg · keyboard: type 1–8, Enter to guess',
      pad: function (btn, v) {
        if (v.phase !== 'play') return null;
        if (btn === 'LEFT') slot = (slot + v.pegs - 1) % v.pegs;
        else if (btn === 'RIGHT') slot = (slot + 1) % v.pegs;
        else if (btn === 'UP') draft[slot] = (draft[slot] + 1) % v.colours;
        else if (btn === 'DOWN') draft[slot] = draft[slot] <= 0 ? v.colours - 1 : draft[slot] - 1;
        else if (btn === 'B') draft[slot] = -1;
        else if (btn === 'A') {
          const input = submit();
          if (input) return input;
          // Not full yet: A jumps to the first empty peg.
          slot = draft.indexOf(-1);
        }
        render();
        return null;
      },
      typing: function (k, v) {
        if (v.phase !== 'play') return null;
        if (/^[1-9]$/.test(k) && Number(k) <= v.colours) {
          draft[slot] = Number(k) - 1;
          slot = Math.min(v.pegs - 1, slot + 1);
        } else if (k === 'Backspace') {
          draft[slot] = -1;
          slot = Math.max(0, slot - 1);
        } else if (k === 'Enter') {
          const input = submit();
          return input || true;
        } else return null;
        render();
        return true;
      },
      overHtml: function (v) {
        return v.won ? 'Cracked the ' + v.variant + ' code in ' + v.guesses.length + (v.guesses.length === 1 ? ' guess' : ' guesses') : 'Not cracked in ' + v.maxGuesses + ': a lost game doesn\'t count';
      },
      mount: function (el) {
        root = document.createElement('div');
        root.className = 'mm1-host';
        root.innerHTML = '<div class="mm1-top"></div><div class="mm1-main"></div>';
        el.appendChild(root);
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
};
  })();

  // ---- the phone ----
  const player = (function () {

    const ready = Promise.resolve();

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
      if (!v || !root) return;
      if (v.guesses.length !== guesses || draft.length !== v.pegs) {
        guesses = v.guesses.length;
        fresh(v);
      }
      const k = JSON.stringify([v.guesses, v.phase, draft, v.best]);
      if (k === key) return;
      key = k;
      const play = v.phase === 'play';
      root.querySelector('.info').innerHTML = 'Guess <strong>' + Math.min(v.guesses.length + 1, v.maxGuesses) + '</strong> / ' + v.maxGuesses + (v.best === null || v.best === undefined ? '' : ' · best ' + v.best);
      root.querySelector('.mm1-main').innerHTML = rows(v, draft, draft.indexOf(-1)) + code(v);
      let pal = '';
      for (let c = 0; c < v.colours; c++) pal += '<button type="button" data-c="' + c + '">' + peg(c) + '</button>';
      root.querySelector('.mm1-pal').innerHTML = pal + '<button type="button" class="back" data-back>⌫</button>';
      root.querySelector('.mm1-pal').classList.toggle('off', !play);
      root.querySelector('.go').disabled = !play || draft.indexOf(-1) !== -1;
    }


    return {
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
};
  })();

  window.ArkMastermind = { host: host, player: player };
})();
