/* ============================================================
   youtube.js — YouTube helpers
   - robust video-id extraction from every common URL shape
   - IFrame API lazy loader
   - oEmbed metadata fetch (title / author) with noembed fallback
   - thumbnail URL helpers
   ============================================================ */
(function () {
  'use strict';

  /* ---------- ID extraction ---------- */
  // accepts: full urls (watch?v=, youtu.be/, shorts/, embed/, live/,
  // music.youtube.com/watch?v=) or a bare 11-char id
  function extractId(input) {
    if (!input) return null;
    const s = String(input).trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
    let url;
    try {
      url = new URL(s.includes('://') ? s : 'https://' + s);
    } catch (e) {
      return null;
    }
    const host = url.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[1];
    }
    return null;
  }

  /* ---------- thumbnails ---------- */
  function thumb(id, quality) {
    return 'https://i.ytimg.com/vi/' + id + '/' + (quality || 'hqdefault') + '.jpg';
  }
  // try maxres first, fall back to hq (maxres 404s for many videos)
  function bestThumb(id) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // YouTube returns a 120x90 gray placeholder when maxres is missing
        if (img.naturalWidth > 200) resolve(thumb(id, 'maxresdefault'));
        else resolve(thumb(id, 'hqdefault'));
      };
      img.onerror = () => resolve(thumb(id, 'hqdefault'));
      img.src = thumb(id, 'maxresdefault');
    });
  }

  /* ---------- metadata (oEmbed) ---------- */
  async function fetchMeta(id) {
    const watchUrl = 'https://www.youtube.com/watch?v=' + id;
    const endpoints = [
      'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(watchUrl),
      'https://noembed.com/embed?url=' + encodeURIComponent(watchUrl),
    ];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        if (!res.ok) continue;
        const data = await res.json();
        if (data && data.title) {
          return {
            title: data.title,
            author: (data.author_name || '').replace(/\s*-\s*Topic$/, ''),
          };
        }
      } catch (e) {
        /* try next endpoint */
      }
    }
    return null;
  }

  /* ---------- IFrame API loader ---------- */
  let apiPromise = null;
  function loadAPI() {
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve(window.YT);
        return;
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev();
        resolve(window.YT);
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    });
    return apiPromise;
  }

  window.YTUtil = { extractId, thumb, bestThumb, fetchMeta, loadAPI };
})();
