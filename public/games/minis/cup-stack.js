// Cup Stack (server/games/minis/cup-stack.js): build each pyramid of cups, then take it down, a tap
// per cup with the hand the strip shows. The TV shows both mats; phones have a LEFT and a RIGHT
// button (the next one glows); controllers press ◀ / X for left and ▶ / B for right.
(function () {
  const WORD = { fumble: 'Fumble! 💥', built: 'Built! ▲', down: 'Down! ✓', done: 'Done! 🏁' };

  /** The pyramid being worked on for `step`: its size, how many cups are up, and which stack it is. */
  function stage(s, step) {
    let from = 0;
    for (let i = 0; i < s.stacks.length; i++) {
      const n = s.stacks[i];
      if (step < from + 2 * n || i === s.stacks.length - 1) {
        const k = step - from;
        return { i: i, size: n, up: k <= n ? k : 2 * n - k, building: k < n };
      }
      from += 2 * n;
    }
  }

  /** A pyramid of `size` cups with the first `up` of them stacked (the rest shown faint). */
  function pyramid(size, up) {
    const base = Math.round((Math.sqrt(8 * size + 1) - 1) / 2);
    let html = '<div class="mi-cs-pyr" style="--base:' + base + '">';
    let i = 0;
    for (let row = 0; row < base; row++) {
      html += '<div class="mi-cs-row" style="--row:' + row + '">';
      for (let c = 0; c < base - row; c++) html += '<i class="mi-cs-cup' + (i++ < up ? ' up' : '') + '"></i>';
      html += '</div>';
    }
    return html + '</div>';
  }

  /** The next hands: the first one big. */
  function strip(s, slot, n) {
    const k = s.step[slot];
    let html = '<div class="mi-cs-strip">';
    for (let j = 0; j < n && k + j < s.total; j++) {
      const h = s.seq[k + j];
      html += '<span class="mi-cs-hand ' + h + (j === 0 ? ' now' : '') + '">' + (h === 'L' ? '◀ L' : 'R ▶') + '</span>';
    }
    return html + '</div>';
  }

  function tally(s, slot) {
    const st = stage(s, s.step[slot]);
    const done = s.doneAt[slot] !== null;
    return '<div class="mi-cs-tally">' + s.stacks.map(function (n, i) {
      return '<span class="' + (done || i < st.i ? 'done' : i === st.i ? 'now' : '') + '">' + n + '</span>';
    }).join('') + '</div>';
  }

  /** One player's mat: the stacks done, the pyramid, the word, the strip and how far along. */
  function mat(s, slot, now) {
    const st = stage(s, s.step[slot]);
    const done = s.doneAt[slot] !== null;
    const locked = now < s.lockUntil[slot];
    return tally(s, slot) +
      '<div class="mi-cs-mat' + (locked ? ' fumbled' : '') + (done ? ' finished' : '') + '">' + (done ? '<b class="mi-cs-done">🏁</b>' : pyramid(st.size, st.up)) + '</div>' +
      '<div class="mi-cs-what">' + (done ? 'Finished!' : st.building ? 'Build it up' : 'Take it down') + '</div>' +
      (done ? '' : strip(s, slot, 6)) +
      '<div class="mi-cs-bar"><i style="width:' + (100 * s.step[slot] / s.total) + '%"></i></div>';
  }

  function flash(el, s, slot, seen) {
    const l = s.last[slot];
    if (!l || l.n === seen[slot] || !WORD[l.kind]) return;
    seen[slot] = l.n;
    const w = el.querySelector('.mi-cs-word');
    w.textContent = WORD[l.kind];
    w.className = 'mi-cs-word show ' + l.kind;
    void w.offsetWidth;
  }

  let host = null;
  let phone = null;

  function send(hand) {
    if (!phone || !phone.s) return;
    phone.mctx.send({ type: 'tap', hand: hand });
    phone.mctx.vibrate(10);
  }

  ArkMini.register('cup-stack', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split mi-cs-tv">' + [0, 1].map(function (slot) {
          return '<div class="mi-side mi-cs-side p' + (slot + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, slot) + '</div><div class="k"></div><b class="mi-cs-word"></b></div>';
        }).join('') + '</div>';
        host = { el: el, sides: el.querySelectorAll('.mi-cs-side'), seen: [0, 0] };
      },
      update: function (s) {
        if (!host) return;
        host.sides.forEach(function (side, slot) {
          side.querySelector('.k').innerHTML = mat(s, slot, s.elapsed);
          flash(side, s, slot, host.seen);
        });
        // (the fumble shake ends with the lock, though no new view comes then)
        clearTimeout(host.unlock);
        const wait = Math.max(s.lockUntil[0], s.lockUntil[1]) - s.elapsed;
        if (wait > 0) host.unlock = setTimeout(function () { if (host) host.sides.forEach(function (side) { const m = side.querySelector('.mi-cs-mat'); if (m) m.classList.remove('fumbled'); }); }, wait);
      },
      unmount: function () { if (host) clearTimeout(host.unlock); host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-cs-phone"><div class="mi-cs-head"></div><div class="mi-cs-me"></div><b class="mi-cs-word"></b>' +
          '<div class="mi-cs-btns"><button data-h="L">◀<small>LEFT</small></button><button data-h="R">▶<small>RIGHT</small></button></div></div>';
        phone = { el: el, mctx: mctx, slot: mctx.slot, s: null, seen: [0, 0] };
        el.querySelectorAll('[data-h]').forEach(function (b) {
          b.addEventListener('pointerdown', function (e) { e.preventDefault(); send(b.getAttribute('data-h')); });
        });
      },
      update: function (s) {
        if (!phone) return;
        phone.s = s;
        const me = phone.slot;
        phone.el.querySelector('.mi-cs-head').innerHTML = '<span>You <b>' + s.step[me] + '</b>/' + s.total + '</span><span>Them <b>' + s.step[1 - me] + '</b>/' + s.total + '</span>';
        const st = stage(s, s.step[me]);
        const done = s.doneAt[me] !== null;
        phone.el.querySelector('.mi-cs-me').innerHTML = tally(s, me) + '<div class="mi-cs-mat' + (done ? ' finished' : '') + '">' + (done ? '<b class="mi-cs-done">🏁</b>' : pyramid(st.size, st.up)) + '</div>' + (done ? '' : strip(s, me, 5));
        flash(phone.el, s, me, phone.seen);
        const locked = s.elapsed < s.lockUntil[me];
        const next = done ? '' : s.seq[s.step[me]];
        phone.el.querySelectorAll('[data-h]').forEach(function (b) {
          b.classList.toggle('next', b.getAttribute('data-h') === next && !locked);
          b.classList.toggle('locked', locked || done);
        });
        clearTimeout(phone.unlock);
        if (locked) phone.unlock = setTimeout(function () { if (phone && phone.s === s) phone.el.querySelectorAll('[data-h]').forEach(function (b) { b.classList.remove('locked'); b.classList.toggle('next', b.getAttribute('data-h') === next); }); }, s.lockUntil[me] - s.elapsed);
      },
      unmount: function () { if (phone) clearTimeout(phone.unlock); phone = null; },
    },
    pad: function (btn) {
      if (btn === 'LEFT' || btn === 'X') return { type: 'tap', hand: 'L' };
      if (btn === 'RIGHT' || btn === 'B') return { type: 'tap', hand: 'R' };
      return null;
    },
    sounds: function (prev, s) {
      const out = [];
      s.last.forEach(function (l, i) {
        const was = prev.last[i];
        if (!l || (was && was.n === l.n)) return;
        out.push({ fumble: 'crash', built: 'correct', down: 'correct', done: 'fanfare' }[l.kind] || 'knock');
      });
      return out;
    },
  });
})();
