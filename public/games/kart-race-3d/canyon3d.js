// Sunset Canyon Rally's scenery for Kart Race 3D: red rock cliffs round the field, a mesa and boulders
// in the infield, two rock arches over the road (the Arch Sweep and the Mining Cut), a dam in the
// distance and the festival paddock by the start. Scenery only: nothing stands on the road or its
// barriers, and the karts never touch any of it.
// Two halves: layout(view) decides what goes where (the same on every TV, kept clear of the road),
// and build(THREE, view) makes it from the PIECES factories. A piece can later be swapped for a
// ComfyUI model by replacing its factory; the layout stays.
// KRCanyon.layout(view) -> { rocks, arches, dam, paddock } | null; KRCanyon.build(THREE, view) -> { group, dispose() } | null.
(function () {
  const SEED = 20261108;
  const ROCK_GAP = 3; // rocks keep this far outside the barriers
  const ARCH = { clear: 7, legR: 2.5, legGap: 1, legClear: 0.5, grow: 6, slide: 0.03, slideStep: 0.002 }; // clear: the underside's height, above the chase camera
  // Sizes for a 128-wide field; a bigger field scales them by its width (s = field.w / 128).
  const BASE_W = 128;
  const CLIFF = { out: 1, step: 7, r: [5, 8], h: [9, 16] };
  const BOULDERS = { max: 80, grid: 4, r: [1, 3], h: [1, 4] };
  const MESA = { maxR: 14, h: 8 };
  const DAM = { y: -30, w: 56, h: 22 };
  // The paddock along the first stretch after the line, outside the loop: [kind, distance along the
  // road, how far beyond the barriers]. (People-sized: these don't scale.)
  const PADDOCK = [['tent', 8, 5], ['canopy', 14, 5.5], ['tent', 20, 4.5], ['tent', 26, 5]];
  const FLAGS = { from: 4, to: 30, every: 3, beyond: 1.75 };
  const times = function (range, s) { return [range[0] * s, range[1] * s]; };

  /** A small seeded random generator (mulberry32): every TV draws the same canyon. */
  function random(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** The distance from (x, y) to the nearest point of the road's centre line (every stretch of it). */
  function clearance(road, x, y) {
    let best = Infinity;
    const l = road.line;
    for (let i = 0; i < l.length; i++) {
      const d = (l[i][0] - x) * (l[i][0] - x) + (l[i][1] - y) * (l[i][1] - y);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  /** Is (x, y) inside the loop the centre line draws? */
  function inside(road, x, y) {
    let hit = false;
    const l = road.line;
    for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
      if ((l[i][1] > y) !== (l[j][1] > y) && x < ((l[j][0] - l[i][0]) * (y - l[i][1])) / (l[j][1] - l[i][1]) + l[i][0]) hit = !hit;
    }
    return hit;
  }

  const between = function (rnd, range) { return range[0] + rnd() * (range[1] - range[0]); };

  /** Cliffs in a ring just outside the field's edge, each wholly outside it. */
  function cliffs(f, rnd, s) {
    const out = [];
    const edge = function (x0, y0, x1, y1, nx, ny) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let d = 0; d <= len; d += CLIFF.step * s) {
        const r = between(rnd, times(CLIFF.r, s));
        const t = d / len;
        const push = r + CLIFF.out;
        out.push({ kind: 'cliff', x: x0 + (x1 - x0) * t + nx * push, y: y0 + (y1 - y0) * t + ny * push, r: r, h: between(rnd, times(CLIFF.h, s)) });
      }
    };
    edge(0, 0, f.w, 0, 0, -1);
    edge(f.w, 0, f.w, f.h, 1, 0);
    edge(f.w, f.h, 0, f.h, 0, 1);
    edge(0, f.h, 0, 0, -1, 0);
    return out;
  }

  /** The festival paddock: tents, a canopy and flags beside the first stretch after the line, outside the loop. */
  function paddock(road, keep) {
    const Road = window.ArkKartTrack;
    const at = function (d, off) { return Road.pointAt(road, d / road.length, off); };
    const mid = at(PADDOCK[1][1], keep + PADDOCK[1][2]);
    const side = inside(road, mid.x, mid.y) ? -1 : 1;
    const out = PADDOCK.map(function (p) {
      const q = at(p[1], (keep + p[2]) * side);
      return { kind: p[0], x: q.x, y: q.y, angle: q.angle };
    });
    for (let d = FLAGS.from; d <= FLAGS.to; d += FLAGS.every) {
      const q = at(d, (keep + FLAGS.beyond) * side);
      out.push({ kind: 'flag', x: q.x, y: q.y, angle: q.angle });
    }
    return out;
  }

  /**
   * An arch over the road near lap fraction p: its legs as close to the barriers as every stretch
   * allows. Where another stretch runs close (a hairpin), the arch slides along the lap (at most
   * `slide` either way) to the nearest spot where both legs fit.
   */
  function arch(road, p, keep) {
    const fits = function (q, inner) {
      const o = inner / 2 + ARCH.legR;
      return [-1, 1].every(function (s) {
        const x = q.x - Math.sin(q.angle) * o * s;
        const y = q.y + Math.cos(q.angle) * o * s;
        return clearance(road, x, y) >= keep + ARCH.legClear + ARCH.legR;
      });
    };
    const least = 2 * (keep + ARCH.legGap);
    for (let k = 0; k <= ARCH.slide / ARCH.slideStep; k++) {
      for (const dir of k ? [1, -1] : [1]) {
        const q = window.ArkKartTrack.pointAt(road, p + dir * k * ARCH.slideStep, 0);
        for (let inner = least; inner <= least + 2 * ARCH.grow; inner += 0.5) {
          if (fits(q, inner)) return { x: q.x, y: q.y, angle: q.angle, inner: inner, clear: ARCH.clear, legR: ARCH.legR };
        }
      }
    }
    return null; // nowhere fits: no arch rather than one standing on the road
  }

  function layout(view) {
    const scenery = view.track && view.track.scenery;
    if (!scenery || scenery.kind !== 'canyon') return null;
    const Road = window.ArkKartTrack;
    const road = Road.build(view.track.points);
    const f = view.field;
    const keep = view.trackWidth / 2 + view.wallOut; // the road and its barriers
    const rnd = random(SEED);
    const s = f.w / BASE_W;
    const rocks = cliffs(f, rnd, s);
    const pad = paddock(road, keep);

    // The mesa: the most open spot inside the loop.
    let best = null;
    for (let x = 2; x < f.w; x += 2) {
      for (let y = 2; y < f.h; y += 2) {
        if (!inside(road, x, y)) continue;
        const c = clearance(road, x, y);
        if (!best || c > best.c) best = { x: x, y: y, c: c };
      }
    }
    const placed = [];
    if (best && best.c - keep - ROCK_GAP > 1) {
      const mesa = { kind: 'mesa', x: best.x, y: best.y, r: Math.min(MESA.maxR * s, best.c - keep - ROCK_GAP), h: MESA.h * s };
      rocks.push(mesa);
      placed.push(mesa);
    }

    // Boulders on a jittered grid, in a seeded order, clear of the road, the paddock and each other.
    const spots = [];
    const grid = BOULDERS.grid * s;
    for (let x = grid / 2; x < f.w; x += grid) {
      for (let y = grid / 2; y < f.h; y += grid) spots.push([x + (rnd() - 0.5) * 3 * s, y + (rnd() - 0.5) * 3 * s]);
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = spots[i];
      spots[i] = spots[j];
      spots[j] = t;
    }
    let boulders = 0;
    for (let i = 0; i < spots.length && boulders < BOULDERS.max; i++) {
      const x = spots[i][0];
      const y = spots[i][1];
      const r = between(rnd, times(BOULDERS.r, s));
      const h = between(rnd, times(BOULDERS.h, s));
      if (x - r < 0.5 || y - r < 0.5 || x + r > f.w - 0.5 || y + r > f.h - 0.5) continue;
      if (clearance(road, x, y) < keep + ROCK_GAP + r) continue;
      if (pad.some(function (p) { return Math.hypot(p.x - x, p.y - y) < ROCK_GAP + r; })) continue;
      if (placed.some(function (o) { return Math.hypot(o.x - x, o.y - y) < o.r + r + 1; })) continue;
      const b = { kind: 'boulder', x: x, y: y, r: r, h: h };
      rocks.push(b);
      placed.push(b);
      boulders++;
    }

    return {
      rocks: rocks,
      arches: (scenery.arches || []).map(function (p) { return arch(road, p, keep); }).filter(Boolean),
      dam: { x: f.w / 2, y: DAM.y * s, w: DAM.w * s, h: DAM.h * s },
      scale: s,
      paddock: pad,
    };
  }

  // ---- the pieces ----

  const COLORS = {
    rock: [0xc2410c, 0xea580c, 0xb45309, 0x9a3412, 0xd97706], // the rock's bands, bottom up
    concrete: 0xd6d3d1,
    water: 0x22b8cf,
    fall: 0xe0f7fa,
    teal: 0x14b8a6,
    yellow: 0xfacc15,
    wood: 0x8b5a2b,
  };
  const SLAB_H = 2.5; // a rock is a stack of slabs about this tall, each a little narrower than the one below
  const TAPER = 0.9;

  /**
   * A rock as slabs: [{ x, y (field), base, r, h, turn, color }]. Every slab is drawn from one shared
   * cylinder in one instanced mesh, so all the canyon's rock costs a single draw call.
   */
  function slabs(rock, rnd, out, s) {
    const n = Math.max(1, Math.round(rock.h / (SLAB_H * (s || 1))));
    const h = rock.h / n;
    let r = rock.r;
    for (let i = 0; i < n; i++) {
      out.push({ x: rock.x, y: rock.y, base: i * h, r: r, h: h, turn: rnd() * Math.PI, color: COLORS.rock[(i + Math.floor(rnd() * 2)) % COLORS.rock.length] });
      r *= TAPER;
    }
  }

  /**
   * The pieces: each returns a THREE.Object3D at the origin, facing +x (the way the road runs; the
   * dam faces +z, south, towards the track), with
   * userData.piece naming it. `mat(color)` gives a material shared within the build. A ComfyUI model
   * can replace any of these later.
   */
  const PIECES = {
    /** A rock arch across the road: the half ring over the top (its legs are rock slabs, see build). */
    arch: function (THREE, a, mat) {
      const o = new THREE.Group();
      const R = a.inner / 2 + a.legR; // from the middle of the road to each leg's centre
      const tube = a.legR * 0.9;
      const lift = Math.max(0, a.clear - (R - tube)); // the underside over the road at `clear`
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 8, 18, Math.PI).rotateY(Math.PI / 2), mat(COLORS.rock[1]));
      ring.position.y = lift;
      o.add(ring);
      o.userData.legs = lift; // how tall the legs stand under the ring
      return o;
    },
    /** The dam, facing the track (+z): the wall, two towers, the lake behind and two waterfalls. */
    dam: function (THREE, d, mat) {
      const o = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(d.w, d.h, 4), mat(COLORS.concrete));
      wall.position.y = d.h / 2;
      o.add(wall);
      [-1, 1].forEach(function (s) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(4, d.h + 4, 6), mat(COLORS.concrete));
        tower.position.set((s * d.w) / 4, (d.h + 4) / 2, 0);
        o.add(tower);
        const fall = new THREE.Mesh(new THREE.PlaneGeometry(4, d.h * 0.8), mat(COLORS.fall));
        fall.position.set((s * d.w) / 7, d.h * 0.4, 2.05);
        o.add(fall);
      });
      // (shallow: the overview camera between races draws only so far)
      const lake = new THREE.Mesh(new THREE.PlaneGeometry(d.w + 20, 30).rotateX(-Math.PI / 2), mat(COLORS.water));
      lake.position.set(0, d.h * 0.8, -17);
      o.add(lake);
      return o;
    },
    /** A round festival tent: a drum and a pointed roof, in teal or yellow. */
    tent: function (THREE, t, mat) {
      const o = new THREE.Group();
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.6, 10), mat(0xf8fafc));
      drum.position.y = 0.8;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.4, 10), mat(t.index % 2 ? COLORS.yellow : COLORS.teal));
      roof.position.y = 2.3;
      o.add(drum, roof);
      return o;
    },
    /** The paddock's canopy: a flat teal roof on four posts. */
    canopy: function (THREE, c, mat) {
      const o = new THREE.Group();
      const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 3), mat(COLORS.teal));
      roof.position.y = 2.6;
      o.add(roof);
      const post = new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6);
      [[-2.3, -1.3], [2.3, -1.3], [-2.3, 1.3], [2.3, 1.3]].forEach(function (p) {
        const m = new THREE.Mesh(post, mat(COLORS.wood));
        m.position.set(p[0], 1.3, p[1]);
        o.add(m);
      });
      return o;
    },
    /** A flag on a pole, teal or yellow. */
    flag: function (THREE, f, mat) {
      const o = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), mat(COLORS.wood));
      pole.position.y = 2;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), mat(f.index % 2 ? COLORS.yellow : COLORS.teal));
      cloth.position.set(0.6, 3.6, 0);
      o.add(pole, cloth);
      return o;
    },
  };

  function build(THREE, view) {
    const l = layout(view);
    if (!l) return null;
    const group = new THREE.Group();
    group.name = 'canyon';
    const mats = new Map();
    const mat = function (color) {
      if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide }));
      return mats.get(color);
    };
    const place = function (obj, name, x, y, angle) {
      obj.userData.piece = name;
      obj.position.set(x, 0, y); // field (x, y) is scene (x, z)
      obj.rotation.y = -(angle || 0);
      group.add(obj);
      return obj;
    };

    const rnd = random(SEED + 1);
    const all = [];
    l.rocks.forEach(function (r) { slabs(r, rnd, all, l.scale); });
    l.arches.forEach(function (a) {
      const obj = place(PIECES.arch(THREE, a, mat), 'arch', a.x, a.y, a.angle);
      // The legs: rock either side of the road, up to the ring.
      const o = a.inner / 2 + a.legR;
      [-1, 1].forEach(function (s) {
        slabs({ x: a.x - Math.sin(a.angle) * o * s, y: a.y + Math.cos(a.angle) * o * s, r: a.legR, h: obj.userData.legs + a.legR }, rnd, all);
      });
    });
    place(PIECES.dam(THREE, l.dam, mat), 'dam', l.dam.x, l.dam.y, 0); // (built facing the track already)
    let tents = 0;
    let flags = 0;
    l.paddock.forEach(function (p) {
      const index = p.kind === 'tent' ? tents++ : p.kind === 'flag' ? flags++ : 0;
      place(PIECES[p.kind](THREE, { index: index }, mat), p.kind, p.x, p.y, p.angle);
    });

    // Every slab of rock in one instanced mesh, each with its own size, turn and band colour.
    const slab = new THREE.CylinderGeometry(1, 1, 1, 9).translate(0, 0.5, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const rocks = new THREE.InstancedMesh(slab, rockMat, all.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    all.forEach(function (s, i) {
      m.compose(new THREE.Vector3(s.x, s.base, s.y), q.setFromAxisAngle(up, s.turn), new THREE.Vector3(s.r, s.h, s.r));
      rocks.setMatrixAt(i, m);
      rocks.setColorAt(i, c.setHex(s.color));
    });
    rocks.userData.piece = 'rock';
    group.add(rocks);

    return {
      group: group,
      dispose: function () {
        const done = new Set();
        group.traverse(function (o) {
          if (!o.isMesh) return;
          if (o.isInstancedMesh) o.dispose(); // its per-copy buffers on the GPU
          [o.geometry].concat(o.material).forEach(function (t) {
            if (done.has(t)) return;
            done.add(t);
            t.dispose();
          });
        });
      },
    };
  }

  window.KRCanyon = { layout: layout, build: build, PIECES: PIECES };
})();
