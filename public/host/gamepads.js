// Reads game controllers plugged into (or paired with) the TV device through
// the browser Gamepad API and turns them into simple press events:
//   A B X Y LB RB LT RT BACK START UP DOWN LEFT RIGHT
// Uses the "standard" layout (Xbox naming). On PlayStation pads: A = Cross,
// B = Circle, X = Square, Y = Triangle. The left stick doubles as the D-pad.
// Browsers only reveal a controller after one of its buttons is pressed.
//
// The TV's keyboard is a controller too (index ArkPads.KEYBOARD), so a laptop or
// the Steam Deck's keyboard plays on its own: arrows or WASD move, Enter / Space = A,
// Backspace = B, Q = X, E = Y, P = Start, Esc = Back.
(function () {
  const BUTTONS = {
    0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
    8: 'BACK', 9: 'START', 10: 'LS', 11: 'RS', 12: 'UP', 13: 'DOWN', 14: 'LEFT', 15: 'RIGHT',
  };
  const STICK = 0.6;
  const KEYBOARD = 99;
  const KEYS = {
    ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
    KeyW: 'UP', KeyS: 'DOWN', KeyA: 'LEFT', KeyD: 'RIGHT',
    Enter: 'A', NumpadEnter: 'A', Space: 'A', Backspace: 'B', KeyQ: 'X', KeyE: 'Y', KeyP: 'START', Escape: 'BACK',
  };
  const keysDown = {}; // key code -> button name, while held
  let typing = null; // fn(key) -> true when a game took the key as typing (see setTyping)
  let keyboardSeen = false;

  const held = {}; // pad index -> names held on the last frame
  const sticks = {}; // pad index -> left stick { x, y }, -1..1
  const sticks2 = {}; // pad index -> right stick { x, y }, -1..1
  let onPress = function () {};
  let onChange = function () {};
  let onFrame = function () {};

  function pressedNames(gp) {
    const out = [];
    gp.buttons.forEach(function (b, i) {
      const name = BUTTONS[i];
      if (name && (b.pressed || b.value > 0.5)) out.push(name);
    });
    const x = gp.axes[0] || 0;
    const y = gp.axes[1] || 0;
    if (x < -STICK) out.push('LEFT');
    if (x > STICK) out.push('RIGHT');
    if (y < -STICK) out.push('UP');
    if (y > STICK) out.push('DOWN');
    return out;
  }

  function pads() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.prototype.filter.call(list || [], function (gp) { return gp && gp.connected; });
  }

  function poll() {
    const seen = {};
    let changed = false;
    pads().forEach(function (gp) {
      seen[gp.index] = true;
      const before = held[gp.index];
      if (!before) changed = true;
      const now = pressedNames(gp);
      held[gp.index] = now;
      sticks[gp.index] = { x: gp.axes[0] || 0, y: gp.axes[1] || 0 };
      sticks2[gp.index] = { x: gp.axes[2] || 0, y: gp.axes[3] || 0 };
      now.forEach(function (name) {
        // Fire once per press, not every frame it's held.
        if (!before || before.indexOf(name) === -1) onPress(gp.index, name);
      });
    });
    // The keyboard, once a key has been pressed: what's held, and the arrows as a stick.
    if (keyboardSeen) {
      seen[KEYBOARD] = true;
      if (!held[KEYBOARD]) changed = true;
      const names = Object.keys(keysDown).map(function (k) { return keysDown[k]; });
      held[KEYBOARD] = names.filter(function (n, i) { return names.indexOf(n) === i; });
      const has = function (n) { return held[KEYBOARD].indexOf(n) !== -1; };
      sticks[KEYBOARD] = { x: (has('RIGHT') ? 1 : 0) - (has('LEFT') ? 1 : 0), y: (has('DOWN') ? 1 : 0) - (has('UP') ? 1 : 0) };
    }
    Object.keys(held).forEach(function (i) {
      if (!seen[i]) {
        delete held[i];
        delete sticks[i];
        delete sticks2[i];
        changed = true;
      }
    });
    if (changed) onChange(Object.keys(held).map(Number));
    onFrame();
    requestAnimationFrame(poll);
  }

  // A key fires one press when it goes down (held keys auto-repeat keydown: those are
  // skipped, like a held button). Typing in a text box is left alone.
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    // A game that wants letters or digits (the solo word and number games) gets them first.
    if (typing && !e.repeat && typing(e.key)) {
      e.preventDefault();
      return;
    }
    const name = KEYS[e.code];
    if (!name) return;
    e.preventDefault(); // Space would scroll and Enter would click whatever has focus
    if (keysDown[e.code]) return;
    keysDown[e.code] = name;
    keyboardSeen = true;
    onPress(KEYBOARD, name);
  });
  window.addEventListener('keyup', function (e) { delete keysDown[e.code]; });
  window.addEventListener('blur', function () { Object.keys(keysDown).forEach(function (k) { delete keysDown[k]; }); });

  window.ArkPads = {
    KEYBOARD: KEYBOARD,
    /** fn(key) gets each key press first (e.key: 'a', '7', 'Enter'…); return true to keep it from the buttons. */
    setTyping: function (fn) { typing = fn; },
    /** fn(padIndex, buttonName) on each new press. */
    onPress: function (fn) { onPress = fn; },
    /** fn([padIndex, ...]) whenever a controller appears or disappears. */
    onChange: function (fn) { onChange = fn; },
    /** fn() once per frame, after presses; read held()/stick() inside for analog games. */
    onFrame: function (fn) { onFrame = fn; },
    /** Button names held right now on a pad. */
    held: function (index) { return held[index] || []; },
    /** Left stick position { x, y } (-1..1, down is +y). */
    stick: function (index) { return sticks[index] || { x: 0, y: 0 }; },
    /** Right stick position { x, y } (-1..1, down is +y). */
    stick2: function (index) { return sticks2[index] || { x: 0, y: 0 }; },
    /** Short buzz, on controllers and browsers that support it. */
    rumble: function (index, ms) {
      const gp = pads().filter(function (p) { return p.index === index; })[0];
      const act = gp && gp.vibrationActuator;
      if (act && act.playEffect) {
        act.playEffect('dual-rumble', { duration: ms, strongMagnitude: 0.5, weakMagnitude: 0.8 }).catch(function () {});
      }
    },
  };

  // (getGamepads can be missing: the keyboard still works.)
  requestAnimationFrame(poll);
})();
