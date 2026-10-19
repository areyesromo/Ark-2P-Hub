// Motion for phone minigames: the accelerometer (how the phone is moved and tilted) and
// vibration. Phones only give a web page the motion sensor on a secure (https) page, and
// iPhones only after asking from a tap (the minigame Ready button calls ArkMotion.ask()).
// Every motion game keeps a button or swipe as well, so a phone without it can still play.
(function () {
  const G = 9.81;
  let asked = false;
  let live = false; // a reading has arrived
  let flip = 1; // -1 on phones that report the axes the other way round (see reading)

  /** From a tap: ask for the motion sensor where the phone wants permission (iPhones). */
  function ask() {
    if (asked) return;
    asked = true;
    [window.DeviceMotionEvent, window.DeviceOrientationEvent].forEach(function (E) {
      if (E && typeof E.requestPermission === 'function') E.requestPermission().catch(function () {});
    });
  }

  /**
   * A reading, in screen terms for a phone held upright: x to the right, y up, z out of the
   * screen. `move` is the phone's own acceleration (gravity taken out, m/s²), `tilt` how far
   * its right edge and its top point down (-1..1, gravity), `jolt` the size of `move`.
   */
  function reading(e) {
    const g = e.accelerationIncludingGravity || {};
    const a = e.acceleration;
    const gx = g.x || 0;
    const gy = g.y || 0;
    const gz = g.z || 0;
    // Held upright, gravity reads along +y on most phones and -y on some: learn which.
    if (Math.abs(gy) > 5) flip = gy > 0 ? 1 : -1;
    const mx = a && a.x !== null ? a.x : 0;
    const my = a && a.y !== null ? a.y : 0;
    const mz = a && a.z !== null ? a.z : 0;
    return {
      move: { x: flip * mx, y: flip * my, z: flip * mz },
      jolt: Math.hypot(mx, my, mz) || Math.max(0, Math.hypot(gx, gy, gz) - G),
      tilt: { right: Math.max(-1, Math.min(1, (-flip * gx) / G)), top: Math.max(-1, Math.min(1, (flip * gy) / G)) },
    };
  }

  /** Call fn(reading) for each motion reading; returns a function that stops it. */
  function on(fn) {
    const handler = function (e) {
      if (!e.accelerationIncludingGravity && !e.acceleration) return;
      live = true;
      fn(reading(e));
    };
    window.addEventListener('devicemotion', handler);
    return function () { window.removeEventListener('devicemotion', handler); };
  }

  /** Buzz the phone (Android; iPhones can't from a web page). */
  function buzz(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  window.ArkMotion = {
    ask: ask,
    on: on,
    buzz: buzz,
    /** True once the sensor has sent something (otherwise show the button / swipe way). */
    live: function () { return live; },
  };
})();
