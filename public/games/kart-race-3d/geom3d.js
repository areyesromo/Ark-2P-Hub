// Kart Race 3D's maths, with no three.js in it so the tests can check it: the road and wall shapes
// (from track.js's lines), smoothing between the server's views, and the chase camera. A field point
// (x, y) is the scene point (x, heightAt(x, y), y). Sets globalThis.ArkKartGeom.
(function () {
  /** The ground's height. Flat for now: tracks with bumps and banking will change only this. */
  function heightAt() {
    return 0;
  }

  /**
   * A closed strip between two loops of the same length (a road, a kerb, a wall's face): vertex 2i
   * is a[i], 2i+1 is b[i]. With a on the left of the direction of travel, the faces point up.
   */
  function ribbon(a, b) {
    const n = a.length;
    const positions = new Float32Array(n * 6);
    const indices = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) {
      positions.set([a[i][0], heightAt(a[i][0], a[i][1]), a[i][1], b[i][0], heightAt(b[i][0], b[i][1]), b[i][1]], i * 6);
      const j = (i + 1) % n;
      indices.set([2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j], i * 6);
    }
    return { positions: positions, indices: indices };
  }

  /** Every wall a camera mustn't see through, as [x1, y1, x2, y2]: both barriers' inside faces and the field's edge. */
  function wallSegments(road, edge, field) {
    const L = globalThis.ArkKartTrack.edgeLines(road, edge, 0);
    const out = [];
    [L.left, L.right].forEach(function (line) {
      line.forEach(function (p, i) {
        const q = line[(i + 1) % line.length];
        out.push([p[0], p[1], q[0], q[1]]);
      });
    });
    const w = field.w;
    const h = field.h;
    out.push([0, 0, w, 0], [w, 0, w, h], [w, h, 0, h], [0, h, 0, 0]);
    return out;
  }

  /** The shorter turn from angle a to angle b. */
  function turn(a, b) {
    return Math.atan2(Math.sin(b - a), Math.cos(b - a));
  }

  /**
   * Karts drawn a little in the past (`delayMs`), blended between the views either side of that
   * moment, so 30 views a second look smooth at 60 frames. A kart that moved more than `snap` in
   * one view (a new race, a new track) jumps there instead of sliding.
   */
  function smoother(opts) {
    opts = opts || {};
    const delayMs = opts.delayMs === undefined ? 50 : opts.delayMs;
    const snap = opts.snap === undefined ? 2 : opts.snap;
    const views = []; // the last few { t, poses }, oldest first
    return {
      push: function (t, poses) {
        views.push({ t: t, poses: poses });
        if (views.length > 4) views.shift();
      },
      at: function (t) {
        if (!views.length) return null;
        const rt = t - delayMs;
        const last = views[views.length - 1];
        if (views.length === 1 || rt >= last.t) return last.poses;
        if (rt <= views[0].t) return views[0].poses;
        let i = views.length - 1;
        while (views[i - 1].t > rt) i--;
        const a = views[i - 1];
        const b = views[i];
        const f = (rt - a.t) / (b.t - a.t || 1);
        return b.poses.map(function (q, k) {
          const p = a.poses[k];
          if (!p || Math.hypot(q.x - p.x, q.y - p.y) > snap) return q;
          return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, angle: p.angle + turn(p.angle, q.angle) * f };
        });
      },
    };
  }

  // The chase camera: `back` behind the kart, `up` high, looking `ahead` of it; `rate` is how fast
  // it catches up (per ms). In a battle it sits higher and further back to show more of the arena.
  const CAM = { back: 3.2, up: 1.6, ahead: 2.5, fov: 70, rate: 0.008, battle: { back: 4.5, up: 3.0, ahead: 1.5 } };

  /** Where the camera wants to be for a kart: { eye: [x, y], eyeH, look: [x, y] } in field units. */
  function chase(pose, cam) {
    cam = cam || CAM;
    const c = Math.cos(pose.angle);
    const s = Math.sin(pose.angle);
    return { eye: [pose.x - c * cam.back, pose.y - s * cam.back], eyeH: cam.up, look: [pose.x + c * cam.ahead, pose.y + s * cam.ahead] };
  }

  /** Move part of the way to the goal: more the longer the frame, never past it. */
  function follow(cur, goal, dtMs, rate) {
    const k = 1 - Math.exp(-(rate === undefined ? CAM.rate : rate) * dtMs);
    return cur.map(function (c, i) { return c + (goal[i] - c) * k; });
  }

  /** The eye, pulled in toward the kart to just before the first wall between them. */
  function clampEye(kart, eye, segments, margin) {
    margin = margin === undefined ? 0.2 : margin;
    const dx = eye[0] - kart[0];
    const dy = eye[1] - kart[1];
    const len = Math.hypot(dx, dy);
    if (!len) return eye;
    let best = Infinity; // nearest crossing, as a fraction of the way to the eye
    segments.forEach(function (s) {
      const ex = s[2] - s[0];
      const ey = s[3] - s[1];
      const den = dx * ey - dy * ex;
      if (!den) return;
      const t = ((s[0] - kart[0]) * ey - (s[1] - kart[1]) * ex) / den;
      const u = ((s[0] - kart[0]) * dy - (s[1] - kart[1]) * dx) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < best) best = t;
    });
    if (best === Infinity) return eye;
    const d = Math.max(0, best * len - margin) / len;
    return [kart[0] + dx * d, kart[1] + dy * d];
  }

  globalThis.ArkKartGeom = { heightAt: heightAt, ribbon: ribbon, wallSegments: wallSegments, smoother: smoother, CAM: CAM, chase: chase, follow: follow, clampEye: clampEye };
})();
