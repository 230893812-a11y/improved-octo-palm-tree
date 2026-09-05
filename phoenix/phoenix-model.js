/*
 * Licensed Phoenix model layer
 *
 * This file keeps the existing procedural PhoenixHero scene as a graceful
 * fallback, while replacing it with the locally bundled NORBERTO-3D model
 * when Three.js and the model loader are available.  It is deliberately a
 * classic script so the static HTML page still works on GitHub Pages.
 */
(function (global) {
  'use strict';

  var baseApi = global.PhoenixHero;
  if (!baseApi || typeof baseApi.mount !== 'function') return;

  var MODEL_URL = 'phoenix/models/phoenix-bird.glb';
  var LOADER_URL = 'https://cdn.jsdelivr.net/npm/three@0.140.0/examples/js/loaders/GLTFLoader.js';
  var dependencyPromise = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function reducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function loadScript(src, ready) {
    return new Promise(function (resolve, reject) {
      var selector = 'script[data-phoenix-model-cdn="' + src + '"]';
      var existing = document.querySelector(selector);
      if (existing) {
        if (ready()) resolve();
        else {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', reject, { once: true });
        }
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.phoenixModelCdn = src;
      script.addEventListener('load', function () {
        if (ready()) resolve();
        else reject(new Error('凤凰模型依赖加载完成但全局对象缺失'));
      }, { once: true });
      script.addEventListener('error', function () {
        reject(new Error('凤凰模型依赖加载失败'));
      }, { once: true });
      document.head.appendChild(script);
    });
  }

  function loadDependencies() {
    if (dependencyPromise) return dependencyPromise;
    var threeUrl = baseApi.cdn && baseApi.cdn.three
      ? baseApi.cdn.three
      : 'https://cdn.jsdelivr.net/npm/three@0.140.0/build/three.min.js';
    dependencyPromise = (global.THREE
      ? Promise.resolve()
      : loadScript(threeUrl, function () { return !!global.THREE; }))
      .then(function () {
        if (global.THREE && global.THREE.GLTFLoader) return null;
        return loadScript(LOADER_URL, function () {
          return !!(global.THREE && global.THREE.GLTFLoader);
        });
      })
      .then(function () {
        if (!global.THREE || !global.THREE.GLTFLoader) throw new Error('GLTFLoader 不可用');
        return global.THREE;
      });
    return dependencyPromise;
  }

  function makeGlowTexture(THREE) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    var context = canvas.getContext('2d');
    var gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,232,168,.9)');
    gradient.addColorStop(.22, 'rgba(255,111,39,.58)');
    gradient.addColorStop(.62, 'rgba(197,34,49,.14)');
    gradient.addColorStop(1, 'rgba(197,34,49,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    var texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function createParticleField(THREE, root, mobile) {
    // Keep the particles as a supporting ember field.  A smaller mobile
    // budget leaves the licensed model, touch input and page scroll plenty of
    // headroom, while desktop still gets a visible halo of embers.
    var count = mobile ? 64 : 220;
    var positions = new Float32Array(count * 3);
    var phases = new Float32Array(count);
    var speeds = new Float32Array(count);
    for (var i = 0; i < count; i += 1) {
      var angle = Math.random() * Math.PI * 2;
      var radius = .85 + Math.random() * 1.8;
      positions[i * 3] = Math.cos(angle) * radius * 1.2;
      positions[i * 3 + 1] = -.8 + Math.random() * 2.9;
      positions[i * 3 + 2] = (Math.random() - .5) * .7;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = .25 + Math.random() * .8;
    }
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var material = new THREE.PointsMaterial({
      color: 0xffad62,
      size: mobile ? .026 : .036,
      transparent: true,
      opacity: .52,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    var points = new THREE.Points(geometry, material);
    root.add(points);
    return { points: points, material: material, phases: phases, speeds: speeds };
  }

  function createModelScene(host, options, THREE) {
    options = options || {};
    var mobile = !!(global.matchMedia && global.matchMedia('(max-width: 760px)').matches);
    var reduced = reducedMotion();
    var width = Math.max(1, host.clientWidth || global.innerWidth);
    var height = Math.max(1, host.clientHeight || global.innerHeight);
    var ratio = Math.min(global.devicePixelRatio || 1, mobile ? 1.25 : 1.65);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(28, width / height, .1, 100);
    camera.position.set(0, .28, mobile ? 7.45 : 7.85);
    camera.lookAt(0, .2, 0);
    var renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !mobile,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    if (THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.domElement.className = 'phoenix-canvas phoenix-model-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);

    // Warm key + muted sage rim keep the bird in the same visual temperature
    // as the amber/coral page palette; the rim is an accent, not a second
    // cyan focal point.
    var ambient = new THREE.HemisphereLight(0xffdfbd, 0x2a211e, 1.65);
    scene.add(ambient);
    var keyLight = new THREE.PointLight(0xff8750, 3.55, 11, 2);
    keyLight.position.set(2.3, 2.8, 3.5);
    scene.add(keyLight);
    var rimLight = new THREE.PointLight(0x9bc1b2, 1.35, 9, 2);
    rimLight.position.set(-2.6, 1.2, -1.8);
    scene.add(rimLight);

    var root = new THREE.Group();
    // A slight desktop-left offset keeps the long tail away from the card's
    // right edge while leaving the bird centered on narrow screens.
    root.position.set(mobile ? 0 : -.1, .18, 0);
    scene.add(root);
    var aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(THREE),
      color: 0xff6a32,
      transparent: true,
      opacity: .33,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    aura.position.set(0, .25, -.7);
    aura.scale.set(4.1, 4.1, 1);
    root.add(aura);
    var halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.72, .012, 8, 96),
      new THREE.MeshBasicMaterial({
        color: 0xffa058,
        transparent: true,
        opacity: .22,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = .2;
    // The hero now keeps the Phoenix as the only visible focal object; the
    // former orbit ring is intentionally disabled.
    halo.visible = false;
    root.add(halo);
    var particles = createParticleField(THREE, root, mobile);

    var modelHolder = new THREE.Group();
    modelHolder.visible = false;
    root.add(modelHolder);
    var mixer = null;
    var action = null;
    var clipDuration = 0;
    var wingBones = [];
    var introRaf = 0;
    var introTimer = 0;
    var introSkipped = false;
    var lastActionScroll = -1;
    var modelReady = false;
    var modelScale = 1;
    var state = {
      pointerX: 0,
      pointerY: 0,
      targetX: 0,
      targetY: 0,
      energy: .72,
      dive: 0,
      wing: .18,
      baseY: .18,
      baseZ: 0,
      introY: -.72,
      introZ: .75,
      pulse: 0
    };
    var clock = new THREE.Clock();
    var visible = true;
    var paused = false;
    var destroyed = false;
    var raf = 0;
    var trigger = null;
    var scrollTarget = null;
    var scrollStart = null;
    var scrollDistance = 0;

    // The procedural fallback owns its own ScrollTrigger instance, but it is
    // removed as soon as the licensed GLB is ready.  Keep a small native
    // scroll driver here so the real model preserves the same "展翼 → 俯冲"
    // interaction even when GSAP is unavailable or still loading.
    function resolveScrollTarget() {
      var target = options.scrollTrigger;
      if (typeof target === 'string') target = document.querySelector(target);
      return target || host.closest('section') || host;
    }

    function readScrollDistance() {
      var configured = mobile && typeof options.scrollDistanceMobile === 'number'
        ? options.scrollDistanceMobile
        : (!mobile && typeof options.scrollDistanceDesktop === 'number'
          ? options.scrollDistanceDesktop
          : null);
      if (configured && configured > 0) return configured;
      if (typeof options.scrollDistance === 'number' && options.scrollDistance > 0) {
        return options.scrollDistance;
      }
      if (typeof options.scrollEnd === 'string') {
        var match = options.scrollEnd.match(/\+=([\d.]+)/);
        if (match) return Math.max(1, Number(match[1]));
      }
      return 1100;
    }

    function measureScrollRange() {
      scrollTarget = scrollTarget || resolveScrollTarget();
      if (!scrollTarget || !scrollTarget.getBoundingClientRect) return;
      var rect = scrollTarget.getBoundingClientRect();
      // Store the document-space start once.  Re-reading rect.top alone on
      // every scroll would cancel out pageYOffset and leave progress at zero.
      scrollStart = rect.top + (global.pageYOffset || global.scrollY || 0);
      var sectionHeight = scrollTarget.offsetHeight || rect.height || 0;
      var viewportAllowance = Math.min(120, Math.max(48, global.innerHeight * .16));
      var natural = Math.max(420, sectionHeight - viewportAllowance);
      scrollDistance = Math.max(1, Math.min(readScrollDistance(), natural));
    }

    function updateScrollProgress() {
      if (reduced || destroyed) return;
      scrollTarget = scrollTarget || resolveScrollTarget();
      if (!scrollTarget || !scrollTarget.getBoundingClientRect) return;
      var rect = scrollTarget.getBoundingClientRect();
      if (scrollStart == null || !scrollDistance) measureScrollRange();
      var absoluteTop = scrollStart == null
        ? rect.top + (global.pageYOffset || global.scrollY || 0)
        : scrollStart;
      var current = global.pageYOffset || global.scrollY || 0;
      setProgress(clamp((current - absoluteTop) / Math.max(1, scrollDistance), 0, 1));
    }

    function collectWingBones(model) {
      wingBones = [];
      if (!model || !model.traverse) return;
      model.traverse(function (object) {
        if (!object.isBone || !/wing/i.test(object.name || '')) return;
        var name = String(object.name || '');
        wingBones.push({
          bone: object,
          side: /left/i.test(name) ? -1 : 1,
          // The _0 and _9 joints are the two broad wing roots.  Feather
          // joints receive a smaller additive pose so the source animation
          // remains readable while the scroll gesture visibly opens the bird.
          weight: /_Wing_(0|9)_/i.test(name) ? 1 : .28,
          lastX: 0,
          lastY: 0,
          lastZ: 0
        });
      });
    }

    function syncWingAction() {
      if (!action || !clipDuration) return;
      var speed = .62 + state.dive * (mobile ? .62 : .95);
      if (action.setEffectiveTimeScale) action.setEffectiveTimeScale(speed);
      // Scrub to a scroll-dependent point only when the scroll value changes;
      // between gestures the original GLB animation keeps playing naturally.
      if (lastActionScroll < 0 || Math.abs(state.dive - lastActionScroll) > .006) {
        action.time = clipDuration * (.08 + state.dive * .78);
        lastActionScroll = state.dive;
      }
    }

    function applyWingPose(time) {
      if (!wingBones.length) return;
      var opening = clamp(state.wing, 0, 1.35) * (mobile ? .11 : .15);
      var pulse = state.pulse * (mobile ? .09 : .13);
      var flutter = reduced ? 0 : Math.sin(time * .0052) * (mobile ? .018 : .028);
      wingBones.forEach(function (entry) {
        var bone = entry.bone;
        // Remove the offset written on the previous frame.  The mixer has
        // already applied the GLB track for this frame, so this preserves the
        // authored animation instead of accumulating Euler rotations.
        bone.rotation.x -= entry.lastX;
        bone.rotation.y -= entry.lastY;
        bone.rotation.z -= entry.lastZ;
        var weight = entry.weight;
        var x = -entry.side * (opening + pulse) * weight + flutter * entry.side * weight;
        var z = entry.side * (opening * .48 + pulse * .72) * weight;
        bone.rotation.x += x;
        bone.rotation.z += z;
        entry.lastX = x;
        entry.lastY = 0;
        entry.lastZ = z;
      });
    }

    function normalizeModel(model) {
      var box = new THREE.Box3().setFromObject(model);
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());
      var maxDimension = Math.max(size.x, size.y, size.z, .001);
      // Leave generous breathing room inside the rounded hero card.  The
      // source mesh has a wide tail span, so using the full card height would
      // crop the wing tips on desktop and the tail on narrow screens.
      // The source bird has a very wide tail span.  A smaller normalized
      // footprint creates a safe margin for pointer movement on desktop.
      // Increase the current compact model by roughly 30% while keeping the
      // pointer-safe bounds introduced for desktop.
      var targetDimension = mobile ? 2.44 : 2.59;
      modelScale = targetDimension / maxDimension;
      model.scale.setScalar(modelScale);
      model.position.set(-center.x * modelScale, -center.y * modelScale, -center.z * modelScale);
      // The source model is a side-flying bird; a tiny yaw keeps the beak and
      // layered tail readable from the hero camera without flattening depth.
      model.rotation.y = -.08;
      model.rotation.x = .04;
      model.traverse(function (object) {
        if (!object.isMesh) return;
        object.frustumCulled = false;
        object.castShadow = false;
        object.receiveShadow = false;
        var materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(function (material) {
          if (!material) return;
          if (material.emissive && material.emissive.set) {
            material.emissive.set(0x2c0b08);
            material.emissiveIntensity = Math.max(Number(material.emissiveIntensity) || 0, .08);
          }
          if ('roughness' in material && !material.map) material.roughness = Math.min(Number(material.roughness) || .6, .62);
        });
      });
    }

    function setProgress(progress) {
      var p = clamp(progress, 0, 1);
      state.dive = p;
      // Use the whole visible hero interval for a clear, screen-space dive.
      // Desktop has a little more depth/tilt headroom than a phone card.
      state.wing = .18 + p * (mobile ? .86 : .98);
      state.baseY = .18 - p * (mobile ? .86 : .98);
      state.baseZ = p * (mobile ? .44 : .58);
      root.rotation.x = -.06 + p * (mobile ? .64 : .72);
      root.rotation.z = Math.sin(p * Math.PI) * (mobile ? -.12 : -.16);
      halo.rotation.z = p * .8;
      syncWingAction();
    }

    function burst() {
      state.pulse = 1;
      if (action) {
        action.reset();
        action.play();
        lastActionScroll = -1;
        syncWingAction();
      }
    }

    function skipIntro() {
      introSkipped = true;
      if (introTimer) {
        global.clearTimeout(introTimer);
        introTimer = 0;
      }
      state.introY = 0;
      state.introZ = 0;
      if (introRaf) {
        global.cancelAnimationFrame(introRaf);
        introRaf = 0;
      }
      if (action) {
        action.reset();
        action.play();
        lastActionScroll = -1;
        syncWingAction();
      }
    }

    function pointerMove(event) {
      var box = host.getBoundingClientRect();
      var x = clamp((event.clientX - box.left) / Math.max(1, box.width), 0, 1);
      var y = clamp((event.clientY - box.top) / Math.max(1, box.height), 0, 1);
      // Keep pointer motion expressive but bounded inside the stage safe zone.
      state.targetX = (x - .5) * 1.18;
      state.targetY = (y - .5) * -1.18;
      state.energy = clamp(1.1 - Math.hypot(x - .5, y - .48) * 1.55, .42, 1.2);
    }

    function pointerDown(event) {
      if (!options.clickable) return;
      var box = host.getBoundingClientRect();
      var x = (event.clientX - box.left) / Math.max(1, box.width) - .5;
      var y = (event.clientY - box.top) / Math.max(1, box.height) - .5;
      if ((x * x) / .2 + (y * y) / .34 < 1) burst();
    }

    function apply(time) {
      var dt = Math.min(.05, clock.getDelta());
      var ease = 1 - Math.pow(.001, dt);
      state.pointerX += (state.targetX - state.pointerX) * ease;
      state.pointerY += (state.targetY - state.pointerY) * ease;
      // Layered low-frequency drift gives the bird an organic, non-repeating
      // flight path instead of a rigid sine-wave translation.
      var driftX = reduced ? 0 : Math.sin(time * .00073 + .8) * .08 + Math.sin(time * .00161 + 2.4) * .035;
      var driftY = reduced ? 0 : Math.cos(time * .00059 + 1.3) * .075 + Math.sin(time * .00137 + .2) * .026;
      var idle = reduced ? 0 : Math.sin(time * .0013) * .025 + Math.sin(time * .00047 + 1.1) * .018;
      root.rotation.y = state.pointerX * (mobile ? .15 : .13) + idle + driftX * .18;
      root.rotation.x = -.06 + state.dive * (mobile ? .64 : .72) + state.pointerY * (mobile ? .075 : .06) + driftY * .12;
      root.position.x = (mobile ? 0 : -.1) + state.pointerX * (mobile ? .09 : .07) + driftX * .72;
      root.position.y = state.baseY + state.introY + state.pointerY * (mobile ? .09 : .07) + driftY;
      root.position.z = state.baseZ + state.introZ;
      if (state.pulse > 0) state.pulse = Math.max(0, state.pulse - dt * 2.1);
      var breathing = reduced ? 0 : Math.sin(time * .0021) * .022;
      var scale = 1.02 + breathing + state.pulse * .04;
      modelHolder.scale.setScalar(scale);
      particles.points.rotation.y += reduced ? 0 : dt * .16;
      aura.material.opacity = .22 + state.energy * .15 + state.pulse * .12;
      aura.scale.set(4.05 + breathing * 4, 4.05 + breathing * 4, 1);
      halo.material.opacity = .16 + state.energy * .11;
      particles.material.opacity = .44 + state.energy * .25;
      keyLight.intensity = 3.1 + state.energy * 1.5 + state.pulse * 1.1;
      if (action) syncWingAction();
      if (mixer && modelReady) mixer.update(dt);
      applyWingPose(time);
    }

    function render(time) {
      if (destroyed) return;
      if (visible && !paused) {
        apply(time);
        renderer.render(scene, camera);
      }
      if (!reduced) raf = global.requestAnimationFrame(render);
    }

    function resize() {
      width = Math.max(1, host.clientWidth || global.innerWidth);
      height = Math.max(1, host.clientHeight || global.innerHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, mobile ? 1.25 : 1.65));
      renderer.setSize(width, height, false);
      scrollStart = null;
      scrollDistance = 0;
    }

    host.addEventListener('pointermove', pointerMove, { passive: true });
    global.addEventListener('pointermove', pointerMove, { passive: true });
    global.addEventListener('pointerdown', pointerDown, { passive: true });
    global.addEventListener('resize', resize, { passive: true });
    if (!reduced) {
      global.addEventListener('scroll', updateScrollProgress, { passive: true });
      trigger = { kill: function () { global.removeEventListener('scroll', updateScrollProgress); } };
    }
    var observer = global.IntersectionObserver ? new IntersectionObserver(function (entries) {
      visible = !!entries[0] && entries[0].isIntersecting;
    }, { threshold: .01, rootMargin: '160px 0px' }) : { observe: function () {}, disconnect: function () {} };
    observer.observe(host);
    function onVisibility() { visible = !document.hidden; }
    document.addEventListener('visibilitychange', onVisibility);

    var cleaned = false;
    function disposeScene() {
      if (cleaned) return;
      cleaned = true;
      destroyed = true;
      if (raf) global.cancelAnimationFrame(raf);
      if (introRaf) global.cancelAnimationFrame(introRaf);
      if (introTimer) global.clearTimeout(introTimer);
      if (trigger && trigger.kill) trigger.kill();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      host.removeEventListener('pointermove', pointerMove);
      global.removeEventListener('pointermove', pointerMove);
      global.removeEventListener('pointerdown', pointerDown);
      global.removeEventListener('resize', resize);
      global.removeEventListener('scroll', updateScrollProgress);
      renderer.dispose();
      scene.traverse(function (object) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          var materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(function (material) {
            if (material.map) material.map.dispose();
            material.dispose();
          });
        }
      });
      if (renderer.domElement.parentNode) renderer.domElement.remove();
      wingBones = [];
    }

    var loader = new THREE.GLTFLoader();
    var modelPromise = new Promise(function (resolve, reject) {
      loader.load(options.modelUrl || MODEL_URL, function (gltf) {
        try {
          normalizeModel(gltf.scene);
          collectWingBones(gltf.scene);
          modelHolder.add(gltf.scene);
          modelHolder.visible = true;
          modelReady = true;
          if (gltf.animations && gltf.animations.length && !reduced) {
            mixer = new THREE.AnimationMixer(gltf.scene);
            action = mixer.clipAction(gltf.animations[0]);
            clipDuration = Number(gltf.animations[0].duration) || 0;
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
            lastActionScroll = -1;
            syncWingAction();
          }
          resolve(gltf);
        } catch (error) {
          disposeScene();
          reject(error);
        }
      }, undefined, function (error) {
        disposeScene();
        reject(error);
      });
    });

    if (!reduced) {
      var start = global.performance ? global.performance.now() : Date.now();
      function intro(now) {
        if (introSkipped || destroyed) {
          state.introY = 0;
          state.introZ = 0;
          introRaf = 0;
          return;
        }
        var progress = clamp((now - start) / 1500, 0, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        state.introY = -.72 * (1 - eased);
        state.introZ = .75 * (1 - eased);
        if (progress < 1 && !destroyed) introRaf = global.requestAnimationFrame(intro);
        else introRaf = 0;
      }
      introRaf = global.requestAnimationFrame(intro);
      // A background tab or an off-screen mobile WebView may throttle
      // requestAnimationFrame. The timer guarantees the entrance cannot stay
      // frozen in its preflight offset when the visitor starts scrolling.
      introTimer = global.setTimeout(function () {
        if (introSkipped || destroyed) return;
        if (introRaf) global.cancelAnimationFrame(introRaf);
        introRaf = 0;
        state.introY = 0;
        state.introZ = 0;
        introTimer = 0;
      }, 1900);
    } else {
      state.introY = 0;
      state.introZ = 0;
    }
    resize();
    setProgress(0);
    updateScrollProgress();
    render(0);

    return modelPromise.then(function () {
      updateScrollProgress();
      return {
        renderer: renderer,
        isModel: true,
        model: modelHolder,
        setProgress: setProgress,
        burst: burst,
        skipIntro: skipIntro,
        pause: function () { paused = true; },
        resume: function () {
          paused = false;
          updateScrollProgress();
          if (!reduced && !raf) render(global.performance ? global.performance.now() : Date.now());
        },
        isPaused: function () { return paused; },
        destroy: disposeScene
      };
    });
  }

  function mount(options) {
    options = options || {};
    var host = options.container;
    if (typeof host === 'string') host = document.querySelector(host);
    if (!host) return Promise.reject(new Error('PhoenixHero: 找不到容器元素。'));
    host.classList.add('phoenix-stage');
    if (options.clickable) host.classList.add('phoenix-stage--clickable');
    var reduced = reducedMotion();

    // A reduced-motion visitor should get the reliable static poster
    // immediately. Do not start loading a GLB or a second renderer that will
    // be disabled by the accessibility preference anyway.
    if (reduced && options.loadOnReducedMotion !== true) {
      host.classList.add('phoenix-model-fallback');
      return Promise.resolve(baseApi.mount(options)).catch(function () { return null; });
    }

    // Mark the page as soon as the model layer is requested.  The main page
    // uses this flag to avoid starting a second, full-screen WebGL fluid
    // simulation while the Phoenix scene is loading.
    global.__phoenixRequested = true;

    // Load the model loader first, then start the original scene.  This
    // ordering lets both scenes share one Three.js instance (and avoids a
    // second WebGL context) while the licensed model downloads.
    // Mount the lightweight poster first so a slow CDN or GLB download never
    // leaves the hero stage empty. The licensed model replaces it when ready.
    var fallbackPromise = Promise.resolve(baseApi.mount(options)).catch(function () { return null; });
    return loadDependencies().then(function (THREE) {
      return createModelScene(host, options, THREE).then(function (modelApi) {
        return fallbackPromise.then(function (fallbackApi) {
          if (fallbackApi && fallbackApi.destroy) fallbackApi.destroy();
          host.classList.add('phoenix-model-ready');
          return modelApi;
        });
      }).catch(function (error) {
        if (options.debug && global.console) console.warn('[PhoenixHero model]', error);
        host.classList.add('phoenix-model-fallback');
        return fallbackPromise;
      });
    }).catch(function (error) {
      if (options.debug && global.console) console.warn('[PhoenixHero model]', error);
      host.classList.add('phoenix-model-fallback');
      return Promise.resolve(baseApi.mount(options)).catch(function () { return null; });
    });
  }

  global.PhoenixHero = {
    mount: mount,
    cdn: baseApi.cdn,
    model: {
      title: 'phoenix bird',
      author: 'NORBERTO-3D',
      source: 'https://sketchfab.com/3d-models/phoenix-bird-844ba0cf144a413ea92c779f18912042',
      license: 'CC BY 4.0'
    }
  };
}(window));
