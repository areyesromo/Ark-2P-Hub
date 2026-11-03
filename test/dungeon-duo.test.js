// Dungeon Duo: a co-op dungeon crawl. A Fighter and a Healer fight through the floors together.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { DungeonDuo, HEROES, ENEMIES, TIMING, CONTINUES, starsFor } from '../server/games/dungeon-duo.js';
import { FLOORS } from '../server/games/dungeon-duo-floors.js';
import { getGame } from '../server/games/index.js';

/** A game past the countdown, every update building every view (as the room does). */
function dungeon({ difficulty = 0, heroes = 0, floors = FLOORS } = {}) {
  const ctx = fakeCtx();
  ctx.settings = { difficulty, heroes };
  let g = null;
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (g) [g.hostView(), g.playerView(0), g.playerView(1)];
    update();
  };
  g = new DungeonDuo(ctx, () => 0.5, floors);
  g.start();
  ctx.advance(TIMING.countdownMs + 10);
  assert.equal(g.phase, 'play');
  return { ctx, g };
}

/** A one-room floor for focused tests: the heroes at S, whatever else is written in. */
function room(rows) {
  return [{ name: 'Test', map: rows }];
}

const TICK = 1000 / 30;
const find = (g, ch) => {
  for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) if (g.map[y][x] === ch) return [x, y];
  return null;
};
/** Put hero `slot` at tile (x, y), facing (fx, fy). */
const put = (g, slot, x, y, fx = 1, fy = 0) => Object.assign(g.heroes[slot], { x: x + 0.5, y: y + 0.5, face: [fx, fy] });

test('every floor is 20 × 12, walled in, with two starts; on each, every key, door, plate and the stairs can be reached', () => {
  for (const f of FLOORS) {
    assert.equal(f.map.length, 12, f.name);
    for (const row of f.map) assert.equal(row.length, 20, f.name + ': ' + row);
    assert.ok(f.map[0].split('').every((c) => c === '#') && f.map[11].split('').every((c) => c === '#'));
    assert.equal(f.map.join('').split('S').length - 1, 2, 'two starts');
    // Walk from the start: through doors only if a key has been found first.
    const walk = (open) => {
      const seen = new Set();
      const [sx, sy] = (() => { for (let y = 0; y < 12; y++) { const x = f.map[y].indexOf('S'); if (x >= 0) return [x, y]; } })();
      const todo = [[sx, sy]];
      seen.add(sx + ',' + sy);
      while (todo.length) {
        const [x, y] = todo.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const c = f.map[y + dy][x + dx];
          const k = x + dx + ',' + (y + dy);
          if (seen.has(k) || c === '#' || (!open && (c === 'D' || c === 'G'))) continue;
          seen.add(k);
          todo.push([x + dx, y + dy]);
        }
      }
      return seen;
    };
    const shut = walk(false);
    const open = walk(true);
    f.map.forEach((row, y) => [...row].forEach((c, x) => {
      if ('KP'.includes(c)) assert.ok(shut.has(x + ',' + y), f.name + ': ' + c + ' reachable before any door');
      if (c === 'E' || c === 'W') assert.ok(open.has(x + ',' + y), f.name + ': ' + c + ' reachable');
    }));
    const keys = f.map.join('').split('K').length - 1;
    const doors = f.map.join('').split('D').length - 1;
    assert.ok(keys >= doors, f.name + ': a key for every door');
  }
});

test('the heroes: one Fighter, one Healer, chosen in the setup; Easy gives more hearts and continues', () => {
  const { g } = dungeon({ heroes: 0 });
  assert.deepEqual(g.heroes.map((h) => h.role), ['fighter', 'healer']);
  assert.deepEqual(g.heroes.map((h) => h.hp), [HEROES.fighter.hp[0], HEROES.healer.hp[0]]);
  const swapped = dungeon({ heroes: 1 }).g;
  assert.deepEqual(swapped.heroes.map((h) => h.role), ['healer', 'fighter']);
  const easy = dungeon({ difficulty: 1 }).g;
  assert.ok(easy.heroes[0].max > g.heroes[0].max);
  assert.ok(CONTINUES[1] > CONTINUES[0]);
  assert.equal(easy.continues, CONTINUES[1]);
});

test('walking: smooth, stopped by walls, facing the way you last moved', () => {
  const { ctx, g } = dungeon({ floors: room(['####################', '#S S               #', ...Array(9).fill('#                  #'), '####################']) });
  const h = g.heroes[0];
  put(g, 0, 3, 3);
  g.onInput(0, { type: 'move', x: 0, y: -1 });
  ctx.advance(2000);
  assert.ok(Math.abs(h.y - 1.3) < 0.02, 'stopped against the top wall: ' + h.y);
  assert.deepEqual(h.face.map((v) => Math.round(v * 100) / 100), [0, -1]);
  g.onInput(0, { type: 'move', x: 0, y: 0 });
  const y = h.y;
  ctx.advance(300);
  assert.equal(h.y, y);
  for (const bad of [{ x: 'a', y: 0 }, { x: NaN, y: 1 }, { x: 1 }]) g.onInput(0, { type: 'move', ...bad });
  assert.deepEqual(g.controls[0].x, 0);
});

test('the Fighter\'s sword hits the enemies in front (not behind); the shield blocks hits from the front, and slows you', () => {
  const { ctx, g } = dungeon({ floors: room(['####################', '#S S               #', ...Array(9).fill('#                  #'), '####################']) });
  put(g, 0, 5, 5, 1, 0);
  const front = g.spawnEnemy('slime', 6.3, 5.5);
  const behind = g.spawnEnemy('slime', 4.2, 5.5);
  front.speed = behind.speed = 0;
  g.onInput(0, { type: 'attack' });
  assert.equal(front.hp, ENEMIES.slime.hp - HEROES.fighter.damage);
  assert.equal(behind.hp, ENEMIES.slime.hp);
  g.onInput(0, { type: 'attack' }); // too soon
  assert.equal(front.hp, ENEMIES.slime.hp - HEROES.fighter.damage);
  ctx.advance(HEROES.fighter.everyMs + 10);
  g.onInput(0, { type: 'attack' });
  assert.ok(!g.enemies.includes(front), 'slain');
  // Blocking: a hit from the front does nothing; from behind it lands.
  g.onInput(0, { type: 'special', on: true });
  assert.equal(g.heroes[0].blocking, true);
  const hp = g.heroes[0].hp;
  g.hurt(0, 1, [6.5, 5.5]);
  assert.equal(g.heroes[0].hp, hp, 'blocked');
  assert.ok(g.events.blocked >= 1);
  g.hurt(0, 1, [3.5, 5.5]);
  assert.equal(g.heroes[0].hp, hp - 1, 'from behind');
  g.onInput(0, { type: 'special', on: false });
  assert.equal(g.heroes[0].blocking, false);
});

test('the Healer\'s bolts fly until they hit an enemy or a wall; the healing circle patches up anyone standing in it', () => {
  const { ctx, g } = dungeon({ floors: room(['####################', '#S S               #', ...Array(9).fill('#                  #'), '####################']) });
  put(g, 1, 3, 5, 1, 0);
  const e = g.spawnEnemy('slime', 8.5, 5.5);
  e.speed = 0;
  g.onInput(1, { type: 'attack' });
  assert.equal(g.shots.length, 1);
  ctx.advance(1000);
  assert.equal(e.hp, ENEMIES.slime.hp - HEROES.healer.damage);
  assert.equal(g.shots.length, 0);
  // A bolt into a wall just stops.
  put(g, 1, 1, 5, -1, 0);
  ctx.advance(HEROES.healer.everyMs);
  g.onInput(1, { type: 'attack' });
  ctx.advance(300);
  assert.equal(g.shots.length, 0);
  // Healing.
  g.heroes[0].hp = 1;
  g.heroes[1].hp = 1;
  put(g, 0, 10, 8);
  put(g, 1, 10, 8);
  g.onInput(1, { type: 'special', on: true });
  assert.equal(g.circles.length, 1);
  ctx.advance(TIMING.circleMs + 100);
  assert.ok(g.heroes[0].hp >= 3 && g.heroes[1].hp >= 3, g.heroes.map((h) => h.hp).join());
  assert.equal(g.circles.length, 0);
  g.onInput(1, { type: 'special', on: true }); // cooling down
  assert.equal(g.circles.length, 0);
});

test('enemies chase you and hurt on touch; you can\'t be hurt again straight away', () => {
  const { ctx, g } = dungeon({ floors: room(['####################', '#S S               #', ...Array(9).fill('#                  #'), '####################']) });
  put(g, 0, 10, 5);
  put(g, 1, 17, 9);
  const s = g.spawnEnemy('slime', 6.5, 5.5);
  const hp = g.heroes[0].hp;
  ctx.advance(4000);
  assert.ok(Math.hypot(s.x - g.heroes[0].x, s.y - g.heroes[0].y) < 1.2, 'it came after you');
  assert.ok(g.heroes[0].hp < hp, 'and hurt you');
  assert.ok(g.heroes[0].hp >= hp - Math.ceil(4000 / TIMING.invulnMs), 'not every tick');
});

test('downed at no hearts; your partner revives you by standing beside you; both down and it\'s back to the start of the floor', () => {
  const { ctx, g } = dungeon();
  g.enemies = [];
  g.hurt(0, 99, null);
  assert.equal(g.heroes[0].downed, true);
  g.onInput(0, { type: 'move', x: 1, y: 0 });
  g.onInput(0, { type: 'attack' });
  const x = g.heroes[0].x;
  ctx.advance(300);
  assert.equal(g.heroes[0].x, x, 'a downed hero can\'t move');
  Object.assign(g.heroes[1], { x: g.heroes[0].x + 0.8, y: g.heroes[0].y });
  ctx.advance(TIMING.reviveMs + 100);
  assert.equal(g.heroes[0].downed, false);
  assert.equal(g.heroes[0].hp, Math.ceil(g.heroes[0].max / 2));
  // Both down: a retry, one continue fewer, the floor as it was.
  const before = g.continues;
  g.keys = 1;
  g.heroes[0].invulnUntil = 0; // (just revived: briefly safe)
  g.hurt(0, 99, null);
  g.hurt(1, 99, null);
  ctx.advance(50); // (the next tick)
  assert.equal(g.phase, 'retry');
  ctx.advance(TIMING.retryMs + 50);
  assert.equal(g.phase, 'play');
  assert.equal(g.continues, before - 1);
  assert.equal(g.retries, 1);
  assert.equal(g.keys, 0);
  assert.ok(g.heroes.every((h) => !h.downed && h.hp === h.max));
  assert.ok(g.enemies.length > 0, 'the enemies are back');
});

test('out of continues: the quest is over, no stars', () => {
  const { ctx, g } = dungeon();
  g.continues = 0;
  g.hurt(0, 99, null);
  g.hurt(1, 99, null);
  ctx.advance(50); // (the next tick)
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().won, false);
  assert.equal(g.hostView().stars, 0);
  assert.equal(ctx.pendingTimers(), 0);
});

test('a key opens a locked door; both heroes on the stairs (on their feet) go down to the next floor', () => {
  const { ctx, g } = dungeon({ floors: room([
    '####################',
    '#S S   K   D   E   #',
    ...Array(9).fill('#          #       #'),
    '####################',
  ]).concat(room(['####################', '#S S               #', ...Array(9).fill('#                  #'), '####################'])) });
  const door = find(g, 'D');
  // Into the door with no key: it stays shut.
  put(g, 0, door[0] - 1, door[1]);
  g.onInput(0, { type: 'move', x: 1, y: 0 });
  ctx.advance(500);
  assert.ok(g.heroes[0].x < door[0], 'blocked');
  // Over the key, then into the door.
  const key = find(g, 'K');
  put(g, 0, key[0], key[1]);
  ctx.advance(TICK * 2);
  assert.equal(g.keys, 1);
  assert.equal(g.map[key[1]][key[0]], ' ', 'picked up');
  put(g, 0, door[0] - 1, door[1]);
  ctx.advance(500);
  assert.equal(g.keys, 0);
  assert.equal(g.map[door[1]][door[0]], ' ', 'opened');
  g.onInput(0, { type: 'move', x: 0, y: 0 });
  // The stairs: both on them, both standing.
  const stairs = find(g, 'E');
  put(g, 0, stairs[0], stairs[1]);
  g.hurt(1, 99, null);
  put(g, 1, stairs[0], stairs[1]);
  ctx.advance(200);
  assert.equal(g.floor, 0, 'not with a downed partner');
  g.heroes[1].downed = false;
  g.heroes[1].hp = 3;
  ctx.advance(200);
  assert.equal(g.phase, 'floorClear');
  ctx.advance(TIMING.floorClearMs + 50);
  assert.equal(g.floor, 1);
  assert.equal(g.phase, 'play');
});

test('the last floor cleared: the quest is won, with stars for finishing, few retries and a good time', () => {
  assert.equal(starsFor({ won: false, retries: 0, ms: 1 }), 0);
  assert.equal(starsFor({ won: true, retries: 0, ms: 1, par: 1000 }), 3);
  assert.equal(starsFor({ won: true, retries: 2, ms: 1, par: 1000 }), 2);
  assert.equal(starsFor({ won: true, retries: 2, ms: 2000, par: 1000 }), 1);
  const { ctx, g } = dungeon({ floors: room(['####################', '#S S E             #', ...Array(9).fill('#                  #'), '####################']) });
  const stairs = find(g, 'E');
  put(g, 0, stairs[0], stairs[1]);
  put(g, 1, stairs[0], stairs[1]);
  ctx.advance(200);
  ctx.advance(TIMING.floorClearMs + 50);
  assert.equal(g.phase, 'over');
  const v = g.hostView();
  assert.equal(v.won, true);
  assert.equal(v.stars, 3);
  assert.equal(v.maxStars, 3);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput(1, { type: 'rematch' });
  assert.equal(g.phase, 'countdown');
  assert.equal(g.floor, 0);
});

test('a controller sends its stick and SPECIAL together: the shield held, the circle on the press', () => {
  const { g } = dungeon();
  g.enemies = [];
  g.onInput(0, { type: 'move', x: 0, y: 0, special: true });
  assert.equal(g.heroes[0].blocking, true);
  g.onInput(0, { type: 'move', x: 1, y: 0, special: true }); // still held: no change
  assert.equal(g.heroes[0].blocking, true);
  g.onInput(0, { type: 'move', x: 0, y: 0, special: false });
  assert.equal(g.heroes[0].blocking, false);
  g.onInput(1, { type: 'move', x: 0, y: 0, special: true });
  assert.equal(g.circles.length, 1);
  g.onInput(1, { type: 'move', x: 0, y: 1, special: true }); // held: not another
  assert.equal(g.circles.length, 1);
});

test('bad input is ignored', () => {
  const { g } = dungeon();
  g.onInput(5, { type: 'attack' });
  g.onInput(0, { type: 'special', on: 'yes' });
  g.onInput(0, { type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.equal(g.heroes[0].blocking, false);
});

test('in the lobby: a co-op game (casual) with motion controls, the heroes and difficulty to pick', () => {
  const def = getGame('dungeon-duo');
  assert.equal(def.category, 'casual');
  assert.equal(def.motion, true);
  const setup = JSON.stringify(def.create(fakeCtx()).hostView());
  assert.ok(setup.includes('"heroes"') && setup.includes('"difficulty"'));
  assert.ok(setup.includes('Fighter') && setup.includes('Healer') && setup.includes('Easy'));
});
