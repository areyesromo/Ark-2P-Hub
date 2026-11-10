// Kart Race 3D's racer models: a racer with a 3D model (models/<racer>-kart.glb and <racer>.glb, built
// by tools/kart-models/) loads it once per TV page, in the background. Each kart clones what this
// resolves, so every Rex on the track shares one copy of the geometry and texture.
// KRModels.get(THREE, racerId) -> Promise<{ kart, driver, wheelRadius }>, or null without a model.
(function () {
  const DIR = '/games/kart-race-3d/models/';
  const MODELS = { rex: { kart: 'rex-kart.glb', driver: 'rex.glb' } };
  const loading = {};

  const KRModels = {
    MODELS: MODELS,
    has: function (racerId) { return Boolean(MODELS[racerId]); },
    /** The skeleton-aware cloner (every Rex needs bones of his own); tests swap in their own. */
    cloner: function () {
      return import('/vendor/three-addons/utils/SkeletonUtils.js').then(function (mod) { return mod.clone; });
    },
    /** Loads a .glb (as Party Board does); tests swap in a fake. */
    loader: function (url) {
      return import('/vendor/three-addons/loaders/GLTFLoader.js').then(function (mod) {
        return new mod.GLTFLoader().loadAsync(url);
      });
    },
    get: function (THREE, racerId) {
      const files = MODELS[racerId];
      if (!files) return null;
      if (loading[racerId]) return loading[racerId];
      loading[racerId] = Promise.all([KRModels.loader(DIR + files.kart), KRModels.loader(DIR + files.driver), KRModels.cloner()])
        .then(function (got) {
          const kart = got[0].scene;
          const driver = got[1].scene;
          kart.updateMatrixWorld(true);
          const wheel = kart.getObjectByName('wheel_fl');
          const size = new THREE.Box3().setFromObject(wheel).getSize(new THREE.Vector3());
          return { kart: kart, driver: driver, wheelRadius: size.y / 2, clone: got[2] };
        })
        .catch(function (err) {
          // Logged once: the karts keep their placeholder, and the page doesn't try again.
          console.error('Kart Race 3D: no model for', racerId, err);
          throw err;
        });
      return loading[racerId];
    },
  };

  window.KRModels = KRModels;
})();
