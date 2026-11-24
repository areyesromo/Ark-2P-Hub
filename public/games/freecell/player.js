(function () {
  Ark.loadCss('/games/solitaire/style.css');
  Ark.loadCss('/games/freecell/style.css');
  const ready = Ark.loadScript('/games/solitaire/board.js').then(function () { return Ark.loadScript('/games/freecell/board.js'); });

  let root = null;
  let table = null;
  let info = null;
  let api = null;
  let view = null;
  let selected = null; // { pile, index? } picked up, waiting for where to put it
  let pending = null; // a tap sent as a "smart" move: { from, nope, moves }
  let boardKey = '';
  let giveUpArmed = false;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkFreeCell) return;
    const key = JSON.stringify([v.tab, v.cells, v.found, selected]);
    if (key !== boardKey) {
      boardKey = key;
      table.innerHTML = window.ArkFreeCell.html(v, { selected: selected });
    }
    info.innerHTML = '⏱ ' + Ark.clock(v.elapsed) + ' · ' + v.foundCount + '/52 home · ' + v.moves + ' moves' + (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.clock(v.best));
    root.querySelector('.finish').classList.toggle('hidden', !v.canFinish);
    root.querySelector('.undo').disabled = !v.canUndo;
  }

  // Tap a card: it goes where it fits (home, a column, a free cell). If it can't
  // go anywhere it stays picked up, and the next tap says where to put it.
  function tap(e) {
    const el = e.target.closest('[data-pile]');
    if (!el || !view || view.phase !== 'play') return;
    const pile = el.getAttribute('data-pile');
    const index = el.hasAttribute('data-index') ? Number(el.getAttribute('data-index')) : undefined;
    api.vibrate(6);
    if (selected) {
      const from = selected;
      selected = null;
      if (window.ArkFreeCell.fits(view, from.pile, from.index, pile)) {
        api.send({ type: 'move', from: from.pile, index: from.index, to: pile });
        return render();
      }
      render();
      // It can't go there: so this tap is about the card tapped (tapping the picked-up one puts it back).
      if (from.pile === pile && from.index === index) return;
    }
    if (!el.classList.contains('sol-card')) return; // an empty place, with nothing picked up
    pending = { from: { pile: pile, index: index }, nope: view.nope, moves: view.moves };
    api.send({ type: 'smart', from: pile, index: index });
  }

  Ark.register('player', 'freecell', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'fc-phone';
      root.innerHTML =
        '<div class="info"></div><div class="fc-table"></div>' +
        '<div class="sol-tools"><button class="ghost undo">↶ Undo</button><button class="primary finish hidden">✨ Finish</button><button class="ghost give-up">Give up</button></div>';
      el.appendChild(root);
      table = root.querySelector('.fc-table');
      info = root.querySelector('.info');
      table.addEventListener('click', tap);
      root.querySelector('.undo').addEventListener('click', function () { selected = null; api.send({ type: 'undo' }); });
      root.querySelector('.finish').addEventListener('click', function () { api.send({ type: 'finish' }); });
      const giveUp = root.querySelector('.give-up');
      giveUp.addEventListener('click', function () {
        if (!giveUpArmed) {
          giveUpArmed = true;
          giveUp.textContent = 'Tap again';
          setTimeout(function () { giveUpArmed = false; if (root) giveUp.textContent = 'Give up'; }, 3000);
          return;
        }
        api.send({ type: 'give-up' });
      });
      ready.then(render);
    },
    update: function (v) {
      if (root) root.setAttribute('data-look', v.look || 'classic');
      if (pending && v.nope > pending.nope) {
        // Couldn't go anywhere by itself: picked up instead (if it's a run that can be picked up).
        if (window.ArkFreeCell && window.ArkFreeCell.taking(v, pending.from.pile, pending.from.index)) selected = pending.from;
        api.vibrate([30, 30, 30]);
      }
      if (pending && (v.nope !== pending.nope || v.moves !== pending.moves)) pending = null;
      if (v.phase !== 'play') selected = null;
      view = v;
      render();
    },
    unmount: function () {
      root = table = info = view = selected = pending = api = null;
      boardKey = '';
      giveUpArmed = false;
    },
  });
})();
