(function () {
  'use strict';

  var total = 22;
  var initialIndex = 4;
  var scene = document.getElementById('scene');
  var camera = document.getElementById('camera');
  var ring = document.getElementById('photoRing');
  var status = document.getElementById('loadStatus');
  var lightbox = document.getElementById('lightbox');
  var lightboxImage = document.getElementById('lightboxImage');
  var lightboxNumber = document.getElementById('lightboxNumber');
  var cards = [];
  var active = initialIndex;
  var zoom = window.innerWidth < 800 ? -65 : 0;
  var dragging = false;
  var moved = false;
  var startX = 0;
  var startY = 0;
  var dragOffset = 0;
  var layoutFrame = 0;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wheelTravel = 0;
  var wheelLocked = false;
  var currentFrame = document.getElementById('currentFrame');

  function path(index) {
    return 'images/' + String(index + 1).padStart(2, '0') + '.webp?v=20260910-imgopt1';
  }

  function relativeOffset(index) {
    var offset = index - active;
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;
    return offset;
  }

  function loadCard(card) {
    var image = card.querySelector('img');
    if (!image.hasAttribute('src')) image.src = image.dataset.src;
  }

  function renderLayout() {
    var mobile = window.innerWidth < 800;
    // A steeper helix keeps adjacent projected cards apart while preserving
    // the continuous 3D wall instead of flattening into a card queue.
    var radius = mobile ? 132 : 368;
    var depth = mobile ? 190 : 410;
    var pitch = mobile ? 68 : 92;
    var step = mobile ? .94 : .86;
    var maxVisible = mobile ? 4 : 5;
    cards.forEach(function (card, index) {
      var offset = relativeOffset(index) - dragOffset;
      var distance = Math.abs(offset);
      var visible = distance <= maxVisible;
      card.hidden = !visible;
      card.classList.toggle('active', index === active && Math.abs(dragOffset) < .08);
      card.setAttribute('aria-current', index === active ? 'true' : 'false');
      if (!visible) return;
      loadCard(card);

      var angle = offset * step;
      var front = (Math.cos(angle) + 1) / 2;
      var x = Math.sin(angle) * radius;
      var y = offset * pitch + Math.sin(angle * 1.55) * (mobile ? 17 : 30);
      var z = Math.cos(angle) * depth - depth * .54;
      var scale = (mobile ? .42 : .46) + front * (mobile ? .58 : .62);
      var opacity = .31 + front * .69;
      var rotation = Math.max(-30, Math.min(30, -Math.sin(angle) * (mobile ? 21 : 27)));
      card.style.opacity = opacity.toFixed(3);
      card.style.zIndex = String(30 + Math.round(front * 60));
      card.style.filter = 'saturate(' + (.58 + front * .5).toFixed(2) + ') brightness(' + (.58 + front * .46).toFixed(2) + ')';
      card.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateY(' + rotation.toFixed(1) + 'deg) scale(' + scale.toFixed(3) + ')';
    });
    camera.style.transform = 'translateZ(' + zoom + 'px)';
  }

  function layout() {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(function () {
      layoutFrame = 0;
      renderLayout();
    });
  }

  function select(index) {
    active = (index + total) % total;
    if (currentFrame) currentFrame.textContent = 'FRAME ' + String(active + 1).padStart(2, '0') + ' / ' + total;
    layout();
  }

  function open(index) {
    select(index);
    lightboxImage.src = path(active);
    lightboxImage.alt = '个人摄影作品 ' + String(active + 1).padStart(2, '0');
    lightboxNumber.textContent = String(active + 1).padStart(2, '0') + ' / ' + total;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lightbox.querySelector('.lightbox-close').focus();
  }

  function close() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    scene.focus();
  }

  function shift(step) {
    open(active + step);
  }

  for (var index = 0; index < total; index += 1) {
    (function (photoIndex) {
      var button = document.createElement('button');
      var image = document.createElement('img');
      var label = document.createElement('span');
      button.type = 'button';
      button.className = 'photo-card';
      button.setAttribute('aria-label', '查看摄影作品 ' + String(photoIndex + 1).padStart(2, '0'));
      image.dataset.src = path(photoIndex);
      image.alt = '';
      image.loading = Math.abs(photoIndex - initialIndex) <= 1 ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.addEventListener('load', function () { image.classList.add('loaded'); });
      label.textContent = String(photoIndex + 1).padStart(2, '0');
      button.append(image, label);
      button.addEventListener('click', function () {
        if (!moved) open(photoIndex);
      });
      button.addEventListener('focus', function () {
        if (!dragging && button.matches(':focus-visible')) select(photoIndex);
      });
      ring.appendChild(button);
      cards.push(button);
    }(index));
  }

  layout();
  status.textContent = '空间已就绪';

  scene.addEventListener('pointerdown', function (event) {
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    scene.classList.add('dragging');
    scene.setPointerCapture(event.pointerId);
  });
  scene.addEventListener('pointermove', function (event) {
    if (!dragging) return;
    var deltaX = event.clientX - startX;
    if (Math.abs(deltaX) + Math.abs(event.clientY - startY) > 6) moved = true;
    dragOffset = Math.max(-1.15, Math.min(1.15, deltaX / (window.innerWidth < 800 ? 105 : 190)));
    layout();
  });
  function endDrag(event) {
    if (!dragging) return;
    var step = dragOffset < -.34 ? 1 : (dragOffset > .34 ? -1 : 0);
    dragging = false;
    scene.classList.remove('dragging');
    dragOffset = 0;
    select(active + step);
    setTimeout(function () { moved = false; }, 0);
  }
  scene.addEventListener('pointerup', endDrag);
  scene.addEventListener('pointercancel', function () {
    dragging = false;
    scene.classList.remove('dragging');
    dragOffset = 0;
    layout();
    moved = false;
  });
  scene.addEventListener('wheel', function (event) {
    event.preventDefault();
    if (lightbox.classList.contains('open') || wheelLocked) return;
    wheelTravel += Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(wheelTravel) < 34) return;
    wheelLocked = true;
    select(active + (wheelTravel > 0 ? 1 : -1));
    wheelTravel = 0;
    setTimeout(function () { wheelLocked = false; }, reducedMotion ? 80 : 390);
  }, { passive: false });
  scene.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowLeft') select(active - 1);
    if (event.key === 'ArrowRight') select(active + 1);
    if (event.key === 'Enter') open(active);
  });

  document.getElementById('previousButton').onclick = function () { select(active - 1); };
  document.getElementById('nextButton').onclick = function () { select(active + 1); };
  document.getElementById('focusButton').onclick = function () { open(active); };
  document.getElementById('zoomOutButton').onclick = function () { zoom = Math.max(-180, zoom - 40); layout(); };
  document.getElementById('zoomInButton').onclick = function () { zoom = Math.min(150, zoom + 40); layout(); };
  lightbox.querySelector('.lightbox-close').onclick = close;
  lightbox.querySelector('.lightbox-prev').onclick = function () { shift(-1); };
  lightbox.querySelector('.lightbox-next').onclick = function () { shift(1); };
  lightbox.addEventListener('click', function (event) { if (event.target === lightbox) close(); });
  document.addEventListener('keydown', function (event) {
    if (!lightbox.classList.contains('open')) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') shift(-1);
    if (event.key === 'ArrowRight') shift(1);
  });

  var helpButton = document.getElementById('helpButton');
  var helpPanel = document.getElementById('helpPanel');
  helpButton.onclick = function () {
    var show = helpPanel.hasAttribute('hidden');
    helpPanel.toggleAttribute('hidden', !show);
    helpButton.setAttribute('aria-expanded', String(show));
  };
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 160);
  });
}());
