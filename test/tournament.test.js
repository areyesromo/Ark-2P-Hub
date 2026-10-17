import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/rooms.js';
import { Tournament, TOURNAMENT_LENGTHS } from '../server/tournament.js';

test('tournament: off by default; first to a majority wins; draws score nothing; the next game starts a new one', () => {
  const t = new Tournament();
  assert.equal(t.on, false);
  assert.equal(t.record({ game: 'Pong', winner: 0 }), false, 'nothing counts while it is off');
  assert.deepEqual(t.view().wins, [0, 0]);

  assert.ok(t.setLength(3));
  assert.equal(t.target, 2);
  t.record({ game: 'Pong', winner: 0 });
  t.record({ game: 'Tanks', winner: null });
  t.record({ game: 'Sumo', winner: 1 });
  assert.deepEqual(t.wins, [1, 1]);
  assert.equal(t.champion, null);
  t.record({ game: 'Kart Race', winner: 1 });
  assert.equal(t.champion, 1);
  assert.deepEqual(t.view().games.map((g) => g.winner), [0, null, 1, 1]);

  // Extending a won series keeps the score and reopens it.
  t.setLength(5);
  assert.equal(t.champion, null);
  assert.deepEqual(t.wins, [1, 2]);
  t.setLength(3);
  assert.equal(t.champion, 1);
  t.record({ game: 'Pong', winner: 0 }); // after a champion: a new series
  assert.deepEqual(t.wins, [1, 0]);
  assert.equal(t.games.length, 1);

  assert.equal(t.setLength(4), false);
  assert.deepEqual(TOURNAMENT_LENGTHS, [0, 3, 5, 7]);
  t.setLength(0);
  assert.deepEqual(t.view().wins, [0, 0], 'turning it off clears it');
});

/** A room with two controller players and a pretend TV. */
function room() {
  const r = new Room('TEST', { to: () => ({ emit() {} }) });
  r.hostSockets.add('tv');
  r.seatPlayer('Ana', null, { local: true });
  r.seatPlayer('Ben', null, { local: true });
  return r;
}

/** Play a Rock Paper Scissors match that `winner` wins (from 2-0). */
function playRps(r, winner) {
  r.startGame('rock-paper-scissors');
  r.handleInput(0, { type: 'go' });
  r.game.game.scores = winner === 0 ? [2, 0] : [0, 2];
  r.handleInput(0, { type: 'pick', choice: winner === 0 ? 'rock' : 'scissors' });
  r.handleInput(1, { type: 'pick', choice: winner === 0 ? 'scissors' : 'rock' });
  assert.equal(r.game.hostView().phase, 'over');
  r.pushGameViews(); // another view of the same end screen doesn't count twice
  r.stopGame();
}

test('a room counts finished competitive matches, not casual ones; a new player starts a fresh series', () => {
  const r = room();
  assert.deepEqual(r.publicState().tournament.bestOf, 0);
  assert.match(r.setTournament({ bestOf: 9 }).error, /3, 5 or 7/);
  assert.ok(r.setTournament({ bestOf: 3 }).ok);
  playRps(r, 0);
  playRps(r, 1);
  playRps(r, 0);
  let t = r.publicState().tournament;
  assert.deepEqual(t.wins, [2, 1]);
  assert.equal(t.champion, 0);
  assert.equal(t.games[0].game, 'Rock Paper Scissors');

  // A casual game doesn't count.
  const casual = r.lobbyGames().find((g) => g.category === 'casual');
  r.startGame(casual.id);
  r.recordResult({ phase: 'over', winner: 1 });
  r.stopGame();
  assert.deepEqual(r.publicState().tournament.wins, [2, 1]);

  r.setTournament({ reset: true });
  assert.deepEqual(r.publicState().tournament.wins, [0, 0]);
  assert.equal(r.publicState().tournament.bestOf, 3, 'starting over keeps the length');

  playRps(r, 1);
  r.removePlayer(1); // someone leaves: a fresh series for whoever comes next
  r.seatPlayer('Cat', null, { local: true });
  t = r.publicState().tournament;
  assert.deepEqual(t.wins, [0, 0]);
  assert.equal(t.bestOf, 3);
  r.dispose();
});
