// A controller on the hub's plain pages (Settings, the leaderboard, trophies), which the TV opens:
// the D-pad or left stick moves between the page's buttons, links, choices and boxes by where they
// are on screen, A presses the one you're on, B goes back. Needs gamepads.js (ArkPads) first.
// Text boxes: A puts the cursor there; on a Steam Deck, Steam + X brings up its keyboard.
(function () {
  if (!window.ArkPads) return;
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
  let current = null;
  let hint = null;

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) {
      // A hidden radio inside its picture card: the card is what you see.
      const card = el.closest('label');
      return Boolean(card && card.getBoundingClientRect().width);
    }
    return !el.closest('.hidden') && getComputedStyle(el).visibility !== 'hidden';
  }
  function items() {
    return Array.prototype.filter.call(document.querySelectorAll(FOCUSABLE), visible);
  }
  /** What the player sees for an item: a radio's card, otherwise the item itself. */
  function box(el) {
    return (el.type === 'radio' && el.closest('label')) || el;
  }

  function mark(el) {
    if (current) box(current).classList.remove('pad-nav-focus');
    current = el;
    if (!el) return;
    box(el).classList.add('pad-nav-focus');
    if (el.type !== 'text' && el.type !== 'password' && el.tagName !== 'TEXTAREA') el.focus({ preventScroll: true });
    box(el).scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /** The nearest item that way from the current one (by its picture on screen). */
  function step(dir) {
    const list = items();
    if (!list.length) return null;
    if (!current || list.indexOf(current) === -1) return list[0];
    const a = box(current).getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;
    list.forEach(function (el) {
      if (el === current || box(el) === box(current)) return;
      const b = box(el).getBoundingClientRect();
      const bx = b.left + b.width / 2;
      const by = b.top + b.height / 2;
      const dx = bx - ax;
      const dy = by - ay;
      const ok = dir === 'DOWN' ? b.top >= a.bottom - 4 : dir === 'UP' ? b.bottom <= a.top + 4 : dir === 'RIGHT' ? b.left >= a.right - 4 && Math.abs(dy) < a.height : b.right <= a.left + 4 && Math.abs(dy) < a.height;
      if (!ok) return;
      const score = dir === 'UP' || dir === 'DOWN' ? Math.abs(dy) * 2 + Math.abs(dx) : Math.abs(dx) * 2 + Math.abs(dy);
      if (score < bestScore) { best = el; bestScore = score; }
    });
    return best;
  }

  function back() {
    const link = document.getElementById('back') || document.querySelector('a[href="/host/"]');
    if (link && visible(link)) location.href = link.getAttribute('href');
    else history.back();
  }

  ArkPads.onPress(function (_idx, btn) {
    if (btn === 'UP' || btn === 'DOWN' || btn === 'LEFT' || btn === 'RIGHT') {
      const next = step(btn);
      if (next) mark(next);
      else if (btn === 'UP' || btn === 'DOWN') window.scrollBy({ top: (btn === 'UP' ? -1 : 1) * innerHeight * 0.5, behavior: 'smooth' });
      return;
    }
    if ((btn === 'A' || btn === 'START') && current) {
      if (current.type === 'text' || current.type === 'password' || current.tagName === 'TEXTAREA') return current.focus();
      return current.click();
    }
    if (btn === 'B' || btn === 'BACK') return back();
  });

  ArkPads.onChange(function (list) {
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'pad-nav-hint';
      hint.textContent = '🎮 D-pad: move · A: select · B: back';
      document.body.appendChild(hint);
    }
    hint.classList.toggle('hidden', !list.length);
    if (list.length && !current) mark(step('DOWN'));
  });
})();
