/*
 * Procedural Phoenix Hero
 * -------------------------------------------------------------------------
 * A dependency-light, model-free Three.js scene for the resume hero.  It is
 * deliberately shipped as an IIFE (rather than an ES module) so the page can
 * use it from a normal <script> tag on GitHub Pages.  Three.js, GSAP and
 * ScrollTrigger are loaded from jsDelivr only after mount.  If a CDN, WebGL,
 * or an older browser is unavailable, a 2D canvas poster remains visible.
 *
 * Usage (after including phoenix-prototype.css):
 *   <div id="phoenixStage" class="phoenix-stage" aria-label="凤凰视觉效果"></div>
 *   <script src="phoenix/phoenix-prototype.js"></script>
 *   <script>
 *     PhoenixHero.mount({
 *       container: '#phoenixStage',
 *       scrollTrigger: '#about',
 *       clickable: true
 *     });
 *   </script>
 *
 * The module exposes PhoenixHero.mount(options) and the returned destroy()
 * function.  No resume markup or CSS is changed by this file.
 */
(function (global) {
  'use strict';

  var CDN = {
    // Keep the classic Three.js build aligned with the GLTFLoader used by the
    // licensed Phoenix model layer. Mixing releases can make GLTF parsing fail
    // and silently switch the page to the procedural fallback poster.
    three: 'phoenix/vendor/three.min.js',
    gsap: 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
    scrollTrigger: 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js'
  };

  var dependencyPromise = null;

  function loadScript(src, ready) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-phoenix-cdn="' + src + '"]');
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
      script.dataset.phoenixCdn = src;
      script.addEventListener('load', function () {
        if (ready()) resolve();
        else reject(new Error('凤凰依赖加载完成但全局对象缺失: ' + src));
      }, { once: true });
      script.addEventListener('error', function () {
        reject(new Error('凤凰依赖加载失败: ' + src));
      }, { once: true });
      document.head.appendChild(script);
    });
  }

  function loadDependencies() {
    if (dependencyPromise) return dependencyPromise;
    dependencyPromise = (global.THREE ? Promise.resolve() : loadScript(CDN.three, function () { return !!global.THREE; }))
      .then(function () {
        return global.gsap ? Promise.resolve() : loadScript(CDN.gsap, function () { return !!global.gsap; });
      })
      .then(function () {
        return global.ScrollTrigger ? Promise.resolve() : loadScript(CDN.scrollTrigger, function () { return !!global.ScrollTrigger; });
      })
      .then(function () {
        return { THREE: global.THREE, gsap: global.gsap, ScrollTrigger: global.ScrollTrigger };
      });
    return dependencyPromise;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isReducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function makeFallbackPoster(host, reduced, options) {
    options = options || {};
    var canvas = document.createElement('canvas');
    canvas.className = 'phoenix-fallback-canvas';
    canvas.setAttribute('aria-label', '凤凰视觉海报');
    canvas.setAttribute('role', 'img');
    var label = document.createElement('span');
    label.className = 'phoenix-fallback-label';
    label.textContent = 'PHOENIX / KEEP EXPLORING';
    var poster = document.createElement('div');
    poster.className = 'phoenix-fallback-poster';
    poster.appendChild(canvas);
    poster.appendChild(label);
    host.appendChild(poster);

    var ctx = canvas.getContext('2d');
    var width = 0;
    var height = 0;
    var ratio = 1;
    var pointer = { x: .5, y: .45 };
    var start = global.performance ? global.performance.now() : Date.now();
    var raf = 0;
    var paused = false;
    var destroyed = false;
    var scrollProgress = 0;
    var scrollTarget = null;
    var scrollStart = null;
    var scrollDistance = 0;
    var mobile = !!(global.matchMedia && global.matchMedia('(max-width: 760px)').matches);
    var particles = Array.from({ length: 90 }, function (_, i) {
      return { phase: i * 2.31, radius: 0.18 + (i % 9) * .018, speed: .25 + (i % 7) * .04 };
    });

    function resize() {
      var box = host.getBoundingClientRect();
      width = Math.max(1, box.width || global.innerWidth);
      height = Math.max(1, box.height || global.innerHeight);
      ratio = Math.min(global.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function pathWing(side, cx, cy, scale, flare) {
      var s = side < 0 ? -1 : 1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, 1);
      ctx.rotate(-.08 + flare * .2);
      var gradient = ctx.createLinearGradient(0, -scale * .15, scale * 1.08, scale * .65);
      gradient.addColorStop(0, 'rgba(255,228,158,.95)');
      gradient.addColorStop(.5, 'rgba(255,116,52,.8)');
      gradient.addColorStop(1, 'rgba(186,27,47,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(scale * .46, -scale * .82, scale * 1.08, -scale * .7, scale * 1.2, -scale * .12);
      ctx.bezierCurveTo(scale * .98, scale * .12, scale * .68, scale * .46, scale * .15, scale * .62);
      ctx.bezierCurveTo(scale * .38, scale * .22, scale * .2, scale * .1, 0, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,186,95,.56)';
      ctx.lineWidth = Math.max(1, scale * .018);
      for (var i = 0; i < 7; i += 1) {
        ctx.beginPath();
        ctx.moveTo(scale * .08, scale * (.08 + i * .055));
        ctx.quadraticCurveTo(scale * (.42 + i * .08), scale * (-.38 + i * .04), scale * (1.04 - i * .09), scale * (-.1 + i * .1));
        ctx.stroke();
      }
      ctx.restore();
    }

    function draw(time) {
      var elapsed = (time - start) / 1000;
      var pulse = reduced ? 0 : Math.sin(elapsed * 1.4) * .04;
      var dive = scrollProgress * scrollProgress * (3 - 2 * scrollProgress);
      ctx.clearRect(0, 0, width, height);
      var cx = width * (.5 + (pointer.x - .5) * .025);
      var cy = height * (.51 + (pointer.y - .5) * .02 + dive * (mobile ? .14 : .19));
      var scale = Math.min(width, height) * (.3 + pulse + dive * .035);

      var glow = ctx.createRadialGradient(cx, cy, scale * .04, cx, cy, scale * 1.42);
      glow.addColorStop(0, 'rgba(255,154,61,.2)');
      glow.addColorStop(.6, 'rgba(236,57,54,.06)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // Keep the fallback visually tied to the same scroll story as the GLB:
      // the bird tilts and its wing span opens as the reader moves down.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dive * (mobile ? .18 : .28));
      ctx.translate(-cx, -cy);
      var flare = .35 + dive * .34 + (reduced ? 0 : Math.sin(elapsed * 1.2) * .12);
      var wingScale = 1.08 + dive * .12;
      pathWing(-1, cx - scale * .08, cy - scale * .03, scale * wingScale, flare);
      pathWing(1, cx + scale * .08, cy - scale * .03, scale * wingScale, flare);

      ctx.save();
      ctx.translate(cx, cy + scale * .24);
      var body = ctx.createRadialGradient(-scale * .1, -scale * .2, scale * .03, 0, 0, scale * .52);
      body.addColorStop(0, '#ffe6a9');
      body.addColorStop(.28, '#ff9a43');
      body.addColorStop(1, '#961e3b');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, scale * .24, scale * .46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffbf63';
      ctx.beginPath();
      ctx.arc(scale * .02, -scale * .42, scale * .16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#271324';
      ctx.beginPath();
      ctx.arc(scale * .08, -scale * .44, scale * .026, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd178';
      ctx.beginPath();
      ctx.moveTo(scale * .16, -scale * .39);
      ctx.lineTo(scale * .38, -scale * .32);
      ctx.lineTo(scale * .15, -scale * .28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      particles.forEach(function (particle) {
        var angle = particle.phase + elapsed * particle.speed;
        var distance = scale * particle.radius * (1 + Math.sin(angle * 1.3) * .12);
        var px = cx + Math.cos(angle) * distance * 1.45;
        var py = cy + Math.sin(angle) * distance * .82 + scale * .12;
        var alpha = .16 + (Math.sin(angle * 2) + 1) * .18;
        ctx.fillStyle = 'rgba(255,184,91,' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1, scale * .012), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      if (!reduced && !paused && !destroyed) raf = global.requestAnimationFrame(draw);
    }

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
      if (typeof options.scrollDistance === 'number' && options.scrollDistance > 0) return options.scrollDistance;
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
      scrollStart = rect.top + (global.pageYOffset || global.scrollY || 0);
      var sectionHeight = scrollTarget.offsetHeight || rect.height || 0;
      var allowance = Math.min(120, Math.max(48, global.innerHeight * .16));
      var natural = Math.max(420, sectionHeight - allowance);
      scrollDistance = Math.max(1, Math.min(readScrollDistance(), natural));
    }

    function setProgress(progress) {
      scrollProgress = clamp(progress, 0, 1);
    }

    function skipIntro() {
      // The poster has no separate entrance tween; keep its current scroll
      // position and simply redraw from the latest measured progress.
      updateScrollProgress();
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
      setProgress((current - absoluteTop) / Math.max(1, scrollDistance));
    }

    resize();
    if (!reduced) {
      global.addEventListener('scroll', updateScrollProgress, { passive: true });
      updateScrollProgress();
    }
    draw(start);
    function pointerMove(event) {
      var box = host.getBoundingClientRect();
      pointer.x = clamp((event.clientX - box.left) / Math.max(1, box.width), 0, 1);
      pointer.y = clamp((event.clientY - box.top) / Math.max(1, box.height), 0, 1);
    }
    global.addEventListener('pointermove', pointerMove, { passive: true });
    global.addEventListener('resize', resize, { passive: true });
    return {
      canvas: canvas,
      updatePointer: function (x, y) { pointer.x = x; pointer.y = y; },
      setProgress: setProgress,
      skipIntro: skipIntro,
      pause: function () {
        paused = true;
        if (raf) { global.cancelAnimationFrame(raf); raf = 0; }
      },
      resume: function () {
        paused = false;
        updateScrollProgress();
        if (!reduced && !raf) raf = global.requestAnimationFrame(draw);
      },
      isPaused: function () { return paused; },
      destroy: function () {
        destroyed = true;
        if (raf) global.cancelAnimationFrame(raf);
        global.removeEventListener('scroll', updateScrollProgress);
        global.removeEventListener('pointermove', pointerMove);
        global.removeEventListener('resize', resize);
        poster.remove();
      }
    };
  }

  function createScene(host, deps, options, reduced) {
    var THREE = deps.THREE;
    var gsap = deps.gsap;
    var ScrollTrigger = deps.ScrollTrigger;
    var width = Math.max(1, host.clientWidth || global.innerWidth);
    var height = Math.max(1, host.clientHeight || global.innerHeight);
    var mobile = global.matchMedia && global.matchMedia('(max-width: 760px)').matches;
    var ratio = Math.min(global.devicePixelRatio || 1, mobile ? 1.35 : 1.75);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(28, width / height, .1, 100);
    camera.position.set(0, .5, 7.2);
    camera.lookAt(0, .35, 0);
    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !mobile, powerPreference: 'high-performance' });
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.className = 'phoenix-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);

    // Use a warm key and a restrained sage rim so the fallback scene belongs
    // to the same amber/coral palette as the real Phoenix model.
    var ambient = new THREE.HemisphereLight(0xffdfb0, 0x2a211e, 1.62);
    scene.add(ambient);
    var keyLight = new THREE.PointLight(0xff8648, 3.7, 9, 2);
    keyLight.position.set(1.7, 2.6, 3.2);
    scene.add(keyLight);
    var rimLight = new THREE.PointLight(0x9bc1b2, 1.45, 8, 2);
    rimLight.position.set(-2.4, .8, -1.5);
    scene.add(rimLight);

    var root = new THREE.Group();
    root.position.set(0, .25, 0);
    scene.add(root);

    var flameMat = new THREE.MeshStandardMaterial({ color: 0x751d32, emissive: 0xd83c22, emissiveIntensity: 1.28, roughness: .38, metalness: .2 });
    var goldMat = new THREE.MeshStandardMaterial({ color: 0xffad43, emissive: 0xf45b20, emissiveIntensity: .92, roughness: .31, metalness: .28 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x2a1429, emissive: 0x5a1d2d, emissiveIntensity: .8, roughness: .42, metalness: .32 });
    var cyanMat = new THREE.MeshBasicMaterial({ color: 0xc8d7c3, transparent: true, opacity: .72 });

    function makeGlowTexture() {
      var glowCanvas = document.createElement('canvas');
      glowCanvas.width = glowCanvas.height = 128;
      var glowContext = glowCanvas.getContext('2d');
      var gradient = glowContext.createRadialGradient(64, 64, 2, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,226,153,.9)');
      gradient.addColorStop(.22, 'rgba(255,117,43,.6)');
      gradient.addColorStop(.62, 'rgba(218,42,43,.16)');
      gradient.addColorStop(1, 'rgba(218,42,43,0)');
      glowContext.fillStyle = gradient;
      glowContext.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(glowCanvas);
    }
    var aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xff6b32, transparent: true, opacity: .34, blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.position.set(0, .3, -.58);
    aura.scale.set(3.7, 3.7, 1);
    root.add(aura);

    var body = new THREE.Mesh(new THREE.SphereGeometry(.64, 24, 18), flameMat);
    body.scale.set(.68, 1.08, .62);
    body.position.y = -.05;
    root.add(body);
    var chest = new THREE.Mesh(new THREE.SphereGeometry(.4, 20, 16), goldMat);
    chest.scale.set(.74, .96, .46);
    chest.position.set(0, .12, .54);
    root.add(chest);

    var neck = new THREE.Mesh(new THREE.CylinderGeometry(.18, .3, .52, 16), goldMat);
    neck.position.set(0, .8, .08);
    neck.rotation.z = -.04;
    root.add(neck);
    var head = new THREE.Mesh(new THREE.SphereGeometry(.32, 20, 16), goldMat);
    head.position.set(0, 1.12, .2);
    head.scale.set(1.05, .9, .95);
    root.add(head);
    var beak = new THREE.Mesh(new THREE.ConeGeometry(.105, .46, 5), goldMat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(.38, 1.08, .23);
    root.add(beak);
    var eyeGeo = new THREE.SphereGeometry(.045, 10, 8);
    var eyeL = new THREE.Mesh(eyeGeo, cyanMat);
    eyeL.position.set(.22, 1.19, .47);
    var eyeR = eyeL.clone();
    eyeR.position.z = .02;
    root.add(eyeL, eyeR);

    // Crest: three small flames give the head a recognizable phoenix profile.
    for (var c = 0; c < 3; c += 1) {
      var crest = new THREE.Mesh(new THREE.ConeGeometry(.085 - c * .01, .4 - c * .055, 5), flameMat);
      crest.position.set(-.1 + c * .1, 1.42 + (c % 2) * .025, .17);
      crest.rotation.z = -.28 + c * .12;
      root.add(crest);
    }

    // A feather is an extruded curved silhouette instead of a cone.  The
    // front-facing profile reads clearly at small sizes while the shallow
    // extrusion still catches Three.js lighting when the pointer moves.
    function makeFeather(length, width, depth) {
      var shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.bezierCurveTo(width * .62, length * .12, width * 1.05, length * .54, width * .72, length * .82);
      shape.bezierCurveTo(width * .52, length * 1.02, width * .16, length * 1.06, 0, length);
      shape.bezierCurveTo(-width * .16, length * 1.06, -width * .52, length * 1.02, -width * .72, length * .82);
      shape.bezierCurveTo(-width * 1.05, length * .54, -width * .62, length * .12, 0, 0);
      var geometry = new THREE.ExtrudeGeometry(shape, { depth: depth || .045, bevelEnabled: false, curveSegments: 3 });
      geometry.translate(0, -length * .08, -(depth || .045) * .5);
      return geometry;
    }

    function buildWing(side) {
      var wing = new THREE.Group();
      wing.position.set(side * .43, .7, .02);
      wing.rotation.z = side * -.22;
      wing.rotation.y = side * -.1;
      var fan = new THREE.Group();
      wing.add(fan);
      var featherCount = mobile ? 6 : 8;
      for (var i = 0; i < featherCount; i += 1) {
        var length = 1.34 - i * .07;
        var feather = new THREE.Mesh(makeFeather(length, .125 - i * .004, .052), i % 2 ? flameMat : goldMat);
        feather.position.set(side * (i * .22 + .1), .08 - i * .04, -.04 - i * .018);
        // Point the feather fan out to either side; the group rotation below
        // then supplies the small breathing/flap motion.
        feather.rotation.z = side * (-1.28 + i * .105);
        feather.rotation.x = -.1 + i * .028;
        feather.scale.x = side;
        fan.add(feather);
      }
      var membraneShape = new THREE.Shape();
      membraneShape.moveTo(0, 0);
      membraneShape.quadraticCurveTo(.58, .36, 1.3, .14);
      membraneShape.quadraticCurveTo(1.0, .56, .24, .68);
      membraneShape.quadraticCurveTo(.12, .42, 0, 0);
      var membrane = new THREE.Mesh(new THREE.ExtrudeGeometry(membraneShape, { depth: .022, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0x8a2030, emissive: 0x4d142b, emissiveIntensity: .9, transparent: true, opacity: .34, side: THREE.DoubleSide, roughness: .45 }));
      membrane.position.set(side * .08, -.02, -.055);
      membrane.scale.x = side;
      fan.add(membrane);
      // A thin shoulder ring catches the rim light when the wing opens.
      var shoulder = new THREE.Mesh(new THREE.TorusGeometry(.34, .025, 7, 24, Math.PI * 1.28), cyanMat);
      shoulder.rotation.y = Math.PI / 2;
      shoulder.position.set(side * .08, .02, .28);
      wing.add(shoulder);
      root.add(wing);
      return { group: wing, fan: fan };
    }

    var wingLeft = buildWing(-1);
    var wingRight = buildWing(1);

    var tail = new THREE.Group();
    tail.position.set(0, -.78, -.12);
    for (var t = 0; t < 7; t += 1) {
      var tailLength = 1.42 - Math.abs(t - 3) * .09;
      var tailFeather = new THREE.Mesh(makeFeather(tailLength, .15, .045), t % 2 ? darkMat : flameMat);
      tailFeather.position.set((t - 3) * .14, -.28 + Math.abs(t - 3) * .05, -.12 - Math.abs(t - 3) * .05);
      tailFeather.rotation.z = Math.PI + (t - 3) * .07;
      tailFeather.rotation.x = -.08;
      tailFeather.scale.x = .9;
      tail.add(tailFeather);
    }
    root.add(tail);

    var halo = new THREE.Mesh(new THREE.TorusGeometry(1.72, .012, 8, 96), new THREE.MeshBasicMaterial({ color: 0xff9b54, transparent: true, opacity: .28, blending: THREE.AdditiveBlending }));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = .3;
    root.add(halo);

    // Fire / feather motes.  Keep the count modest on mobile to avoid a second
    // expensive full-screen simulation next to the existing fluid background.
    var configuredCount = mobile ? options.mobileParticleCount : options.desktopParticleCount;
    var particleCount = Math.round(clamp(Number(configuredCount) || (mobile ? 96 : 360), 48, 700));
    var positions = new Float32Array(particleCount * 3);
    var phases = new Float32Array(particleCount);
    var speeds = new Float32Array(particleCount);
    for (var p = 0; p < particleCount; p += 1) {
      var angle = Math.random() * Math.PI * 2;
      var radius = .9 + Math.random() * 1.75;
      positions[p * 3] = Math.cos(angle) * radius;
      positions[p * 3 + 1] = -.45 + Math.random() * 2.25;
      positions[p * 3 + 2] = (Math.random() - .5) * .8;
      phases[p] = Math.random() * Math.PI * 2;
      speeds[p] = .25 + Math.random() * .8;
    }
    var particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var particleMat = new THREE.PointsMaterial({ color: 0xffad62, size: mobile ? .028 : .038, transparent: true, opacity: .58, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    var particles = new THREE.Points(particleGeo, particleMat);
    root.add(particles);

    var state = {
      // Start open for an immediate first impression; scroll adds the dive.
      wing: .68,
      dive: 0,
      energy: .7,
      pointerX: 0,
      pointerY: 0,
      targetX: 0,
      targetY: 0,
      scroll: 0,
      baseY: .25,
      baseZ: 0,
      introY: 0,
      introZ: 0
    };
    var targetPointer = { x: 0, y: 0 };
    var clock = new THREE.Clock();
    var visible = true;
    var pausedByUser = false;
    var raf = 0;
    var destroyed = false;
    var trigger = null;
    var scrollTarget = null;
    var scrollStart = null;
    var scrollDistance = 0;
    var introTween = null;
    var wingTween = null;
    var scaleTween = null;
    var introSkipped = false;
    var scrollGestureStarted = false;

    function setProgress(progress) {
      var p = clamp(progress, 0, 1);
      if (p > .006 && !scrollGestureStarted) {
        scrollGestureStarted = true;
        // Hand ownership of the wing pose to the scroll driver as soon as
        // the reader moves; the entrance tween must not overwrite it.
        if (wingTween && wingTween.kill) wingTween.kill();
      }
      state.scroll = p;
      // The first half is a controlled opening; the second half tilts the bird
      // into a graceful downward dive while keeping the face in view.
      state.wing = .68 + p * (mobile ? .44 : .56);
      state.dive = p;
      state.baseY = .25 - p * (mobile ? .86 : .98);
      state.baseZ = p * (mobile ? .44 : .58);
      root.rotation.x = -.09 + p * (mobile ? .64 : .72);
      root.rotation.z = Math.sin(p * Math.PI) * (mobile ? -.12 : -.16);
      halo.rotation.z = p * .8;
    }

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
      if (typeof options.scrollDistance === 'number' && options.scrollDistance > 0) return options.scrollDistance;
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
      scrollStart = rect.top + (global.pageYOffset || global.scrollY || 0);
      var sectionHeight = scrollTarget.offsetHeight || rect.height || 0;
      var allowance = Math.min(120, Math.max(48, global.innerHeight * .16));
      var natural = Math.max(420, sectionHeight - allowance);
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
      setProgress((current - absoluteTop) / Math.max(1, scrollDistance));
    }

    function skipIntro() {
      introSkipped = true;
      if (scaleTween && scaleTween.progress) scaleTween.progress(1).kill();
      if (introTween && introTween.progress) introTween.progress(1).kill();
      if (wingTween && wingTween.progress) wingTween.progress(1).kill();
      state.introY = 0;
      state.introZ = 0;
      root.scale.set(1, 1, 1);
      state.wing = Math.max(state.wing, .68 + state.dive * (mobile ? .44 : .56));
    }

    function applyInteraction(time) {
      var dt = Math.min(.05, clock.getDelta());
      var ease = 1 - Math.pow(.001, dt);
      state.pointerX += (targetPointer.x - state.pointerX) * ease;
      state.pointerY += (targetPointer.y - state.pointerY) * ease;
      var idle = reduced ? 0 : Math.sin(time * .0014) * .035;
      root.rotation.y = state.pointerX * .27 + idle;
      // Recompute from the scroll base every frame; adding here would make
      // the bird slowly spin out of control after a few seconds.
      root.rotation.x = -.09 + state.dive * (mobile ? .64 : .72) + state.pointerY * .12;
      root.position.x = state.pointerX * .16;
      // Pointer Y adds a restrained vertical parallax: moving the cursor or
      // dragging down on a phone nudges the phoenix into the dive path.
      root.position.y = state.baseY + state.introY + state.pointerY * .16;
      root.position.z = state.baseZ + state.introZ;
      var wingOpen = state.wing + (reduced ? 0 : Math.sin(time * .006) * .035);
      wingLeft.group.rotation.z = -.1 - wingOpen * .22;
      wingRight.group.rotation.z = .1 + wingOpen * .22;
      wingLeft.fan.rotation.y = -.05 + state.pointerX * .08;
      wingRight.fan.rotation.y = .05 + state.pointerX * .08;
      wingLeft.fan.rotation.x = state.pointerY * .06;
      wingRight.fan.rotation.x = state.pointerY * .06;
      chest.scale.y = 1.12 + (reduced ? 0 : Math.sin(time * .002) * .025);
      particles.rotation.y += reduced ? 0 : dt * .18;
      halo.material.opacity = .2 + state.energy * .14;
      particleMat.opacity = .5 + state.energy * .3;
      aura.material.opacity = .23 + state.energy * .16;
      var auraPulse = 3.62 + (reduced ? 0 : Math.sin(time * .0022) * .12);
      aura.scale.set(auraPulse, auraPulse, 1);
      keyLight.intensity = 3.2 + state.energy * 1.9;
    }

    function render(time) {
      if (destroyed) return;
      if (visible && !pausedByUser) {
        applyInteraction(time);
        renderer.render(scene, camera);
      }
      if (!reduced) raf = global.requestAnimationFrame(render);
    }

    function resize() {
      width = Math.max(1, host.clientWidth || global.innerWidth);
      height = Math.max(1, host.clientHeight || global.innerHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, mobile ? 1.35 : 1.75));
      renderer.setSize(width, height, false);
      scrollStart = null;
      scrollDistance = 0;
    }

    function pointerMove(event) {
      var box = host.getBoundingClientRect();
      var x = clamp((event.clientX - box.left) / Math.max(1, box.width), 0, 1);
      var y = clamp((event.clientY - box.top) / Math.max(1, box.height), 0, 1);
      targetPointer.x = (x - .5) * 2;
      targetPointer.y = (y - .5) * -2;
      var distance = Math.sqrt(Math.pow(x - .5, 2) + Math.pow(y - .48, 2));
      state.energy = clamp(1.12 - distance * 1.6, .42, 1.2);
    }

    function clickWing() {
      if (reduced || !gsap) return;
      gsap.timeline({ defaults: { ease: 'power2.out' } })
        .to(state, { wing: 1.12, duration: .42 })
        .to(state, { wing: .54, duration: .85, ease: 'elastic.out(1,.45)' });
    }

    // A light hit-area check keeps the effect clickable even when the resume
    // copy is layered above the canvas.  It approximates the bird's central
    // silhouette instead of intercepting every page click.
    function pointerDown(event) {
      if (!options.clickable) return;
      var box = host.getBoundingClientRect();
      var x = (event.clientX - box.left) / Math.max(1, box.width) - .5;
      var y = (event.clientY - box.top) / Math.max(1, box.height) - .5;
      if ((x * x) / .18 + (y * y) / .3 < 1) clickWing();
    }

    // Listen on window as well as the host: the stage is pointer-events:none
    // by default so links and buttons below it remain accessible.
    host.addEventListener('pointermove', pointerMove, { passive: true });
    global.addEventListener('pointermove', pointerMove, { passive: true });
    global.addEventListener('pointerdown', pointerDown, { passive: true });
    global.addEventListener('resize', resize, { passive: true });

    var observer = global.IntersectionObserver ? new IntersectionObserver(function (entries) {
      visible = !!entries[0] && entries[0].isIntersecting;
    }, { threshold: 0.01, rootMargin: '160px 0px' }) : { observe: function () {}, disconnect: function () {} };
    observer.observe(host);
    function visibilityChange() { visible = !document.hidden; }
    document.addEventListener('visibilitychange', visibilityChange);

    if (gsap) {
      scaleTween = gsap.fromTo(root.scale, { x: .58, y: .58, z: .58 }, { x: 1, y: 1, z: 1, duration: reduced ? 0 : 1.55, ease: 'power3.out' });
      // Animate an additive intro offset so ScrollTrigger and pointer parallax
      // can keep owning the base position throughout the entrance.
      introTween = gsap.fromTo(state, { introY: -.83, introZ: .85 }, { introY: 0, introZ: 0, duration: reduced ? 0 : 1.8, ease: 'power3.out' });
      wingTween = gsap.fromTo(state, { wing: .08 }, { wing: .62, duration: reduced ? 0 : 1.65, ease: 'power2.out' });
    }

    // A native driver is intentionally used even when GSAP/ScrollTrigger is
    // present.  It measures the real hero section and keeps the model and the
    // procedural fallback on the same desktop/mobile flight path.
    if (!reduced) {
      global.addEventListener('scroll', updateScrollProgress, { passive: true });
      trigger = { kill: function () { global.removeEventListener('scroll', updateScrollProgress); } };
    }

    resize();
    setProgress(0);
    updateScrollProgress();
    render(0);
    return {
      renderer: renderer,
      setProgress: setProgress,
      burst: clickWing,
      skipIntro: skipIntro,
      pause: function () { pausedByUser = true; },
      resume: function () {
        pausedByUser = false;
        updateScrollProgress();
        if (!reduced && !raf) render(global.performance ? global.performance.now() : Date.now());
      },
      isPaused: function () { return pausedByUser; },
      destroy: function () {
        destroyed = true;
        if (raf) global.cancelAnimationFrame(raf);
        if (trigger && trigger.kill) trigger.kill();
        observer.disconnect();
        document.removeEventListener('visibilitychange', visibilityChange);
        global.removeEventListener('resize', resize);
        host.removeEventListener('pointermove', pointerMove);
        global.removeEventListener('pointermove', pointerMove);
        global.removeEventListener('pointerdown', pointerDown);
        renderer.dispose();
        scene.traverse(function (object) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            var materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach(function (material) { if (material.map) material.map.dispose(); material.dispose(); });
          }
        });
        renderer.domElement.remove();
      }
    };
  }

  function mount(options) {
    options = options || {};
    var host = options.container;
    if (typeof host === 'string') host = document.querySelector(host);
    if (!host) return Promise.reject(new Error('PhoenixHero: 找不到容器元素。'));
    // Tell the background layer that this page is opting into a primary
    // WebGL scene. The resume keeps its lightweight 2D flow instead of
    // creating a second full-screen WebGL context on mobile devices.
    global.__phoenixRequested = true;
    host.classList.add('phoenix-stage');
    if (options.clickable) host.classList.add('phoenix-stage--clickable');
    var reduced = isReducedMotion();
    var fallback = makeFallbackPoster(host, reduced, options);
    var mounted = {
      renderer: null,
      burst: function () {},
      skipIntro: function () { if (fallback && fallback.skipIntro) fallback.skipIntro(); },
      pause: function () { if (fallback && fallback.pause) fallback.pause(); },
      resume: function () { if (fallback && fallback.resume) fallback.resume(); },
      isPaused: function () { return fallback && fallback.isPaused ? fallback.isPaused() : false; },
      destroy: function () { fallback.destroy(); }
    };
    // Respect the operating system's reduced-motion preference without
    // downloading a renderer that will never animate.
    if (reduced && options.loadOnReducedMotion !== true) return Promise.resolve(mounted);
    return loadDependencies().then(function (deps) {
      if (!deps.THREE || !global.WebGLRenderingContext) throw new Error('当前浏览器不支持 WebGL');
      // Construct first; if WebGL creation fails, the poster is still intact.
      var sceneInstance = createScene(host, deps, options, reduced);
      fallback.destroy();
      mounted = sceneInstance;
      host.classList.toggle('is-static', reduced);
      return mounted;
    }).catch(function (error) {
      // Keep the poster in place; logging is intentionally quiet in production.
      host.querySelectorAll('.phoenix-canvas').forEach(function (canvas) { canvas.remove(); });
      if (options.debug && global.console) console.warn('[PhoenixHero]', error);
      return mounted;
    });
  }

  global.PhoenixHero = { mount: mount, cdn: CDN };
}(window));
