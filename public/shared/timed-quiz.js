// Screens for the against-the-clock games (Quick Maths, Colour Trap, see
// server/games/timed-quiz.js): the question big on the TV with the four
// choices under it, four big buttons on the phone, and the clock.
//
//   ArkQuiz.host(el, { prompt(v) -> html, choice(v, i) -> html, badges: ['A', 'B', 'X', 'Y'] })
//   ArkQuiz.player(el, api, { prompt(v) -> html, choice(v, i) -> html })
// Each returns { update(v) }. Optional: cls (a class for longer text, e.g. Trivia's),
// score(v) -> html for the top line, and v.reveal ({ answer, chose }) marks the
// right answer (and a wrong pick) while it shows.
(function () {
  function clock(ms) {
    return Math.ceil(ms / 1000) + ' s';
  }

  function flash(el, last, seen) {
    if (!last || last.n === seen.n) return;
    seen.n = last.n;
    el.classList.remove('right', 'wrong');
    void el.offsetWidth; // restart the flash
    el.classList.add(last.ok ? 'right' : 'wrong');
  }

  /** The classes of choice i: the right answer and a wrong pick while the answer shows. */
  function marks(v, i) {
    const r = v.reveal;
    if (!r) return '';
    if (i === r.answer) return ' is-answer';
    return i === r.chose ? ' is-wrong' : ' is-off';
  }

  function host(el, opts) {
    el.innerHTML = '<div class="tq1-host' + (opts.cls ? ' ' + opts.cls : '') + '"><div class="tq1-top"><span class="tq1-clock"></span><span class="tq1-score"></span></div>' +
      '<div class="tq1-prompt"></div><div class="tq1-choices"></div><div class="tq1-bar"><i></i></div></div>';
    const root = el.firstChild;
    const seen = { n: null };
    let key = '';
    return {
      update: function (v) {
        root.querySelector('.tq1-clock').textContent = v.reveal ? '' : '⏱ ' + clock(v.timeLeft); // no clock while the answer shows
        root.querySelector('.tq1-clock').classList.toggle('low', v.phase === 'play' && v.timeLeft < 10000);
        root.querySelector('.tq1-bar i').style.width = (100 * v.timeLeft) / (v.seconds * 1000) + '%';
        root.querySelector('.tq1-score').innerHTML = opts.score ? opts.score(v) : '✔ <strong>' + v.right + '</strong>' + (v.wrong ? ' · ✘ ' + v.wrong : '') + (v.streak > 2 ? ' · 🔥 ' + v.streak : '');
        flash(root, v.last, seen);
        const k = JSON.stringify([v.phase, v.question, v.reveal]);
        if (k === key) return;
        key = k;
        const q = v.question;
        if (v.phase === 'ready') root.querySelector('.tq1-prompt').innerHTML = '<span class="tq1-ready">Get ready…</span>';
        else if (q) root.querySelector('.tq1-prompt').innerHTML = opts.prompt(v);
        root.querySelector('.tq1-choices').innerHTML = q ? q.options.map(function (_, i) {
          return '<div class="tq1-choice' + marks(v, i) + '">' + (opts.badges ? '<b class="badge b' + opts.badges[i] + '">' + opts.badges[i] + '</b>' : '') + opts.choice(v, i) + '</div>';
        }).join('') : '';
      },
    };
  }

  function player(el, api, opts) {
    el.innerHTML = '<div class="tq1-phone' + (opts.cls ? ' ' + opts.cls : '') + '"><div class="tq1-top"><span class="tq1-clock"></span><span class="tq1-score"></span></div>' +
      '<div class="tq1-prompt"></div><div class="tq1-choices"></div></div>';
    const root = el.firstChild;
    const seen = { n: null };
    let key = '';
    root.querySelector('.tq1-choices').addEventListener('pointerdown', function (e) {
      const b = e.target.closest('[data-i]');
      if (!b || b.className) return; // the answer is showing
      e.preventDefault();
      api.send({ type: 'answer', choice: Number(b.getAttribute('data-i')) });
      api.vibrate(8);
    });
    return {
      update: function (v) {
        root.querySelector('.tq1-clock').textContent = v.reveal ? '' : '⏱ ' + clock(v.timeLeft); // no clock while the answer shows
        root.querySelector('.tq1-score').innerHTML = (opts.score ? opts.score(v) : '✔ <strong>' + v.right + '</strong>') + (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.formatScore(v.best, 'pts'));
        if (v.last && v.last.n !== seen.n && !v.last.ok) api.vibrate([50, 30, 50]);
        flash(root, v.last, seen);
        const k = JSON.stringify([v.phase, v.question, v.reveal]);
        if (k === key) return;
        key = k;
        const q = v.question;
        root.querySelector('.tq1-prompt').innerHTML = v.phase === 'ready' ? '<span class="tq1-ready">Get ready…</span>' : q ? opts.prompt(v) : '';
        root.querySelector('.tq1-choices').innerHTML = q ? q.options.map(function (_, i) {
          return '<button type="button" class="' + marks(v, i).trim() + '" data-i="' + i + '">' + opts.choice(v, i) + '</button>';
        }).join('') : '';
      },
    };
  }

  window.ArkQuiz = { host: host, player: player };
})();
