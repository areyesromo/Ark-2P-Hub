// Kart Race 3D's TV: Kart Race's TV (HUD, setup, start lights, scoreboard) with a 3D stage in
// place of its top-down canvas.
(function () {
  const stage = { mount: function () {}, update: function () {}, unmount: function () {} };
  Ark.register('host', 'kart-race-3d', Ark.loadScript('/games/kart-race/host.js').then(function () {
    return window.ArkKartTV.make({ stage: stage });
  }));
})();
