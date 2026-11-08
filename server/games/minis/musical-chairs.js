// Musical Chairs: the music plays while you both circle one chair. When it stops, SIT: the quicker
// one gets the chair and the round. Sit while it's still playing and you trip (a moment you can't
// sit). From the second round the music can dip (a short pause, then it plays on): sit then and you
// trip too. First to 3 rounds. Each screen times its own reaction from when it showed the stop
// (`rt`; -1: sat before it saw the stop), so network lag costs nobody.
import { T_SLACK_MS } from './runner.js';

export const TIMING = { musicMinMs: 2500, musicMaxMs: 6500, dipMs: 450, tripMs: 900, graceMs: 300, noSitMs: 3000, betweenMs: 1800 };
export const WINS = 3;
const MAX_ROUNDS = 7;

export default {
  id: 'musical-chairs', kind: 'party', look: '2d', name: 'Musical Chairs', order: 'WAIT FOR THE MUSIC TO STOP…', howTo: 'SIT (or A) when the music stops. Too soon and you trip!', durationMs: 50000,
  create(api) {
    const wins = [0, 0];
    let round = 0;
    let stage = 'music';
    let stopAt = 0;
    let sat = [null, null];
    const trippedUntil = [0, 0];
    let last = null;
    let timers = [];
    let done = false;
    const later = (fn, ms) => timers.push(api.setTimeout(fn, ms));
    const clear = () => {
      timers.forEach((t) => api.clearTimeout(t));
      timers = [];
    };

    function finish(winner) {
      if (done) return;
      done = true;
      clear();
      api.end({ winner });
    }

    function dip() {
      stage = 'dip';
      later(() => {
        if (stage !== 'dip') return;
        stage = 'music';
        api.update();
      }, TIMING.dipMs);
      api.update();
    }

    function startRound() {
      round++;
      stage = 'music';
      sat = [null, null];
      const playMs = TIMING.musicMinMs + Math.floor(api.rng() * (TIMING.musicMaxMs - TIMING.musicMinMs + 1));
      // From the second round, a dip now and then partway through.
      if (round >= 2 && api.rng() < 0.6) later(dip, Math.floor(playMs * (0.35 + api.rng() * 0.3)));
      later(() => {
        stage = 'stopped';
        stopAt = api.elapsed();
        later(decide, TIMING.noSitMs);
        api.update();
      }, playMs);
      api.update();
    }

    function decide() {
      clear();
      const [a, b] = sat;
      const winner = a === null && b === null ? null : b === null || (a !== null && a <= b) ? 0 : 1;
      stage = 'done';
      if (winner !== null) wins[winner]++;
      last = { winner, rt: sat.slice() };
      if (winner !== null && wins[winner] >= WINS) return finish(winner);
      if (round >= MAX_ROUNDS) return finish(wins[0] === wins[1] ? null : wins[0] > wins[1] ? 0 : 1);
      later(startRound, TIMING.betweenMs);
      api.update();
    }

    return {
      start: startRound,
      onInput(slot, input) {
        if (done || input.type !== 'sit' || (slot !== 0 && slot !== 1)) return;
        const now = api.elapsed();
        if (stage === 'done' || sat[slot] !== null || now < trippedUntil[slot]) return;
        const early = stage === 'music' || stage === 'dip' || (typeof input.rt === 'number' && input.rt < 0);
        if (early) {
          // Sat with the music still on: down you go, for a moment.
          trippedUntil[slot] = now + TIMING.tripMs;
          return api.update();
        }
        const since = now - stopAt;
        const rt = typeof input.rt === 'number' && Number.isFinite(input.rt) && input.rt <= since + T_SLACK_MS ? input.rt : since;
        sat[slot] = Math.round(rt);
        if (sat[0] !== null && sat[1] !== null) return decide();
        clear();
        later(decide, TIMING.graceMs); // a slower network may still bring a quicker sit
        api.update();
      },
      onTimeUp: () => finish(wins[0] === wins[1] ? null : wins[0] > wins[1] ? 0 : 1),
      view: () => ({ round, stage, wins, sat: sat.map((x) => x !== null), trippedUntil, last, need: WINS }),
      debugDip: dip,
    };
  },
};
