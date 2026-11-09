// Keep the shared input behavior, with a separate presentation for the 3D game.
Ark.register('player', 'kart-race-3d', Ark.loadRenderer('player', 'kart-race').then(function () {
  Ark.loadCss('/games/kart-race-3d/style.css');
  return window.ArkKartPhone.make({ threeD: true });
}));
