// Tower Stack on the phone: one big DROP button for your turns (it lights up in your colour), and
// how the tower's doing. Watch the block slide on the TV and tap as it's right over the tower.
(function () {
  Ark.loadCss('/games/tower-stack/style.css');

  let root = null;
  let els = null;
  let api = null;
  let view = null;
  let textKey = '';

  function myTurn() {
    return view && view.phase === 'drop' && view.turn === view.you;
  }

  function drop(e) {
    e.preventDefault();
    if (!myTurn()) return;
    api.send({ type: 'drop' });
    if (navigator.vibrate) navigator.vibrate(20);
  }

  function render(v) {
    view = v;
    if (!els) return;
    const mine = v.turn === v.you;
    const dir = v.you === 0 ? '↔ left-right' : '↕ front-back';
    let status;
    if (v.phase === 'intro') status = 'You drop the blocks sliding <strong>' + dir + '</strong>. Tap as one is right over the tower.';
    else if (v.phase === 'over') status = '<span class="big">' + (v.stars ? '⭐'.repeat(v.stars) : 'Down it comes') + '</span><br>' + v.height + ' floors';
    else if (v.last && v.phase === 'settle') status = v.last.kind === 'perfect' ? '✨ Perfect!' + (v.combo >= 3 ? ' It grows back.' : '') : v.last.kind === 'miss' ? '💥 Missed: a life gone' : 'Trimmed: the overhang falls off';
    else status = mine ? '<strong>Your drop</strong> · watch the TV' : 'Their drop…';
    const hearts = '❤️'.repeat(Math.max(0, v.lives)) + '🖤'.repeat(Math.max(0, v.maxLives - v.lives));
    const html = '<div class="ts-info"><span>🏗️ ' + v.height + ' floors</span><span>' + hearts + '</span></div><div class="ts-status">' + status + '</div>';
    if (html !== textKey) {
      textKey = html;
      els.text.innerHTML = html;
    }
    els.drop.disabled = !myTurn();
    els.drop.classList.toggle('mine', myTurn());
    els.drop.classList.toggle('hidden', v.phase === 'over');
    els.rematch.classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'tower-stack', {
    zoomable: function (v) { return v.phase === 'over'; },
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'ts-phone';
      root.innerHTML = '<div class="ts-text"></div><button class="ts-drop">DROP<small>on your turn</small></button><button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      els = { text: root.querySelector('.ts-text'), drop: root.querySelector('.ts-drop'), rematch: root.querySelector('.rematch') };
      // (on the press, not the release: the moment you tap is the moment it drops)
      els.drop.addEventListener('pointerdown', drop);
      els.rematch.addEventListener('click', function () { api.send({ type: 'rematch' }); });
      if (view) render(view);
    },
    update: render,
    unmount: function () {
      root = els = view = null;
      textKey = '';
    },
  });
})();
