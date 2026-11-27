// What a set of dice scores in Farkle (the same rules as server/games/farkle.js), for the phones and
// the TV to show as you pick. Sets window.ArkFarkle.
(function () {
  function scoreOf(dice) {
    const n = dice.length;
    if (!n) return 0;
    const c = [0, 0, 0, 0, 0, 0, 0];
    dice.forEach(function (d) { c[d]++; });
    let special = 0;
    if (n === 6) {
      const counts = c.slice(1).filter(Boolean).sort(function (a, b) { return a - b; }).join('');
      if (counts === '111111' || counts === '222' || counts === '24') special = 1500;
      else if (counts === '33') special = 2500;
    }
    let total = 0;
    for (let f = 1; f <= 6; f++) {
      const k = c[f];
      if (!k) continue;
      const single = f === 1 ? 100 : f === 5 ? 50 : 0;
      const triple = f === 1 ? 1000 : f * 100;
      const kind = k >= 3 ? [0, 0, 0, triple, 1000, 2000, 3000][k] : 0;
      const best = Math.max(kind, k >= 3 && single ? triple + (k - 3) * single : 0, single * k);
      if (!best) return special;
      total += best;
    }
    return Math.max(total, special);
  }
  window.ArkFarkle = { scoreOf: scoreOf };
})();
