// Tilt controls for phone games: reads the motion sensor and reports how the
// phone is tilted, in the directions of what's on screen.
//
// Phones only let a web page read the motion sensor on a secure (https://)
// page, and iPhones only after asking from a tap. The hub serves both http
// and https on the same port, so a game can offer the secure page when
// start() fails with 'insecure' (see api.secureUrl in play.js).
(function () {
  let listening = false;
  let got = false;
  let timer = null;
  let handler = null;
  let onFail = null;

  /** The screen's rotation: 0, 90, 180 or 270 (counter-clockwise turns of the phone). */
  function screenAngle() {
    const o = window.screen && screen.orientation;
    const a = o && typeof o.angle === 'number' ? o.angle : Number(window.orientation) || 0;
    return ((a % 360) + 360) % 360;
  }

  /**
   * From the W3C angles, how far the right-hand side and the top of the
   * controller point up (sines, -1..1). `extra` adds a quarter turn for a
   * controller drawn sideways on an upright phone (90).
   */
  function axes(e, extra) {
    const b = e.beta * Math.PI / 180;
    const g = e.gamma * Math.PI / 180;
    const xUp = -Math.cos(b) * Math.sin(g); // the phone's own x axis (right edge, held upright)
    const yUp = Math.sin(b); // its y axis (top edge)
    const a = (screenAngle() + (extra || 0)) % 360;
    if (a === 90) return { right: -yUp, top: xUp };
    if (a === 180) return { right: -xUp, top: -yUp };
    if (a === 270) return { right: yUp, top: -xUp };
    return { right: xUp, top: yUp };
  }

  const reasons = {
    insecure: 'Phones only let web pages use the motion sensor on a secure (https) page.',
    none: 'This phone has no motion sensor the browser can read.',
    silent: 'No reading from the motion sensor.',
    denied: 'Motion sensor access was not allowed.',
    ask: 'Tap 📱 Tilt again to allow the motion sensor.',
  };

  function stop() {
    clearTimeout(timer);
    if (listening) window.removeEventListener('deviceorientation', handler);
    listening = false;
    handler = null;
  }

  function fail(code) {
    stop();
    if (onFail) onFail(code, reasons[code]);
  }

  /**
   * Start reading. onTilt({ right, top }) on each reading (see axes; `extra`
   * is a function returning the controller's extra quarter turn, if any).
   * onError(code, message) if it can't: 'insecure' | 'none' | 'silent' |
   * 'denied' | 'ask' ('ask': call again from a tap). `fromTap`: called
   * from a tap, so iPhones can ask for permission.
   */
  function start(onTilt, onError, opts) {
    opts = opts || {};
    stop();
    onFail = onError;
    const insecure = window.isSecureContext === false;
    if (typeof window.DeviceOrientationEvent === 'undefined') return fail(insecure ? 'insecure' : 'none');
    const listen = function () {
      got = false;
      handler = function (e) {
        if (e.beta === null || e.beta === undefined || e.gamma === null || e.gamma === undefined) return;
        got = true;
        onTilt(axes(e, opts.extra ? opts.extra() : 0));
      };
      window.addEventListener('deviceorientation', handler);
      listening = true;
      timer = setTimeout(function () { if (!got) fail(insecure ? 'insecure' : 'silent'); }, 1500);
    };
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      if (insecure) return fail('insecure');
      if (!opts.fromTap) return fail('ask');
      DeviceOrientationEvent.requestPermission().then(function (answer) {
        if (answer === 'granted') listen();
        else fail('denied');
      }).catch(function () { fail('denied'); });
      return;
    }
    listen();
  }

  window.ArkTilt = { start: start, stop: stop, axes: axes };
})();
