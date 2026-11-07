// HD graphics for the 3D games on the TV (window.ArkHD). Each TV picks its own level (the HD
// button on its top bar, kept on that device):
//   hd:       glow on what's meant to glow (lava, lanterns, the goal ring, sparks), soft studio
//             reflections on the shiny things (balls, marbles, metal) and sharper shadows; the
//             colours stay as they are. Made for a Steam Deck and up.
//   standard: the 3D as it always was, for a slower TV.
// A 3D renderer makes its scene as before, then: const hd = ArkHD.create(THREE, renderer, scene,
// camera); and draws with hd.render() (resizing with hd.setSize(w, h), and hd.dispose() at the
// end). The glow loads a moment after the scene starts; until then it draws as standard.
(function () {
  const KEY = 'ark.graphics';

  function level() {
    try {
      return localStorage.getItem(KEY) === 'standard' ? 'standard' : 'hd';
    } catch (e) {
      return 'hd';
    }
  }

  function set(l) {
    try {
      localStorage.setItem(KEY, l === 'standard' ? 'standard' : 'hd');
    } catch (e) {
      // (private mode: it stays as it is)
    }
  }

  let addons = null;
  function loadAddons() {
    if (!addons) {
      addons = Promise.all([
        import('/vendor/three-addons/postprocessing/EffectComposer.js'),
        import('/vendor/three-addons/postprocessing/RenderPass.js'),
        import('/vendor/three-addons/postprocessing/UnrealBloomPass.js'),
        import('/vendor/three-addons/postprocessing/ShaderPass.js'),
        import('/vendor/three-addons/postprocessing/OutputPass.js'),
        import('/vendor/three-addons/environments/RoomEnvironment.js'),
      ]).then(function (m) {
        return { EffectComposer: m[0].EffectComposer, RenderPass: m[1].RenderPass, UnrealBloomPass: m[2].UnrealBloomPass, ShaderPass: m[3].ShaderPass, OutputPass: m[4].OutputPass, RoomEnvironment: m[5].RoomEnvironment };
      });
    }
    return addons;
  }

  /**
   * Does this material glow? Only what's meant to: a strong emissive colour (lava, a goal ring, a
   * lantern, fire; not a tile's faint face light), or a bright unlit colour (sparks, a flash).
   * material.userData.glow (true / false) decides it outright.
   */
  function glows(m) {
    if (!m || m.visible === false) return false;
    if (m.userData && typeof m.userData.glow === 'boolean') return m.userData.glow;
    if (m.emissive && !m.emissiveMap) {
      const e = m.emissive;
      return Math.max(e.r, e.g, e.b) * (m.emissiveIntensity === undefined ? 1 : m.emissiveIntensity) >= 0.5;
    }
    if (m.isMeshBasicMaterial || m.isSpriteMaterial || m.isPointsMaterial) {
      const c = m.color;
      return Boolean(c) && Math.max(c.r, c.g, c.b) >= 0.8 && (m.opacity === undefined || m.opacity >= 0.3);
    }
    return false;
  }

  // The last step: the scene as drawn, plus the glow on top (alpha kept, so a see-through scene stays so).
  const MIX = {
    uniforms: { tDiffuse: { value: null }, bloom: { value: null } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform sampler2D bloom; varying vec2 vUv; void main() { vec4 base = texture2D(tDiffuse, vUv); vec3 glow = texture2D(bloom, vUv).rgb; float g = clamp(max(glow.r, max(glow.g, glow.b)), 0.0, 1.0); gl_FragColor = vec4(base.rgb + glow, max(base.a, g)); }',
  };

  /**
   * HD for one renderer and scene. opts: bloom ({ strength, radius }), env (how much the studio
   * reflections light the scene, 0 for none), post (false: reflections and shadows but no glow
   * pass, for a split-screen view that draws itself).
   */
  function create(THREE, renderer, scene, camera, opts) {
    opts = opts || {};
    try {
      // (for tuning: localStorage 'ark.hd.tune' = {"env":0.2,"bloom":{"strength":0.3}} overrides)
      const t = JSON.parse(localStorage.getItem('ark.hd.tune') || 'null');
      if (t && typeof t === 'object') opts = Object.assign({}, opts, t);
    } catch (e) {
      // (none)
    }
    const hd = level() === 'hd';
    const out = {
      hd: hd,
      composer: null,
      render: function () { renderer.render(scene, camera); },
      setSize: function () {},
      dispose: function () {},
    };
    if (!hd) return out;
    let disposed = false;
    let w = 0;
    let h = 0;
    let frame = 0;
    let envTex = null;
    let glowPass = null;
    const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    /** Every light that casts a shadow gets a sharper one (lights added later too). */
    function sharpenShadows() {
      scene.traverse(function (o) {
        if (!o.isLight || !o.castShadow || !o.shadow || o.shadow.mapSize.x >= 4096) return;
        o.shadow.mapSize.set(4096, 4096);
        if (o.shadow.map) {
          o.shadow.map.dispose();
          o.shadow.map = null;
        }
      });
    }
    /** The glow pass: everything that doesn't glow drawn black (and see-through things hidden). */
    function renderGlow() {
      const swapped = [];
      const hidden = [];
      scene.traverseVisible(function (o) {
        if (!o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.some(glows)) return;
        if (o.isMesh && !mats.some(function (m) { return m.transparent; })) {
          swapped.push([o, o.material]);
          o.material = black;
        } else {
          hidden.push(o);
        }
      });
      hidden.forEach(function (o) { o.visible = false; });
      const bg = scene.background;
      const fog = scene.fog;
      scene.background = null;
      scene.fog = null;
      const clear = renderer.getClearAlpha();
      renderer.setClearAlpha(0);
      glowPass.render();
      renderer.setClearAlpha(clear);
      scene.background = bg;
      scene.fog = fog;
      hidden.forEach(function (o) { o.visible = true; });
      swapped.forEach(function (p) { p[0].material = p[1]; });
    }
    out.setSize = function (W, H) {
      w = W;
      h = H;
      if (out.composer) {
        [glowPass, out.composer].forEach(function (c) {
          c.setPixelRatio(renderer.getPixelRatio());
          c.setSize(W, H);
        });
      }
    };
    out.render = function () {
      if (frame++ % 120 === 0) sharpenShadows();
      if (!out.composer) return renderer.render(scene, camera);
      renderGlow();
      out.composer.render();
    };
    out.dispose = function () {
      disposed = true;
      black.dispose();
      if (envTex) envTex.dispose();
      [glowPass, out.composer].forEach(function (c) {
        if (!c) return;
        c.passes.forEach(function (p) { if (p.dispose) p.dispose(); });
        c.dispose();
      });
    };
    loadAddons().then(function (A) {
      if (disposed) return;
      // Soft studio light all round: reflections on whatever is shiny (gently: the scenes keep
      // their own lighting).
      if (opts.env !== 0) {
        const pmrem = new THREE.PMREMGenerator(renderer);
        envTex = pmrem.fromScene(new A.RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
        scene.environment = envTex;
        scene.environmentIntensity = opts.env === undefined ? 0.2 : opts.env;
      }
      if (opts.post === false) return;
      // A scene that only has the renderer's clear colour behind it: make that its background
      // (drawn into the pipeline below, a clear colour would come out paler than it is).
      if (!scene.background && renderer.getClearAlpha() === 1) scene.background = renderer.getClearColor(new THREE.Color());
      const target = function () { return new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }); };
      // The glow: just the glowing parts, blurred out (into its own target, not the screen) ...
      const b = opts.bloom || {};
      glowPass = new A.EffectComposer(renderer, target());
      glowPass.renderToScreen = false;
      glowPass.addPass(new A.RenderPass(scene, camera));
      glowPass.addPass(new A.UnrealBloomPass(new THREE.Vector2(256, 256), b.strength === undefined ? 1.1 : b.strength, b.radius === undefined ? 0.45 : b.radius, 0));
      // ... then the scene as always, with the glow added on top.
      const composer = new A.EffectComposer(renderer, target());
      composer.addPass(new A.RenderPass(scene, camera));
      const mix = new A.ShaderPass(new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, bloom: { value: glowPass.renderTarget2.texture } }, vertexShader: MIX.vertexShader, fragmentShader: MIX.fragmentShader }), 'tDiffuse');
      mix.needsSwap = true;
      composer.addPass(mix);
      composer.addPass(new A.OutputPass());
      out.composer = composer;
      const css = renderer.getSize(new THREE.Vector2());
      out.setSize(w || css.x, h || css.y);
    }).catch(function () {
      // (no add-ons: it stays standard)
    });
    return out;
  }

  window.ArkHD = { level: level, set: set, create: create, glows: glows };
})();
