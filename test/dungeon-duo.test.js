// Dungeon Duo: a co-op dungeon crawl. A Fighter and a Healer fight through the floors together.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { DungeonDuo, HEROES, ENEMIES, TIMING, CONTINUES, SPIKES, starsFor } from '../server/games/dungeon-duo.js';
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
    // Walk from the start, through doors and gates only when told to.
    const walk = (doors, gates) => {
      const seen = new Set();
      const [sx, sy] = (() => { for (let y = 0; y < 12; y++) { const x = f.map[y].indexOf('S'); if (x >= 0) return [x, y]; } })();
      const todo = [[sx, sy]];
      seen.add(sx + ',' + sy);
      while (todo.length) {
        const [x, y] = todo.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const c = f.map[y + dy][x + dx];
          const k = x + dx + ',' + (y + dy);
          if (seen.has(k) || c === '#' || (!doors && c === 'D') || (!gates && c === 'G')) continue;
          seen.add(k);
          todo.push([x + dx, y + dy]);
        }
      }
      return seen;
    };
    const shut = walk(false, false);
    const gated = walk(false, true);
    const open = walk(true, true);
    f.map.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === 'P') assert.ok(shut.has(x + ',' + y) || gated.has(x + ',' + y), f.name + ': a plate reachable');
      if (c === 'K') assert.ok(gated.has(x + ',' + y), f.name + ': the key reachable before any door');
      if (c === 'E' || c === 'W') assert.ok(open.has(x + ',' + y), f.name + ': ' + c + ' reachable');
    }));
    // A gate needs a plate on the side you start, so one of you can hold it open.
    if (f.map.join('').includes('G')) assert.ok(f.map.some((row, y) => [...row].some((c, x) => c === 'P' && shut.has(x + ',' + y))), f.name + ': a plate before the gate');
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

test('spikes go up and down in turn: stepping on them while they\'re up hurts, and the shield doesn\'t help', () => {
  const { ctx, g } = dungeon({ floors: room(['####################', '#S S   ^           #', ...Array(9).fill('#                  #'), '####################']) });
  const spike = find(g, '^');
  put(g, 1, 17, 9);
  // Wait until they're down, then stand on them.
  while (g.spikesUp()) ctx.advance(TICK);
  put(g, 0, spike[0], spike[1]);
  g.onInput(0, { type: 'special', on: true });
  const hp = g.heroes[0].hp;
  ctx.advance(TICK * 2);
  assert.equal(g.heroes[0].hp, hp, 'safe while down');
  assert.equal(g.hostView().spikesUp, false);
  ctx.advance(SPIKES.downMs);
  assert.equal(g.hostView().spikesUp, true);
  assert.ok(g.heroes[0].hp < hp, 'hurt once they come up, shield or not');
  // Off them: no more harm.
  put(g, 0, spike[0] + 3, spike[1]);
  g.heroes[0].invulnUntil = 0;
  const hp2 = g.heroes[0].hp;
  ctx.advance(SPIKES.upMs);
  assert.equal(g.heroes[0].hp, hp2);
});

test('a gate is open only while someone stands on a plate (or in the gateway); it stops enemies and bolts too', () => {
  const { ctx, g } = dungeon({ floors: room([
    '####################',
    '#S S  P  #         #',
    '#        G         #',
    ...Array(8).fill('#        #         #'),
    '####################',
  ]) });
  const gate = find(g, 'G');
  const plate = find(g, 'P');
  // Shut: you can't walk through.
  put(g, 0, gate[0] - 1, gate[1]);
  put(g, 1, 2, 6);
  g.onInput(0, { type: 'move', x: 1, y: 0 });
  ctx.advance(500);
  assert.ok(g.heroes[0].x < gate[0], 'blocked by the gate');
  assert.equal(g.hostView().gateOpen, false);
  // A partner on the plate: open.
  put(g, 1, plate[0], plate[1]);
  ctx.advance(TICK * 2);
  assert.equal(g.hostView().gateOpen, true);
  // Halfway through the gateway when the partner steps off: it waits for you.
  g.onInput(0, { type: 'move', x: 0, y: 0 });
  put(g, 0, gate[0], gate[1]);
  put(g, 1, 2, 6);
  ctx.advance(TICK * 2);
  assert.equal(g.hostView().gateOpen, true, 'not shut on someone');
  put(g, 0, gate[0] + 2, gate[1]);
  ctx.advance(TICK * 2);
  assert.equal(g.hostView().gateOpen, false, 'shut once clear');
  // Shut, it stops enemies and bolts.
  const s = g.spawnEnemy('slime', gate[0] - 1.5, gate[1] + 0.5);
  ctx.advance(3000);
  assert.ok(s.x < gate[0], 'the slime stays behind it');
  const healer = g.heroes.findIndex((h) => h.role === 'healer');
  put(g, healer, gate[0] + 2, gate[1], -1, 0);
  g.enemies = [];
  const e = g.spawnEnemy('slime', gate[0] - 1.5, gate[1] + 0.5);
  e.speed = 0;
  g.attack(healer);
  ctx.advance(1500);
  assert.equal(e.hp, ENEMIES.slime.hp, 'the bolt hit the gate');
});

test('the gate opens while one of you is down, so you can always get to each other (and an enemy in the gateway holds it)', () => {
  const { ctx, g } = dungeon({ floors: room([
    '####################',
    '#S S  P  #         #',
    '#        G         #',
    ...Array(8).fill('#        #         #'),
    '####################',
  ]) });
  const gate = find(g, 'G');
  put(g, 0, gate[0] - 2, gate[1]);
  put(g, 1, gate[0] + 2, gate[1]);
  ctx.advance(TICK * 2);
  assert.equal(g.hostView().gateOpen, false);
  g.hurt(1, 99, null);
  ctx.advance(TICK * 2);
  assert.equal(g.hostView().gateOpen, true, 'open: your partner is down on the other side');
  g.onInput(0, { type: 'move', x: 1, y: 0 });
  ctx.advance(1500);
  assert.ok(g.heroes[0].x > gate[0] + 1, 'through to them');
  g.onInput(0, { type: 'move', x: 0, y: 0 });
  ctx.advance(TIMING.reviveMs + 200);
  assert.equal(g.heroes[1].downed, false, 'revived');
  ctx.advance(TICK * 2);
  assert.equal(g.hostView().gateOpen, false, 'shut again');
  // An enemy standing in the gateway keeps it open.
  put(g, 0, 6, 1);
  ctx.advance(TICK * 2);
  assert.equal(g.hostView().gateOpen, true);
  const e = g.spawnEnemy('slime', gate[0] + 0.5, gate[1] + 0.5);
  e.speed = 0;
  put(g, 0, 2, 8);
  put(g, 1, 3, 8);
  ctx.advance(TICK * 2);
  assert.equal(g.hostView().gateOpen, true, 'not shut on the slime');
});

test('raised spikes cost one heart a rise, however long you stand on them', () => {
  const { ctx, g } = dungeon({ floors: room(['####################', '#S S   ^           #', ...Array(9).fill('#                  #'), '####################']) });
  const spike = find(g, '^');
  put(g, 1, 17, 9);
  while (g.spikesUp()) ctx.advance(TICK);
  put(g, 0, spike[0], spike[1]);
  const hp = g.heroes[0].hp;
  ctx.advance(SPIKES.downMs + SPIKES.upMs - TICK);
  assert.equal(g.heroes[0].hp, hp - 1);
});

test('skeletons keep their distance and throw bones when they can see you; the shield blocks a bone from the front', () => {
  const { ctx, g } = dungeon({ floors: room(['####################', '#S S               #', ...Array(9).fill('#                  #'), '####################']) });
  const fighter = g.heroes.findIndex((h) => h.role === 'fighter');
  const healer = 1 - fighter;
  put(g, healer, 17, 10);
  put(g, fighter, 5, 5, 1, 0);
  const k = g.spawnEnemy('skeleton', 6.5, 5.5);
  ctx.advance(1500);
  assert.ok(Math.hypot(k.x - g.heroes[fighter].x, k.y - g.heroes[fighter].y) > 2.5, 'it backed off');
  // It throws: hurt with no shield...
  k.x = 9.5; k.y = 5.5; k.speed = 0;
  g.heroes[fighter].invulnUntil = 0;
  const hp = g.heroes[fighter].hp;
  ctx.advance(ENEMIES.skeleton.throwEveryMs + 1500);
  assert.ok(g.hostView().events.thrown > 0, 'it threw');
  assert.ok(g.heroes[fighter].hp < hp, 'a bone hit');
  // ...and blocked when facing it with the shield up.
  g.heroes[fighter].invulnUntil = 0;
  g.heroes[fighter].hp = g.heroes[fighter].max;
  put(g, fighter, 5, 5, 1, 0);
  g.onInput(fighter, { type: 'special', on: true });
  const blocked = g.events.blocked;
  ctx.advance(ENEMIES.skeleton.throwEveryMs + 1500);
  assert.equal(g.heroes[fighter].hp, g.heroes[fighter].max);
  assert.ok(g.events.blocked > blocked);
  // Bones show on the TV while they fly.
  assert.ok(Array.isArray(g.hostView().bones));
});

test('a skeleton behind a wall can\'t see you, so it doesn\'t throw', () => {
  const { ctx, g } = dungeon({ floors: room([
    '####################',
    '#S S     #         #',
    ...Array(9).fill('#        #         #'),
    '####################',
  ]) });
  put(g, 0, 5, 5);
  put(g, 1, 4, 8);
  const k = g.spawnEnemy('skeleton', 12.5, 5.5);
  k.speed = 0;
  ctx.advance(ENEMIES.skeleton.throwEveryMs * 3);
  assert.equal(g.events.thrown, 0);
});

test('the Crypt (floor 2) has the spikes, the plates and gate, and skeletons', () => {
  const crypt = FLOORS[1].map.join('');
  assert.equal(FLOORS[1].name, 'The Crypt');
  for (const c of '^PGk') assert.ok(crypt.includes(c), c);
  const { ctx, g } = dungeon();
  g.floor = 1;
  g.load();
  assert.ok(g.enemies.some((e) => e.kind === 'skeleton'));
  assert.ok(find(g, 'G') && find(g, 'P'), 'plates and gates stay on the map');
  ctx.advance(TICK);
});

test('enemy ids never repeat from one floor (or retry) to the next, so the TV never mixes them up', () => {
  const two = room(['####################', '#S S  b s          #', ...Array(9).fill('#                  #'), '####################'])
    .concat(room(['####################', '#S S  s b          #', ...Array(9).fill('#                  #'), '####################']));
  const { g } = dungeon({ floors: two });
  const first = g.enemies.map((e) => e.id);
  g.floor = 1;
  g.load();
  assert.ok(g.enemies.every((e) => !first.includes(e.id)));
});

test('a held shield blocks an enemy pressing on it now and then (not every tick), and pushes it back', () => {
  const { ctx, g } = dungeon({ floors: room(['####################', '#S S               #', ...Array(9).fill('#                  #'), '####################']) });
  const f = g.heroes.findIndex((h) => h.role === 'fighter');
  put(g, 1 - f, 17, 10);
  put(g, f, 8, 5, 1, 0);
  g.onInput(f, { type: 'special', on: true });
  const s = g.spawnEnemy('slime', 9.1, 5.5);
  ctx.advance(3000);
  assert.equal(g.heroes[f].hp, g.heroes[f].max);
  assert.ok(g.events.blocked >= 2 && g.events.blocked <= 3000 / TIMING.blockMs + 1, 'blocked ' + g.events.blocked);
  // Pushed back each time: it never gets to sit on the shield.
  g.onInput(f, { type: 'special', on: false });
  s.speed = 0;
  s.x = 9.1;
  g.heroes[f].face = [1, 0];
  g.onInput(f, { type: 'special', on: true });
  g.heroes[f].blockUntil = 0;
  ctx.advance(TICK * 2);
  assert.ok(s.x > 9.4, 'knocked back');
});

test('the shield slows you while it\'s up', () => {
  const { ctx, g } = dungeon({ floors: room(['####################', '#S S               #', ...Array(9).fill('#                  #'), '####################']) });
  const f = g.heroes.findIndex((h) => h.role === 'fighter');
  put(g, f, 2, 5);
  g.onInput(f, { type: 'move', x: 1, y: 0 });
  ctx.advance(1000);
  const free = g.heroes[f].x - 2.5;
  put(g, f, 2, 7);
  g.onInput(f, { type: 'special', on: true });
  ctx.advance(1000);
  const slow = g.heroes[f].x - 2.5;
  assert.ok(Math.abs(free - HEROES.fighter.speed) < 0.3, 'free ' + free);
  assert.ok(Math.abs(slow - HEROES.fighter.blockSpeed) < 0.3, 'slow ' + slow);
});

test('the revive starts over if your partner walks away', () => {
  const { ctx, g } = dungeon({ floors: room(['####################', '#S S               #', ...Array(9).fill('#                  #'), '####################']) });
  put(g, 0, 5, 5);
  put(g, 1, 6, 5);
  g.hurt(0, 99, null);
  ctx.advance(TIMING.reviveMs * 0.75);
  assert.ok(g.heroes[0].revive > 0);
  put(g, 1, 12, 5);
  ctx.advance(TICK * 2);
  assert.equal(g.heroes[0].revive, 0);
  put(g, 1, 6, 5);
  ctx.advance(TIMING.reviveMs * 0.75);
  assert.equal(g.heroes[0].downed, true, 'not yet: it started over');
});

test('a rematch starts the quest over: continues, retries, the clock and the events all fresh', () => {
  const { ctx, g } = dungeon({ floors: room(['####################', '#S S               #', ...Array(9).fill('#                  #'), '####################']) });
  for (let i = 0; i <= CONTINUES[0]; i++) {
    g.hurt(0, 99, null);
    g.hurt(1, 99, null);
    ctx.advance(TICK * 2);
    if (g.phase === 'retry') ctx.advance(TIMING.retryMs + 50);
  }
  assert.equal(g.phase, 'over');
  const v = g.hostView();
  assert.ok(v.timeMs > 0, 'the time it took');
  ctx.advance(5000);
  assert.equal(g.hostView().timeMs, v.timeMs, 'the clock stopped');
  g.onInput(0, { type: 'move', x: 1, y: 0 });
  g.onInput(0, { type: 'rematch' });
  assert.equal(g.continues, CONTINUES[0]);
  assert.equal(g.retries, 0);
  assert.equal(g.events.downs, 0);
  assert.equal(g.hostView().timeMs, 0);
  assert.deepEqual(g.controls[0], { x: 0, y: 0, special: false });
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
  g.onInput(0, { type: 'move', x: '1', y: true });
  g.onInput(0, { type: 'move', x: NaN, y: 0 });
  assert.equal(g.phase, 'play');
  assert.equal(g.heroes[0].blocking, false);
  assert.deepEqual(g.controls[0], { x: 0, y: 0, special: false });
  // The same shield state again doesn't send everyone a new view.
  const f = g.heroes.findIndex((h) => h.role === 'fighter');
  g.onInput(f, { type: 'special', on: true });
  const sent = g.ctx.updates;
  g.onInput(f, { type: 'special', on: true });
  assert.equal(g.ctx.updates, sent);
});

test('in the lobby: a co-op game (casual) with motion controls, the heroes and difficulty to pick', () => {
  const def = getGame('dungeon-duo');
  assert.equal(def.category, 'casual');
  assert.equal(def.motion, true);
  const setup = JSON.stringify(def.create(fakeCtx()).hostView());
  assert.ok(setup.includes('"heroes"') && setup.includes('"difficulty"'));
  assert.ok(setup.includes('Fighter') && setup.includes('Healer') && setup.includes('Easy'));
});
