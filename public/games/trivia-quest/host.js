// Trivia Quest on the TV (server/games/trivia-quest.js): the monster and its health bar, your
// shared hearts and stars, then the question and its four answers (Quiz Battle's tiles). At the
// reveal: who picked what, the hit, and any hearts lost.
(function () {
  Ark.loadCss('/games/quiz/style.css');
  Ark.loadCss('/games/trivia-quest/style.css');
  const esc = Ark.escapeHtml;

  let root = null;
  let bar = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let lastKey = '';
  let shownHp = null; // { monster, pct }: where the health bar was, so it drains from there

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  /** ❤️ for each heart left, 🖤 for each lost. */
  function heartsHtml(v) {
    let h = '';
    for (let i = 0; i < v.maxHearts; i++) h += '<span class="' + (i < v.hearts ? 'on' : 'off') + '">' + (i < v.hearts ? '❤️' : '🖤') + '</span>';
    return '<div class="tq-hearts">' + h + '</div>';
  }

  /** The road so far: each monster, beaten ones with their stars. */
  function trailHtml(v) {
    return '<div class="tq-trail">' + v.monsters.map(function (m, i) {
      const done = i < v.beaten.length;
      const cls = done ? 'done' : i === v.monsterIndex ? 'now' : '';
      return '<span class="' + cls + '"><b>' + m.emoji + '</b>' + (done ? '⭐'.repeat(v.beaten[i]) : '') + '</span>';
    }).join('<i>›</i>') + '</div>';
  }

  /** Each player: thinking / locked in, then right or wrong and their hit. */
  function side(v, slot) {
    let status = '';
    if (v.phase === 'question') status = v.answered[slot] ? '🔒 Locked in' : 'Thinking…';
    else if (v.phase === 'reveal') {
      const p = v.picks[slot];
      status = p === null ? '⌛ No answer' : p === v.correct ? '✅ Hit for ' + v.hits[slot] : '❌ ' + v.labels[p] + ' · 💔';
    }
    const fifty = v.fiftyUsed[slot] ? '' : ' <span class="tq-fifty" title="50/50 left">💡</span>';
    return '<div class="qz-side' + (slot === 1 ? ' right' : '') + (v.phase === 'question' && v.answered[slot] ? ' locked' : '') + '">' +
      '<span class="name">' + nameOf(v, slot) + fifty + '</span><span class="status">' + status + '</span></div>';
  }

  function monsterHtml(v) {
    const m = v.monster;
    const pct = Math.round((m.hp / m.maxHp) * 100);
    const hit = v.phase === 'reveal' && v.damage > 0;
    const down = v.phase === 'defeated' || (v.phase === 'over' && m.hp === 0);
    return '<div class="tq-monster' + (hit ? ' hit' : '') + (down ? ' down' : '') + (v.phase === 'reveal' && v.heartsLost ? ' attacks' : '') + '">' +
      '<div class="emoji">' + m.emoji + '</div>' +
      '<div class="info"><div class="name">' + esc(m.name) + '</div>' +
      '<div class="tq-hp"><div class="fill' + (pct <= 25 ? ' low' : '') + '" data-pct="' + pct + '" style="width:' + (shownHp && shownHp.monster === v.monsterIndex ? shownHp.pct : pct) + '%"></div><span>' + m.hp + ' / ' + m.maxHp + '</span></div>' +
      (hit ? '<div class="dmg">' + (v.teamStrike ? '⚡ Team strike! ' : '') + '−' + v.damage + '</div>' : '') +
      (v.phase === 'reveal' && v.heartsLost ? '<div class="ouch">' + m.emoji + ' strikes back: −' + v.heartsLost + ' ' + (v.heartsLost > 1 ? 'hearts' : 'heart') + '</div>' : '') +
      '</div></div>';
  }

  function tile(v, i) {
    let cls = 'qz-tile c' + i;
    let marks = '';
    // A controller player's 50/50: their colour's strike through the two answers it took away.
    [0, 1].forEach(function (slot) {
      if (v.phase === 'question' && v.removedOnTv[slot].indexOf(i) !== -1) cls += ' tq-gone p' + (slot + 1);
    });
    if (v.phase === 'reveal') {
      cls += i === v.correct ? ' correct' : ' wrong';
      [0, 1].forEach(function (slot) {
        if (v.picks[slot] === i) marks += '<span class="mark p' + (slot + 1) + '">' + esc(v.players[slot].name) + '</span>';
      });
    }
    return '<div class="' + cls + '"><span class="badge">' + v.labels[i] + '</span><span class="text">' + esc(v.question.options[i]) + '</span>' +
      (marks ? '<span class="marks">' + marks + '</span>' : '') + '</div>';
  }

  function body(v) {
    if (v.phase === 'intro') {
      return '<div class="qz-center"><div class="big tq-enter">' + v.monster.emoji + '</div>' +
        '<div class="sub"><strong>' + esc(v.monster.name) + '</strong> blocks the way! ' + (v.monsterIndex === 0
          ? 'Answer together to wear it down: right and fast hits harder, both right is a team strike. Every wrong answer costs a heart.'
          : v.monsterIndex === v.monsters.length - 1 ? 'The boss: less time to answer.' : 'Tougher this time.') + '</div></div>';
    }
    if (v.phase === 'defeated') {
      return '<div class="qz-center"><div class="big">' + '⭐'.repeat(v.beaten[v.beaten.length - 1]) + '</div>' +
        '<div class="sub"><strong>' + esc(v.monster.name) + '</strong> is beaten!' + (v.hearts === 0 && v.monsterIndex < v.monsters.length - 1 ? ' But you\'re out of hearts…' : '') + '</div></div>';
    }
    if (v.phase === 'over') {
      return '<div class="qz-center"><div class="big">' + (v.won ? '🏆' : '💀') + '</div><div class="sub">' +
        (v.won ? 'Quest complete! You beat all three monsters'
          : v.monster.hp === 0 ? 'You beat the ' + esc(v.monster.name) + ', but that was your last heart'
            : 'Out of hearts. The ' + esc(v.monster.name) + ' wins this time') +
        '<br><strong>' + v.stars + ' / ' + v.maxStars + ' ⭐</strong><br>Rematch or head back to the lobby from your phones or controllers.</div></div>';
    }
    return '<div class="qz-card"><div class="meta">Question ' + v.number + ' · ' + esc(v.question.cat) + '</div><div class="q">' + esc(v.question.text) + '</div></div>' +
      '<div class="qz-bar"><div class="fill"></div></div>' +
      '<div class="qz-grid">' + [0, 1, 2, 3].map(function (i) { return tile(v, i); }).join('') + '</div>';
  }

  // The server pushes a view every second; ease the timer bar smoothly in between.
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!bar || !view) return;
    let frac = 0;
    if (view.phase === 'question') frac = Math.max(0, view.timeLeftMs - (performance.now() - viewAt)) / view.questionMs;
    bar.style.width = (frac * 100).toFixed(2) + '%';
    bar.classList.toggle('low', view.phase === 'question' && frac < 0.25);
  }

  // Controller players: face buttons answer (the D-pad as a diamond, as in Quiz Battle); LB / RB is your 50/50.
  const PAD_ANSWERS = { A: 0, B: 1, X: 2, Y: 3, DOWN: 0, RIGHT: 1, LEFT: 2, UP: 3 };

  Ark.register('host', 'trivia-quest', {
    sounds: function (prev, v) {
      const out = [];
      if (v.answered.filter(Boolean).length > prev.answered.filter(Boolean).length) out.push('lock');
      if (v.phase === 'reveal' && prev.phase !== 'reveal') {
        if (v.damage > 0) out.push(v.teamStrike ? 'boom' : 'correct');
        if (v.heartsLost) out.push('wrong');
      }
      if (v.phase === 'defeated' && prev.phase !== 'defeated') out.push('fanfare');
      if (v.phase === 'intro' && prev.phase !== 'intro') out.push('reveal');
      return out;
    },
    padHint: 'A B X Y (or D-pad ↓ → ← ↑) to answer · LB / RB: your 50/50 (once a quest: the two answers it takes away are struck out in your colour) · A: rematch at the end',
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'question' || v.answered[slot]) return null;
      if (btn === 'LB' || btn === 'RB') return { type: 'fifty' };
      if (btn in PAD_ANSWERS) return { type: 'answer', choice: PAD_ANSWERS[btn] };
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'qz-host tq-host';
      el.appendChild(root);
      raf = requestAnimationFrame(tick);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      const key = JSON.stringify([v.phase, v.number, v.monsterIndex, v.answered, v.picks, v.hearts, v.beaten, v.fiftyUsed, v.removedOnTv, v.players.map(function (p) { return p.name; })]);
      if (key === lastKey) return; // per-second clock updates only move the bar
      lastKey = key;
      root.innerHTML = '<div class="tq-top">' + heartsHtml(v) + trailHtml(v) + '<div class="tq-stars">⭐ ' + v.stars + ' / ' + v.maxStars + '</div></div>' +
        (v.phase === 'intro' ? '' : monsterHtml(v)) +
        (v.phase === 'question' || v.phase === 'reveal' ? '<div class="qz-top">' + side(v, 0) + '<span class="vs">🤝</span>' + side(v, 1) + '</div>' : '') +
        body(v);
      bar = root.querySelector('.qz-bar .fill');
      // The health bar was drawn where it stood: now let it drain to the new value.
      const hp = root.querySelector('.tq-hp .fill');
      if (hp) {
        const pct = Number(hp.getAttribute('data-pct'));
        hp.getBoundingClientRect(); // (so the browser sees the old width first)
        hp.style.width = pct + '%';
        shownHp = { monster: v.monsterIndex, pct: pct };
      }
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = bar = view = shownHp = null;
      lastKey = '';
    },
  });
})();
