// Kart Race 3D: shared race controls, a separate interface, and a lazily loaded 3D stage.
(function () {
  const SCRIPTS = [
    '/games/minis/mini.js',
    '/games/kart-race/track.js',
    '/games/kart-race/racers.js',
    '/games/kart-race-3d/geom3d.js',
    '/games/kart-race-3d/canyon3d.js',
    '/games/kart-race-3d/world3d.js',
    '/games/kart-race-3d/rig3d.js',
    '/games/kart-race-3d/body3d.js',
    '/games/kart-race-3d/models3d.js',
    '/games/kart-race-3d/karts3d.js',
    '/games/kart-race-3d/things3d.js',
    '/games/kart-race-3d/kart3d.js',
  ];
  let box = null;
  let scene = null;
  let latest = null; // the newest view, for a scene still loading
  let mounts = 0; // each mount's number: a scene that arrives after its mount is gone is dropped
  let message = null;
  let failed = false;

  function loadScene() {
    const mine = ++mounts;
    const el = box;
    failed = false;
    message.innerHTML = '<span class="kr3d-eyebrow">KART RACE 3D</span><h2>Preparing the grid</h2><p>Loading the track and karts…</p>';
    message.hidden = false;
    SCRIPTS.reduce(function (p, src) { return p.then(function () { if (mine === mounts) return Ark.loadScript(src); }); }, Promise.resolve())
      .then(function () {
        if (mine !== mounts) return null;
        return window.KR3D.create(el);
      })
      .then(function (s) {
        if (!s) return;
        if (mine !== mounts) return s.dispose();
        try { if (latest) s.update(latest); }
        catch (err) { s.dispose(); throw err; }
        scene = s;
        message.hidden = true;
      })
      .catch(function () {
        if (mine !== mounts) return;
        failed = true;
        message.innerHTML = '<span class="kr3d-eyebrow">KART RACE 3D</span><h2>Couldn\'t open the track</h2><p>Check your connection and 3D graphics support, then try again.</p><button class="primary" type="button">Retry loading · X</button><p class="sub">Use the hub menu to return to the lobby. Kart Race is also available in 2D.</p>';
        message.querySelector('button').addEventListener('click', loadScene);
      });
  }

  const stage = {
    mount: function (arena) {
      Ark.loadCss('/games/kart-race-3d/style.css');
      box = document.createElement('div');
      box.className = 'kr3d';
      box.innerHTML = '<div class="kr3d-frame p1"></div><div class="kr3d-frame p2"></div>';
      arena.insertBefore(box, arena.firstChild);
      message = document.createElement('div');
      message.className = 'kr3d-status panel';
      message.setAttribute('role', 'status');
      arena.appendChild(message);
      loadScene();
    },
    pad: function (btn) {
      if (!failed || btn !== 'X') return false;
      loadScene();
      return true;
    },
    update: function (v) {
      latest = v;
      if (scene) scene.update(v);
    },
    unmount: function () {
      mounts++;
      if (scene) scene.dispose();
      scene = latest = box = null;
      if (message) message.remove();
      message = null;
      failed = false;
    },
  };

  Ark.register('host', 'kart-race-3d', Promise.all([
    Ark.loadScript('/games/kart-race/host.js'),
    Ark.loadScript('/games/kart-race-3d/ui.js'),
  ]).then(function () {
    return window.ArkKartTV.make({ stage: stage, presentation: window.ArkKart3DUI.create(), look: true });
  }));
})();
