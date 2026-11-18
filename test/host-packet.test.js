// The TV's view on the wire (Room#hostPacket): its big fields go only when they change, and the
// TV (public/host/host.js) fills them in from the last whole view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/rooms.js';

const io = { to: () => ({ emit() {} }) };
const big = (n) => Array.from({ length: 60 }, (_, i) => ({ x: i, y: n }));

/** What host.js does with a packet: fill `kept` in from the last whole view. */
function fill(last, packet) {
  if (!packet.kept) return packet.view;
  assert.ok(last, 'a packet with kept fields needs a view to fill them from');
  const view = { ...packet.view };
  for (const key of packet.kept) view[key] = last[key];
  return view;
}

test('a big field that has not changed is left out and named in kept; small ones always go', () => {
  const r = new Room('PACK', io, {});
  const first = r.hostPacket('kart-race-3d', { phase: 'racing', t: 1, boxes: big(1), coins: big(2) });
  assert.equal(first.kept, undefined, 'the first view goes whole');
  const second = r.hostPacket('kart-race-3d', { phase: 'racing', t: 2, boxes: big(1), coins: big(3) });
  assert.deepEqual(second.kept, ['boxes']);
  assert.deepEqual(Object.keys(second.view).sort(), ['coins', 'phase', 't']);
  const view = fill({ phase: 'racing', t: 1, boxes: big(1), coins: big(2) }, second);
  assert.deepEqual(view, { phase: 'racing', t: 2, boxes: big(1), coins: big(3) });
});

test('a field that goes away stays away, and another game starts whole', () => {
  const r = new Room('PACK', io, {});
  r.hostPacket('a', { boxes: big(1), track: big(9) });
  const gone = r.hostPacket('a', { track: big(9) });
  assert.deepEqual(gone.kept, ['track']);
  assert.equal(fill({ boxes: big(1), track: big(9) }, gone).boxes, undefined);
  assert.equal(r.hostPacket('b', { track: big(9) }).kept, undefined, 'a new game: nothing to keep');
});

test('a screen that joins gets the whole view, and the next broadcast goes whole too', () => {
  const r = new Room('PACK', io, {});
  const sent = [];
  r.game = { hostView: () => ({ phase: 'play', boxes: big(1) }) };
  r.gameId = 'g';
  r.hostPacket('g', r.game.hostView());
  r.sendView({ emit: (event, msg) => sent.push(msg) }, 'host');
  assert.deepEqual(sent[0], { gameId: 'g', view: { phase: 'play', boxes: big(1) } });
  assert.equal(r.hostPacket('g', r.game.hostView()).kept, undefined, 'the other TVs may hold an older copy');
});
