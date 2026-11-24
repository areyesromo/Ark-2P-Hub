// Stack's sliding block, followed on this screen: the server sends where it
// started and how fast it goes, and this works out where it is now (the same
// sums as server/games/stack.js), so a drop can say when the player saw it.
(function () {
  function tracker() {
    let key = '';
    let base = 0; // performance.now() when the block started (less any paused time)
    let moving = null;
    let pausedAt = null;

    return {
      update: function (v) {
        moving = v.moving;
        const k = JSON.stringify([v.height, v.phase === 'over', moving && [moving.from, moving.dir, moving.speed]]);
        const now = performance.now();
        if (k !== key || (v.phase === 'play' && pausedAt !== null)) {
          // A new block (or carrying on after a pause): pick up where the server says it is.
          key = k;
          base = now - (moving ? moving.elapsed : 0);
        }
        pausedAt = v.phase === 'paused' ? (pausedAt === null ? now : pausedAt) : null;
      },
      /** How long the block has been moving, as this screen sees it (ms). */
      t: function () {
        return (pausedAt !== null ? pausedAt : performance.now()) - base;
      },
      /** Its left edge now. */
      x: function () {
        const m = moving;
        if (!m || m.span <= 0) return 0;
        const start = m.dir > 0 ? m.from : 2 * m.span - m.from;
        const d = (start + (m.speed * this.t()) / 1000) % (2 * m.span);
        return d <= m.span ? d : 2 * m.span - d;
      },
    };
  }
  window.ArkStack = { tracker: tracker };
})();
