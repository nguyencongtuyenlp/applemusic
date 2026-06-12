/* ============================================================
   nowplaying.js — mini player + full Now Playing sheet
   iOS 26 behaviors: sheet slide-up, drag-down dismiss, artwork
   shrink on pause, marquee title, scrubber thicken-on-touch,
   animated artwork-color background, queue panel, mini swipe.
   ============================================================ */
(function () {
  'use strict';

  const { el, esc, fmtTime } = Util;

  let np, mini, scrubber, volSlider;
  let scrubbing = false;
  let videoMode = false;

  function $(id) {
    return document.getElementById(id);
  }

  /* outline star normally, filled red when favorited (matches iOS) */
  function setFav(on) {
    const b = $('np-fav');
    b.classList.toggle('on', on);
    b.innerHTML = on ? Icons.star : Icons.starOutline;
  }

  /* ============ init DOM wiring ============ */
  function init() {
    np = $('now-playing');
    mini = $('mini-player');

    /* mini player taps (ignored right after a horizontal swipe) */
    mini.addEventListener('click', (e) => {
      if (e.target.closest('.mp-btn')) return;
      if (mini._swiped) return;
      open();
    });
    $('mp-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      Player.toggle();
    });
    $('mp-fwd').addEventListener('click', (e) => {
      e.stopPropagation();
      Player.next();
    });
    wireMiniSwipe();

    /* NP controls */
    $('np-close-area').addEventListener('click', () => {});
    $('np-pp').addEventListener('click', () => Player.toggle());
    $('np-next').addEventListener('click', () => Player.next());
    $('np-prev').addEventListener('click', () => Player.prev());
    $('np-more').addEventListener('click', () => {
      const s = Player.current();
      if (s) App.openSongSheet(s);
    });
    $('np-fav').addEventListener('click', async () => {
      const s = Player.current();
      if (!s) return;
      const on = await Library.toggleFavorite(s.id);
      setFav(on);
      Util.toast(on ? 'Đã thêm vào Bài Hát Yêu Thích' : 'Đã bỏ yêu thích');
    });
    $('np-queue-btn').addEventListener('click', () => {
      const q = $('np-queue');
      q.classList.toggle('open');
      $('np-queue-btn').classList.toggle('on', q.classList.contains('open'));
      if (q.classList.contains('open')) renderQueue();
    });
    $('np-airplay-btn').addEventListener('click', () =>
      Util.toast('AirPlay không khả dụng trên trình duyệt web.')
    );
    $('np-lyrics-btn').addEventListener('click', () =>
      Util.toast('Lời bài hát chưa được hỗ trợ trong bản này.')
    );

    wireScrub();
    wireVolume();
    wireDragDismiss();

    /* player events */
    Player.on('change', (e) => {
      if (!e.song) {
        /* queue emptied (e.g. playing song deleted) */
        mini.classList.add('gone');
        close();
        renderQueue();
        return;
      }
      /* full track UI only when a track actually (re)loads;
         queue-only mutations just refresh the queue panel */
      if (e.loadedTrack || e.loadedTrack === undefined) updateTrackUI(e.song);
      else {
        mini.classList.remove('gone');
        $('mp-title').textContent = e.song.title;
        $('mp-artist').textContent = e.song.artist;
      }
      renderQueue();
    });
    Player.on('state', ({ playing, loading }) => {
      np.classList.toggle('paused', !playing);
      const ppIcon = playing ? Icons.pause : Icons.play;
      $('np-pp').innerHTML = ppIcon;
      $('mp-toggle').innerHTML = playing ? Icons.pause : Icons.play;
      if (videoMode) positionVideo();
    });
    Player.on('time', ({ position, duration }) => {
      if (scrubbing) return; // drag preview owns the bar and labels
      const pct = duration > 0 ? (position / duration) * 100 : 0;
      scrubber.querySelector('.fill').style.width = pct + '%';
      $('np-t-el').textContent = fmtTime(position);
      $('np-t-rem').textContent = '-' + fmtTime(Math.max(0, (duration || 0) - position));
    });
    Player.on('error', (e) => {
      if (e && e.message) Util.toast(e.message);
    });
    Player.on('autoplay-blocked', () => Util.toast('Chạm nút phát để bắt đầu nghe.'));
    Player.on('volume', (v) => {
      volSlider.querySelector('.fill').style.width = v * 100 + '%';
    });
  }

  /* ============ track UI ============ */
  async function updateTrackUI(song) {
    if (!song) return;
    mini.classList.remove('gone');
    $('mp-art').src = song.coverDisplayUrl;
    $('mp-title').textContent = song.title;
    $('mp-artist').textContent = song.artist;
    $('np-art').src = song.coverDisplayUrl;
    $('np-artist').textContent = song.artist;
    setFav(!!song.favorite);
    if (song.type !== 'youtube' && videoMode) toggleVideo();

    /* marquee */
    const titleBox = $('np-title');
    titleBox.innerHTML =
      '<span class="marquee-inner">' + esc(song.title) + '</span>';
    requestAnimationFrame(() => {
      const inner = titleBox.querySelector('.marquee-inner');
      if (inner.scrollWidth - 60 > titleBox.clientWidth) {
        inner.innerHTML = esc(song.title) + '<span style="display:inline-block;width:60px"></span>' + esc(song.title);
        titleBox.classList.add('marquee');
      } else {
        titleBox.classList.remove('marquee');
      }
    });

    /* background colors from artwork */
    const cols = await Util.extractColors(song.coverDisplayUrl);
    const blobs = np.querySelectorAll('#np-bg .blob');
    blobs.forEach((b, i) => (b.style.background = cols[i % cols.length]));
  }

  /* ============ open / close ============ */
  function open() {
    if (!Player.current()) return;
    np.classList.add('open');
    if (videoMode) requestAnimationFrame(positionVideo);
  }
  function close() {
    np.classList.remove('open');
    $('np-queue').classList.remove('open');
    $('np-queue-btn').classList.remove('on');
    if (videoMode) toggleVideo();
  }

  /* ============ scrubber / volume ============ */
  function sliderLogic(container, onCommit, onLive) {
    const apply = (clientX, commit) => {
      const r = container.getBoundingClientRect();
      let f = (clientX - r.left) / r.width;
      f = Math.min(1, Math.max(0, f));
      container.querySelector('.fill').style.width = f * 100 + '%';
      if (onLive) onLive(f);
      if (commit) onCommit(f);
    };
    container.addEventListener('pointerdown', (e) => {
      container.setPointerCapture(e.pointerId);
      container.classList.add('touching');
      scrubbing = container === scrubber;
      apply(e.clientX, false);
    });
    container.addEventListener('pointermove', (e) => {
      if (!container.classList.contains('touching')) return;
      apply(e.clientX, false);
    });
    const end = (e) => {
      if (!container.classList.contains('touching')) return;
      container.classList.remove('touching');
      apply(e.clientX, true);
      if (container === scrubber) scrubbing = false;
    };
    container.addEventListener('pointerup', end);
    container.addEventListener('pointercancel', () => {
      container.classList.remove('touching');
      if (container === scrubber) scrubbing = false;
    });
  }
  function wireScrub() {
    scrubber = $('np-scrub');
    sliderLogic(
      scrubber,
      (f) => {
        const d = Player.state.duration || 0;
        if (d) Player.seek(f * d);
      },
      (f) => {
        const d = Player.state.duration || 0;
        $('np-t-el').textContent = fmtTime(f * d);
        $('np-t-rem').textContent = '-' + fmtTime(Math.max(0, d - f * d));
      }
    );
  }
  function wireVolume() {
    volSlider = $('np-vol');
    volSlider.querySelector('.fill').style.width = Player.state.volume * 100 + '%';
    sliderLogic(volSlider, (f) => Player.setVolume(f), (f) => Player.setVolume(f));
  }

  /* ============ drag-down dismiss ============ */
  function wireDragDismiss() {
    const zone = $('np-close-area'); /* grabber + artwork area */
    let startY = null;
    let dy = 0;
    zone.addEventListener('pointerdown', (e) => {
      if ($('np-queue').classList.contains('open')) return;
      startY = e.clientY;
      dy = 0;
      np.classList.add('dragging');
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', (e) => {
      if (startY == null) return;
      dy = Math.max(0, e.clientY - startY);
      np.style.transform = 'translateY(' + dy + 'px)';
    });
    const end = () => {
      if (startY == null) return;
      np.classList.remove('dragging');
      np.style.transform = '';
      if (dy > 130) close();
      startY = null;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  /* ============ mini swipe (đổi bài) ============ */
  function wireMiniSwipe() {
    let sx = null;
    let dx = 0;
    mini.addEventListener('pointerdown', (e) => {
      sx = e.clientX;
      dx = 0;
    });
    mini.addEventListener('pointermove', (e) => {
      if (sx == null) return;
      dx = e.clientX - sx;
      if (Math.abs(dx) > 8) {
        mini.style.transform = 'translateX(' + dx * 0.55 + 'px)';
        mini.style.transition = 'none';
      }
    });
    const end = () => {
      if (sx == null) return;
      mini.style.transition = '';
      mini.style.transform = '';
      mini._swiped = Math.abs(dx) > 12; // suppress the click that follows a swipe
      if (mini._swiped) setTimeout(() => (mini._swiped = false), 250);
      if (dx < -70) Player.next();
      else if (dx > 70) Player.prev();
      sx = null;
      dx = 0;
    };
    mini.addEventListener('pointerup', end);
    mini.addEventListener('pointercancel', end);
    mini.addEventListener('pointerleave', end);
  }

  /* ============ queue panel ============ */
  function renderQueue() {
    const list = $('np-queue-list');
    if (!list) return;
    list.innerHTML = '';
    const q = Player.state.queue;
    if (!q.length) {
      list.appendChild(el('div', 'empty', '<div class="d">Hàng đợi trống.</div>'));
      return;
    }
    q.forEach((s, i) => {
      const isCur = i === Player.state.index;
      const r = el('div', 'row');
      r.innerHTML =
        '<img class="row-art" src="' + esc(s.coverDisplayUrl) + '" alt="">' +
        '<div class="row-main"><div class="row-texts">' +
        '<div class="row-title">' + (isCur ? '<span class="now-bars">♫ </span>' : '') + esc(s.title) + '</div>' +
        '<div class="row-sub">' + esc(s.artist) + '</div></div></div>';
      r.addEventListener('click', () => Player.jumpTo(i));
      list.appendChild(r);
    });
  }

  /* ============ video mode (YouTube xem video) ============ */
  function positionVideo() {
    const dock = $('yt-dock');
    const art = $('np-art');
    if (!dock || !art) return;
    const r = art.getBoundingClientRect();
    dock.style.left = r.left + 'px';
    dock.style.top = r.top + 'px';
    dock.style.width = r.width + 'px';
    dock.style.height = r.height + 'px';
    dock.style.right = 'auto';
    dock.style.bottom = 'auto';
  }
  function toggleVideo() {
    const cur = Player.current();
    const dock = $('yt-dock');
    if (!dock) return;
    if (!videoMode && (!cur || cur.type !== 'youtube')) {
      Util.toast('Chỉ bài hát từ YouTube mới xem được video.');
      return;
    }
    videoMode = !videoMode;
    if (videoMode) {
      if (!np.classList.contains('open')) open();
      positionVideo();
      dock.classList.add('as-video');
      $('np-art').style.opacity = '0';
    } else {
      dock.classList.remove('as-video');
      dock.style.cssText = '';
      $('np-art').style.opacity = '';
    }
  }
  window.addEventListener('resize', () => {
    if (videoMode) positionVideo();
  });

  window.NowPlaying = { init, open, close, updateTrackUI, toggleVideo };
})();
