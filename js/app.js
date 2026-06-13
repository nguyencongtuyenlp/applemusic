/* ============================================================
   app.js — boot, tab navigation, chrome collapse, search,
   sheets (add / edit / song actions), demo seeding, persistence.
   ============================================================ */
(function () {
  'use strict';

  const { el, esc } = Util;
  let activeTab = 'home';
  let chromeCollapsed = false;
  const scrollPos = { home: 0, discover: 0, radio: 0, library: 0 };

  function $(id) {
    return document.getElementById(id);
  }

  /* ============ demo seed (copyright-free NCS tracks, verified embeddable) ============ */
  const SEEDS = [
    { ytId: 'K4DyBUG242c', title: 'On & On (feat. Daniel Levi)', artist: 'Cartoon, Jéja', album: 'NCS: The Best Of' },
    { ytId: '3nQNiWdeH2Q', title: 'Heroes Tonight (feat. Johnning)', artist: 'Janji', album: 'NCS: The Best Of' },
    { ytId: 'J2X5mJ3HDYE', title: 'Invincible', artist: 'DEAF KEV', album: 'NCS: The Best Of' },
    { ytId: 'jK2aIUmmdP4', title: 'My Heart', artist: 'Different Heaven & EH!DE', album: 'NCS: The Best Of' },
    { ytId: 'p7ZsBPK656s', title: 'Blank', artist: 'Disfigure', album: 'NCS: The Best Of' },
    { ytId: '__CRWE-L45k', title: 'Symbolism', artist: 'Electro-Light', album: 'NCS: Trap' },
    { ytId: 'TW9d8vYrVFQ', title: 'Sky High', artist: 'Elektronomia', album: 'NCS: House' },
    { ytId: 'fzNMd3Tu1Zw', title: 'Energy', artist: 'Elektronomia', album: 'NCS: House' },
  ];
  async function seedIfFirstRun() {
    const seeded = await DB.kvGet('seeded-v1', false);
    if (seeded || Library.songs.length) return;
    for (const s of SEEDS) {
      const song = {
        id: DB.uuid(),
        type: 'youtube',
        ytId: s.ytId,
        title: s.title,
        artist: s.artist,
        album: s.album,
        coverUrl: YTUtil.thumb(s.ytId, 'hqdefault'),
        favorite: false,
        playCount: 0,
        addedAt: Date.now(),
      };
      await DB.putSong(song);
      Library.songs.push(Library.hydrateCover(song));
    }
    await DB.kvSet('seeded-v1', true);
  }

  /* First time cloud is switched on for a previously-local install:
     cloud is empty but the device has a local library → push it up once.
     Only runs when the cloud read succeeded and came back empty (safe). */
  let didMigrate = false;
  async function migrateLocalToCloud() {
    if (!DB.cloud) return;
    if (Library.songs.length > 0) return; // cloud already has data
    const local = await DB.localSongs();
    if (!local.length) return; // nothing to migrate
    for (const s of local) await DB.putSong(s);
    const pls = await DB.localPlaylists();
    for (const p of pls) await DB.putPlaylist(p);
    await DB.kvSet('seeded-v1', true);
    await Library.init();
    didMigrate = true;
    Util.toast('Đã tải thư viện sẵn có lên đám mây ☁️');
  }

  /* ============ tabs ============ */
  const TABS = [
    { id: 'home', label: 'Trang chủ', icon: 'home' },
    { id: 'discover', label: 'Khám phá', icon: 'discover' },
    { id: 'radio', label: 'Radio', icon: 'radio' },
    { id: 'library', label: 'Thư viện', icon: 'library' },
  ];

  function buildTabBar() {
    const bar = $('tab-bar');
    bar.innerHTML = '';
    // sliding liquid-glass selection lens (sits behind the active tab)
    const indicator = el('div', 'tab-indicator');
    indicator.id = 'tab-indicator';
    bar.appendChild(indicator);
    TABS.forEach((t) => {
      const b = el('button', 'tab' + (t.id === activeTab ? ' active' : ''));
      b.dataset.tab = t.id;
      b.innerHTML = Icons[t.icon] + '<span class="tab-label">' + esc(t.label) + '</span>';
      bar.appendChild(b);
    });
    wireTabGesture(bar);
    requestAnimationFrame(positionTabIndicator);
    setTimeout(positionTabIndicator, 150); // fallback if rAF fires before layout
  }

  /* ---- liquid-glass lens: spring + magnify + 2-axis jelly wobble ----
     At rest the lens is a bit SMALLER than the tab so it fits inside the
     rounded pill (no clipping on edge tabs). While pressed/dragged it
     MAGNIFIES (grows beyond the bar, like a glass loupe) and chases the
     finger; on each jump it wobbles — stretching horizontally first, then
     vertically, then settling — like jelly (iOS 26). */
  const LENS_W_TRIM = 6; // rest lens slightly narrower than the tab (clears the rounded ends)
  const LENS_H_TRIM = 4; // nearly full tab height (top/bottom are straight, so no clipping)
  const lens = {
    cx: 0, vcx: 0, targetCx: 0, y: 0, w: 0, h: 0,
    press: 0, pressTarget: 0, wobAmp: 0, wobT: 0,
    lastTs: 0, raf: 0, animating: false,
  };

  function lensGeom(tab) {
    const bar = $('tab-bar');
    const w = tab.offsetWidth - LENS_W_TRIM;
    const h = tab.offsetHeight - LENS_H_TRIM;
    const cx = tab.offsetLeft - bar.clientLeft + tab.offsetWidth / 2;
    const cy = tab.offsetTop - bar.clientTop + tab.offsetHeight / 2;
    return { cx, y: cy - h / 2, w, h };
  }
  function applyLens(sx, sy) {
    const ind = $('tab-indicator');
    if (!ind) return;
    ind.style.width = lens.w + 'px';
    ind.style.height = lens.h + 'px';
    ind.style.transform =
      'translate(' + (lens.cx - lens.w / 2) + 'px,' + lens.y + 'px) scale(' + (sx || 1) + ',' + (sy || 1) + ')';
    ind.classList.add('ready');
  }
  function cancelLens() {
    if (lens.raf) cancelAnimationFrame(lens.raf);
    lens.raf = 0;
    lens.animating = false;
  }
  function startLens() {
    if (!lens.animating) {
      lens.animating = true;
      lens.lastTs = 0;
      lens.raf = requestAnimationFrame(lensTick);
    }
  }
  function setLensImmediate(tab) {
    if (!tab || !tab.offsetWidth) return;
    cancelLens();
    const g = lensGeom(tab);
    lens.cx = lens.targetCx = g.cx;
    lens.vcx = 0;
    lens.y = g.y;
    lens.w = g.w;
    lens.h = g.h;
    lens.press = lens.pressTarget;
    lens.wobAmp = 0;
    const mag = 1 + lens.press * 0.5;
    applyLens(mag, mag);
  }
  function springLensTo(tab) {
    if (!tab || !tab.offsetWidth) return;
    const g = lensGeom(tab);
    lens.targetCx = g.cx;
    lens.y = g.y;
    lens.w = g.w;
    lens.h = g.h;
    // kick the jelly proportional to the jump (keeps it lively while dragging)
    const amp = Math.min(Math.abs(g.cx - lens.cx) * 0.006, 0.32);
    if (amp > lens.wobAmp * Math.exp(-7 * lens.wobT)) {
      lens.wobAmp = amp;
      lens.wobT = 0;
    }
    startLens();
  }
  function setPress(on) {
    lens.pressTarget = on ? 1 : 0;
    startLens();
  }
  function lensTick(ts) {
    const dt = lens.lastTs ? Math.min(48, ts - lens.lastTs) : 16;
    lens.lastTs = ts;
    // position spring on the centre x (so magnify scales around the icon)
    const dx = lens.targetCx - lens.cx;
    lens.vcx = (lens.vcx + dx * 0.18) * 0.72;
    lens.cx += lens.vcx;
    // magnify ramps up while pressed (glass loupe)
    lens.press += (lens.pressTarget - lens.press) * 0.18;
    const mag = 1 + lens.press * 0.5; // up to 1.5x
    // jelly: decaying cosine, X and Y opposite → wide first, then tall, then rest
    lens.wobT += dt / 1000;
    const wob = lens.wobAmp * Math.exp(-7 * lens.wobT) * Math.cos(26 * lens.wobT);
    applyLens(mag * (1 + wob), mag * (1 - wob * 0.82));
    const settled =
      Math.abs(dx) < 0.3 &&
      Math.abs(lens.vcx) < 0.3 &&
      Math.abs(lens.press - lens.pressTarget) < 0.01 &&
      Math.abs(wob) < 0.004;
    if (settled) {
      lens.cx = lens.targetCx;
      lens.vcx = 0;
      lens.press = lens.pressTarget;
      const m = 1 + lens.press * 0.5;
      applyLens(m, m);
      cancelLens();
      return;
    }
    lens.raf = requestAnimationFrame(lensTick);
  }
  function positionTabIndicator() {
    const bar = $('tab-bar');
    const active = bar && bar.querySelector('.tab.active');
    if (active) setLensImmediate(active);
  }
  function tabUnderX(x) {
    const tabs = [].slice.call($('tab-bar').querySelectorAll('.tab'));
    if (!tabs.length) return null;
    for (const t of tabs) {
      const r = t.getBoundingClientRect();
      if (x >= r.left && x <= r.right) return t;
    }
    return x < tabs[0].getBoundingClientRect().left ? tabs[0] : tabs[tabs.length - 1];
  }
  function setPreview(tab) {
    $('tab-bar').querySelectorAll('.tab').forEach((t) => t.classList.toggle('preview', t === tab));
  }
  function clearPreview() {
    $('tab-bar').querySelectorAll('.tab.preview').forEach((t) => t.classList.remove('preview'));
  }

  /* iOS-26 press-drag-release: bar lifts/grows on touch, the glass lens
     tracks the finger, snaps to the tab under it, and settles on release */
  function wireTabGesture(bar) {
    let press = null;
    bar.addEventListener('pointerdown', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      press = { id: e.pointerId, startX: e.clientX, moved: false, collapsed: chromeCollapsed };
      try { bar.setPointerCapture(e.pointerId); } catch (er) {}
      if (chromeCollapsed) return; // collapsed: a tap just re-expands (on release)
      bar.classList.add('pressing');
      setPress(true); // magnify the lens
      const tgt = tabUnderX(e.clientX) || tab;
      springLensTo(tgt);
      setPreview(tgt);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!press || press.collapsed) return;
      if (Math.abs(e.clientX - press.startX) > 4) press.moved = true;
      const tgt = tabUnderX(e.clientX);
      if (tgt) {
        springLensTo(tgt); // the lens chases the finger with stretch + bounce
        setPreview(tgt);
      }
    });
    const finish = (e, commit) => {
      if (!press) return;
      const wasCollapsed = press.collapsed;
      bar.classList.remove('pressing');
      setPress(false); // shrink the magnify back to rest size
      clearPreview();
      if (commit && !wasCollapsed) {
        const tgt = tabUnderX(e.clientX);
        if (tgt) {
          springLensTo(tgt); // settle on the released tab with a bounce
          switchTab(tgt.dataset.tab);
        }
      } else if (commit && wasCollapsed) {
        App.setChromeCollapsed(false);
      } else {
        springLensTo(bar.querySelector('.tab.active')); // cancelled → spring back
      }
      press = null;
    };
    bar.addEventListener('pointerup', (e) => finish(e, true));
    bar.addEventListener('pointercancel', (e) => finish(e, false));
  }

  function switchTab(tab) {
    if (tab === activeTab && !Views.hasSub()) return;
    const prevView = $('view-' + activeTab);
    if (prevView) scrollPos[activeTab] = prevView.scrollTop;
    Views.popAll();
    activeTab = tab;
    document.querySelectorAll('.tab').forEach((b) =>
      b.classList.toggle('active', b.dataset.tab === tab)
    );
    TABS.forEach((t) => {
      const v = $('view-' + t.id);
      if (v) v.hidden = t.id !== tab;
    });
    Views.renderRoot(tab);
    const view = $('view-' + tab);
    view.scrollTop = scrollPos[tab] || 0;
    App.setChromeCollapsed(false);
    // lens is driven by the gesture spring; only snap here for non-gesture
    // (e.g. programmatic) switches when nothing is animating
    if (!lens.animating) springLensTo($('tab-bar').querySelector('.tab.active'));
  }

  function refreshAll() {
    Views.renderRoot(activeTab);
    Views.refreshSub();
  }

  /* ============ chrome collapse ============ */
  let glassRefreshTimer = null;
  function setChromeCollapsed(v) {
    if (chromeCollapsed === v) return;
    chromeCollapsed = v;
    $('bottom-chrome').classList.toggle('collapsed', v);
    /* the lens follows the active tab as it grows/shrinks during collapse */
    positionTabIndicator();
    /* re-fit the refraction maps + lens once the width transition settles */
    clearTimeout(glassRefreshTimer);
    glassRefreshTimer = setTimeout(() => {
      Glass.refreshAll();
      positionTabIndicator();
    }, 380);
  }

  /* ============ search ============ */
  function initSearch() {
    const overlay = $('view-search');
    const input = $('search-input');
    const results = $('search-results');

    $('search-btn').addEventListener('click', () => {
      overlay.classList.add('open');
      $('bottom-chrome').classList.add('hidden-for-search');
      renderResults('');
      setTimeout(() => input.focus(), 320);
    });
    $('search-cancel').addEventListener('click', closeSearch);
    function closeSearch() {
      overlay.classList.remove('open');
      $('bottom-chrome').classList.remove('hidden-for-search');
      input.value = '';
      input.blur();
    }
    input.addEventListener('input', () => renderResults(input.value));

    function renderResults(q) {
      results.innerHTML = '';
      const trimmed = (q || '').trim();
      if (!trimmed) {
        results.appendChild(
          el('div', 'hint', 'Tìm theo tên bài hát, nghệ sĩ hoặc album trong thư viện của bạn.<br><br>Mẹo: dán link YouTube vào đây để thêm nhanh bài hát.')
        );
        return;
      }
      /* paste a YouTube link -> quick add */
      if (YTUtil.extractId(trimmed)) {
        const add = el('div', 'hint');
        add.innerHTML =
          '<button class="add-btn" style="background:var(--accent);color:#fff;font-weight:600;padding:12px 22px;border-radius:22px">Thêm bài hát từ link YouTube này</button>';
        add.querySelector('button').addEventListener('click', () => {
          closeSearch();
          App.openAddSheet(trimmed);
        });
        results.appendChild(add);
      }
      const found = Library.search(trimmed);
      if (!found.length && !YTUtil.extractId(trimmed)) {
        results.appendChild(el('div', 'hint', 'Không tìm thấy kết quả cho “' + esc(trimmed) + '”.'));
        return;
      }
      found.forEach((s) => results.appendChild(Views.songRow(s, { queue: found, swipeDelete: true })));
    }

    /* lift field above mobile keyboard */
    if (window.visualViewport) {
      const wrap = $('search-field-wrap');
      window.visualViewport.addEventListener('resize', () => {
        const lift = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
        wrap.style.transform = lift > 40 ? 'translateY(-' + lift + 'px)' : '';
      });
    }
  }

  /* ============ sheets ============ */
  function openSheet(contentBuilder, title) {
    const backdrop = $('sheet-backdrop');
    const sheet = $('sheet');
    sheet.querySelector('.sheet-title').textContent = title || '';
    const body = sheet.querySelector('.sheet-body');
    body.innerHTML = '';
    contentBuilder(body, closeSheet);
    backdrop.classList.add('open');
    sheet.classList.add('open');
    function closeSheet() {
      backdrop.classList.remove('open');
      sheet.classList.remove('open');
    }
    backdrop.onclick = closeSheet;
    return closeSheet;
  }

  /* ---- add / edit song ---- */
  function openAddSheet(prefillUrl, editSong) {
    openSheet((body, close) => {
      let mode = editSong ? editSong.type : 'youtube';
      let coverFile = null;
      let audioFile = null;

      body.innerHTML =
        '<div class="seg"><button data-m="youtube">Link YouTube</button><button data-m="file">Tải file lên</button></div>' +
        '<div id="f-youtube"><div class="f-label">LINK YOUTUBE</div>' +
        '<input class="f-input" id="f-url" placeholder="https://youtube.com/watch?v=..." inputmode="url" autocomplete="off" spellcheck="false">' +
        '<div class="f-hint">Dán link — tên bài & nghệ sĩ sẽ tự điền. Nhạc phát qua trình phát YouTube chạy ẩn phía sau.</div></div>' +
        '<div id="f-file" style="display:none"><div class="f-label">FILE NHẠC (MP3, M4A...)</div>' +
        '<button class="f-file" id="f-audio-btn">' + Icons.upload + '<span id="f-audio-name">Chọn file nhạc từ máy…</span></button>' +
        '<input type="file" id="f-audio" accept="audio/*" hidden></div>' +
        '<div class="f-label">TÊN BÀI HÁT</div><input class="f-input" id="f-title" placeholder="Tên bài hát">' +
        '<div class="f-label">NGHỆ SĨ</div><input class="f-input" id="f-artist" placeholder="Tên nghệ sĩ">' +
        '<div class="f-label">ALBUM (TUỲ CHỌN)</div><input class="f-input" id="f-album" placeholder="Tên album">' +
        '<div class="f-label">ẢNH BÌA (TUỲ CHỌN)</div>' +
        '<button class="f-file" id="f-cover-btn">' + Icons.image + '<span id="f-cover-name">Chọn ảnh bìa…</span></button>' +
        '<input type="file" id="f-cover" accept="image/*" hidden>' +
        '<img class="f-cover-preview" id="f-cover-prev" alt="">' +
        '<button class="f-submit" id="f-submit">' + (editSong ? 'Lưu thay đổi' : 'Thêm vào thư viện') + '</button>';

      const segBtns = body.querySelectorAll('.seg button');
      function setMode(m) {
        mode = m;
        segBtns.forEach((b) => b.classList.toggle('active', b.dataset.m === m));
        body.querySelector('#f-youtube').style.display = m === 'youtube' ? '' : 'none';
        body.querySelector('#f-file').style.display = m === 'file' ? '' : 'none';
      }
      segBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));
      setMode(mode);
      if (editSong) {
        body.querySelector('.seg').style.display = 'none';
        if (editSong.type === 'youtube') {
          body.querySelector('#f-url').value = 'https://youtu.be/' + editSong.ytId;
        } else {
          /* changing the audio file isn't supported — hide both source sections */
          body.querySelector('#f-youtube').style.display = 'none';
          body.querySelector('#f-file').style.display = 'none';
        }
        body.querySelector('#f-title').value = editSong.title || '';
        body.querySelector('#f-artist').value = editSong.artist || '';
        body.querySelector('#f-album').value = editSong.album || '';
      }
      if (prefillUrl) body.querySelector('#f-url').value = prefillUrl;

      /* auto-fill meta from oEmbed when a link is pasted */
      const urlInput = body.querySelector('#f-url');
      let lastFetched = '';
      urlInput.addEventListener('input', async () => {
        const id = YTUtil.extractId(urlInput.value);
        if (!id || id === lastFetched) return;
        lastFetched = id;
        const meta = await YTUtil.fetchMeta(id);
        if (meta) {
          const t = body.querySelector('#f-title');
          const a = body.querySelector('#f-artist');
          if (!t.value) t.value = meta.title;
          if (!a.value) a.value = meta.author;
        }
      });
      if (prefillUrl) urlInput.dispatchEvent(new Event('input'));

      body.querySelector('#f-audio-btn').addEventListener('click', () => body.querySelector('#f-audio').click());
      body.querySelector('#f-audio').addEventListener('change', (e) => {
        audioFile = e.target.files[0] || null;
        const nameEl = body.querySelector('#f-audio-name');
        nameEl.textContent = audioFile ? audioFile.name : 'Chọn file nhạc từ máy…';
        body.querySelector('#f-audio-btn').classList.toggle('has', !!audioFile);
        if (audioFile && !body.querySelector('#f-title').value) {
          body.querySelector('#f-title').value = audioFile.name.replace(/\.[^.]+$/, '');
        }
      });
      body.querySelector('#f-cover-btn').addEventListener('click', () => body.querySelector('#f-cover').click());
      body.querySelector('#f-cover').addEventListener('change', (e) => {
        coverFile = e.target.files[0] || null;
        body.querySelector('#f-cover-name').textContent = coverFile ? coverFile.name : 'Chọn ảnh bìa…';
        body.querySelector('#f-cover-btn').classList.toggle('has', !!coverFile);
        const prev = body.querySelector('#f-cover-prev');
        if (coverFile) {
          prev.src = URL.createObjectURL(coverFile);
          prev.classList.add('show');
        } else prev.classList.remove('show');
      });

      body.querySelector('#f-submit').addEventListener('click', async () => {
        const btn = body.querySelector('#f-submit');
        btn.disabled = true;
        btn.textContent = 'Đang xử lý…';
        try {
          const fields = {
            title: body.querySelector('#f-title').value,
            artist: body.querySelector('#f-artist').value,
            album: body.querySelector('#f-album').value,
            coverFile,
          };
          if (editSong) {
            const patch = {
              title: fields.title.trim() || editSong.title,
              artist: fields.artist.trim() || editSong.artist,
              album: fields.album.trim(),
            };
            if (coverFile) patch.coverData = await Util.fileToCoverDataUrl(coverFile);
            /* a changed YouTube link is applied for real */
            if (editSong.type === 'youtube') {
              const newId = YTUtil.extractId(urlInput.value);
              if (newId && newId !== editSong.ytId) {
                patch.ytId = newId;
                if (!coverFile && !editSong.coverData && !editSong.coverBlob) {
                  patch.coverUrl = await YTUtil.bestThumb(newId);
                }
              }
            }
            await Library.updateSong(editSong.id, patch);
            Util.toast('Đã lưu thay đổi');
          } else if (mode === 'youtube') {
            await Library.addYouTube({ url: urlInput.value, ...fields });
            Util.toast('Đã thêm bài hát từ YouTube');
          } else {
            await Library.addFile({ audioFile, ...fields });
            Util.toast('Đã thêm bài hát vào thư viện');
          }
          close();
          refreshAll();
        } catch (err) {
          Util.toast(err.message || 'Có lỗi xảy ra.');
          btn.disabled = false;
          btn.textContent = editSong ? 'Lưu thay đổi' : 'Thêm vào thư viện';
        }
      });
    }, editSong ? 'Sửa bài hát' : 'Thêm bài hát');
  }

  /* ---- song action sheet ---- */
  function openSongSheet(song) {
    openSheet((body, close) => {
      const head = el('div', 'as-song');
      head.innerHTML =
        '<img src="' + esc(song.coverDisplayUrl) + '" alt=""><div><div class="t">' + esc(song.title) + '</div><div class="a">' + esc(song.artist) + '</div></div>';
      body.appendChild(head);

      const actions = [
        { icon: 'play', label: 'Phát', fn: () => App.playFromGesture([song], 0) },
        { icon: 'playNext', label: 'Phát tiếp theo', fn: () => { Player.playNext(song); Util.toast('Sẽ phát tiếp theo'); } },
        { icon: 'queue', label: 'Thêm vào cuối hàng đợi', fn: () => { Player.addToQueue(song); Util.toast('Đã thêm vào hàng đợi'); } },
        { icon: song.favorite ? 'star' : 'starOutline', label: song.favorite ? 'Bỏ yêu thích' : 'Yêu thích', fn: async () => { const on = await Library.toggleFavorite(song.id); Util.toast(on ? 'Đã thêm vào Bài Hát Yêu Thích' : 'Đã bỏ yêu thích'); refreshAll(); } },
        { icon: 'playlist', label: 'Thêm vào playlist…', fn: () => openPickPlaylistSheet(song) },
        song.type === 'youtube' && Player.current() && Player.current().id === song.id
          ? { icon: 'video', label: 'Xem video', fn: () => NowPlaying.toggleVideo() }
          : null,
        { icon: 'edit', label: 'Sửa thông tin', fn: () => openAddSheet(null, song) },
        { icon: 'trash', label: 'Xoá khỏi thư viện', danger: true, fn: async () => {
            await Library.removeSong(song.id);
            Player.removeFromQueue(song.id);
            Util.toast('Đã xoá “' + song.title + '”');
            refreshAll();
          } },
      ];
      actions.filter(Boolean).forEach((a) => {
        const b = el('button', 'as-row' + (a.danger ? ' danger' : ''));
        b.innerHTML = Icons[a.icon] + '<span>' + esc(a.label) + '</span>';
        b.addEventListener('click', () => {
          close();
          setTimeout(a.fn, 120);
        });
        body.appendChild(b);
      });
    }, '');
  }

  function openPickPlaylistSheet(song) {
    openSheet((body, close) => {
      const create = el('button', 'as-row');
      create.innerHTML = Icons.plus + '<span>Tạo playlist mới…</span>';
      create.addEventListener('click', async () => {
        const name = prompt('Tên playlist mới:');
        if (name == null) return;
        const pl = await Library.createPlaylist(name.trim() || 'Playlist mới');
        await Library.addToPlaylist(pl.id, song.id);
        Util.toast('Đã thêm vào “' + pl.name + '”');
        close();
        refreshAll();
      });
      body.appendChild(create);
      Library.playlists.forEach((pl) => {
        const b = el('button', 'as-row');
        b.innerHTML = Icons.playlist + '<span>' + esc(pl.name) + '</span>';
        b.addEventListener('click', async () => {
          await Library.addToPlaylist(pl.id, song.id);
          Util.toast('Đã thêm vào “' + pl.name + '”');
          close();
          refreshAll();
        });
        body.appendChild(b);
      });
      if (!Library.playlists.length) {
        body.appendChild(el('div', 'f-hint', 'Chưa có playlist nào — tạo mới ở trên.'));
      }
    }, 'Thêm vào playlist');
  }

  function openPlaylistSheet(pl) {
    openSheet((body, close) => {
      const ren = el('button', 'as-row');
      ren.innerHTML = Icons.edit + '<span>Đổi tên playlist</span>';
      ren.addEventListener('click', async () => {
        const name = prompt('Tên mới:', pl.name);
        if (name == null || !name.trim()) return;
        pl.name = name.trim();
        await DB.putPlaylist(pl);
        close();
        refreshAll();
      });
      body.appendChild(ren);
      const dele = el('button', 'as-row danger');
      dele.innerHTML = Icons.trash + '<span>Xoá playlist</span>';
      dele.addEventListener('click', async () => {
        await Library.deletePlaylist(pl.id);
        Util.toast('Đã xoá playlist');
        close();
        Views.popAll();
        refreshAll();
      });
      body.appendChild(dele);
    }, pl.name);
  }

  function openLibrarySheet() {
    openSheet((body, close) => {
      const a1 = el('button', 'as-row');
      a1.innerHTML = Icons.plus + '<span>Thêm bài hát</span>';
      a1.addEventListener('click', () => {
        close();
        setTimeout(() => openAddSheet(), 120);
      });
      body.appendChild(a1);
      const a2 = el('button', 'as-row');
      a2.innerHTML = Icons.playlist + '<span>Tạo playlist mới</span>';
      a2.addEventListener('click', () => {
        close();
        setTimeout(() => App.createPlaylistPrompt(), 120);
      });
      body.appendChild(a2);
      const a3 = el('button', 'as-row');
      a3.innerHTML = Icons.album + '<span>Cài đặt giao diện</span>';
      a3.addEventListener('click', () => {
        close();
        setTimeout(() => openSettingsSheet(), 120);
      });
      body.appendChild(a3);
    }, 'Thư viện');
  }

  /* ---- settings: Liquid Glass translucency ---- */
  // slider 0..100 (độ trong); higher = clearer = lower fill alpha
  function applyGlassTranslucency(val) {
    const alpha = (0.5 - (val / 100) * 0.42).toFixed(3); // 0%→0.50, 100%→0.08
    document.documentElement.style.setProperty('--glass-alpha', alpha);
  }
  function loadGlassTranslucency() {
    const v = parseInt(localStorage.getItem('glass-translucency') || '55', 10);
    applyGlassTranslucency(v);
  }

  /* ---- settings: theme (dark / light / auto) ---- */
  function applyTheme(theme) {
    const useLight =
      theme === 'light' ||
      (theme === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
    document.documentElement.classList.toggle('light', useLight);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', useLight ? '#f2f2f7' : '#000000');
  }
  function loadTheme() {
    applyTheme(localStorage.getItem('theme') || 'dark');
  }

  function openSettingsSheet() {
    openSheet((body, close) => {
      const saved = parseInt(localStorage.getItem('glass-translucency') || '55', 10);
      const theme = localStorage.getItem('theme') || 'dark';
      const themeBtn = (val, label) =>
        '<button class="seg-btn' + (theme === val ? ' active' : '') + '" data-theme="' + val + '">' + label + '</button>';
      body.innerHTML =
        '<div class="f-label" style="margin-top:2px">GIAO DIỆN</div>' +
        '<div class="seg" id="theme-seg">' +
        themeBtn('dark', 'Tối') + themeBtn('light', 'Sáng') + themeBtn('auto', 'Tự động') +
        '</div>' +
        '<div class="set-row"><span class="set-label">Độ trong của Liquid Glass</span><span class="set-val" id="glass-val">' + saved + '%</span></div>' +
        '<div class="set-preview"><div class="set-glass">Liquid Glass</div></div>' +
        '<input type="range" class="set-slider" id="glass-slider" min="0" max="100" value="' + saved + '">' +
        '<p class="f-hint">Chỉnh độ trong suốt của thanh tab, mini player và các lớp kính. Kéo càng sang phải càng trong (nhìn xuyên thấu nhiều hơn) — đúng kiểu iOS 26.</p>' +
        '<div class="set-divider"></div>' +
        '<button class="as-row" id="set-add">' + Icons.plus + '<span>Thêm bài hát</span></button>' +
        '<button class="as-row" id="set-reset">' + Icons.repeat + '<span>Khôi phục mặc định</span></button>';
      body.querySelectorAll('#theme-seg .seg-btn').forEach((b) => {
        b.addEventListener('click', () => {
          const t = b.dataset.theme;
          localStorage.setItem('theme', t);
          applyTheme(t);
          body.querySelectorAll('#theme-seg .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
          Glass.refreshAll();
        });
      });
      const slider = body.querySelector('#glass-slider');
      const valEl = body.querySelector('#glass-val');
      slider.addEventListener('input', () => {
        const v = +slider.value;
        applyGlassTranslucency(v);
        valEl.textContent = v + '%';
        localStorage.setItem('glass-translucency', String(v));
        Glass.refreshAll();
      });
      body.querySelector('#set-add').addEventListener('click', () => {
        close();
        setTimeout(() => openAddSheet(), 120);
      });
      body.querySelector('#set-reset').addEventListener('click', () => {
        slider.value = 55;
        applyGlassTranslucency(55);
        valEl.textContent = '55%';
        localStorage.setItem('glass-translucency', '55');
        Glass.refreshAll();
      });
    }, 'Cài đặt');
  }

  async function createPlaylistPrompt() {
    const name = prompt('Tên playlist mới:');
    if (name == null) return;
    await Library.createPlaylist(name.trim() || 'Playlist mới');
    refreshAll();
    Views.refreshSub();
  }

  /* delete a song from the whole library (used by swipe-to-delete) */
  async function deleteSong(song) {
    await Library.removeSong(song.id);
    Player.removeFromQueue(song.id);
    Util.toast('Đã xoá “' + song.title + '”');
    refreshAll();
  }

  /* ============ play + history ============ */
  function playFromGesture(list, index, opts) {
    Player.playQueue(list, index, opts || {});
    saveQueueSoon();
  }

  let saveTimer = null;
  function saveQueueSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const cur = Player.current();
      DB.kvSet('last-queue', {
        ids: Player.state.queue.map((s) => s.id),
        currentId: cur ? cur.id : null,
      });
    }, 800);
  }

  async function restoreQueue() {
    const last = await DB.kvGet('last-queue', null);
    if (!last || !last.ids || !last.ids.length) return;
    const songs = last.ids.map((id) => Library.byId(id)).filter(Boolean);
    if (!songs.length) return;
    let idx = songs.findIndex((s) => s.id === last.currentId);
    if (idx < 0) idx = 0;
    /* restore UI without autoplay (browsers block it anyway);
       the first play press loads the backend */
    Player.restore(songs, idx);
    NowPlaying.updateTrackUI(songs[idx]);
  }

  /* ============ boot ============ */
  async function boot() {
    loadTheme();
    loadGlassTranslucency();
    buildTabBar();
    NowPlaying.init();
    initSearch();
    window.addEventListener('resize', positionTabIndicator);

    await Library.init();
    await migrateLocalToCloud();
    await seedIfFirstRun();

    TABS.forEach((t) => {
      const v = $('view-' + t.id);
      v.hidden = t.id !== activeTab;
    });
    Views.renderRoot(activeTab);
    await restoreQueue();

    Player.on('change', (e) => {
      /* count a play only when a track actually loads, not on queue edits */
      if (e.song && e.loadedTrack) Library.notePlayed(e.song.id);
      saveQueueSoon();
    });
    Player.on('track-ended', () => saveQueueSoon());

    /* liquid glass refraction (Chromium) */
    Glass.register($('tab-bar'), 'lgf-tab', 'lgi-tab');
    Glass.register($('mini-player'), 'lgf-mini', 'lgi-mini');
    Glass.register($('search-btn'), 'lgf-search', 'lgi-search');

    /* warm up the hidden YouTube player early so first tap is fast */
    YTUtil.loadAPI().catch(() => {});

    if (location.protocol === 'file:') {
      Util.toast('Hãy chạy qua máy chủ web (vd: npx serve) — mở file trực tiếp sẽ không phát được YouTube.');
    } else if (DB.cloud && !didMigrate) {
      Util.toast('☁️ Đã đồng bộ với kho lưu trữ đám mây');
    }
  }

  window.App = {
    playFromGesture,
    setChromeCollapsed,
    openAddSheet,
    openSongSheet,
    openPlaylistSheet,
    openLibrarySheet,
    openSettingsSheet,
    createPlaylistPrompt,
    deleteSong,
    refreshAll,
  };

  document.addEventListener('DOMContentLoaded', boot);
})();
