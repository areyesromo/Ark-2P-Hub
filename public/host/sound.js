// Sound effects for the TV, made on the fly with the Web Audio API (no audio
// files). ArkSound.play('name') plays one of the effects below.
//
// Browsers only allow audio after someone interacts with the page, so sound
// starts once someone clicks, taps or presses a key on the TV (a gamepad press
// doesn't count), unless the browser allows autoplay (the Pi kiosk does).
// ArkSound.onChange tells the page when to show "tap for sound".
(function () {
  const KEY = 'ark.sound';
  const VOLUME = 0.45;

  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  const listeners = [];
  const lastPlayed = {}; // name -> time, to stop the same effect stacking up
  let unlockAttemptAt = -Infinity;

  try { muted = localStorage.getItem(KEY) === 'off'; } catch (e) { /* private mode */ }

  function setup() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ctx.onstatechange = notify;
    return ctx;
  }

  function notify() {
    listeners.forEach(function (fn) { fn(); });
  }

  /** True once the browser lets us play (after the first click/tap/key). */
  function unlocked() {
    return Boolean(ctx && ctx.state === 'running');
  }

  function unlock() {
    if (unlocked()) return;
    unlockAttemptAt = performance.now();
    if (!setup()) return;
    // A context made during a click may already be running; otherwise ask for it.
    if (ctx.state !== 'running') ctx.resume().then(notify, function () {});
    else notify();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  });
  // Kiosk browsers started with --autoplay-policy=no-user-gesture-required
  // (see deploy/pi/kiosk.sh) can play straight away; elsewhere this context
  // stays suspended until the first click, tap or key.
  if (setup() && ctx.state !== 'running') ctx.resume().then(notify, function () {});

  // ---- building blocks -------------------------------------------------------

  /** An oscillator note: type, start/end frequency, duration, volume, delay. */
  function tone(type, f0, f1, dur, vol, delay) {
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** A burst of filtered noise: filter type, frequency (start/end), duration, volume, delay. */
  function noise(filter, f0, f1, dur, vol, delay) {
    const t = ctx.currentTime + (delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const fl = ctx.createBiquadFilter();
    fl.type = filter;
    fl.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    fl.Q.value = filter === 'bandpass' ? 1.5 : 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl);
    fl.connect(g);
    g.connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** Notes (Hz) one after another. */
  function arpeggio(type, notes, step, dur, vol) {
    notes.forEach(function (f, i) { tone(type, f, f, dur, vol, i * step); });
  }

  // ---- the effects -------------------------------------------------------------

  const SOUNDS = {
    tick: function () { tone('sine', 880, 880, 0.09, 0.35); },
    go: function () { tone('square', 1320, 1320, 0.28, 0.18); tone('sine', 660, 660, 0.28, 0.25); },
    point: function () { arpeggio('triangle', [660, 990], 0.08, 0.16, 0.35); },
    fanfare: function () {
      arpeggio('triangle', [523, 659, 784], 0.11, 0.18, 0.35);
      tone('triangle', 1047, 1047, 0.6, 0.35, 0.33);
      tone('sine', 523, 523, 0.6, 0.2, 0.33);
    },
    join: function () { arpeggio('sine', [587, 880], 0.07, 0.14, 0.3); },
    leave: function () { arpeggio('sine', [880, 587], 0.07, 0.14, 0.25); },
    start: function () { noise('bandpass', 400, 3000, 0.35, 0.25); arpeggio('triangle', [392, 523, 659], 0.07, 0.12, 0.25); },
    paddle: function () { tone('square', 520, 520, 0.05, 0.16); },
    wall: function () { tone('square', 260, 260, 0.04, 0.1); },
    puck: function () { noise('highpass', 2500, 2500, 0.04, 0.35); tone('sine', 700, 500, 0.05, 0.2); },
    crash: function () { noise('lowpass', 2000, 120, 0.6, 0.6); tone('sawtooth', 160, 40, 0.5, 0.18); },
    eat: function () { tone('square', 500, 1000, 0.08, 0.14); },
    shoot: function () { noise('highpass', 1500, 600, 0.12, 0.3); tone('square', 800, 200, 0.1, 0.08); },
    boom: function () { noise('lowpass', 1200, 100, 0.45, 0.6); tone('sine', 120, 40, 0.4, 0.35); },
    bigBoom: function () { noise('lowpass', 1600, 60, 1.0, 0.75); tone('sine', 90, 30, 0.9, 0.45); tone('sawtooth', 200, 50, 0.6, 0.12); },
    splash: function () { noise('bandpass', 1800, 500, 0.45, 0.45); },
    drop: function () { tone('sine', 300, 120, 0.12, 0.4); noise('lowpass', 900, 200, 0.08, 0.3, 0.02); },
    lock: function () { tone('square', 1200, 1200, 0.03, 0.12); tone('sine', 600, 600, 0.06, 0.2, 0.02); },
    correct: function () { arpeggio('triangle', [784, 1047, 1319], 0.08, 0.16, 0.32); },
    wrong: function () { tone('sawtooth', 180, 140, 0.35, 0.16); },
    close: function () { tone('sine', 660, 760, 0.12, 0.25); tone('sine', 760, 660, 0.12, 0.25, 0.12); },
    whoosh: function () { noise('bandpass', 300, 3000, 0.4, 0.35); },
    reveal: function () { arpeggio('sine', [988, 1319], 0.1, 0.35, 0.3); },
  };

  function play(name) {
    if (muted || !SOUNDS[name] || !unlocked()) return;
    const now = performance.now();
    if (now - (lastPlayed[name] || 0) < 40) return;
    lastPlayed[name] = now;
    try { SOUNDS[name](); } catch (e) { /* never let audio break the game */ }
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(KEY, m ? 'off' : 'on'); } catch (e) { /* private mode */ }
    if (m === false) unlock();
    if (master) master.gain.value = m ? 0 : VOLUME;
    notify();
  }

  window.ArkSound = {
    play: play,
    names: Object.keys(SOUNDS),
    isMuted: function () { return muted; },
    setMuted: setMuted,
    unlocked: unlocked,
    /** The shared AudioContext (null until it can be made), for the background music. */
    context: function () { return ctx; },
    /** When a click/tap/key last tried to switch audio on (so that click isn't also a mute toggle). */
    unlockAttemptAt: function () { return unlockAttemptAt; },
    onChange: function (fn) { listeners.push(fn); },
  };
})();
