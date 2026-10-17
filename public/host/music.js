// Background music for the TV, composed and played live with the Web Audio
// API (no audio files), like the sound effects in sound.js.
//
// There are four moods: 'lobby' (laid back), 'action' (chiptune, for the
// real-time games), 'thinking' (calm, for quizzes and board games) and
// 'casual' (bouncy). Each loops a chord progression with bass and drums, and
// a melody that's made up fresh every 8 bars (the second half of each 8 bars
// echoes the first, so it sounds like a tune rather than noodling).
//
//   ArkMusic.setMood('action')   crossfades to that mood ('off' fades out)
//   ArkMusic.setEnabled(false)   the 🎵 button; remembered in this browser
//
// ArkMusic.compose(mood, bar, seed) is pure (it just lists the notes of one
// bar), so it's tested in Node.
(function () {
  const KEY = 'ark.music';
  const VOLUME = 0.16;
  const STEPS = 16; // sixteenth notes per bar
  const LOOKAHEAD = 0.15; // seconds of notes scheduled ahead
  const FADE = 0.9;

  const QUALITY = {
    maj: [0, 4, 7],
    min: [0, 3, 7],
    maj7: [0, 4, 7, 11],
    m7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10],
  };

  /**
   * Each mood: tempo, a 4-bar chord loop ([root as a MIDI note, quality]),
   * the scale its melodies use (semitones above `key`), and its parts.
   */
  const MOODS = {
    lobby: {
      bpm: 84,
      key: 60, // C
      scale: [0, 2, 4, 7, 9], // major pentatonic
      chords: [[53, 'maj7'], [52, 'm7'], [50, 'm7'], [48, 'maj7']],
      drums: { kick: [0, 7, 10], snare: [4, 12], hat: [2, 6, 10, 14] },
      bass: [[0, 0, 6], [10, 0, 4]], // [step, semitones above the root, length in steps]
      pad: true,
      arp: null,
      melody: { chance: 0.3, every: 2, octave: 12, inst: 'lead' },
    },
    action: {
      bpm: 132,
      key: 57, // A minor
      scale: [0, 3, 5, 7, 10], // minor pentatonic
      chords: [[45, 'min'], [41, 'maj'], [48, 'maj'], [43, 'maj']],
      drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
      bass: [[0, 0, 2], [2, 12, 2], [4, 0, 2], [6, 12, 2], [8, 0, 2], [10, 12, 2], [12, 0, 2], [14, 12, 2]],
      pad: false,
      arp: { every: 1, octave: 24, inst: 'arp' },
      melody: { chance: 0.45, every: 2, octave: 12, inst: 'lead' },
    },
    thinking: {
      bpm: 100,
      key: 62, // D dorian
      scale: [0, 2, 3, 7, 9],
      chords: [[50, 'm7'], [46, 'maj7'], [53, 'maj7'], [48, 'maj']],
      drums: { kick: [0, 8], snare: [12], hat: [2, 6, 10, 14] },
      bass: [[0, 0, 6], [8, 7, 6]],
      pad: true,
      arp: { every: 2, octave: 12, inst: 'pluck' },
      melody: { chance: 0.18, every: 4, octave: 12, inst: 'lead' },
    },
    casual: {
      bpm: 112,
      key: 55, // G
      scale: [0, 2, 4, 7, 9],
      chords: [[43, 'maj'], [40, 'min'], [48, 'maj'], [50, 'maj']],
      drums: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
      bass: [[0, 0, 3], [6, 7, 2], [8, 12, 3], [12, 7, 2]],
      pad: false,
      stabs: [2, 6, 10, 14],
      arp: null,
      melody: { chance: 0.38, every: 2, octave: 12, inst: 'lead' },
    },
  };

  /** A small seeded random number generator (mulberry32), so a phrase can be replayed. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** The melody for one bar: a random walk on the scale that lands on chord tones on the beat. */
  function melodyBar(m, mood, chord, rand) {
    const out = [];
    const notes = [];
    for (let o = 0; o < 2; o++) mood.scale.forEach(function (s) { notes.push(mood.key + m.octave - 12 + s + 12 * o); });
    const tones = QUALITY[chord[1]].map(function (i) { return (chord[0] + i) % 12; });
    let at = Math.floor(rand() * notes.length);
    for (let step = 0; step < STEPS; step += m.every) {
      if (rand() > m.chance && step % 8 !== 0) continue;
      at = Math.max(0, Math.min(notes.length - 1, at + Math.round((rand() - 0.5) * 4)));
      let midi = notes[at];
      if (step % 4 === 0) {
        // On the beat: nudge to the nearest chord tone.
        for (let d = 0; d < 3 && tones.indexOf(midi % 12) === -1; d++) midi++;
      }
      out.push({ step: step, inst: m.inst, midi: midi, len: m.every * (rand() < 0.3 ? 2 : 1), vel: 0.7 + 0.3 * rand() });
    }
    return out;
  }

  /**
   * Every note of one bar of a mood: [{ step (0-15), inst, midi?, len (steps), vel }].
   * seed picks the melodies; the same (mood, bar, seed) always gives the same bar.
   */
  function compose(moodName, bar, seed) {
    const mood = MOODS[moodName];
    if (!mood) return [];
    const chord = mood.chords[bar % mood.chords.length];
    const tones = QUALITY[chord[1]].map(function (i) { return chord[0] + i; });
    const out = [];
    Object.keys(mood.drums).forEach(function (inst) {
      mood.drums[inst].forEach(function (step) { out.push({ step: step, inst: inst, len: 1, vel: 1 }); });
    });
    mood.bass.forEach(function (b) { out.push({ step: b[0], inst: 'bass', midi: chord[0] - 12 + b[1], len: b[2], vel: 1 }); });
    if (mood.pad) tones.forEach(function (midi) { out.push({ step: 0, inst: 'pad', midi: midi + 12, len: STEPS, vel: 1 }); });
    (mood.stabs || []).forEach(function (step) {
      tones.forEach(function (midi) { out.push({ step: step, inst: 'stab', midi: midi + 12, len: 1, vel: 1 }); });
    });
    if (mood.arp) {
      const up = tones.concat(tones.slice(1, -1).reverse());
      for (let step = 0, i = 0; step < STEPS; step += mood.arp.every, i++) {
        out.push({ step: step, inst: mood.arp.inst, midi: up[i % up.length] + mood.arp.octave, len: mood.arp.every, vel: 1 });
      }
    }
    // Melodies come in 8-bar phrases; bars 4-7 repeat bars 0-3.
    const phrase = Math.floor(bar / 8);
    const rand = rng(seed * 7919 + phrase * 104729 + (bar % 4) * 31 + moodName.length);
    return out.concat(melodyBar(mood.melody, mood, chord, rand));
  }

  // ---- playing it -------------------------------------------------------------------

  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* private mode */ }

  let ctx = null;
  let out = null; // this mood's gain (faded in and out)
  let mood = null; // what's playing
  let wanted = 'lobby';
  let bar = 0;
  let step = 0;
  let nextAt = 0;
  let notes = [];
  let seed = 1;
  let timer = null;
  let noise = null;
  const listeners = [];

  const hz = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };

  function voice(type, midi, t, dur, vol, attack, cutoff) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = hz(midi);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function hit(filter, freq, t, dur, vol) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** One note of an instrument at time t (seconds); stepDur is a sixteenth note. */
  function playNote(n, t, stepDur) {
    const dur = n.len * stepDur;
    const v = n.vel;
    switch (n.inst) {
      case 'kick': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
        g.gain.setValueAtTime(0.9, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        o.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t + 0.26);
        break;
      }
      case 'snare': return hit('bandpass', 1800, t, 0.14, 0.45);
      case 'hat': return hit('highpass', 7000, t, 0.04, 0.22);
      case 'bass': return voice('triangle', n.midi, t, dur * 0.95, 0.55 * v, 0.01, 900);
      case 'pad':
        voice('triangle', n.midi, t, dur, 0.09, 0.35);
        return voice('sine', n.midi + 0.08, t, dur, 0.07, 0.4);
      case 'stab': return voice('square', n.midi, t, Math.min(dur, 0.12), 0.05, 0.005, 2200);
      case 'arp': return voice('square', n.midi, t, Math.max(0.08, dur * 0.9), 0.06, 0.005, 2400);
      case 'pluck': return voice('sine', n.midi, t, Math.max(0.25, dur * 1.5), 0.16, 0.005);
      case 'lead': return voice('triangle', n.midi, t, Math.max(0.12, dur * 0.95), 0.2 * v, 0.02);
    }
  }

  function schedule() {
    if (!ctx || !mood || ctx.state !== 'running') return;
    const stepDur = 60 / MOODS[mood].bpm / 4;
    // A background tab can stall the timer: skip ahead instead of playing a pile-up.
    if (nextAt < ctx.currentTime - 0.2) nextAt = ctx.currentTime + 0.05;
    while (nextAt < ctx.currentTime + LOOKAHEAD) {
      if (step === 0) notes = compose(mood, bar, seed);
      for (const n of notes) {
        if (n.step === step) {
          try { playNote(n, nextAt, stepDur); } catch (e) { /* never let music break the TV */ }
        }
      }
      nextAt += stepDur;
      step = (step + 1) % STEPS;
      if (step === 0) bar++;
    }
  }

  /** Start `wanted` from its first bar, fading in on a fresh gain node. */
  function begin() {
    ctx = window.ArkSound && ArkSound.context();
    if (!ctx || ctx.state !== 'running' || !enabled || wanted === 'off') return;
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(VOLUME, ctx.currentTime + FADE);
    out.connect(ctx.destination);
    mood = wanted;
    bar = 0;
    step = 0;
    seed = Math.floor(Math.random() * 1e6);
    nextAt = ctx.currentTime + 0.05;
    if (!timer) timer = setInterval(schedule, 25);
    schedule();
  }

  /** Fade out what's playing, then (maybe) start what's wanted. */
  function sync() {
    const target = enabled ? wanted : 'off';
    if (target === mood) return;
    if (out && ctx) {
      const old = out;
      old.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.setValueAtTime(Math.max(0.0001, old.gain.value), ctx.currentTime);
      old.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + FADE * 0.6);
      setTimeout(function () { old.disconnect(); }, FADE * 1000);
    }
    out = null;
    mood = null;
    if (target === 'off') {
      clearInterval(timer);
      timer = null;
      return;
    }
    begin();
  }

  function setMood(m) {
    wanted = m === 'off' || MOODS[m] ? m : 'lobby';
    sync();
  }

  function setEnabled(on) {
    enabled = Boolean(on);
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* private mode */ }
    sync();
    listeners.forEach(function (fn) { fn(); });
  }

  // Audio may only start after the first click (see sound.js): start then.
  if (window.ArkSound) ArkSound.onChange(function () { if (!mood) sync(); });

  window.ArkMusic = {
    compose: compose,
    moods: Object.keys(MOODS),
    MOODS: MOODS,
    setMood: setMood,
    setEnabled: setEnabled,
    isEnabled: function () { return enabled; },
    playing: function () { return mood; },
    onChange: function (fn) { listeners.push(fn); },
  };
})();
