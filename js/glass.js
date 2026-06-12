/* ============================================================
   glass.js — Liquid Glass refraction (Chromium)
   Generates an SDF-based displacement map per capsule and feeds
   it to an SVG filter consumed by `backdrop-filter: url(#...)`.
   Non-Chromium browsers keep the frosted-glass CSS fallback.
   ============================================================ */
(function () {
  'use strict';

  // @supports lies about backdrop-filter:url() — gate by engine.
  const isChromium = !!window.chrome && /Chrom(e|ium)|Edg\//.test(navigator.userAgent);

  // capsule registry: [{el, filterId, feImageId}]
  const targets = [];

  function smooth(a, b, t) {
    t = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function sdfRoundRect(x, y, hw, hh, r) {
    const qx = Math.abs(x) - hw + r;
    const qy = Math.abs(y) - hh + r;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
  }

  /* Build the R=X / G=Y displacement map (128 = neutral).
     Displacement grows toward the rim, flat center — the LG signature. */
  function buildMap(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const raw = new Float32Array(w * h * 2);
    let max = 1e-6;
    let i = 0;
    const r = (Math.min(w, h) / Math.max(w, h)) * 0.5;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ux = x / w - 0.5;
        const uy = y / h - 0.5;
        const d = sdfRoundRect(ux, uy, 0.5, 0.5, Math.min(r, 0.5));
        const edge = smooth(0.8, 0, d - 0.02);
        const t = edge * smooth(0, 1, edge);
        const dx = ux * t * w;
        const dy = uy * t * h;
        raw[i++] = dx;
        raw[i++] = dy;
        max = Math.max(max, Math.abs(dx), Math.abs(dy));
      }
    }
    i = 0;
    for (let p = 0; p < img.data.length; p += 4) {
      img.data[p] = (raw[i++] / (max * 2) + 0.5) * 255;
      img.data[p + 1] = (raw[i++] / (max * 2) + 0.5) * 255;
      img.data[p + 2] = 128;
      img.data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  function refresh(t) {
    const rect = t.el.getBoundingClientRect();
    const w = Math.max(2, Math.round(rect.width));
    const h = Math.max(2, Math.round(rect.height));
    if (w === t.w && h === t.h) return;
    t.w = w;
    t.h = h;
    const filter = document.getElementById(t.filterId);
    const feImage = document.getElementById(t.feImageId);
    if (!filter || !feImage) return;
    filter.setAttribute('width', w);
    filter.setAttribute('height', h);
    feImage.setAttribute('width', w);
    feImage.setAttribute('height', h);
    feImage.setAttribute('href', buildMap(w, h));
    t.el.classList.add('lg-on');
  }

  let raf = null;
  function refreshAll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      targets.forEach(refresh);
    });
  }

  const Glass = {
    enabled: isChromium,
    register(el, filterId, feImageId) {
      if (!isChromium || !el) return;
      document.documentElement.classList.add('lg-refract');
      const t = { el, filterId, feImageId, w: 0, h: 0 };
      targets.push(t);
      refresh(t);
    },
    refreshAll,
  };

  window.addEventListener('resize', refreshAll);

  window.Glass = Glass;
})();
