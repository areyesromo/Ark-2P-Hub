// Kart Race 3D's scene: the track (world3d.js), the karts (karts3d.js) and the things on the road
// (things3d.js), drawn twice a frame, P1's chase camera on the left half and P2's on the right.
// Karts are smoothed between the server's views (geom3d.js). Between races, a camera high over the field.
// KR3D.create(el) -> Promise<{ update(view), dispose() }>; rejects without WebGL.
(function () {
  const SKY = 0x9bd4f5;
  const BOOST_FOV = 8; // extra field of view on a boost
  const OVERVIEW = { up: 24, back: 15 }; // the camera between races, south of the field centre

  function create(el) {
    const G = window.ArkKartGeom;
    const CAM = G.CAM;
    let gl = null;
    let view = null;
    let world = null;
    let worldKey = null;
    let karts = [null, null];
    let things = null;
    let smooth = G.smoother();
    let race = null; // the race the smoother and cameras are following
    let prev = null; // the view before this one
    let cams = [];
    let follow = [null, null]; // each half's camera: { eye: [x, y], h, look: [x, y], fov }
    let lastFrame = 0;

    const css = getComputedStyle(document.documentElement);
    const colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];

    /** Two karts on the road: draw it split. */
    function split() {
      return Boolean(view && view.karts && view.track && (view.phase === 'race' || view.phase === 'countdown'));
    }

    function draw(renderer, scene, w, h) {
      if (split()) {
        renderer.setScissorTest(true);
        cams.forEach(function (cam, i) {
          const x = i * Math.floor(w / 2);
          renderer.setViewport(x, 0, Math.floor(w / 2), h);
          renderer.setScissor(x, 0, Math.floor(w / 2), h);
          cam.aspect = w / 2 / h;
          cam.updateProjectionMatrix();
          renderer.render(scene, cam);
        });
        renderer.setScissorTest(false);
      } else {
        renderer.setViewport(0, 0, w, h);
        renderer.render(scene, gl.camera);
      }
    }

    /** Move each half's camera toward its kart, never behind a wall. */
    function aim(poses, dt) {
      poses.forEach(function (pose, i) {
        const k = view.karts[i];
        const goal = G.chase(pose, view.battle ? CAM.battle : CAM);
        const fov = CAM.fov + (k && k.boosting ? BOOST_FOV : 0);
        const want = goal.eye.concat(goal.eyeH, goal.look, fov);
        const f = follow[i] ? G.follow(follow[i], want, dt) : want; // a new race: straight there
        const eye = G.clampEye([pose.x, pose.y], [f[0], f[1]], world ? world.segments : []);
        follow[i] = [eye[0], eye[1]].concat(f.slice(2));
        const c = follow[i];
        const cam = cams[i];
        cam.position.set(c[0], G.heightAt(c[0], c[1]) + c[2], c[1]);
        cam.lookAt(c[3], 0.4, c[4]);
        if (cam.fov !== c[5]) {
          cam.fov = c[5];
          cam.updateProjectionMatrix();
        }
      });
    }

    function frame() {
      const now = performance.now();
      const dt = lastFrame ? Math.min(100, now - lastFrame) : 16;
      lastFrame = now;
      if (things && view) things.update(view, now);
      const poses = split() ? smooth.at(now) : null;
      if (!poses) return;
      poses.forEach(function (pose, i) {
        if (karts[i]) karts[i].set(pose, view.karts[i], now);
      });
      aim(poses, dt);
    }

    function setWorld(v) {
      const key = v.track ? v.track.index + ':' + v.trackWidth : null;
      if (key === worldKey) return;
      if (world) {
        gl.scene.remove(world.group);
        world.dispose();
      }
      world = v.track ? window.KRWorld.build(gl.THREE, v) : null;
      worldKey = key;
      if (world) gl.scene.add(world.group);
      // Between races, look over the whole field.
      const f = v.field;
      gl.camera.position.set(f.w / 2, OVERVIEW.up, f.h / 2 + OVERVIEW.back);
      gl.camera.lookAt(f.w / 2, 0, f.h / 2);
    }

    function setKarts(v) {
      [0, 1].forEach(function (slot) {
        const k = v.karts && v.karts[slot];
        const want = k ? k.racer : null;
        if (karts[slot] && karts[slot].racer !== want) {
          gl.scene.remove(karts[slot].obj);
          karts[slot].dispose();
          karts[slot] = null;
        }
        if (want && !karts[slot]) {
          karts[slot] = window.KRKarts.make(gl.THREE, want, colors[slot]);
          gl.scene.add(karts[slot].obj);
        }
      });
    }

    return window.ArkMini.scene3d(el, { fov: 50, maxPixelRatio: 1, draw: draw }).then(function (g) {
      gl = g;
      gl.scene.background = new gl.THREE.Color(SKY);
      cams = [0, 1].map(function () { return new gl.THREE.PerspectiveCamera(CAM.fov, 8 / 9, 0.1, 200); });
      things = window.KRThings.make(gl.THREE);
      gl.scene.add(things.group);
      gl.onFrame(frame);
      return {
        update: function (v) {
          view = v;
          el.classList.toggle('split', split());
          if (v.track) setWorld(v);
          const lights = v.phase === 'countdown' && (!prev || prev.phase !== 'countdown');
          prev = v;
          if (v.race !== race || !v.karts || lights) {
            // A new race, a rematch (the lights again) or none: karts and cameras afresh on the grid.
            race = v.karts ? v.race : null;
            smooth = G.smoother();
            follow = [null, null];
          }
          setKarts(v);
          if (v.karts) smooth.push(performance.now(), v.karts.map(function (k) { return { x: k.x, y: k.y, angle: k.angle }; }));
        },
        dispose: function () {
          if (world) world.dispose();
          karts.forEach(function (k) { if (k) k.dispose(); });
          if (things) things.dispose();
          gl.dispose();
          world = things = view = null;
          karts = [null, null];
        },
      };
    });
  }

  window.KR3D = { create: create };
})();
