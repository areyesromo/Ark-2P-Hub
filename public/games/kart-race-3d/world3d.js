// Kart Race 3D's track: grass, the road, red and white kerbs, striped tyre walls, boost pads and the
// start line, all built from the same lines the server drives on (track.js), so what you see is what
// you hit. KRWorld.build(THREE, view) -> { group, segments, dispose() }.
(function () {
  const WALL_H = 0.5;
  const KERB = 0.25; // kerb width, just outside the road's edge
  const COLORS = { grass: 0x3f8f3a, road: 0x3b3f46, wall: 0xf1f5f9 };

  /** A small repeating canvas texture (stripes, chequers, chevrons). */
  function canvasTexture(THREE, w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  function stripes(THREE) {
    return canvasTexture(THREE, 2, 1, function (g) {
      g.fillStyle = '#ef4444';
      g.fillRect(0, 0, 1, 1);
      g.fillStyle = '#f1f5f9';
      g.fillRect(1, 0, 1, 1);
    });
  }

  /** A geometry from ribbon-style arrays, with u running along the loop (`perSample` stripes each). */
  function geometry(THREE, positions, indices, perSample) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const n = positions.length / 6;
    const uv = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) uv.set([i * perSample, 0, i * perSample, 1], i * 4);
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    return g;
  }

  /** An upright strip along a line, from height h0 to h1 (a wall's face). */
  function upright(line, h0, h1) {
    const G = window.ArkKartGeom;
    const n = line.length;
    const positions = new Float32Array(n * 6);
    const indices = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const p = line[i];
      const base = G.heightAt(p[0], p[1]);
      positions.set([p[0], base + h0, p[1], p[0], base + h1, p[1]], i * 6);
      const j = (i + 1) % n;
      indices.set([2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j], i * 6);
    }
    return { positions: positions, indices: indices };
  }

  /** A flat quad lying on the ground at a field point, turned to `angle`. */
  function decal(THREE, material, len, wide, p, lift) {
    const geo = new THREE.PlaneGeometry(len, wide);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, material);
    m.position.set(p.x, window.ArkKartGeom.heightAt(p.x, p.y) + lift, p.y);
    m.rotation.y = -p.angle;
    return m;
  }

  function build(THREE, v) {
    const Road = window.ArkKartTrack;
    const G = window.ArkKartGeom;
    const group = new THREE.Group();
    const road = Road.build(v.track.points);
    const edge = Road.barriers(road, v.trackWidth / 2, v.wallOut);
    const half = v.trackWidth / 2;
    const f = v.field;
    const stripeTex = stripes(THREE);
    const wallMat = new THREE.MeshLambertMaterial({ map: stripeTex, side: THREE.DoubleSide });

    // Grass under everything, well past the field's edge.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(f.w + 60, f.h + 60).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: COLORS.grass }));
    ground.position.set(f.w / 2, -0.02, f.h / 2);
    group.add(ground);

    const strip = function (a, b, mat, lift, perSample) {
      const r = G.ribbon(a, b);
      const m = new THREE.Mesh(geometry(THREE, r.positions, r.indices, perSample), mat);
      m.position.y = lift;
      group.add(m);
    };
    strip(Road.outline(road.line, -half), Road.outline(road.line, half), new THREE.MeshLambertMaterial({ color: COLORS.road }), 0, 0);
    const kerbMat = new THREE.MeshLambertMaterial({ map: stripeTex });
    strip(Road.outline(road.line, -half - KERB), Road.outline(road.line, -half), kerbMat, 0.01, 0.25);
    strip(Road.outline(road.line, half), Road.outline(road.line, half + KERB), kerbMat, 0.01, 0.25);

    // Tyre walls: the inside face where the server's barrier is, an outside face, and a top.
    const inner = Road.edgeLines(road, edge, 0);
    const outer = Road.edgeLines(road, edge, Road.BARRIER);
    ['left', 'right'].forEach(function (side) {
      [inner[side], outer[side]].forEach(function (line) {
        const r = upright(line, 0, WALL_H);
        group.add(new THREE.Mesh(geometry(THREE, r.positions, r.indices, 0.25), wallMat));
      });
      strip(inner[side], outer[side], wallMat, WALL_H, 0.25);
    });

    // The field's edge is a wall too.
    const border = new THREE.MeshLambertMaterial({ color: COLORS.wall });
    [[f.w / 2, -0.15, f.w + 0.6, 0.3], [f.w / 2, f.h + 0.15, f.w + 0.6, 0.3], [-0.15, f.h / 2, 0.3, f.h], [f.w + 0.15, f.h / 2, 0.3, f.h]].forEach(function (b) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b[2], WALL_H, b[3]), border);
      m.position.set(b[0], WALL_H / 2, b[1]);
      group.add(m);
    });

    // Boost pads: yellow with chevrons pointing the way to go.
    const chevrons = canvasTexture(THREE, 32, 32, function (g, w, h) {
      g.fillStyle = '#facc15';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#a16207';
      g.lineWidth = 4;
      [8, 18].forEach(function (x) {
        g.beginPath();
        g.moveTo(x, 6);
        g.lineTo(x + 8, h / 2);
        g.lineTo(x, h - 6);
        g.stroke();
      });
    });
    const padMat = new THREE.MeshLambertMaterial({ map: chevrons });
    (v.track.boosts || []).forEach(function (p) { group.add(decal(THREE, padMat, 1.4, 1.0, p, 0.02)); });

    // The start line (races only): a chequered strip across the road.
    if (v.track.start) {
      const cheq = canvasTexture(THREE, 2, 8, function (g, w, h) {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            g.fillStyle = (x + y) % 2 ? '#111827' : '#f8fafc';
            g.fillRect(x, y, 1, 1);
          }
        }
      });
      group.add(decal(THREE, new THREE.MeshLambertMaterial({ map: cheq }), 0.5, v.trackWidth, v.track.start, 0.02));
    }

    return {
      group: group,
      segments: G.wallSegments(road, edge, f),
      dispose: function () {
        group.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (o.material.map) o.material.map.dispose();
            o.material.dispose();
          }
        });
      },
    };
  }

  window.KRWorld = { build: build };
})();
