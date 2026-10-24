import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseChangelog, notesSince, compareVersions } from '../server/changelog.js';

const TEXT = `# What's new

Some intro text that isn't a version.

## 0.1.7

- What's new card: see what changed after an update.
- New game: **Anagram Duel**.

## 0.1.6
- Closing from Steam is quick.

## 0.1.5

- No more black screen from Steam.
`;

test('reads each version and its lines, newest first', () => {
  assert.deepEqual(parseChangelog(TEXT), [
    { version: '0.1.7', items: ["What's new card: see what changed after an update.", 'New game: **Anagram Duel**.'] },
    { version: '0.1.6', items: ['Closing from Steam is quick.'] },
    { version: '0.1.5', items: ['No more black screen from Steam.'] },
  ]);
});

test('notes after the version you had, up to the one you have now', () => {
  const all = parseChangelog(TEXT);
  assert.deepEqual(notesSince(all, '0.1.5', '0.1.7').map((e) => e.version), ['0.1.7', '0.1.6']);
  assert.deepEqual(notesSince(all, '0.1.6', '0.1.6'), [], 'nothing new');
  assert.deepEqual(notesSince(all, '0.1.6', '0.1.10').map((e) => e.version), ['0.1.7'], 'numbers, not text: 0.1.10 > 0.1.7');
});

test('without a version you had, just the current one', () => {
  assert.deepEqual(notesSince(parseChangelog(TEXT), null, '0.1.6').map((e) => e.version), ['0.1.6']);
});

test('nothing to show from an empty or missing changelog', () => {
  assert.deepEqual(parseChangelog(''), []);
  assert.deepEqual(notesSince([], '0.1.0', '0.1.7'), []);
});

test('the real CHANGELOG.md reads, newest first, every version with lines', () => {
  const all = parseChangelog(fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'));
  assert.ok(all.length >= 1);
  for (const e of all) {
    assert.match(e.version, /^\d+\.\d+\.\d+$/);
    assert.ok(e.items.length > 0, e.version + ' has lines');
  }
  for (let i = 1; i < all.length; i++) assert.ok(compareVersions(all[i - 1].version, all[i].version) > 0, 'newest first');
});

test('compares version numbers part by part', () => {
  assert.ok(compareVersions('0.1.10', '0.1.7') > 0);
  assert.ok(compareVersions('0.2.0', '0.1.9') > 0);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
});

test('a line that wraps onto the next (indented) line stays one item', () => {
  assert.deepEqual(parseChangelog('## 1.0.0\n\n- First part\n  and the rest.\n- Next.\n'), [
    { version: '1.0.0', items: ['First part and the rest.', 'Next.'] },
  ]);
});
