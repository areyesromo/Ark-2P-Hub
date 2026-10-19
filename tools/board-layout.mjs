// board-layout.mjs: write docs/party-board-art/layout.json, every Party Board map in 3D world
// units (as the 3D board places them), for building board environment models.
//   node tools/board-layout.mjs
import fs from 'node:fs';
import { MAPS } from '../server/games/board/maps.js';

const round = (n) => Math.round(n * 1000) / 1000;
// public/games/party-board/board3d.js at(): 0..1 board coordinates to the ground plane.
const at = (s) => ({ x: round((s.x - 0.5) * 22), z: round((s.y - 0.5) * 13) });
// 3D layouts: a height level per space (0 ground, 1 ledge, 2 top), LEVEL units apart.
const LEVEL = 1.2;
/** How each link is built: a walkway (same level), stairs (one level), or a bridge over a gap. */
const kind = (s, n, spaces) => ((s.bridge || []).includes(n) ? 'bridge' : spaces[n].h !== s.h ? 'stairs' : 'walk');

const out = {
  units: 'three.js world units; Y up; +X right, +Z toward the camera (down on the 2D board); the ground top is y = 0',
  levels: { step: LEVEL, note: 'y = level x step: 0 ground, 1 ledge, 2 top (maps with "levels": true)' },
  tile: { diameter: 1.3, topHeight: { model: 0.2, plain: 0.32 } },
  keepOut: { aroundTile: 1.0, aroundPath: 0.6, note: 'no props inside these distances (from tile centres / path centre lines)' },
  maps: {},
};
for (const [id, m] of Object.entries(MAPS)) {
  const levels = m.spaces.some((s) => s.h !== undefined);
  out.maps[id] = {
    name: m.name,
    tier: m.tier,
    ...(levels ? { levels: true } : {}),
    spaces: m.spaces.map((s, i) => ({
      i, ...at(s), ...(levels ? { y: round(s.h * LEVEL), level: s.h } : {}), type: s.type, next: s.next,
      ...(levels ? { links: s.next.map((n) => kind(s, n, m.spaces)) } : {}),
      ...(s.warp !== undefined ? { warp: s.warp } : {}),
      ...(s.starCandidate ? { starCandidate: true } : {}),
      ...(s.next.length > 1 ? { fork: true } : {}),
    })),
  };
}
fs.writeFileSync('docs/party-board-art/layout.json', JSON.stringify(out, null, 1) + '\n');
console.log('wrote docs/party-board-art/layout.json:', Object.keys(out.maps).join(', '));
