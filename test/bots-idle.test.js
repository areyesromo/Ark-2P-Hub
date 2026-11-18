// The computer never loses to a player who does nothing, at any level: the games where it once did
// (it missed every serve after a misjudged one in Pong, couldn't score past a mallet left in the
// goal in Air Hockey, froze on its own bomb in Bomb Duel, never fired at a tank that stood still
// in Tank Duel). In the turn-based games, the turn clock plays a pit or a card for the idle player,
// at random: Easy beats that too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { play } from './helpers-bots.js';

/** The computer against nobody, `n` games, the idle player in either seat: it wins every one. */
function beatsIdle(id, levels, n) {
  for (const level of levels) {
    for (let seed = 1; seed <= n; seed++) {
      const cpu = seed % 2;
      const { view } = play(id, cpu ? [null, level] : [level, null], { seed, limitMs: 20 * 60 * 1000 });
      assert.equal(view.phase, 'over', `${id} ${level} seed ${seed}: the game ends`);
      assert.equal(view.winner, cpu, `${id} ${level} seed ${seed}: the computer wins ${JSON.stringify(view.scores)}`);
    }
  }
}

for (const id of ['pong', 'air-hockey', 'tanks', 'bomb-duel']) {
  test(id + ': the computer beats a player who does nothing, every level', () => beatsIdle(id, ['easy', 'normal', 'hard'], 2));
}

for (const id of ['mancala', 'memory-match']) {
  test(id + ': Easy beats the turn clock playing for an idle player', () => beatsIdle(id, ['easy'], 4));
}
