(function () {
  Ark.loadCss('/games/mastermind-1p/style.css');
  const ready = Ark.loadScript('/games/mastermind-1p/board.js');

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
    if (!v || !root || !window.ArkMaster) return;
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
    root.querySelector('.mm1-main').innerHTML = window.ArkMaster.rows(v, local ? draft : null, slot) + window.ArkMaster.code(v);
  }

  function submit() {
    if (draft.some(function (c) { return c < 0; })) return null;
    return { type: 'guess', pegs: draft.slice() };
  }

  Ark.register('host', 'mastermind-1p', {
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
  });
})();
