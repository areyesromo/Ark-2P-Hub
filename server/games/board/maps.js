// Party Board maps: spaces in loop order (the last links back to the first),
// x / y in 0..1 for drawing. Types: start (acts as blue), blue, red, event,
// bonus, shop. starCandidate: where the ⭐ can appear.

/** The 28 squares around a 10 × 6 grid's edge, clockwise from the top left. */
function ring() {
  const cells = [];
  for (let c = 0; c < 10; c++) cells.push([c, 0]);
  for (let r = 1; r < 5; r++) cells.push([9, r]);
  for (let c = 9; c >= 0; c--) cells.push([c, 5]);
  for (let r = 4; r >= 1; r--) cells.push([0, r]);
  return cells.map(([c, r]) => ({ x: Math.round((0.06 + c * 0.0978) * 1000) / 1000, y: Math.round((0.1 + r * 0.16) * 1000) / 1000 }));
}

const ISLAND = [
  'start', 'blue', 'blue*', 'red', 'event', 'blue', 'shop', 'blue*', 'blue', 'red',
  'bonus', 'blue', 'blue*', 'red', 'event', 'blue', 'blue', 'red', 'shop', 'blue*',
  'blue', 'red', 'bonus', 'blue', 'event', 'blue*', 'red', 'blue',
];

export const MAPS = {
  island: {
    name: 'Party Island',
    spaces: ring().map((p, i) => {
      const t = ISLAND[i];
      return t.endsWith('*') ? { ...p, type: t.slice(0, -1), starCandidate: true } : { ...p, type: t };
    }),
  },
};
