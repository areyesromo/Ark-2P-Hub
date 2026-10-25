// Trivia Quest. Co-op: the two of you face three monsters in a row (Goo Blob, Stone Golem,
// then the Dragon), each with a health bar, and share a row of hearts. Every turn is a
// question from the Quiz Battle bank; you both answer secretly on your phones (talk it over
// first: that's the point) and it's revealed when you've both answered or time runs out. A
// right answer hits the monster, harder the faster it came, and both right is a team strike
// (half as much again). Every wrong or missing answer costs a heart. Beat a monster for up to
// three stars (fewer for each heart lost against it); run out of hearts and the quest ends.
// Each player has one 50/50 per quest, on their own phone only.

import { QUESTIONS } from './quiz-questions.js';
import { settingOf, usedIn } from './options.js';
import { LABELS, TOPICS } from './quiz.js';

export const MONSTERS = [
  { id: 'blob', name: 'Goo Blob', emoji: '🦠', hp: 100, questionMs: 15000 },
  { id: 'golem', name: 'Stone Golem', emoji: '🗿', hp: 150, questionMs: 15000 },
  { id: 'dragon', name: 'Dragon', emoji: '🐉', hp: 200, questionMs: 12000 },
];
/** A right answer: `base`, plus up to `speed` more the faster it came; both right: times `team`. */
export const DAMAGE = { base: 10, speed: 10, team: 1.5 };
export const HEARTS = 5;
export const TIMING = { introMs: 3000, revealMs: 4000, defeatedMs: 3000 };

/** Stars for beating a monster, by the hearts lost against it. */
export function starsFor(lost) {
  return lost === 0 ? 3 : lost === 1 ? 2 : 1;
}

export class TriviaQuest {
  constructor(ctx, rng = Math.random, bank = QUESTIONS) {
    this.ctx = ctx;
    this.rng = rng;
    const topic = TOPICS[settingOf(ctx, 'topic', 0) - 1];
    this.maxHearts = settingOf(ctx, 'hearts', HEARTS);
    this.bank = topic && bank.some((q) => q.cat === topic) ? bank.filter((q) => q.cat === topic) : bank;
    // Asked in earlier quests in this room, so rematches don't repeat.
    this.used = usedIn(ctx, 'quest:' + (topic || 'all'));
    this.timer = null;
  }

  start() {
    this.hearts = this.maxHearts;
    this.beaten = []; // stars for each monster beaten
    this.won = false;
    this.index = -1;
    this.questions = [];
    this.fifty = [null, null]; // { index, removed } once used
    this.monsterIndex = 0;
    this.meet();
  }

  get monster() {
    return MONSTERS[this.monsterIndex];
  }

  get questionMs() {
    return this.monster.questionMs;
  }

  get stars() {
    return this.beaten.reduce((a, b) => a + b, 0);
  }

  /** The next monster walks on. */
  meet() {
    this.hp = this.monster.hp;
    this.lostHere = 0; // hearts lost against this one
    this.runPhase('intro', TIMING.introMs, () => this.ask());
  }

  /** One question nobody in this room has had lately (starting over when the bank runs dry), answers shuffled. */
  pickQuestion() {
    let pool = this.bank.map((_, i) => i).filter((i) => !this.used.has(i));
    if (!pool.length) {
      this.used.clear();
      pool = this.bank.map((_, i) => i);
    }
    const i = pool[Math.floor(this.rng() * pool.length)];
    this.used.add(i);
    const src = this.bank[i];
    const order = [0, 1, 2, 3];
    for (let j = order.length - 1; j > 0; j--) {
      const k = Math.floor(this.rng() * (j + 1));
      [order[j], order[k]] = [order[k], order[j]];
    }
    return { cat: src.cat, text: src.q, options: order.map((o) => src.a[o]), correct: order.indexOf(0) };
  }

  /** A timed phase, with a fresh view every second (for the clock), then onEnd. */
  runPhase(phase, ms, onEnd) {
    this.phase = phase;
    this.phaseEnds = this.ctx.now() + ms;
    this.onPhaseEnd = onEnd;
    this.ctx.update();
    this.scheduleStep();
  }

  scheduleStep() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    const left = this.phaseEnds - this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phaseEnds - this.ctx.now() > 0) {
        this.ctx.update();
        this.scheduleStep();
      } else {
        this.onPhaseEnd();
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  ask() {
    this.index++;
    this.questions.push(this.pickQuestion());
    this.picks = [null, null];
    this.answeredAt = [null, null];
    this.hits = [0, 0];
    this.damage = 0;
    this.heartsLost = 0;
    this.questionStart = this.ctx.now();
    this.runPhase('question', this.questionMs, () => this.reveal());
  }

  reveal() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    const q = this.questions[this.index];
    this.picks.forEach((p, slot) => {
      if (p === q.correct) {
        const left = Math.max(0, this.phaseEnds - this.answeredAt[slot]) / this.questionMs;
        this.hits[slot] = DAMAGE.base + Math.round(DAMAGE.speed * left);
      } else this.heartsLost++;
    });
    this.teamStrike = this.hits.every((h) => h > 0);
    this.damage = Math.round((this.hits[0] + this.hits[1]) * (this.teamStrike ? DAMAGE.team : 1));
    this.hp = Math.max(0, this.hp - this.damage);
    this.heartsLost = Math.min(this.heartsLost, this.hearts);
    this.hearts -= this.heartsLost;
    this.lostHere += this.heartsLost;
    this.runPhase('reveal', TIMING.revealMs, () => this.next());
  }

  /** After a reveal: the monster down, the hearts gone, or the next question. */
  next() {
    if (this.hp === 0) {
      this.beaten.push(starsFor(this.lostHere));
      const last = this.monsterIndex === MONSTERS.length - 1;
      return this.runPhase('defeated', TIMING.defeatedMs, () => {
        if (last) return this.finish(true);
        if (this.hearts === 0) return this.finish(false);
        this.monsterIndex++;
        this.meet();
      });
    }
    if (this.hearts === 0) return this.finish(false);
    this.ask();
  }

  finish(won) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.won = won;
    this.phase = 'over';
    this.phaseEnds = null;
    this.ctx.update();
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'question' || this.picks[slot] !== null) return;
    if (input.type === 'fifty') return this.useFifty(slot);
    if (input.type !== 'answer') return;
    const choice = input.choice;
    if (!Number.isInteger(choice) || choice < 0 || choice > 3 || this.removed(slot).includes(choice)) return;
    this.picks[slot] = choice;
    this.answeredAt[slot] = this.ctx.now();
    if (this.picks.every((p) => p !== null)) this.reveal(); // no need to wait for the clock
    else this.ctx.update();
  }

  /** 50/50: two of the wrong answers gone from this player's phone, once a quest. */
  useFifty(slot) {
    if (this.fifty[slot]) return;
    const q = this.questions[this.index];
    const wrong = [0, 1, 2, 3].filter((i) => i !== q.correct);
    wrong.splice(Math.floor(this.rng() * wrong.length), 1); // one wrong answer stays
    this.fifty[slot] = { index: this.index, removed: wrong };
    this.ctx.update();
  }

  /** The answers this player's 50/50 took away on this question. */
  removed(slot) {
    const f = this.fifty[slot];
    return f && f.index === this.index && this.phase !== 'over' ? f.removed : [];
  }

  timeLeftMs() {
    return this.phaseEnds ? Math.max(0, this.phaseEnds - this.ctx.now()) : 0;
  }

  common() {
    const revealing = this.phase === 'reveal';
    const asking = this.phase === 'question' || revealing;
    const q = asking ? this.questions[this.index] : null;
    return {
      phase: this.phase,
      monster: { name: this.monster.name, emoji: this.monster.emoji, hp: this.hp, maxHp: this.monster.hp },
      monsterIndex: this.monsterIndex,
      monsters: MONSTERS.map((m) => ({ name: m.name, emoji: m.emoji })),
      hearts: this.hearts,
      maxHearts: this.maxHearts,
      number: this.index + 1,
      question: q ? { cat: q.cat, text: q.text, options: q.options } : null,
      labels: LABELS,
      countdown: this.phase === 'intro' ? Math.ceil(this.timeLeftMs() / 1000) : 0,
      timeLeftMs: this.timeLeftMs(),
      questionMs: this.questionMs,
      answered: this.picks ? this.picks.map((p) => p !== null) : [false, false],
      // Secret until the reveal.
      correct: revealing ? q.correct : null,
      hits: revealing ? this.hits : [0, 0],
      damage: revealing ? this.damage : 0,
      teamStrike: revealing && this.teamStrike,
      heartsLost: revealing ? this.heartsLost : 0,
      fiftyUsed: this.fifty.map(Boolean),
      beaten: this.beaten,
      // For the room's history (a co-op game: the team's stars).
      stars: this.stars,
      maxStars: MONSTERS.length * 3,
      won: this.won,
    };
  }

  hostView() {
    const revealing = this.phase === 'reveal';
    return Object.assign(this.common(), {
      picks: revealing ? this.picks : [null, null],
      // A controller player has no phone: their 50/50 shows on the TV instead.
      removedOnTv: [0, 1].map((slot) => (this.ctx.players && this.ctx.players[slot] && this.ctx.players[slot].local ? this.removed(slot) : [])),
      players: this.ctx.players,
    });
  }

  playerView(slot) {
    const revealing = this.phase === 'reveal';
    return Object.assign(this.common(), {
      you: slot,
      yourPick: this.picks ? this.picks[slot] : null,
      theyAnswered: this.picks ? this.picks[1 - slot] !== null : false,
      theirPick: revealing ? this.picks[1 - slot] : null,
      removed: this.removed(slot),
      fiftyLeft: !this.fifty[slot],
    });
  }
}

export default {
  id: 'trivia-quest',
  music: 'thinking',
  category: 'casual',
  name: 'Trivia Quest',
  tagline: 'Co-op quiz: answer together to bring down three monsters (Goo Blob, Stone Golem, Dragon). Right and fast hits harder; every wrong answer costs a shared heart.',
  create: (ctx) => new TriviaQuest(ctx),
};
