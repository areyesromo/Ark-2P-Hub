// Real server views for the UI preview, without running a server or a graphics scene.
import kartRace3d from '../../server/games/kart-race-3d.js';
import { TIMING } from '../../server/games/kart-race.js';
import { fakeCtx } from '../helpers.js';

export function kartViews() {
  const views = {};
  const save = (key, g) => { views[key] = JSON.parse(JSON.stringify(g.hostView())); };
  for (const battle of [false, true]) {
    const ctx = fakeCtx(['Sergio', 'Alex']);
    ctx.players[0].local = true;
    const g = kartRace3d.create(ctx);
    g.start();
    g.onInput(0, { type: 'setting', key: 'track', value: 3 });
    g.onInput(0, { type: 'setting', key: 'races', value: 3 });
    if (battle) g.onInput(0, { type: 'setting', key: 'mode', value: 1 });
    g.onInput(0, { type: 'go' });
    save(battle ? 'battle-setup' : 'setup', g);
    g.onInput(1, { type: 'go' });
    ctx.advance(1800);
    save(battle ? 'battle-countdown' : 'countdown', g);
    ctx.advance(TIMING.countdownMs + 50);
    save(battle ? 'battle' : 'race', g);
    const racing = views[battle ? 'battle' : 'race'];
    racing.raceMs = 68200;
    racing.karts[0] = { ...racing.karts[0], speed: 9.4, coins: 8, laps: 1, lapMs: 22300, bestLap: 45900, drifting: true, driftCharge: 1, items: ['turbo', 'banana'] };
    racing.karts[1] = { ...racing.karts[1], speed: 7.8, coins: 5, laps: 1, lapMs: 24100, bestLap: 47200, items: ['shield'] };
    if (!battle) {
      g.finishLine(0, ctx.now());
      save('finish', g);
      ctx.advance(TIMING.finishMs + 100);
      save('standings', g);
      g.phase = 'over';
      g.winner = 0;
      save('over', g);
    }
  }
  return views;
}
