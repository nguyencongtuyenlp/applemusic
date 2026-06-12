/* ============================================================
   util.js — small shared helpers
   time formatting, dominant-colour extraction, gradient covers,
   DOM sugar, toast notifications.
   ============================================================ */
(function () {
  'use strict';

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.round(sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- deterministic gradient cover for songs without art ---------- */
  const GRADS = [
    ['#fa586a', '#a83279'],
    ['#5f72ff', '#9b23ea'],
    ['#11998e', '#38ef7d'],
    ['#fc4a1a', '#f7b733'],
    ['#396afc', '#2948ff'],
    ['#ee0979', '#ff6a00'],
    ['#7f00ff', '#e100ff'],
    ['#00c6ff', '#0072ff'],
    ['#f857a6', '#ff5858'],
    ['#4776e6', '#8e54e9'],
  ];
  function hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function gradientFor(seed) {
    return GRADS[hashCode(String(seed)) % GRADS.length];
  }
  // SVG data-uri cover with a music note, used when no artwork
  function gradientCoverUrl(seed, label) {
    const [c1, c2] = gradientFor(seed);
    const initial = (label || '♪').trim().charAt(0).toUpperCase() || '♪';
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="512" height="512" fill="url(#g)"/>' +
      '<text x="256" y="300" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="200" font-weight="700" fill="rgba(255,255,255,.85)" text-anchor="middle">' +
      initial +
      '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ---------- dominant colours from artwork (for now-playing bg) ---------- */
  function extractColors(imgUrl) {
    return new Promise((resolve) => {
      const fallback = ['#3a3a45', '#1c1c22', '#101014'];
      if (!imgUrl) return resolve(fallback);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          const W = 24;
          c.width = W;
          c.height = W;
          const x = c.getContext('2d');
          x.drawImage(img, 0, 0, W, W);
          const data = x.getImageData(0, 0, W, W).data;
          const buckets = {};
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (lum < 18 || lum > 245) continue; // skip near black/white
            const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
            (buckets[key] = buckets[key] || { r: 0, g: 0, b: 0, n: 0 });
            buckets[key].r += r; buckets[key].g += g; buckets[key].b += b; buckets[key].n++;
          }
          const sorted = Object.values(buckets).sort((a, b) => b.n - a.n).slice(0, 3);
          if (!sorted.length) return resolve(fallback);
          const cols = sorted.map((s) => {
            const r = Math.round(s.r / s.n), g = Math.round(s.g / s.n), b = Math.round(s.b / s.n);
            return 'rgb(' + r + ',' + g + ',' + b + ')';
          });
          while (cols.length < 3) cols.push(cols[cols.length - 1]);
          resolve(cols);
        } catch (e) {
          resolve(fallback); // canvas tainted (no CORS) or decode issue
        }
      };
      img.onerror = () => resolve(fallback);
      img.src = imgUrl;
    });
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = el('div', 'toast');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- file -> resized cover blob ---------- */
  function fileToCoverBlob(file, size) {
    size = size || 600;
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const x = c.getContext('2d');
        const s = Math.max(size / img.width, size / img.height);
        const w = img.width * s, h = img.height * s;
        x.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.88);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image decode failed'));
      };
      img.src = url;
    });
  }

  window.Util = { fmtTime, el, esc, gradientFor, gradientCoverUrl, extractColors, toast, fileToCoverBlob };
})();
