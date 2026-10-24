// Mirror Me: the TV shows a shape drawn between dots on a 4 x 4 grid, then hides it; you both draw
// it from memory by joining the dots on your phone. Three rounds, each shape a line longer. A
// right line is +1, a wrong one -1 (a round never scores below 0). Most points after three wins.
// While you draw, nobody sees the other's lines: the TV shows only how many each has drawn (except
// for a controller player, who draws on the TV).
export const SIZE = 4;
export const DOTS = SIZE * SIZE;
export const ROUNDS = 3;
export const LENGTHS = [3, 4, 5]; // lines in each round's shape
export const SHOW_MS = 3000;
export const DRAW_MS = 9000;
export const REVEAL_MS = 2500;
const MAX_LINES = 12;

/** Dots a and b are neighbours (across, down or diagonal). */
export function adjacent(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= DOTS || b >= DOTS || a === b) return false;
  return Math.abs((a % SIZE) - (b % SIZE)) <= 1 && Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) <= 1;
}
const line = (a, b) => (a < b ? [a, b] : [b, a]);
const keyOf = ([a, b]) => a + '-' + b;

export default {
  id: 'mirror-me', kind: 'party', look: '2d', name: 'Mirror Me', order: 'REMEMBER THE SHAPE!', howTo: 'Watch the shape, then join the dots to draw it from memory (D-pad + A on a controller)', durationMs: 45000,
  create(api) {
    let round = 0; // 1-based once started
    let stage = 'show';
    let shape = [];
    let drawn = [[], []];
    let done = [false, false];
    const totals = [0, 0];
    let roundPoints = [0, 0];
    let stageEnds = 0;
    let timer = null;

    /** A path of `n` lines through neighbouring dots, no line twice. */
    function makeShape(n) {
      for (;;) {
        let at = Math.floor(api.rng() * DOTS);
        const lines = [];
        for (let tries = 0; lines.length < n && tries < 50; tries++) {
          const next = Math.floor(api.rng() * DOTS);
          const l = line(at, next);
          if (!adjacent(at, next) || lines.some((o) => keyOf(o) === keyOf(l))) continue;
          lines.push(l);
          at = next;
        }
        if (lines.length === n) return lines;
      }
    }
    function go(next, ms) {
      api.clearTimeout(timer);
      stage = next;
      stageEnds = api.elapsed() + ms;
      timer = api.setTimeout(advance, ms);
      api.update();
    }
    function startRound() {
      round++;
      shape = makeShape(LENGTHS[round - 1]);
      drawn = [[], []];
      done = [false, false];
      roundPoints = [0, 0];
      go('show', SHOW_MS);
    }
    function reveal() {
      const right = new Set(shape.map(keyOf));
      roundPoints = drawn.map((mine) => Math.max(0, mine.reduce((p, l) => p + (right.has(keyOf(l)) ? 1 : -1), 0)));
      totals[0] += roundPoints[0];
      totals[1] += roundPoints[1];
      go('reveal', REVEAL_MS);
    }
    function advance() {
      if (stage === 'show') go('draw', DRAW_MS);
      else if (stage === 'draw') reveal();
      else if (round < ROUNDS) startRound();
      else finish();
    }
    function finish() {
      api.clearTimeout(timer);
      stage = 'over';
      api.end({ winner: totals[0] === totals[1] ? null : totals[0] > totals[1] ? 0 : 1 });
    }

    return {
      start() {
        startRound();
      },
      onInput(slot, input) {
        if (stage !== 'draw' || (slot !== 0 && slot !== 1) || done[slot]) return;
        const mine = drawn[slot];
        if (input.type === 'line') {
          if (!adjacent(input.a, input.b) || mine.length >= MAX_LINES) return;
          const l = line(input.a, input.b);
          if (mine.some((o) => keyOf(o) === keyOf(l))) return;
          mine.push(l);
        } else if (input.type === 'undo') {
          if (!mine.length) return;
          mine.pop();
        } else if (input.type === 'done') {
          done[slot] = true;
          if (done[0] && done[1]) return reveal();
        } else {
          return;
        }
        api.update();
      },
      onTimeUp() {
        if (stage !== 'over') finish();
      },
      view: (slot) => {
        const showing = stage === 'show' || stage === 'reveal';
        const you = slot === 0 || slot === 1;
        const pad = (i) => Boolean(api.players[i] && api.players[i].local);
        return {
          // The TV draws a controller player's lines as they go (they have no phone).
          ...(you ? {} : { padLines: drawn.map((d, i) => (pad(i) ? d : null)) }),
          size: SIZE,
          round,
          rounds: ROUNDS,
          stage,
          msLeft: Math.max(0, stageEnds - api.elapsed()),
          shape: showing ? shape : null,
          // Your own lines on your phone; everyone's only at the reveal.
          mine: you ? drawn[slot] : null,
          lines: stage === 'reveal' ? drawn : null,
          counts: drawn.map((d) => d.length),
          done,
          roundPoints: stage === 'reveal' ? roundPoints : null,
          totals,
        };
      },
    };
  },
};
