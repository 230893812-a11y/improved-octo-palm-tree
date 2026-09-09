const root = document.body;
const themeToggle = document.querySelector('#themeToggle');
const printResume = document.querySelector('#printResume');
const copyEmail = document.querySelector('#copyEmail');
const toast = document.querySelector('#toast');
const readerMode = document.querySelector('#readerMode');

const savedTheme = localStorage.getItem('resume-theme');
if (savedTheme === 'dark') root.classList.add('dark');
themeToggle.addEventListener('click', () => {
  root.classList.toggle('dark');
  localStorage.setItem('resume-theme', root.classList.contains('dark') ? 'dark' : 'light');
});

printResume.addEventListener('click', () => window.print());

copyEmail.addEventListener('click', async () => {
  const email = '230893812@qq.com';
  try { await navigator.clipboard.writeText(email); } catch { /* 兼容不支持剪贴板 API 的浏览器 */ }
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
});

readerMode?.addEventListener('click', () => {
  const enabled = root.classList.toggle('reader-mode');
  readerMode.setAttribute('aria-pressed', String(enabled));
  readerMode.textContent = enabled ? '视觉模式' : '阅读模式';
  if (enabled) document.querySelector('#experience')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// 首屏承担视觉记忆，进入正文后自动降低流体背景，让老师更容易阅读。
const aboutSection = document.querySelector('#about');
if (aboutSection && 'IntersectionObserver' in window) {
  const focusObserver = new IntersectionObserver(([entry]) => {
    root.classList.toggle('content-focus', !entry.isIntersecting);
  }, { threshold: 0.18 });
  focusObserver.observe(aboutSection);
}

document.querySelectorAll('.nav a, .brand, .primary-button').forEach(link => {
  link.addEventListener('click', () => document.querySelector('.nav')?.classList.remove('open'));
});

// 证书筛选：默认展厅突出代表性证书，完整列表仍可展开查看。
const filterButtons = [...document.querySelectorAll('.filter-button')];
const certificateCards = [...document.querySelectorAll('.cert-card')];
certificateCards.forEach(card => {
  const label = card.querySelector('.cert-meta small');
  if (!label) return;
  const text = label.textContent;
  label.dataset.level = text.includes('官方认证') ? 'official' : (text.includes('课程结业') ? 'course' : 'platform');
});
filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filterButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    certificateCards.forEach(card => {
      card.hidden = filter !== 'all' && card.dataset.category !== filter;
    });
  });
});

// 图片灯箱：证书、兴趣照片和底部二维码均可点击查看高清版本。
const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightboxImage');
const lightboxCaption = document.querySelector('#lightboxCaption');
const lightboxItems = [...document.querySelectorAll('a[data-lightbox]')];
let lightboxGroup = [];
let lightboxIndex = 0;

function itemTitle(item) {
  return item.querySelector('.cert-meta b, .media-caption b')?.textContent.trim() || item.querySelector('img')?.alt || '素材预览';
}
function showLightbox(index) {
  if (!lightboxGroup.length) return;
  lightboxIndex = (index + lightboxGroup.length) % lightboxGroup.length;
  const item = lightboxGroup[lightboxIndex];
  lightboxImage.src = item.href;
  lightboxImage.alt = item.querySelector('img')?.alt || itemTitle(item);
  lightboxCaption.textContent = `${itemTitle(item)} · ${lightboxIndex + 1} / ${lightboxGroup.length}`;
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  lightboxImage.removeAttribute('src');
  document.body.style.overflow = '';
}
lightboxItems.forEach(item => {
  item.addEventListener('click', event => {
    event.preventDefault();
    lightboxGroup = lightboxItems.filter(candidate => candidate.dataset.lightbox === item.dataset.lightbox && !candidate.hidden);
    showLightbox(lightboxGroup.indexOf(item));
  });
});
document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
document.querySelector('.lightbox-prev').addEventListener('click', () => showLightbox(lightboxIndex - 1));
document.querySelector('.lightbox-next').addEventListener('click', () => showLightbox(lightboxIndex + 1));
lightbox.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', event => {
  if (!lightbox.classList.contains('open')) return;
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'ArrowLeft') showLightbox(lightboxIndex - 1);
  if (event.key === 'ArrowRight') showLightbox(lightboxIndex + 1);
});

// 视频封面点击即播放：保留原生 controls，同时为触摸设备补一层明确的
// 点击行为。若浏览器仍要求用户授权，失败会静默交给原生控件处理。
document.querySelectorAll('.video-card video').forEach(video => {
  video.addEventListener('click', event => {
    if (!video.paused) return;
    if (!video.querySelector('source')) {
      const source = document.createElement('source');
      source.src = video.dataset.videoSrc || '';
      source.type = 'video/mp4';
      video.appendChild(source);
      video.load();
    }
    // Prevent the native click toggle from immediately undoing the play()
    // call below (this is especially noticeable on Chromium touch views).
    event.preventDefault();
    const start = () => {
      if (!video.paused) return;
      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
    };
    start();
    // Some Chromium builds run the media element's native toggle after the
    // event listener, so retry on the next task to keep the cover gesture
    // deterministic without removing the native controls.
    window.setTimeout(start, 0);
  });
});

// 轻量流动背景：光斑会跟随鼠标缓慢漂移，手机端则自动循环。
const canvas = document.querySelector('#fluidFallback');
const context = canvas?.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let fluidRaf = 0;
let fluidRunning = true;
let fluidLastFrame = 0;
let advancedFluid = null;
let advancedFluidPaused = false;
const pointer = { x: 0.5, y: 0.45, active: false };
const blobs = [
  { color: [235, 106, 82], size: 0.44, x: 0.16, y: 0.19, phase: 0.2 },
  { color: [246, 201, 94], size: 0.5, x: 0.82, y: 0.26, phase: 2.1 },
  { color: [142, 209, 209], size: 0.56, x: 0.52, y: 0.86, phase: 4.2 }
];
let canvasWidth = 0;
let canvasHeight = 0;
function resizeCanvas() {
  if (!canvas || !context) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  canvas.width = canvasWidth * ratio;
  canvas.height = canvasHeight * ratio;
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}
function drawFluid(time = 0) {
  if (!canvas || !context) return;
  if (time && time - fluidLastFrame < 33) {
    fluidRaf = window.requestAnimationFrame(drawFluid);
    return;
  }
  fluidLastFrame = time;
  fluidRaf = 0;
  const paused = !fluidRunning || root.classList.contains('motion-paused');
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  const base = Math.min(canvasWidth, canvasHeight);
  blobs.forEach((blob, index) => {
    // Keep the ambient motion broad and unhurried so it supports the phoenix
    // instead of competing with it. Pointer response remains perceptible,
    // but no longer creates abrupt colour splashes behind the copy.
    const drift = (reduceMotion || paused) ? 0 : Math.sin(time * 0.00008 + blob.phase) * 0.032;
    const pointerPull = pointer.active ? 0.055 : 0.018;
    const x = (blob.x + drift + (pointer.x - 0.5) * pointerPull * (index % 2 ? 1 : -1)) * canvasWidth;
    const y = (blob.y + Math.cos(time * 0.00007 + blob.phase) * ((reduceMotion || paused) ? 0 : 0.024) + (pointer.y - 0.5) * pointerPull) * canvasHeight;
    const radius = base * blob.size;
    const [r, g, b] = blob.color;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${r},${g},${b},.19)`);
    gradient.addColorStop(.42, `rgba(${r},${g},${b},.08)`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  });
  if (!reduceMotion && fluidRunning) fluidRaf = window.requestAnimationFrame(drawFluid);
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('pointermove', event => {
  pointer.x = event.clientX / window.innerWidth;
  pointer.y = event.clientY / window.innerHeight;
  pointer.active = true;
});
resizeCanvas();
drawFluid(0);

// 性能优先：不再加载额外的 WebGL 流体库，保留本地低负载 Canvas 背景。
const advancedCanvas = document.querySelector('#fluidCanvas');
const smallScreen = window.matchMedia?.('(max-width: 760px)').matches;
if (advancedCanvas && false && (!window.__phoenixRequested || !smallScreen)) {
  window.addEventListener('pointermove', event => {
    // 库默认监听 canvas 的 mousemove；由于背景不能拦截页面点击，这里把窗口事件安全转发给它。
    advancedCanvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: event.clientX, clientY: event.clientY, bubbles: false
    }));
  }, { passive: true });
  // v0.6.1 exposes the simulation(canvas, options) API used below.  Newer
  // releases use a class-based API, so pin this compatible MIT version for
  // a stable static-page deployment.
  import('https://esm.run/webgl-fluid-enhanced@0.6.1').then(module => {
    const fluid = module.default || module;
    advancedFluid = fluid;
    fluid.simulation(advancedCanvas, {
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 640,
      TRANSPARENT: true,
      HOVER: true,
      SHADING: true,
      BLOOM: true,
      BLOOM_INTENSITY: 0.3,
      BLOOM_THRESHOLD: 0.82,
      SUNRAYS: false,
      SPLAT_RADIUS: 0.1,
      SPLAT_FORCE: 2200,
      VELOCITY_DISSIPATION: 0.975,
      DENSITY_DISSIPATION: 0.985,
      COLOR_UPDATE_SPEED: 3,
      BRIGHTNESS: 0.38,
      COLOR_PALETTE: ['#d96f52', '#e7b85e', '#9bb9ae', '#5b4b47'],
      BACK_COLOR: '#f7f4ee'
    });
    advancedCanvas.classList.remove('is-hidden');
    canvas?.classList.add('is-hidden');
    document.body.classList.add('advanced-fluid-ready');
    if (root.classList.contains('motion-paused')) setAmbientMotion(true);
  }).catch(() => {
    // CDN 不可用或浏览器不支持 WebGL 时，保留本地 Canvas 背景。
    advancedCanvas.classList.add('is-hidden');
  });
}

// The existing Phoenix pause control also quiets the ambient layers.  The
// custom event keeps this bridge independent from the Phoenix implementation
// (model or fallback), while the optional library pause API prevents the
// desktop WebGL simulation from continuing to render in the background.
function setAmbientMotion(paused) {
  fluidRunning = !paused;
  root.classList.toggle('motion-paused', paused);
  if (paused && fluidRaf) {
    window.cancelAnimationFrame(fluidRaf);
    fluidRaf = 0;
  } else if (!paused && !reduceMotion && !fluidRaf) {
    fluidRaf = window.requestAnimationFrame(drawFluid);
  }
  if (advancedFluid && typeof advancedFluid.pause === 'function' && advancedFluidPaused !== paused) {
    advancedFluid.pause();
    advancedFluidPaused = paused;
  }
}
window.addEventListener('resume-motion-state', event => setAmbientMotion(Boolean(event.detail?.paused)));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (fluidRaf) window.cancelAnimationFrame(fluidRaf);
    fluidRaf = 0;
  } else if (!reduceMotion && fluidRunning && !fluidRaf) {
    fluidRaf = window.requestAnimationFrame(drawFluid);
  }
});
const phoenixToggle = document.querySelector('#phoenixToggle');
if (phoenixToggle) {
  const syncPhoenixPause = () => setAmbientMotion(phoenixToggle.getAttribute('aria-pressed') === 'true');
  phoenixToggle.addEventListener('click', () => window.setTimeout(syncPhoenixPause, 0));
  // Also catch state changes made by the loading/fallback controller without
  // requiring a second click handler.
  new MutationObserver(syncPhoenixPause).observe(phoenixToggle, { attributes: true, attributeFilter: ['aria-pressed'] });
  syncPhoenixPause();
}

// 右下角音乐播放器：尝试自动播放（浏览器若拦截，会提示用户点击），
// 同时支持播放 / 暂停和拖动进度。
const musicPlayer = document.querySelector('#musicPlayer');
const musicAudio = document.querySelector('#musicAudio');
const musicToggle = document.querySelector('#musicToggle');
const musicProgress = document.querySelector('#musicProgress');
const musicCurrent = document.querySelector('#musicCurrent');
const musicDuration = document.querySelector('#musicDuration');
const musicStatus = document.querySelector('#musicStatus');
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}
function updateMusicState(playing) {
  musicPlayer.classList.toggle('playing', playing);
  musicPlayer.classList.toggle('muted', playing && musicAudio.muted);
  musicToggle.setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
  musicToggle.title = playing ? '暂停音乐' : '播放音乐';
  if (playing && musicAudio.muted) {
    musicToggle.setAttribute('aria-label', '开启音乐声音');
    musicToggle.title = '开启音乐声音';
    musicStatus.textContent = '静音自动播放 · 点击开启声音';
  } else {
    musicStatus.textContent = playing ? '正在播放 · 点击暂停' : '点击播放 · 浏览器可能需要授权';
  }
}
musicToggle.addEventListener('click', async () => {
  if (!musicAudio.paused && musicAudio.muted) {
    // Autoplay is allowed in muted mode by most browsers. The first user
    // gesture upgrades it to an audible track without interrupting playback.
    musicAudio.muted = false;
    updateMusicState(true);
  } else if (musicAudio.paused) {
    musicAudio.muted = false;
    try { await musicAudio.play(); } catch { musicStatus.textContent = '浏览器阻止播放，请再次点击'; }
  } else {
    musicAudio.pause();
  }
});
musicAudio.addEventListener('play', () => updateMusicState(true));
musicAudio.addEventListener('pause', () => updateMusicState(false));
musicAudio.addEventListener('volumechange', () => {
  if (!musicAudio.paused) updateMusicState(true);
});
musicAudio.addEventListener('loadedmetadata', () => { musicDuration.textContent = formatTime(musicAudio.duration); });
musicAudio.addEventListener('timeupdate', () => {
  musicCurrent.textContent = formatTime(musicAudio.currentTime);
  musicProgress.value = musicAudio.duration ? (musicAudio.currentTime / musicAudio.duration) * 100 : 0;
});
musicAudio.addEventListener('ended', () => { musicProgress.value = 0; musicCurrent.textContent = '0:00'; updateMusicState(false); });
musicProgress.addEventListener('input', () => {
  if (musicAudio.duration) musicAudio.currentTime = (Number(musicProgress.value) / 100) * musicAudio.duration;
});

// 音乐默认不自动播放，访客点击播放器后再加载并播放，避免打扰访客。
musicAudio.volume = 0.42;
musicStatus.textContent = '点击播放 · 按需加载音乐';

// 纯前端项目导览机器人：只展示预设信息，不在 GitHub Pages 暴露任何密钥。
const aiBot = document.querySelector('#aiBot');
const aiBotToggle = document.querySelector('#aiBotToggle');
const aiBotPanel = document.querySelector('#aiBotPanel');
const aiBotClose = document.querySelector('#aiBotClose');
const aiBotMessage = document.querySelector('#aiBotMessage');
function setBotOpen(open) {
  if (!aiBot || !aiBotToggle || !aiBotPanel) return;
  aiBotPanel.hidden = !open;
  aiBotToggle.setAttribute('aria-expanded', String(open));
  aiBot.classList.toggle('is-open', open);
}
aiBotToggle?.addEventListener('click', () => setBotOpen(aiBotPanel.hidden));
aiBotClose?.addEventListener('click', () => setBotOpen(false));
document.querySelectorAll('[data-bot-message]').forEach((button) => {
  button.addEventListener('click', () => {
    if (aiBotMessage) aiBotMessage.textContent = button.dataset.botMessage || '';
  });
});
const phoenixEye = document.querySelector('.phoenix-eye');
aiBotToggle?.addEventListener('pointermove', (event) => {
  const rect = aiBotToggle.getBoundingClientRect();
  const x = Math.max(-2, Math.min(2, ((event.clientX - rect.left) / rect.width - 0.5) * 5));
  const y = Math.max(-1.5, Math.min(1.5, ((event.clientY - rect.top) / rect.height - 0.5) * 4));
  phoenixEye?.style.setProperty('--eye-x', `${x}px`);
  phoenixEye?.style.setProperty('--eye-y', `${y}px`);
});
aiBotToggle?.addEventListener('pointerleave', () => {
  phoenixEye?.style.setProperty('--eye-x', '0px');
  phoenixEye?.style.setProperty('--eye-y', '0px');
});
