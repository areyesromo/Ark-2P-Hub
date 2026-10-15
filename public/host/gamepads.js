// Reads game controllers plugged into (or paired with) the TV device through
// the browser Gamepad API and turns them into simple press events:
//   A B X Y LB RB LT RT BACK START UP DOWN LEFT RIGHT
// Uses the "standard" layout (Xbox naming). On PlayStation pads: A = Cross,
// B = Circle, X = Square, Y = Triangle. The left stick doubles as the D-pad.
// Browsers only reveal a controller after one of its buttons is pressed.
(function () {
  const BUTTONS = {
    0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
    8: 'BACK', 9: 'START', 12: 'UP', 13: 'DOWN', 14: 'LEFT', 15: 'RIGHT',
  };
  const STICK = 0.6;

  const held = {}; // pad index -> names held on the last frame
  let onPress = function () {};
  let onChange = function () {};

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
      now.forEach(function (name) {
        // Fire once per press, not every frame it's held.
        if (!before || before.indexOf(name) === -1) onPress(gp.index, name);
      });
    });
    Object.keys(held).forEach(function (i) {
      if (!seen[i]) {
        delete held[i];
        changed = true;
      }
    });
    if (changed) onChange(Object.keys(held).map(Number));
    requestAnimationFrame(poll);
  }

  window.ArkPads = {
    /** fn(padIndex, buttonName) on each new press. */
    onPress: function (fn) { onPress = fn; },
    /** fn([padIndex, ...]) whenever a controller appears or disappears. */
    onChange: function (fn) { onChange = fn; },
    /** Short buzz, on controllers and browsers that support it. */
    rumble: function (index, ms) {
      const gp = pads().filter(function (p) { return p.index === index; })[0];
      const act = gp && gp.vibrationActuator;
      if (act && act.playEffect) {
        act.playEffect('dual-rumble', { duration: ms, strongMagnitude: 0.5, weakMagnitude: 0.8 }).catch(function () {});
      }
    },
  };

  if (navigator.getGamepads) requestAnimationFrame(poll);
})();
