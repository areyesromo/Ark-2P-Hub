// Kart Race 3D's TV: Kart Race's TV (HUD, setup, start lights, scoreboard) with a 3D stage in
// place of its top-down canvas (kart3d.js and friends, loaded in order on first use).
(function () {
  const SCRIPTS = [
    '/games/minis/mini.js',
    '/games/kart-race/track.js',
    '/games/kart-race/racers.js',
    '/games/kart-race-3d/geom3d.js',
    '/games/kart-race-3d/world3d.js',
    '/games/kart-race-3d/karts3d.js',
    '/games/kart-race-3d/things3d.js',
    '/games/kart-race-3d/kart3d.js',
  ];
  const NONE = '<div class="kr3d-none panel">3D isn\'t available on this screen. Try <strong>Kart Race</strong> instead.</div>';

  let box = null;
  let scene = null;
  let latest = null; // the newest view, for a scene still loading
  let mounts = 0; // each mount's number: a scene that arrives after its mount is gone is dropped

  const stage = {
    mount: function (arena) {
      Ark.loadCss('/games/kart-race-3d/style.css');
      const mine = ++mounts;
      box = document.createElement('div');
      box.className = 'kr3d';
      box.innerHTML = '<div class="kr3d-frame p1"></div><div class="kr3d-frame p2"></div>';
      arena.insertBefore(box, arena.firstChild);
      const el = box;
      SCRIPTS.reduce(function (p, src) { return p.then(function () { return Ark.loadScript(src); }); }, Promise.resolve())
        .then(function () { return window.KR3D.create(el); })
        .then(function (s) {
          if (mine !== mounts) return s.dispose();
          scene = s;
          if (latest) s.update(latest);
        })
        .catch(function () {
          if (mine === mounts) el.innerHTML = NONE; // no WebGL, or the 3D code didn't load
        });
    },
    update: function (v) {
      latest = v;
      if (scene) scene.update(v);
    },
    unmount: function () {
      mounts++;
      if (scene) scene.dispose();
      scene = latest = box = null;
    },
  };

  Ark.register('host', 'kart-race-3d', Ark.loadScript('/games/kart-race/host.js').then(function () {
    return window.ArkKartTV.make({ stage: stage });
  }));
})();
