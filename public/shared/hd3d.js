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
  if (window.ArkHD) return; // (loaded already: by the TV page, then again by a game)
  const KEY = 'ark.graphics';
  let active = 0; // HD scenes on screen now (the TV's HD button reloads only if there are)

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
      }).catch(function (err) {
        addons = null; // (a blip: the next scene tries again)
        throw err;
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
      if (m.map) return false; // (a picture: a label, an icon, an emoji; white is just its tint)
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
   * reflections light the scene, 0 for none), post (false: the reflections only, for a
   * split-screen view that draws itself and keeps its own shadows).
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
    active++;
    let counted = true;
    const uncount = function () {
      if (counted) active--;
      counted = false;
    };
    const out = {
      hd: hd,
      composer: null,
      render: function () { renderer.render(scene, camera); },
      setSize: function () {},
      dispose: uncount,
    };
    if (!hd) return out;
    let disposed = false;
    let w = 0;
    let h = 0;
    let frame = 0;
    let envTex = null;
    let glowPass = null;
    // The glow pass's stand-ins: black (it hides what's behind, as the real thing would), black
    // seen from both sides, and nothing at all (a see-through thing: what's in it still glows).
    const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const black2 = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    const none = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const swapped = [];
    const hidden = [];
    let envScene = null;
    let envTarget = null;
    let setBackground = false;
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
    /** A material's glow, looked at again every half second (a pulsing lava's can change). */
    function glowsNow(m) {
      const c = m.userData && m.userData.hdGlow;
      if (c && frame - c[0] < 30) return c[1];
      const g = glows(m);
      if (m.userData) m.userData.hdGlow = [frame, g];
      return g;
    }
    function stand(o) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some(glowsNow)) return;
      const shown = mats.filter(function (m) { return m.visible !== false; });
      if (!shown.length || !o.isMesh) {
        hidden.push(o); // (invisible anyway, or a sprite, line or point that doesn't glow)
        return;
      }
      swapped.push(o, o.material);
      if (shown.some(function (m) { return m.transparent || m.alphaTest > 0; })) o.material = none;
      else o.material = shown.some(function (m) { return m.side !== THREE.FrontSide; }) ? black2 : black;
    }
    /**
     * The glow pass: everything that doesn't glow drawn black, so it still hides what's behind it,
     * fading into black fog (far-off glow fades as the real thing does). Everything is put back
     * afterwards, whatever happens.
     */
    function renderGlow() {
      swapped.length = 0;
      hidden.length = 0;
      scene.traverseVisible(function (o) { if (o.material) stand(o); });
      for (let i = 0; i < hidden.length; i++) hidden[i].visible = false;
      const bg = scene.background;
      const fogColor = scene.fog ? scene.fog.color.clone() : null;
      const clear = renderer.getClearAlpha();
      const autoShadows = renderer.shadowMap.autoUpdate;
      try {
        scene.background = null;
        if (scene.fog) scene.fog.color.setRGB(0, 0, 0);
        renderer.setClearAlpha(0);
        renderer.shadowMap.autoUpdate = false; // (the main pass draws the shadows: once a frame is enough)
        glowPass.render();
      } finally {
        renderer.shadowMap.autoUpdate = autoShadows;
        renderer.setClearAlpha(clear);
        scene.background = bg;
        if (fogColor) scene.fog.color.copy(fogColor);
        for (let i = 0; i < hidden.length; i++) hidden[i].visible = true;
        for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
      }
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
      uncount();
      disposed = true;
      [black, black2, none].forEach(function (m) { m.dispose(); });
      if (envTex) {
        envTex.dispose();
        if (envTarget) envTarget.dispose();
        if (envScene && envScene.dispose) envScene.dispose();
        if (scene.environment === envTex) scene.environment = null;
      }
      if (setBackground) scene.background = null;
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
        envScene = new A.RoomEnvironment();
        envTarget = pmrem.fromScene(envScene, 0.04);
        envTex = envTarget.texture;
        pmrem.dispose();
        scene.environment = envTex;
        scene.environmentIntensity = opts.env === undefined ? 0.2 : opts.env;
      }
      if (opts.post === false) return;
      // A scene that only has the renderer's clear colour behind it: make that its background
      // (drawn into the pipeline below, a clear colour would come out paler than it is).
      if (!scene.background && renderer.getClearAlpha() === 1) {
        scene.background = renderer.getClearColor(new THREE.Color());
        setBackground = true;
      }
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

  window.ArkHD = { level: level, set: set, create: create, glows: glows, active: function () { return active; } };
})();
