import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reactionMs, REACTION } from '../server/games/bot-human.js';

test('the computer reacts like a person: a skewed spread round a human median, never inhumanly fast', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const times = Array.from({ length: 4000 }, () => reactionMs(level, Math.random)).sort((a, b) => a - b);
    const median = times[2000];
    const { median: want, floor } = REACTION[level];
    assert.ok(Math.abs(median - want) < want * 0.06, level + ' median ' + median);
    assert.ok(times[0] >= floor, level + ' never under ' + floor + ': ' + times[0]);
    // Right-skewed: the slow tail is longer than the quick one.
    assert.ok(times[3800] - median > median - times[200], level + ' skewed');
  }
  assert.ok(REACTION.hard.median < REACTION.normal.median && REACTION.normal.median < REACTION.easy.median);
  assert.ok(REACTION.normal.median >= 250 && REACTION.normal.median <= 290, 'Normal is the human average');
  assert.ok(REACTION.hard.floor >= 140, 'even Hard is no quicker than a sharp player');
});
