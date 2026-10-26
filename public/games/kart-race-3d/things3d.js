// Kart Race 3D's things on the road: ? boxes, coins, bananas, webs, oil slicks, shots and blasts.
// Simple stand-ins for now (models come later), each kind one instanced mesh so a full track is a
// handful of draw calls. KRThings.make(THREE) -> { group, update(view, now), dispose() }.
(function () {
  const SHOT_COLORS = { bouncer: 0x22d3ee, seeker: 0xef4444, bomb: 0x111827 };
  const BLAST = { ms: 500, r: 2 };

  function make(THREE) {
    const group = new THREE.Group();
    const dummy = new THREE.Object3D();
    const kinds = {};
    const add = function (key, geo, mat, max) {
      const m = new THREE.InstancedMesh(geo, mat, max);
      m.count = 0;
      m.frustumCulled = false; // instances spread over the whole track
      group.add(m);
      kinds[key] = m;
    };
    add('boxes', new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshNormalMaterial(), 40);
    add('doubles', new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: 0xfbbf24 }), 20);
    add('coins', new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xfacc15 }), 80);
    add('bananas', new THREE.CapsuleGeometry(0.1, 0.3, 4, 8).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xfde047 }), 20);
    add('webs', new THREE.CircleGeometry(0.6, 16).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.7 }), 10);
    add('oils', new THREE.CircleGeometry(0.7, 16).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1e1b4b, transparent: true, opacity: 0.8 }), 10);
    add('shots', new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }), 10);
    add('blasts', new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.55 }), 6);
    const color = new THREE.Color();

    /** Place one kind's instances: each item gives { x, y, h, spin, scale, color }. */
    const place = function (key, items) {
      const m = kinds[key];
      const n = Math.min(items.length, m.instanceMatrix.count);
      for (let i = 0; i < n; i++) {
        const it = items[i];
        dummy.position.set(it.x, window.ArkKartGeom.heightAt(it.x, it.y) + (it.h || 0), it.y);
        dummy.rotation.set(0, it.spin || 0, 0);
        dummy.scale.setScalar(it.scale || 1);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        if (it.color !== undefined) m.setColorAt(i, color.setHex(it.color));
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    };

    return {
      group: group,
      update: function (v, now) {
        const spin = now / 400;
        const at = function (h, extra) {
          return function (p) { return Object.assign({ x: p.x, y: p.y, h: h }, extra ? extra(p) : null); };
        };
        place('boxes', (v.boxes || []).filter(function (b) { return !b.double; }).map(at(0.45, function () { return { spin: spin }; })));
        place('doubles', (v.boxes || []).filter(function (b) { return b.double; }).map(at(0.45, function () { return { spin: spin }; })));
        place('coins', (v.coins || []).map(at(0.35, function () { return { spin: spin * 1.5 }; })));
        place('bananas', (v.bananas || []).map(at(0.12)));
        place('webs', (v.webs || []).map(at(0.03)));
        place('oils', (v.oils || []).map(at(0.025)));
        place('shots', (v.shots || []).map(at(0.3, function (s) { return { color: SHOT_COLORS[s.kind] || 0xffffff }; })));
        place('blasts', (v.blasts || []).filter(function (b) { return b.age < BLAST.ms; }).map(at(0.2, function (b) { return { scale: Math.max(0.05, (b.age / BLAST.ms) * BLAST.r) }; })));
      },
      dispose: function () {
        Object.keys(kinds).forEach(function (k) {
          kinds[k].geometry.dispose();
          kinds[k].material.dispose();
          kinds[k].dispose();
        });
      },
    };
  }

  window.KRThings = { make: make };
})();
