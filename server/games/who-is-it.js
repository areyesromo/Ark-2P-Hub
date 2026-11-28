// Who Is It: a guessing game of faces. You each get a secret face from the same 24 (only you see
// yours, on your phone). Take turns: ask one yes-or-no question about the other's face ("Glasses?",
// "Red hair?"), and the answer comes back straight away, true every time; the faces it rules out
// are flipped down on your board. Or, instead of asking, name the face you think is theirs: right,
// and you win the round; wrong, and you lose it. Who goes first swaps every round; first to 3
// rounds (or 1 or 5). Out of time: your turn passes.

import { settingOf } from './options.js';

export const WIN_SCORE = 3;
export const TIMING = { turnMs: 30000, answerMs: 1800, roundEndMs: 5000 };

// The 24 faces: hair (colour, or bald), long hair, glasses, a hat, a beard, eyes, earrings, rosy cheeks.
const F = (name, hair, long, glasses, hat, beard, eyes, earrings, rosy, skin) => ({ name, hair, long, glasses, hat, beard, eyes, earrings, rosy, skin });
export const FACES = [
  F('Ada', 'black', 1, 0, 0, 0, 'brown', 1, 0, 2), F('Ben', 'brown', 0, 1, 0, 1, 'blue', 0, 0, 0),
  F('Cleo', 'red', 1, 0, 1, 0, 'green', 1, 1, 0), F('Dev', 'black', 0, 0, 0, 1, 'brown', 0, 0, 1),
  F('Elsa', 'blonde', 1, 1, 0, 0, 'blue', 0, 1, 0), F('Finn', 'red', 0, 0, 1, 0, 'blue', 0, 1, 0),
  F('Gus', 'grey', 0, 1, 0, 1, 'brown', 0, 0, 1), F('Hana', 'black', 1, 1, 1, 0, 'brown', 1, 0, 1),
  F('Ivo', 'bald', 0, 0, 0, 1, 'green', 0, 1, 2), F('Jade', 'brown', 1, 0, 0, 0, 'green', 1, 1, 1),
  F('Kofi', 'black', 0, 1, 1, 0, 'brown', 0, 0, 2), F('Lena', 'grey', 1, 0, 0, 0, 'blue', 1, 0, 0),
  F('Milo', 'blonde', 0, 0, 0, 0, 'blue', 0, 1, 0), F('Nia', 'brown', 1, 1, 0, 0, 'brown', 0, 0, 2),
  F('Otto', 'bald', 0, 1, 1, 0, 'blue', 0, 0, 0), F('Pia', 'blonde', 1, 0, 1, 0, 'green', 0, 0, 1),
  F('Raj', 'black', 0, 0, 0, 0, 'brown', 1, 0, 1), F('Sofi', 'red', 1, 1, 0, 0, 'blue', 0, 1, 0),
  F('Tom', 'brown', 0, 0, 1, 1, 'brown', 0, 1, 0), F('Uma', 'grey', 1, 1, 1, 0, 'green', 1, 0, 2),
  F('Vic', 'blonde', 0, 1, 0, 1, 'green', 0, 0, 0), F('Wen', 'black', 1, 0, 0, 0, 'brown', 0, 1, 1),
  F('Xav', 'brown', 0, 0, 0, 1, 'green', 1, 0, 2), F('Yara', 'red', 1, 0, 0, 0, 'brown', 1, 0, 1),
];

// The questions, each a test of a face.
export const QUESTIONS = [
  { id: 'black', text: 'Black hair?', test: (f) => f.hair === 'black' },
  { id: 'brown', text: 'Brown hair?', test: (f) => f.hair === 'brown' },
  { id: 'blonde', text: 'Blonde hair?', test: (f) => f.hair === 'blonde' },
  { id: 'red', text: 'Red hair?', test: (f) => f.hair === 'red' },
  { id: 'grey', text: 'Grey hair?', test: (f) => f.hair === 'grey' },
  { id: 'bald', text: 'Bald?', test: (f) => f.hair === 'bald' },
  { id: 'long', text: 'Long hair?', test: (f) => !!f.long },
  { id: 'glasses', text: 'Glasses?', test: (f) => !!f.glasses },
  { id: 'hat', text: 'A hat?', test: (f) => !!f.hat },
  { id: 'beard', text: 'A beard?', test: (f) => !!f.beard },
  { id: 'blue', text: 'Blue eyes?', test: (f) => f.eyes === 'blue' },
  { id: 'browneyes', text: 'Brown eyes?', test: (f) => f.eyes === 'brown' },
  { id: 'green', text: 'Green eyes?', test: (f) => f.eyes === 'green' },
  { id: 'earrings', text: 'Earrings?', test: (f) => !!f.earrings },
  { id: 'rosy', text: 'Rosy cheeks?', test: (f) => !!f.rosy },
];
export const questionById = (id) => QUESTIONS.find((q) => q.id === id);

export class WhoIsIt {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.round = 0;
    this.starter = 1;
    this.winner = null;
    this.newRound();
  }

  newRound() {
    this.clearTimer();
    this.round++;
    this.starter = 1 - this.starter;
    const a = Math.floor(this.rng() * FACES.length);
    let b = Math.floor(this.rng() * (FACES.length - 1));
    if (b >= a) b++;
    this.secret = [a, b]; // each player's own face (the other has to find it)
    this.left = [FACES.map((_, i) => i), FACES.map((_, i) => i)]; // faces each still has standing
    this.asked = [[], []];
    this.log = []; // { by, q, yes } or { by, guess, right } or { by, pass }
    this.n = 0;
    this.result = null;
    this.turn = this.starter;
    this.phase = 'play';
    this.armTurn();
  }

  armTurn() {
    this.deadline = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    this.arm(TIMING.turnMs, 'turnTimeUp');
  }

  turnTimeUp() {
    this.log.push({ by: this.turn, pass: true, n: ++this.n });
    this.next();
  }

  next() {
    this.turn = 1 - this.turn;
    this.armTurn();
  }

  ask(s, q) {
    const yes = q.test(FACES[this.secret[1 - s]]);
    this.left[s] = this.left[s].filter((i) => q.test(FACES[i]) === yes);
    this.asked[s].push(q.id);
    this.log.push({ by: s, q: q.id, yes, n: ++this.n });
    this.next();
  }

  guess(s, face) {
    const right = face === this.secret[1 - s];
    this.log.push({ by: s, guess: face, right, n: ++this.n });
    this.endRound(right ? s : 1 - s, right ? 'right' : 'wrong');
  }

  endRound(w, how) {
    this.clearTimer();
    this.deadline = null;
    this.scores[w]++;
    this.result = { winner: w, how, secrets: this.secret.slice() };
    this.turn = null;
    if (this.scores[w] >= this.winScore) {
      this.winner = w;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.arm(TIMING.roundEndMs, 'newRound');
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
    if (!this.clock && then === 'turnTimeUp') return;
    this.due = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'over' || !this.after) return;
    if (this.deadline) this.deadline += downMs;
    if (!this.clock && this.after === 'turnTimeUp') return;
    const ms = Math.max(0, (this.due || this.ctx.now()) + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    const then = this.after;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play' || slot !== this.turn) return;
    if (input.type === 'ask') {
      const q = questionById(input.q);
      if (!q || this.asked[slot].includes(q.id)) return;
      return this.ask(slot, q);
    }
    if (input.type === 'guess' && Number.isInteger(input.face) && input.face >= 0 && input.face < FACES.length) this.guess(slot, input.face);
  }

  view(viewer) {
    const open = this.phase !== 'play';
    return {
      phase: this.phase,
      round: this.round,
      faces: FACES.map(({ name, hair, long, glasses, hat, beard, eyes, earrings, rosy, skin }) => ({ name, hair, long, glasses, hat, beard, eyes, earrings, rosy, skin })),
      questions: QUESTIONS.map((q) => ({ id: q.id, text: q.text })),
      // Your own face; theirs only once the round is over.
      secret: this.secret.map((f, s) => (open || s === viewer ? f : null)),
      left: this.left,
      asked: this.asked,
      log: this.log.slice(-20),
      n: this.n,
      turn: this.turn,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: this.clock,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(null), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(slot), { you: slot });
  }
}

export default {
  id: 'who-is-it',
  category: 'board',
  phoneOnly: true, // (your face is secret)
  handheld: true,
  music: 'thinking',
  name: 'Who Is It',
  tagline: 'You each have a secret face. Ask yes-or-no questions to rule faces out, then name theirs. A wrong guess loses.',
  create: (ctx) => new WhoIsIt(ctx),
};
