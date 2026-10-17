(function () {
  Ark.loadCss('/games/mind-meld/style.css');
  const dialReady = Ark.loadScript('/games/mind-meld/dial.js');
  const esc = Ark.escapeHtml;
  const SEND_EVERY_MS = 60;

  let root = null;
  let els = null;
  let api = null;
  let view = null;
  let textKey = '';
  let dragging = false;
  let localAim = null; // the dial while this phone is turning it
  let lastSent = 0;
  let sendTimer = null;

  function stars(n) {
    return n ? new Array(n + 1).join('⭐') : '—';
  }

  function sendAim(now) {
    clearTimeout(sendTimer);
    sendTimer = null;
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (!now && wait > 0) {
      sendTimer = setTimeout(function () { sendAim(true); }, wait);
      return;
    }
    lastSent = Date.now();
    api.send({ type: 'aim', value: localAim });
  }

  function canTurn(v) {
    return (v.phase === 'clue' || v.phase === 'guess') && v.you === v.guesser;
  }

  /** The dial: redrawn on every view (the needle moves), without touching the rest of the screen. */
  function drawDial(v) {
    if (!window.ArkDial || !els) return;
    const giverHides = v.you === v.giver && v.phase === 'clue'; // nothing to see of the needle yet
    const aim = dragging && localAim !== null ? localAim : v.aim;
    els.dial.innerHTML = '<span class="end left">' + esc(v.card[0]) + '</span>' +
      ArkDial.svg({ aim: aim, target: v.target, bands: v.bands, needle: !giverHides }) +
      '<span class="end right">' + esc(v.card[1]) + '</span>';
    els.dial.classList.toggle('turnable', canTurn(v));
  }

  function headHtml(v) {
    const giver = v.you === v.giver;
    const top = '<div class="md-top"><span>Round ' + v.round + ' / ' + v.rounds + '</span><span class="stars">' + v.stars + ' ⭐</span></div>';
    if (v.phase === 'clue') {
      return top + (giver
        ? '<div class="md-role">🧠 You give the clue</div><p class="md-help">The coloured spot is the target. Type a word or short phrase that would sit there between <strong>' + esc(v.card[0]) + '</strong> and <strong>' + esc(v.card[1]) + '</strong>.</p>'
        : '<div class="md-role">🎯 You turn the dial</div><p class="md-help">Waiting for the clue… you can line the dial up already.</p>');
    }
    if (v.phase === 'guess') {
      return top + '<div class="md-clue">“' + esc(v.clue) + '”</div>' + (giver
        ? '<p class="md-help">They\'re turning the dial. No extra hints!</p>'
        : '<p class="md-help">Drag the dial to where the clue sits, then lock in.</p>');
    }
    if (v.phase === 'reveal' && v.result) {
      const r = v.result;
      return top + '<div class="md-clue">' + (v.clue ? '“' + esc(v.clue) + '”' : 'No clue') + '</div><div class="md-result">' +
        (r.noClue ? 'Out of time' : r.stars ? stars(r.stars) + ' off by ' + r.diff : 'Missed by ' + r.diff) + '</div>';
    }
    return '';
  }

  function render(v) {
    view = v;
    if (!els) return;
    if (v.phase === 'needPhone' || v.phase === 'over') {
      const key = v.phase + v.stars;
      if (key !== textKey) {
        textKey = key;
        els.head.innerHTML = v.phase === 'over'
          ? '<div class="md-over">' + v.stars + ' of ' + v.maxStars + ' ⭐</div>'
          : '<p class="md-help">Mind Meld needs a phone for whoever gives the clue.</p>';
        els.dial.innerHTML = '';
        els.form.classList.add('hidden');
        els.controls.classList.add('hidden');
        els.rematch.classList.toggle('hidden', v.phase !== 'over');
      }
      return;
    }
    const key = JSON.stringify([v.phase, v.round, v.clue, v.result, v.stars, v.you === v.giver]);
    if (key !== textKey) {
      textKey = key;
      els.head.innerHTML = headHtml(v);
      const giving = v.phase === 'clue' && v.you === v.giver;
      els.form.classList.toggle('hidden', !giving);
      if (giving) {
        els.input.value = '';
        els.input.maxLength = v.clueMax;
      }
      els.controls.classList.toggle('hidden', !canTurn(v));
      els.lock.disabled = v.phase !== 'guess';
      els.rematch.classList.add('hidden');
      if (!canTurn(v)) dragging = false;
    }
    drawDial(v);
  }

  function nudge(d) {
    if (!view || !canTurn(view)) return;
    localAim = Math.max(0, Math.min(100, (localAim !== null && dragging ? localAim : view.aim) + d));
    dragging = true;
    drawDial(view);
    sendAim(true);
    dragging = false;
    view.aim = localAim;
  }

  Ark.register('player', 'mind-meld', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'md-phone';
      root.innerHTML =
        '<div class="md-head"></div>' +
        '<div class="md-dial-box"></div>' +
        '<form class="md-form hidden"><input class="md-input" autocomplete="off" placeholder="Your clue"><button class="primary" type="submit">Send</button></form>' +
        '<div class="md-controls hidden"><button class="ghost" data-nudge="-1">◀</button><button class="primary md-lock">Lock in</button><button class="ghost" data-nudge="1">▶</button></div>' +
        '<button class="primary md-rematch hidden">Play again</button>';
      el.appendChild(root);
      els = {
        head: root.querySelector('.md-head'),
        dial: root.querySelector('.md-dial-box'),
        form: root.querySelector('.md-form'),
        input: root.querySelector('.md-input'),
        controls: root.querySelector('.md-controls'),
        lock: root.querySelector('.md-lock'),
        rematch: root.querySelector('.md-rematch'),
      };
      els.form.addEventListener('submit', function (e) {
        e.preventDefault();
        const text = els.input.value.trim();
        if (!text) return;
        api.send({ type: 'clue', text: text });
        els.input.blur();
      });
      els.lock.addEventListener('click', function () {
        if (dragging) sendAim(true);
        api.send({ type: 'lock' });
        api.vibrate(30);
      });
      els.controls.addEventListener('click', function (e) {
        const b = e.target.closest('[data-nudge]');
        if (b) nudge(Number(b.getAttribute('data-nudge')));
      });
      els.rematch.addEventListener('click', function () { api.send({ type: 'rematch' }); });
      // Drag anywhere on the dial to turn it.
      els.dial.addEventListener('pointerdown', function (e) {
        if (!view || !canTurn(view)) return;
        const svg = els.dial.querySelector('svg');
        if (!svg) return;
        e.preventDefault();
        if (els.dial.setPointerCapture) els.dial.setPointerCapture(e.pointerId);
        dragging = true;
        localAim = ArkDial.valueAt(svg, e.clientX, e.clientY);
        drawDial(view);
        sendAim(false);
      });
      els.dial.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        const svg = els.dial.querySelector('svg');
        localAim = ArkDial.valueAt(svg, e.clientX, e.clientY);
        drawDial(view);
        sendAim(false);
      });
      const up = function () {
        if (!dragging) return;
        sendAim(true);
        view.aim = localAim;
        dragging = false;
      };
      els.dial.addEventListener('pointerup', up);
      els.dial.addEventListener('pointercancel', up);
      const mounted = root;
      dialReady.then(function () {
        if (root !== mounted || !view) return;
        textKey = '';
        render(view);
      });
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      root = els = view = null;
      textKey = '';
      dragging = false;
      localAim = null;
    },
  });
})();
