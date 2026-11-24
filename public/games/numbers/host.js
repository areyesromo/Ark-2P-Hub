(function () {
  Ark.loadCss('/games/numbers/style.css');

  let root = null;
  let view = null;
  let key = '';
  let entry = ''; // typed on the TV (keyboard or controller)
  let cursor = 0; // a controller's place on the digit row
  let round = 0;

  /** The number with the digits that were wrong marked. */
  function compare(r) {
    let out = '';
    for (let i = 0; i < Math.max(r.number.length, r.typed.length); i++) {
      const want = r.number[i] || '';
      const got = r.typed[i] || '_';
      out += '<span class="' + (got === want ? 'ok' : 'no') + '">' + got + '</span>';
    }
    return out;
  }

  function render() {
    const v = view;
    if (!v || !root) return;
    if (v.round !== round) {
      round = v.round;
      entry = '';
    }
    const local = v.player && v.player.local;
    const k = JSON.stringify([v.phase, v.number, v.round, v.result, v.lives, entry, local && cursor]);
    if (k === key) return;
    key = k;
    let main = '';
    if (v.phase === 'ready') main = '<div class="sub">Get ready…</div>';
    else if (v.phase === 'show') {
      main = '<div class="nm-number">' + v.number + '</div><div class="nm-bar"><span style="animation-duration:' + v.showMs + 'ms"></span></div>';
    } else if (v.phase === 'answer') {
      main = '<div class="nm-entry">' + (entry ? entry : '<span class="muted">' + '?'.repeat(v.length) + '</span>') + '</div>' +
        '<div class="sub">' + (local ? 'Type it in: Enter when done' : 'Type it in on your phone') + '</div>';
      if (local) {
        let row = '<div class="nm-row">';
        for (let d = 0; d < 10; d++) row += '<span class="' + (cursor === d ? 'cursor' : '') + '">' + d + '</span>';
        main += row + '</div>';
      }
    } else if (v.result) {
      const r = v.result;
      main = '<div class="nm-number ' + (r.ok ? 'right' : 'wrong') + '">' + (r.ok ? r.number : compare(r)) + '</div>' +
        '<div class="sub">' + (r.ok ? '✓ Right! Next: ' + v.length + ' digits' : '✗ It was ' + r.number + (v.phase === 'over' ? '' : ' · one more go at ' + v.length + ' digits')) + '</div>';
    }
    root.querySelector('.nm-top').innerHTML = '<span>Digits <strong>' + v.length + '</strong></span><span>Best <strong>' + v.score + '</strong></span><span>' + (v.lives >= 2 ? '❤️❤️' : v.lives === 1 ? '❤️🤍' : '🤍🤍') + '</span>';
    root.querySelector('.nm-main').innerHTML = main;
  }

  function submit(v) {
    if (!entry) return null;
    const input = { type: 'answer', digits: entry };
    entry = '';
    return input;
  }

  Ark.register('host', 'numbers', {
    sounds: function (prev, v) {
      if (v.phase === 'show' && prev.phase !== 'show') return ['reveal'];
      if (v.result && (!prev.result || v.result.n !== prev.result.n)) return [v.result.ok ? 'correct' : 'wrong'];
      return [];
    },
    padHint: '← → pick a digit · A type it · B delete · Start / X done · keyboard: just type, Enter',
    pad: function (btn, v) {
      if (v.phase !== 'answer' && v.phase !== 'show') return null;
      if (btn === 'LEFT' || btn === 'RIGHT') cursor = (cursor + (btn === 'LEFT' ? 9 : 1)) % 10;
      else if (btn === 'A') entry += cursor;
      else if (btn === 'B') entry = entry.slice(0, -1);
      else if (btn === 'START' || btn === 'X') {
        const input = submit(v);
        render();
        return input;
      }
      render();
      return null;
    },
    typing: function (k, v) {
      if (v.phase !== 'answer' && v.phase !== 'show') return null;
      if (/^[0-9]$/.test(k)) entry += k;
      else if (k === 'Backspace') entry = entry.slice(0, -1);
      else if (k === 'Enter') {
        const input = submit(v);
        render();
        return input || true;
      } else return null;
      render();
      return true;
    },
    overHtml: function (v) {
      return v.result ? 'The last one was ' + v.result.number + ' (' + v.result.number.length + ' digits)' : '';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'nm-host';
      root.innerHTML = '<div class="nm-top"></div><div class="nm-main"></div>';
      el.appendChild(root);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = entry = '';
      round = 0;
    },
  });
})();
