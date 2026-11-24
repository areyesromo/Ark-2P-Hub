// In the 1 player mode (view.solo) the game is Reaction Rush: its screens are in rush.js (ArkReactionRush).
(function () {
  Ark.loadCss('/games/reaction-duel/style.css');
  const rushReady = Ark.loadScript('/games/reaction-duel/rush.js');
  let rush = null; // { el, api, on, view }: handing over to Reaction Rush's screen
  const esc = Ark.escapeHtml;
  let root = null;

  function nameOf(view, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(view.players[slot].name) + '</span>';
  }

  function resultLine(view) {
    const r = view.result;
    if (!r) return '';
    if (r.kind === 'tap') return nameOf(view, r.winner) + ' takes it in <strong>' + r.ms + ' ms</strong>';
    if (r.kind === 'false-start') return nameOf(view, r.offender) + ' jumped the gun! Point to ' + nameOf(view, r.winner);
    return 'Nobody tapped. No point.';
  }

  function light(view) {
    switch (view.phase) {
      case 'ready':
        return { cls: 'ready', big: 'Get ready…', sub: 'Round ' + view.round + '. Fingers ready!' };
      case 'wait':
        return { cls: 'wait', big: 'WAIT…', sub: 'Tap too early and you lose the point' };
      case 'go':
        return { cls: 'go', big: 'GO!', sub: '' };
      case 'result':
        return { cls: 'result', big: view.result && view.result.kind === 'tap' ? view.result.ms + ' ms' : '😬', sub: resultLine(view) };
      case 'over':
        return {
          cls: 'over',
          big: '<span class="ark-result">🏆 ' + nameOf(view, view.winner) + ' wins!</span>',
          sub: resultLine(view) + '<br>Rematch or head back to the lobby from your phones.',
        };
      default:
        return { cls: '', big: '', sub: '' };
    }
  }

  function best(ms) {
    return ms === null ? '-' : ms + ' ms';
  }

  const TAP_BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT'];

  const duel = {
    // Sound: GO!, and a buzz for jumping the gun (points and the end come from the TV shell).
    sounds: function (prev, v) {
      const out = [];
      if (v.phase === 'go' && prev.phase !== 'go') out.push('go');
      if (v.phase !== prev.phase && v.result && v.result.kind === 'false-start') out.push('wrong');
      return out;
    },
    // Controller players: any face button, bumper or trigger taps.
    padHint: 'Any button or trigger to tap · A: rematch at the end',
    pad: function (btn, view) {
      if (view.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      return TAP_BUTTONS.indexOf(btn) !== -1 ? { type: 'tap' } : null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'rd-host';
      el.appendChild(root);
    },
    update: function (view) {
      const l = light(view);
      root.innerHTML =
        Ark.scoreboardHtml(view.players, view.scores, view.winScore, view.round) +
        '<div class="rd-light ' + l.cls + '"><div class="big">' + l.big + '</div>' +
        (l.sub ? '<div class="sub">' + l.sub + '</div>' : '') + '</div>' +
        '<div class="rd-best"><span>Best: ' + best(view.bestMs[0]) + '</span><span>Best: ' + best(view.bestMs[1]) + '</span></div>';
    },
    unmount: function () { root = null; },
  };

  /** 1 player: show Reaction Rush's screen in place of the duel's (once the script is in). */
  function toRush(v) {
    if (!rush) return false;
    rush.view = v;
    if (!rush.on && window.ArkReactionRush) {
      rush.on = true;
      duel.unmount();
      rush.el.innerHTML = '';
      ArkReactionRush.host.mount(rush.el, rush.api);
    }
    if (rush.on) ArkReactionRush.host.update(v);
    return true;
  }
  const solo = (v) => Boolean(v && v.solo && window.ArkReactionRush);

  Ark.register('host', 'reaction-duel', Object.assign({}, duel, {
    mount: function (el, api) {
      rush = { el: el, api: api, on: false, view: null };
      duel.mount(el, api);
      rushReady.then(function () { if (rush && rush.view && rush.view.solo) toRush(rush.view); });
    },
    update: function (v) {
      if (v.solo) return toRush(v);
      duel.update(v);
    },
    unmount: function () {
      if (rush && rush.on) ArkReactionRush.host.unmount();
      else duel.unmount();
      rush = null;
    },
    sounds: function (prev, v) { return solo(v) ? (ArkReactionRush.host.sounds ? ArkReactionRush.host.sounds(prev, v) : []) : prev.solo ? [] : duel.sounds ? duel.sounds(prev, v) : []; },
    pad: function (btn, v, slot) { return solo(v) ? ArkReactionRush.host.pad(btn, v) : duel.pad ? duel.pad(btn, v, slot) : null; },
    overHtml: function (v) { return solo(v) ? ArkReactionRush.host.overHtml(v) : duel.overHtml ? duel.overHtml(v) : ''; },
  }));
})();
