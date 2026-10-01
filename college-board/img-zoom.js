/* College Board image zoom — shared by every page under /college-board.
   Click/tap any question or explanation image to open a zoomable viewer.
   Wheel / pinch / +/- buttons to zoom, drag to pan, double-click to toggle, Esc to close. */
(function () {
  'use strict';
  if (window.__cbImgZoom) return;
  window.__cbImgZoom = true;

  var SEL = 'img.q, img.question-image, img.explanation-image';
  var MIN = 1, MAX = 8;

  var css = [
    SEL + '{cursor:zoom-in}',
    '#cbz{position:fixed;inset:0;z-index:99999;background:rgba(10,10,14,.92);display:none;overscroll-behavior:contain;touch-action:none;user-select:none;-webkit-user-select:none}',
    '#cbz.open{display:block}',
    '#cbz .cbz-stage{position:absolute;inset:0;overflow:hidden;cursor:grab}',
    '#cbz .cbz-stage.drag{cursor:grabbing}',
    '#cbz img{position:absolute;left:50%;top:50%;max-width:none;max-height:none;background:#fff;border-radius:4px;box-shadow:0 8px 40px rgba(0,0,0,.5);will-change:transform;transform-origin:0 0;-webkit-user-drag:none;pointer-events:none}',
    '#cbz .cbz-bar{position:absolute;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;background:rgba(30,30,38,.92);padding:6px 8px;border-radius:999px;box-shadow:0 2px 12px rgba(0,0,0,.4);z-index:2}',
    '#cbz button{appearance:none;border:0;background:#3a3a46;color:#fff;font:600 18px/1 system-ui,sans-serif;min-width:40px;height:40px;padding:0 12px;border-radius:999px;cursor:pointer}',
    '#cbz button:hover{background:#51515f}',
    '#cbz button:focus-visible{outline:2px solid #c8960c;outline-offset:2px}',
    '#cbz .cbz-pct{color:#fff;font:600 14px/1 system-ui,sans-serif;min-width:48px;text-align:center}',
    '#cbz .cbz-close{background:#7B0000}',
    '#cbz .cbz-close:hover{background:#9a0000}',
    'body.cbz-lock{overflow:hidden}'
  ].join('\n');

  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var root, stage, pic, pct;
  var scale = 1, tx = 0, ty = 0, baseW = 0, baseH = 0, lastFocus = null;
  var pts = {}, dragStart = null, pinchStart = null;

  function build() {
    root = document.createElement('div');
    root.id = 'cbz';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Μεγέθυνση εικόνας');
    root.innerHTML =
      '<div class="cbz-bar">' +
      '<button type="button" data-a="out" aria-label="Σμίκρυνση">−</button>' +
      '<span class="cbz-pct" aria-live="polite">100%</span>' +
      '<button type="button" data-a="in" aria-label="Μεγέθυνση">+</button>' +
      '<button type="button" data-a="reset" aria-label="Επαναφορά">Fit</button>' +
      '<button type="button" data-a="close" class="cbz-close" aria-label="Κλείσιμο">✕</button>' +
      '</div>' +
      '<div class="cbz-stage"><img alt=""></div>';
    document.body.appendChild(root);
    stage = root.querySelector('.cbz-stage');
    pic = stage.querySelector('img');
    pct = root.querySelector('.cbz-pct');

    root.querySelector('.cbz-bar').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'close') close();
      else if (a === 'reset') reset();
      else zoomAt(a === 'in' ? 1.4 : 1 / 1.4, innerWidth / 2, innerHeight / 2);
    });
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY);
    }, { passive: false });
    stage.addEventListener('dblclick', function (e) {
      if (scale > 1.05) reset(); else zoomAt(2.5, e.clientX, e.clientY);
    });
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    // click on the dark backdrop (not the picture) closes
    stage.addEventListener('click', function (e) {
      if (moved) { moved = false; return; }
      if (e.target === stage) close();
    });
  }

  var moved = false;

  function fitSize(nw, nh) {
    var maxW = innerWidth * 0.96, maxH = innerHeight * 0.86;
    var k = Math.min(maxW / nw, maxH / nh);
    return { w: Math.round(nw * k), h: Math.round(nh * k) };
  }

  function apply() {
    // image is positioned with its top-left at the stage centre; offset so its centre sits there at tx,ty = 0
    var x = tx - (baseW * scale) / 2, y = ty - (baseH * scale) / 2;
    pic.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
    pct.textContent = Math.round(scale * 100) + '%';
  }

  function clamp() {
    var w = baseW * scale, h = baseH * scale;
    var limX = Math.max(0, (w - innerWidth) / 2 + 60), limY = Math.max(0, (h - innerHeight) / 2 + 60);
    tx = Math.max(-limX, Math.min(limX, tx));
    ty = Math.max(-limY, Math.min(limY, ty));
  }

  function zoomAt(f, cx, cy) {
    var ns = Math.max(MIN, Math.min(MAX, scale * f));
    f = ns / scale;
    // keep the point under (cx,cy) fixed; coordinates relative to stage centre
    var ox = cx - innerWidth / 2, oy = cy - innerHeight / 2;
    tx = ox - (ox - tx) * f;
    ty = oy - (oy - ty) * f;
    scale = ns;
    clamp();
    apply();
  }

  function reset() { scale = 1; tx = 0; ty = 0; apply(); }

  function onDown(e) {
    if (e.target.closest('.cbz-bar')) return;
    stage.setPointerCapture(e.pointerId);
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pts);
    if (ids.length === 1) {
      dragStart = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
      moved = false;
      stage.classList.add('drag');
    } else if (ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]];
      pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), s: scale };
      dragStart = null;
    }
  }

  function onMove(e) {
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pts);
    if (ids.length === 2 && pinchStart) {
      var a = pts[ids[0]], b = pts[ids[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((pinchStart.s * d / pinchStart.d) / scale, (a.x + b.x) / 2, (a.y + b.y) / 2);
      moved = true;
    } else if (ids.length === 1 && dragStart) {
      var dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      tx = dragStart.tx + dx;
      ty = dragStart.ty + dy;
      clamp();
      apply();
    }
  }

  function onUp(e) {
    delete pts[e.pointerId];
    var ids = Object.keys(pts);
    if (ids.length < 2) pinchStart = null;
    if (ids.length === 1) {
      var p = pts[ids[0]];
      dragStart = { x: p.x, y: p.y, tx: tx, ty: ty };
    } else if (!ids.length) {
      dragStart = null;
      stage.classList.remove('drag');
    }
  }

  function open(img) {
    if (!root) build();
    lastFocus = document.activeElement;
    var nw = img.naturalWidth || +img.getAttribute('width') || img.width || 800;
    var nh = img.naturalHeight || +img.getAttribute('height') || img.height || 600;
    var s = fitSize(nw, nh);
    baseW = s.w; baseH = s.h;
    pic.style.width = s.w + 'px';
    pic.style.height = s.h + 'px';
    pic.alt = img.alt || '';
    pic.src = img.currentSrc || img.src;
    pts = {}; dragStart = null; pinchStart = null;
    scale = 1; tx = 0; ty = 0;
    apply();
    root.classList.add('open');
    document.body.classList.add('cbz-lock');
    root.querySelector('.cbz-close').focus();
  }

  function close() {
    if (!root) return;
    root.classList.remove('open');
    document.body.classList.remove('cbz-lock');
    pic.removeAttribute('src');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  // Event delegation: works for images rendered later (innerHTML) too.
  document.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest(SEL);
    if (!img || (root && root.contains(img))) return;
    e.preventDefault();
    e.stopPropagation();
    open(img);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (!root || !root.classList.contains('open')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === '+' || e.key === '=') zoomAt(1.4, innerWidth / 2, innerHeight / 2);
    else if (e.key === '-' || e.key === '_') zoomAt(1 / 1.4, innerWidth / 2, innerHeight / 2);
    else if (e.key === '0') reset();
  });

  window.addEventListener('resize', function () {
    if (root && root.classList.contains('open')) { clamp(); apply(); }
  });

  // Hint on hover for mouse users.
  document.addEventListener('mouseover', function (e) {
    var img = e.target.closest && e.target.closest(SEL);
    if (img && !img.title) img.title = 'Κλικ για μεγέθυνση';
  });
})();
