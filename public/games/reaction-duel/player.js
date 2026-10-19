(function () {
  Ark.loadCss('/games/reaction-duel/style.css');
  let pad = null;
  let api = null;
  let view = null;

  function onPress(e) {
    if (e.target.closest('.rematch')) return;
    e.preventDefault();
    if (!view || (view.phase !== 'wait' && view.phase !== 'go')) return;
    api.send({ type: 'tap' });
    api.vibrate(30);
    pad.classList.add('pressed');
    setTimeout(function () { if (pad) pad.classList.remove('pressed'); }, 120);
  }

  function onClick(e) {
    if (e.target.closest('.rematch')) api.send({ type: 'rematch' });
  }

  function content(v) {
    const you = v.you;
    const score = 'You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them';
    const r = v.result;
    switch (v.phase) {
      case 'ready':
        return { cls: '', big: 'Ready?', sub: 'Watch the TV. Tap anywhere here when it says GO.' };
      case 'wait':
        return { cls: 'wait', big: 'Wait…', sub: "Don't tap yet!" };
      case 'go':
        return { cls: 'go', big: 'TAP!', sub: '' };
      case 'result': {
        let big = 'Too slow';
        let sub = 'Nobody tapped';
        let cls = '';
        if (r.kind === 'tap') {
          cls = r.winner === you ? 'won' : 'lost';
          big = r.winner === you ? 'Point!' : 'Too slow';
          sub = r.ms + ' ms';
        } else if (r.kind === 'false-start') {
          cls = r.offender === you ? 'lost' : 'won';
          big = r.offender === you ? 'False start!' : 'Free point!';
          sub = r.offender === you ? 'You tapped before GO' : 'They jumped early';
        }
        return { cls: cls, big: big, sub: sub, score: score };
      }
      case 'over': {
        const won = v.winner === you;
        return {
          cls: won ? 'won' : 'lost',
          big: won ? 'You win! 🏆' : 'You lose',
          sub: score,
          rematch: true,
        };
      }
      default:
        return { cls: '', big: '', sub: '' };
    }
  }

  Ark.register('player', 'reaction-duel', {
    mount: function (el, a) {
      api = a;
      pad = document.createElement('div');
      pad.className = 'rd-pad';
      // pointerdown fires on touch immediately (no 300ms click delay)
      pad.addEventListener('pointerdown', onPress);
      pad.addEventListener('click', onClick);
      el.appendChild(pad);
    },
    update: function (v) {
      // No buzz on GO: it would be a head start for phones that can vibrate (iPhones can't).
      view = v;
      const c = content(v);
      pad.className = 'rd-pad ' + c.cls;
      pad.innerHTML =
        '<div class="big">' + c.big + '</div>' +
        (c.sub ? '<div class="sub">' + Ark.escapeHtml(c.sub) + '</div>' : '') +
        (c.score ? '<div class="score">' + c.score + '</div>' : '') +
        (c.rematch ? '<button class="primary rematch">Rematch</button>' : '');
    },
    unmount: function () {
      pad = null;
      view = null;
    },
  });
})();
