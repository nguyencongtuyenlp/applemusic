/* ============================================================
   views.js — screen renderers
   Root tabs: home / discover / radio / library.
   Sub-screens (pushed): playlists, artists, albums, songs,
   downloads, playlist-detail, artist-detail, album-detail.
   ============================================================ */
(function () {
  'use strict';

  const { el, esc, fmtTime } = Util;

  /* ============ small builders ============ */

  function songRow(song, opts) {
    opts = opts || {};
    const row = el('div', 'row');
    let wrap = null; // swipe wrapper, when swipeDelete is on
    let favGutter = '';
    if (song.favorite && opts.favGutter !== false) favGutter = '<span class="fav-gutter">★</span>';
    const isCurrent = Player.current() && Player.current().id === song.id;
    row.innerHTML =
      favGutter +
      '<img class="row-art" loading="lazy" src="' + esc(song.coverDisplayUrl) + '" alt="">' +
      '<div class="row-main"><div class="row-texts">' +
      '<div class="row-title">' + (isCurrent ? '<span class="now-bars">♫ </span>' : '') + esc(song.title) + '</div>' +
      '<div class="row-sub">' + esc(song.artist) + '</div>' +
      '</div>' +
      '<button class="row-more" aria-label="Tùy chọn">' + Icons.more + '</button></div>';
    row.querySelector('.row-more').addEventListener('click', (e) => {
      e.stopPropagation();
      App.openSongSheet(song);
    });
    row.addEventListener('click', () => {
      if (row._swiped) return; // ignore the click that ends a swipe
      if (wrap && wrap.classList.contains('open')) {
        closeSwipe(wrap);
        return;
      }
      const list = opts.queue || [song];
      const idx = opts.queue ? opts.queue.indexOf(song) : 0;
      App.playFromGesture(list, idx);
    });

    if (!opts.swipeDelete) return row;

    // ----- swipe-from-right-to-left to delete (iOS style) -----
    wrap = el('div', 'swipe-row');
    const action = el('div', 'swipe-action');
    action.innerHTML =
      '<button class="swipe-del" aria-label="Xoá">' + Icons.trash + '<span>Xoá</span></button>';
    row.classList.add('swipe-content');
    wrap.appendChild(action);
    wrap.appendChild(row);
    action.querySelector('.swipe-del').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmSwipeDelete(song, wrap, opts);
    });
    wireSwipeDelete(wrap, row, song, opts);
    return wrap;
  }

  /* ---------- swipe-to-delete machinery ---------- */
  const SWIPE_REVEAL = 84;
  let openSwipe = null;
  function closeSwipe(wrap) {
    if (!wrap) return;
    wrap.classList.remove('open');
    const c = wrap.querySelector('.swipe-content');
    if (c) {
      c.style.transition = '';
      c.style.transform = '';
    }
    if (openSwipe === wrap) openSwipe = null;
  }
  function confirmSwipeDelete(song, wrap, opts) {
    openSwipe = null;
    wrap.style.height = wrap.offsetHeight + 'px';
    void wrap.offsetWidth;
    wrap.classList.add('removing');
    wrap.style.height = '0px';
    wrap.style.opacity = '0';
    setTimeout(() => {
      if (opts.onDelete) opts.onDelete(song);
      else App.deleteSong(song);
    }, 240);
  }
  function wireSwipeDelete(wrap, content, song, opts) {
    let sx = 0, sy = 0, dx = 0, horiz = null, active = false;
    content.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      sx = e.clientX; sy = e.clientY; dx = 0; horiz = null; active = true;
      content._swiped = false;
    });
    content.addEventListener('pointermove', (e) => {
      if (!active) return;
      const mdx = e.clientX - sx, mdy = e.clientY - sy;
      if (horiz === null) {
        if (Math.abs(mdx) > 8 || Math.abs(mdy) > 8) horiz = Math.abs(mdx) > Math.abs(mdy);
        else return;
      }
      if (!horiz) { active = false; return; } // vertical → let the list scroll
      e.preventDefault();
      try { content.setPointerCapture(e.pointerId); } catch (er) {}
      if (openSwipe && openSwipe !== wrap) closeSwipe(openSwipe);
      const base = wrap.classList.contains('open') ? -SWIPE_REVEAL : 0;
      dx = Math.min(0, Math.max(-window.innerWidth, base + mdx));
      content.style.transition = 'none';
      content.style.transform = 'translateX(' + dx + 'px)';
      content._swiped = true;
    });
    const end = () => {
      if (!active) return;
      active = false;
      content.style.transition = '';
      if (!horiz) return;
      const w = wrap.offsetWidth || 320;
      if (dx < -w * 0.6) {
        confirmSwipeDelete(song, wrap, opts); // long swipe = delete
      } else if (dx < -SWIPE_REVEAL * 0.5) {
        wrap.classList.add('open'); // reveal the Xoá button
        content.style.transform = 'translateX(' + -SWIPE_REVEAL + 'px)';
        openSwipe = wrap;
      } else {
        closeSwipe(wrap);
      }
      setTimeout(() => { content._swiped = false; }, 60);
    };
    content.addEventListener('pointerup', end);
    content.addEventListener('pointercancel', end);
  }

  function tile(song, queue) {
    const t = el('div', 'tile');
    t.innerHTML =
      '<img class="tile-art" loading="lazy" src="' + esc(song.coverDisplayUrl) + '" alt="">' +
      '<div class="tile-title">' + esc(song.title) + (song.favorite ? ' <span class="fav-star">★</span>' : '') + '</div>' +
      '<div class="tile-sub">' + esc(song.artist) + '</div>';
    t.addEventListener('click', () => {
      const list = queue || [song];
      App.playFromGesture(list, list.indexOf(song));
    });
    return t;
  }

  function sectionHead(title, withChevron, leadStarOutline) {
    const h = el('div', 'section-head');
    h.innerHTML =
      (leadStarOutline ? '<span class="star-lead">' + Icons.starOutline + '</span>' : '') +
      '<span>' + esc(title) + '</span>' +
      (withChevron ? '<span class="chev">' + Icons.chevR.replace('<svg ', '<svg width="15" height="15" ') + '</span>' : '');
    return h;
  }

  function emptyState(title, desc, btnLabel) {
    const e = el('div', 'empty');
    e.innerHTML =
      '<div class="big">♫</div><div class="t">' + esc(title) + '</div><div class="d">' + esc(desc) + '</div>' +
      (btnLabel ? '<button class="add-btn">' + esc(btnLabel) + '</button>' : '');
    const b = e.querySelector('.add-btn');
    if (b) b.addEventListener('click', () => App.openAddSheet());
    return e;
  }

  function actionPills(container, songs) {
    const pills = el('div', 'action-pills');
    pills.innerHTML =
      '<button class="pill-action" id="pp-play">' + Icons.play + ' Phát</button>' +
      '<button class="pill-action" id="pp-shuffle">' + Icons.shuffle + ' Xáo trộn</button>';
    pills.querySelector('#pp-play').addEventListener('click', () => {
      if (songs().length) App.playFromGesture(songs(), 0);
    });
    pills.querySelector('#pp-shuffle').addEventListener('click', () => {
      if (songs().length) App.playFromGesture(songs(), 0, { shuffle: true });
    });
    container.appendChild(pills);
  }

  /* watch scroll: collapse glass header + chrome.
     re-render safe: the previous listener is removed first. */
  function wireScroll(view, smallTitle) {
    let header = view.querySelector('.glass-header');
    if (!header && smallTitle) {
      header = el('div', 'glass-header', '<span>' + esc(smallTitle) + '</span>');
      view.appendChild(header);
    }
    if (view._scrollHandler) view.removeEventListener('scroll', view._scrollHandler);
    let lastY = view.scrollTop;
    view._scrollHandler = () => {
      const y = view.scrollTop;
      if (header) header.classList.toggle('on', y > 46);
      const dy = y - lastY;
      if (Math.abs(dy) > 14) {
        if (dy > 0 && y > 140) App.setChromeCollapsed(true);
        else if (dy < 0) App.setChromeCollapsed(false);
        lastY = y;
      }
      if (y <= 10) App.setChromeCollapsed(false);
    };
    view.addEventListener('scroll', view._scrollHandler, { passive: true });
  }

  /* ============ HOME ============ */
  function renderHome(view) {
    view.innerHTML = '';
    const head = el('div', 'page-head');
    head.innerHTML =
      '<h1 class="page-title">Trang chủ</h1><button class="avatar" aria-label="Hồ sơ">♪</button>';
    head.querySelector('.avatar').addEventListener('click', () => App.openAddSheet());
    view.appendChild(head);

    /* — Lựa Chọn Hàng Đầu Cho Bạn — */
    const sec1 = el('div', 'section');
    sec1.appendChild(sectionHead('Lựa Chọn Hàng Đầu Cho Bạn'));
    const sc1 = el('div', 'h-scroll');

    const favs = Library.favorites();
    const cardFav = el('div', 'big-card');
    cardFav.style.background = 'linear-gradient(180deg,#a9a9ad,#8e8e93)';
    cardFav.innerHTML =
      '<div class="inset-tile"><svg viewBox="0 0 24 24" fill="#fa2d48">' +
      '<path d="m12 2.7 2.55 5.84 6.35.6c.5.05.7.67.32 1l-4.79 4.2 1.41 6.21a.55.55 0 0 1-.82.6L12 17.9l-5.47 3.25a.55.55 0 0 1-.82-.6l1.41-6.21-4.79-4.2a.55.55 0 0 1 .32-1l6.35-.6L11.55 2.7a.55.55 0 0 1 .9 0z"/></svg></div>' +
      '<div class="caption"><div class="cap-eyebrow">Do bạn tạo</div>' +
      '<div class="cap-title">Bài Hát Yêu Thích</div>' +
      '<div class="cap-desc">Những bài hát giúp bạn vươn tới những vì sao.</div></div>';
    cardFav.addEventListener('click', () => {
      if (favs.length) App.playFromGesture(favs, 0);
      else Util.toast('Chưa có bài yêu thích — bấm ★ trong tùy chọn bài hát.');
    });
    sc1.appendChild(cardFav);

    const cardMix = el('div', 'big-card scrimmed');
    cardMix.style.background =
      'conic-gradient(from 220deg at 70% 30%, #ff2d55, #ff9500, #ff2d55, #af52de, #ff2d55)';
    cardMix.innerHTML =
      '<div class="caption"><div class="cap-eyebrow" style="color:#ffb3c0">Dành Cho Bạn</div>' +
      '<div class="cap-title" style="font-size:22px;line-height:1.15">Đài Phát Thanh<br>Cá Nhân</div></div>';
    cardMix.addEventListener('click', () => {
      const all = Library.songs;
      if (all.length) App.playFromGesture(all, 0, { shuffle: true });
      else Util.toast('Thư viện trống — thêm bài hát trước nhé.');
    });
    sc1.appendChild(cardMix);

    const cardNew = el('div', 'big-card scrimmed');
    cardNew.style.background = 'linear-gradient(160deg,#0a84ff,#5e5ce6 55%,#bf5af2)';
    cardNew.innerHTML =
      '<div class="caption"><div class="cap-eyebrow" style="color:#b8d6ff">Mới Thêm</div>' +
      '<div class="cap-title" style="font-size:22px;line-height:1.15">Nhạc Mới<br>Của Bạn</div></div>';
    cardNew.addEventListener('click', () => {
      const all = Library.songs;
      if (all.length) App.playFromGesture(all, 0);
      else Util.toast('Thư viện trống — thêm bài hát trước nhé.');
    });
    sc1.appendChild(cardNew);
    sec1.appendChild(sc1);
    view.appendChild(sec1);

    /* — Nghe Gần Đây — */
    const recents = Library.recentSongs(12);
    const sec2 = el('div', 'section');
    sec2.appendChild(sectionHead('Nghe Gần Đây', true));
    if (recents.length) {
      const sc2 = el('div', 'h-scroll');
      recents.forEach((s) => sc2.appendChild(tile(s, recents)));
      sec2.appendChild(sc2);
    } else {
      sec2.appendChild(emptyState('Chưa nghe bài nào', 'Phát một bài hát và nó sẽ xuất hiện ở đây.', 'Thêm bài hát'));
    }
    view.appendChild(sec2);

    /* — Đã thêm gần đây — */
    if (Library.songs.length) {
      const sec3 = el('div', 'section');
      sec3.appendChild(sectionHead('Đã Thêm Gần Đây', true));
      const sc3 = el('div', 'h-scroll');
      Library.songs.slice(0, 12).forEach((s) => sc3.appendChild(tile(s, Library.songs)));
      sec3.appendChild(sc3);
      view.appendChild(sec3);
    }

    /* — Nhạc Thư Giãn (favorites & most played mix) — */
    const most = Library.songs.slice().sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 10);
    if (most.length > 2) {
      const sec4 = el('div', 'section');
      sec4.appendChild(sectionHead('Nghe Nhiều Nhất'));
      const sc4 = el('div', 'h-scroll');
      most.forEach((s) => sc4.appendChild(tile(s, most)));
      sec4.appendChild(sc4);
      view.appendChild(sec4);
    }

    wireScroll(view, 'Trang chủ');
  }

  /* ============ DISCOVER (Khám phá) ============ */
  function renderDiscover(view) {
    view.innerHTML = '';
    const head = el('div', 'page-head');
    head.innerHTML =
      '<h1 class="page-title">Khám phá</h1><button class="avatar" aria-label="Hồ sơ">♪</button>';
    head.querySelector('.avatar').addEventListener('click', () => App.openAddSheet());
    view.appendChild(head);

    /* hero group */
    view.appendChild(el('div', 'eyebrow', 'PLAYLIST MỚI CẬP NHẬT'));
    view.appendChild(el('div', 'linked-title', 'Các Bản Hit Mới'));
    view.appendChild(el('div', 'linked-sub', 'Những bài hot trong thư viện'));

    const heroScroll = el('div', 'h-scroll');
    const heroes = [
      { word: "Today's<br>Hits", grad: 'linear-gradient(135deg,#1c1c1e 30%,#3a3a3c)', wordColor: 'linear-gradient(90deg,#ffd60a,#ff9f0a)', desc: 'Những bản nhạc đang thịnh hành trong thư viện của bạn.', mode: 'recent' },
      { word: 'Pop<br>Việt ✦', grad: 'linear-gradient(135deg,#ff2d55,#ff375f 60%,#c91341)', wordColor: '#fff', desc: 'Thả mình cùng những giai điệu Việt sôi động.', mode: 'shuffle' },
      { word: 'Chill<br>Mix', grad: 'linear-gradient(135deg,#30d158,#0a84ff)', wordColor: '#eafff2', desc: 'Giai điệu nhẹ nhàng cho ngày dài thư thái.', mode: 'shuffle' },
    ];
    heroes.forEach((h) => {
      const c = el('div', 'hero-card');
      c.innerHTML =
        '<div class="hero-bg" style="background:' + h.grad + '"></div>' +
        '<div class="hero-word" style="' +
        (h.wordColor.indexOf('gradient') >= 0
          ? 'background:' + h.wordColor + ';-webkit-background-clip:text;background-clip:text;color:transparent'
          : 'color:' + h.wordColor) +
        '">' + h.word + '</div>' +
        '<div class="caption">' + esc(h.desc) + '</div>';
      c.addEventListener('click', () => {
        const all = h.mode === 'recent' ? (Library.recentSongs(20).length ? Library.recentSongs(20) : Library.songs) : Library.songs;
        if (all.length) App.playFromGesture(all, 0, { shuffle: h.mode === 'shuffle' });
        else Util.toast('Thư viện trống — thêm bài hát trước nhé.');
      });
      heroScroll.appendChild(c);
    });
    view.appendChild(heroScroll);

    /* viral hits — paged song columns */
    const sec = el('div', 'section');
    sec.appendChild(sectionHead('Bấm Ưa Thích Các Bản Hit Viral', true, true));
    const songs = Library.songs;
    if (!songs.length) {
      sec.appendChild(emptyState('Chưa có bài hát', 'Thêm nhạc từ YouTube hoặc tải file lên để bắt đầu.', 'Thêm bài hát'));
    } else {
      const pager = el('div', 'h-scroll');
      pager.style.scrollSnapType = 'x mandatory';
      for (let i = 0; i < songs.length; i += 4) {
        const col = el('div');
        col.style.width = 'calc(100vw - 70px)';
        col.style.maxWidth = '350px';
        col.style.flex = 'none';
        songs.slice(i, i + 4).forEach((s) => {
          const r = songRow(s, { queue: songs, favGutter: false });
          r.style.paddingLeft = '0';
          col.appendChild(r);
        });
        pager.appendChild(col);
      }
      sec.appendChild(pager);
    }
    view.appendChild(sec);

    /* recently added grid */
    if (Library.songs.length) {
      const sec2 = el('div', 'section');
      sec2.appendChild(sectionHead('Có Thể Bạn Sẽ Thích'));
      const grid = el('div', 'grid2');
      Library.songs.slice(0, 6).forEach((s) => {
        const d = el('div');
        d.innerHTML =
          '<img class="g-art" loading="lazy" src="' + esc(s.coverDisplayUrl) + '" alt="">' +
          '<div class="g-title">' + esc(s.title) + '</div><div class="g-sub">' + esc(s.artist) + '</div>';
        d.addEventListener('click', () => App.playFromGesture(Library.songs, Library.songs.indexOf(s)));
        grid.appendChild(d);
      });
      sec2.appendChild(grid);
      view.appendChild(sec2);
    }

    wireScroll(view, 'Khám phá');
  }

  /* ============ RADIO ============ */
  const STATIONS = [
    { word: '1', color: '#fa2d48', bg: '#fff' },
    { word: 'HITS', color: '#0a84ff', bg: '#fff', italic: true },
    { word: 'VIỆT', color: '#e6a817', bg: '#fff' },
    { word: 'LOFI', color: '#ff2d92', bg: '#fff' },
    { word: 'club', color: '#111', bg: '#fff' },
    { word: 'Chill', color: '#2997ff', bg: '#fff' },
  ];
  function renderRadio(view) {
    view.innerHTML = '';
    const head = el('div', 'page-head');
    head.innerHTML =
      '<h1 class="page-title">Radio</h1><button class="avatar" aria-label="Hồ sơ">♪</button>';
    head.querySelector('.avatar').addEventListener('click', () => App.openAddSheet());
    view.appendChild(head);

    const grid = el('div', 'radio-grid');
    STATIONS.forEach((st) => {
      const s = el('div', 'station');
      s.style.background = st.bg;
      s.innerHTML =
        '<div class="st-word" style="color:' + st.color + ';' + (st.italic ? '' : 'font-style:normal;') + '">' + esc(st.word) + '</div>' +
        '<div class="st-brand" style="color:' + st.color + '">♪ Radio</div>';
      s.addEventListener('click', () => {
        if (Library.songs.length) {
          App.playFromGesture(Library.songs, 0, { shuffle: true });
          Util.toast('Đang phát đài “' + st.word + '” — trộn từ thư viện của bạn');
        } else Util.toast('Thư viện trống — thêm bài hát trước nhé.');
      });
      grid.appendChild(s);
    });
    view.appendChild(grid);

    const sec = el('div', 'section');
    sec.appendChild(sectionHead('Đài Phát Trực Tiếp'));
    sec.appendChild(el('div', 'section-sub', 'Chọn đài phát để thưởng thức âm nhạc mọi lúc và hơn thế.'));
    const sc = el('div', 'h-scroll');
    const lives = [
      { word: 'Deep<br>Focus', grad: 'linear-gradient(150deg,#e8e8ec,#c7c7d1)', wc: '#111', meta: '♪ Radio · Cả ngày', title: 'Tập trung sâu', desc: 'Nhạc nền để học và làm việc.' },
      { word: 'Night<br>Drive', grad: 'linear-gradient(150deg,#1d1d2b,#3c2a52)', wc: '#fff', meta: '♪ Radio · 21:00–02:00', title: 'Lái xe đêm', desc: 'Beat chậm cho những chuyến đi khuya.' },
      { word: 'Morning<br>Boost', grad: 'linear-gradient(150deg,#ffd60a,#ff9f0a)', wc: '#241a00', meta: '♪ Radio · 06:00–10:00', title: 'Năng lượng sáng', desc: 'Khởi động ngày mới đầy hứng khởi.' },
    ];
    lives.forEach((lv) => {
      const c = el('div', 'live-card');
      c.innerHTML =
        '<div style="position:absolute;inset:0;background:' + lv.grad + '"></div>' +
        '<div class="lv-word" style="color:' + lv.wc + '">' + lv.word + '</div>' +
        '<div class="caption"><div class="lv-meta">' + esc(lv.meta) + '</div>' +
        '<div class="lv-title">' + esc(lv.title) + '</div><div class="lv-desc">' + esc(lv.desc) + '</div></div>';
      c.addEventListener('click', () => {
        if (Library.songs.length) App.playFromGesture(Library.songs, 0, { shuffle: true });
        else Util.toast('Thư viện trống — thêm bài hát trước nhé.');
      });
      sc.appendChild(c);
    });
    sec.appendChild(sc);
    view.appendChild(sec);

    wireScroll(view, 'Radio');
  }

  /* ============ LIBRARY (Thư viện) ============ */
  const LIB_CATS = [
    { icon: 'playlist', label: 'Playlist', page: 'playlists' },
    { icon: 'mic', label: 'Nghệ sĩ', page: 'artists' },
    { icon: 'album', label: 'Album', page: 'albums' },
    { icon: 'note', label: 'Bài hát', page: 'songs' },
    { icon: 'download', label: 'Đã tải về', page: 'downloads' },
  ];
  function renderLibrary(view) {
    view.innerHTML = '';
    const head = el('div', 'page-head');
    head.innerHTML =
      '<h1 class="page-title">Thư viện</h1>' +
      '<div class="head-actions">' +
      '<div class="glass-capsule"><button id="lib-add" aria-label="Thêm">' + Icons.addList + '</button>' +
      '<button id="lib-more" aria-label="Tùy chọn">' + Icons.more + '</button></div>' +
      '<button class="avatar" aria-label="Hồ sơ">♪</button></div>';
    head.querySelector('#lib-add').addEventListener('click', () => App.openAddSheet());
    head.querySelector('#lib-more').addEventListener('click', () => App.openLibrarySheet());
    head.querySelector('.avatar').addEventListener('click', () => App.openAddSheet());
    view.appendChild(head);

    // "Ghim nhạc thường nghe của bạn" onboarding card (like real Apple Music),
    // dismissable — stays hidden once closed
    if (localStorage.getItem('pin-card-dismissed') !== '1') {
      const pin = el('div', 'pin-card');
      pin.innerHTML =
        '<button class="pin-x" aria-label="Đóng">' + Icons.close + '</button>' +
        '<div class="pin-row"><span class="pin-icon">' + Icons.pin + '</span>' +
        '<div class="pin-text">' +
        '<div class="pin-title">Ghim nhạc thường nghe của bạn</div>' +
        '<div class="pin-desc">Khi bạn ghim nhạc đã được thêm vào thư viện của mình, nội dung nhạc đó sẽ xuất hiện ở đây.</div>' +
        '</div></div>';
      pin.querySelector('.pin-x').addEventListener('click', () => {
        localStorage.setItem('pin-card-dismissed', '1');
        pin.style.height = pin.offsetHeight + 'px';
        void pin.offsetWidth;
        pin.classList.add('closing');
        pin.style.height = '0px';
        pin.style.opacity = '0';
        pin.style.margin = '0 20px';
        setTimeout(() => pin.remove(), 280);
      });
      view.appendChild(pin);
    }

    const list = el('div');
    list.style.marginTop = '8px';
    LIB_CATS.forEach((c) => {
      const r = el('div', 'lib-row');
      r.innerHTML =
        '<span class="lib-icon">' + Icons[c.icon] + '</span>' +
        '<div class="lib-main"><span class="lib-label">' + esc(c.label) + '</span>' +
        '<span class="row-chev">' + Icons.chevR.replace('<svg ', '<svg width="17" height="17" ') + '</span></div>';
      r.addEventListener('click', () => Views.push(c.page));
      list.appendChild(r);
    });
    view.appendChild(list);

    const sec = el('div', 'section');
    sec.appendChild(sectionHead('Đã thêm gần đây'));
    if (Library.songs.length) {
      const grid = el('div', 'grid2');
      Library.songs.slice(0, 8).forEach((s) => {
        const isCur = Player.current() && Player.current().id === s.id;
        const d = el('div');
        d.innerHTML =
          '<img class="g-art' + (isCur ? ' playing' : '') + '" loading="lazy" src="' + esc(s.coverDisplayUrl) + '" alt="">' +
          '<div class="g-title">' + esc(s.title) + '</div><div class="g-sub">' + esc(s.artist) + '</div>';
        d.addEventListener('click', () => App.playFromGesture(Library.songs, Library.songs.indexOf(s)));
        grid.appendChild(d);
      });
      sec.appendChild(grid);
    } else {
      sec.appendChild(emptyState('Thư viện trống', 'Thêm nhạc từ link YouTube hoặc tải file nhạc của bạn lên.', 'Thêm bài hát'));
    }
    view.appendChild(sec);

    wireScroll(view, 'Thư viện');
  }

  /* ============ SUB-SCREENS ============ */
  const subStack = [];

  function subBar(container, rightButtons) {
    const bar = el('div', 'sub-bar');
    const back = el('button', 'glass-circle');
    back.innerHTML = Icons.chevL;
    back.setAttribute('aria-label', 'Quay lại');
    back.addEventListener('click', () => Views.pop());
    bar.appendChild(back);
    if (rightButtons && rightButtons.length) {
      const cap = el('div', 'glass-capsule');
      rightButtons.forEach((b) => {
        const btn = el('button');
        btn.innerHTML = Icons[b.icon];
        btn.setAttribute('aria-label', b.label);
        btn.addEventListener('click', b.onClick);
        cap.appendChild(btn);
      });
      bar.appendChild(cap);
    }
    container.appendChild(bar);
  }

  function renderSub(page, param) {
    const view = document.getElementById('view-sub');
    view.innerHTML = '';
    view.scrollTop = 0;

    if (page === 'playlists') {
      subBar(view, [
        { icon: 'plus', label: 'Tạo playlist', onClick: () => App.createPlaylistPrompt() },
        { icon: 'more', label: 'Tùy chọn', onClick: () => Util.toast('Nhấn giữ một playlist để xoá.') },
      ]);
      view.appendChild(el('h1', 'sub-title', 'Playlist'));
      const wrap = el('div');
      const pls = [{ id: '__fav', name: 'Bài Hát Yêu Thích', special: true }].concat(Library.playlists);
      pls.forEach((pl) => {
        const r = el('div', 'row');
        const count = pl.special ? Library.favorites().length : Library.playlistSongs(pl).length;
        const cover = pl.special
          ? null
          : (Library.playlistSongs(pl)[0] || {}).coverDisplayUrl;
        r.innerHTML =
          (pl.special ? '<span class="fav-gutter">★</span>' : '') +
          (pl.special
            ? '<div class="row-art small-r" style="background:#f2f2f4;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="30" height="30" fill="#fa2d48"><path d="m12 2.7 2.55 5.84 6.35.6c.5.05.7.67.32 1l-4.79 4.2 1.41 6.21a.55.55 0 0 1-.82.6L12 17.9l-5.47 3.25a.55.55 0 0 1-.82-.6l1.41-6.21-4.79-4.2a.55.55 0 0 1 .32-1l6.35-.6L11.55 2.7a.55.55 0 0 1 .9 0z"/></svg></div>'
            : '<img class="row-art small-r" src="' + esc(cover || Util.gradientCoverUrl(pl.id, pl.name)) + '" alt="">') +
          '<div class="row-main" style="min-height:80px"><div class="row-texts">' +
          '<div class="row-title">' + esc(pl.name) + '</div>' +
          '<div class="row-sub">' + count + ' bài hát</div></div>' +
          '<span class="row-chev">' + Icons.chevR.replace('<svg ', '<svg width="17" height="17" ') + '</span></div>';
        r.addEventListener('click', () => Views.push('playlist-detail', pl));
        if (!pl.special) {
          let pressTimer = null;
          r.addEventListener('pointerdown', () => {
            pressTimer = setTimeout(() => App.openPlaylistSheet(pl), 550);
          });
          ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) =>
            r.addEventListener(ev, () => clearTimeout(pressTimer))
          );
        }
        wrap.appendChild(r);
      });
      view.appendChild(wrap);
    }

    if (page === 'artists') {
      subBar(view, [{ icon: 'filter', label: 'Lọc', onClick: () => {} }]);
      view.appendChild(el('h1', 'sub-title', 'Nghệ sĩ'));
      const artists = Library.artists();
      if (!artists.length) view.appendChild(emptyState('Chưa có nghệ sĩ', 'Thêm bài hát để thấy nghệ sĩ ở đây.', 'Thêm bài hát'));
      artists.forEach((a) => {
        const r = el('div', 'row');
        r.innerHTML =
          '<img class="row-art round" src="' + esc(a.songs[0].coverDisplayUrl) + '" alt="">' +
          '<div class="row-main" style="min-height:56px"><div class="row-texts">' +
          '<div class="row-title">' + esc(a.name) + '</div></div>' +
          '<span class="row-chev">' + Icons.chevR.replace('<svg ', '<svg width="17" height="17" ') + '</span></div>';
        r.addEventListener('click', () => Views.push('artist-detail', a));
        view.appendChild(r);
      });
    }

    if (page === 'albums') {
      subBar(view, [
        { icon: 'filter', label: 'Lọc', onClick: () => {} },
        { icon: 'more', label: 'Tùy chọn', onClick: () => {} },
      ]);
      view.appendChild(el('h1', 'sub-title', 'Album'));
      const albums = Library.albums();
      actionPills(view, () => Library.songs);
      if (!albums.length) {
        view.appendChild(emptyState('Chưa có album', 'Điền tên album khi thêm bài hát để gom nhóm tại đây.', 'Thêm bài hát'));
      } else {
        const grid = el('div', 'grid2');
        grid.style.paddingTop = '20px';
        albums.forEach((al) => {
          const cur = Player.current();
          const playing = cur && al.songs.some((s) => s.id === cur.id);
          const d = el('div');
          d.innerHTML =
            '<img class="g-art' + (playing ? ' playing' : '') + '" src="' + esc(al.songs[0].coverDisplayUrl) + '" alt="">' +
            '<div class="g-title">' + esc(al.name) + '</div><div class="g-sub">' + esc(al.artist) + '</div>';
          d.addEventListener('click', () => Views.push('album-detail', al));
          grid.appendChild(d);
        });
        view.appendChild(grid);
      }
    }

    if (page === 'songs') {
      subBar(view, [
        { icon: 'filter', label: 'Lọc', onClick: () => {} },
        { icon: 'more', label: 'Tùy chọn', onClick: () => {} },
      ]);
      view.appendChild(el('h1', 'sub-title', 'Bài hát'));
      const songs = Library.songsAZ();
      actionPills(view, () => songs);
      if (!songs.length) {
        view.appendChild(emptyState('Chưa có bài hát', 'Thêm nhạc từ YouTube hoặc tải file nhạc lên.', 'Thêm bài hát'));
      } else {
        /* group by first letter */
        const groups = new Map();
        songs.forEach((s) => {
          let L = (s.title || '#').charAt(0).toUpperCase();
          L = L.normalize('NFD').replace(/[̀-ͯ]/g, '');
          if (!/[A-Z]/.test(L)) L = /[0-9]/.test(L) ? '#' : L;
          if (!groups.has(L)) groups.set(L, []);
          groups.get(L).push(s);
        });
        const letters = [...groups.keys()].sort();
        letters.forEach((L) => {
          const lh = el('div', 'letter-head', esc(L));
          lh.dataset.letter = L;
          view.appendChild(lh);
          groups.get(L).forEach((s) => view.appendChild(songRow(s, { queue: songs, swipeDelete: true })));
        });
        /* A-Z rail */
        const rail = el('div', 'az-rail');
        letters.forEach((L) => {
          const b = el('button', '', esc(L));
          b.addEventListener('click', () => {
            const target = view.querySelector('.letter-head[data-letter="' + L + '"]');
            if (target) view.scrollTo({ top: target.offsetTop - 60, behavior: 'smooth' });
          });
          rail.appendChild(b);
        });
        view.appendChild(rail);
      }
    }

    if (page === 'downloads') {
      subBar(view);
      view.appendChild(el('h1', 'sub-title', 'Đã tải về'));
      const files = Library.songs.filter((s) => s.type === 'file');
      if (!files.length) {
        view.appendChild(emptyState('Chưa có nhạc tải lên', 'Nhạc bạn tải lên từ máy sẽ nằm ở đây và phát được cả khi mất mạng.', 'Tải nhạc lên'));
      } else {
        actionPills(view, () => files);
        const wrap = el('div');
        wrap.style.marginTop = '14px';
        files.forEach((s) => wrap.appendChild(songRow(s, { queue: files, swipeDelete: true })));
        view.appendChild(wrap);
      }
    }

    if (page === 'playlist-detail') {
      const pl = param;
      const isFav = pl.id === '__fav';
      const songsOf = () => (isFav ? Library.favorites() : Library.playlistSongs(pl));
      subBar(view, isFav ? [] : [
        { icon: 'more', label: 'Tùy chọn', onClick: () => App.openPlaylistSheet(pl) },
      ]);
      view.appendChild(el('h1', 'sub-title', pl.name));
      actionPills(view, songsOf);
      const list = el('div');
      list.style.marginTop = '14px';
      const ss = songsOf();
      if (!ss.length) {
        list.appendChild(
          emptyState(
            isFav ? 'Chưa có bài yêu thích' : 'Playlist trống',
            isFav ? 'Bấm ★ Yêu thích trong tùy chọn bài hát.' : 'Thêm bài hát vào playlist từ menu ••• của bài hát.'
          )
        );
      } else {
        // in a playlist, swipe removes from the playlist (or unfavorites),
        // not from the whole library
        const onDelete = async (song) => {
          if (isFav) {
            await Library.toggleFavorite(song.id);
            Util.toast('Đã bỏ yêu thích');
          } else {
            await Library.removeFromPlaylist(pl.id, song.id);
            Util.toast('Đã xoá khỏi playlist');
          }
          App.refreshAll();
        };
        ss.forEach((s) => list.appendChild(songRow(s, { queue: ss, swipeDelete: true, onDelete })));
      }
      view.appendChild(list);
    }

    if (page === 'artist-detail') {
      const a = param;
      subBar(view);
      view.appendChild(el('h1', 'sub-title', a.name));
      actionPills(view, () => a.songs);
      const list = el('div');
      list.style.marginTop = '14px';
      a.songs.forEach((s) => list.appendChild(songRow(s, { queue: a.songs, swipeDelete: true })));
      view.appendChild(list);
    }

    if (page === 'album-detail') {
      const al = param;
      subBar(view);
      view.appendChild(el('h1', 'sub-title', al.name));
      view.appendChild(el('div', 'section-sub', al.artist));
      actionPills(view, () => al.songs);
      const list = el('div');
      list.style.marginTop = '14px';
      al.songs.forEach((s) => list.appendChild(songRow(s, { queue: al.songs, swipeDelete: true })));
      view.appendChild(list);
    }

    wireScroll(view);
  }

  /* ============ navigation ============ */
  const Views = {
    rootRenderers: {
      home: renderHome,
      discover: renderDiscover,
      radio: renderRadio,
      library: renderLibrary,
    },
    renderRoot(tab) {
      const view = document.getElementById('view-' + tab);
      if (view) this.rootRenderers[tab](view);
    },
    push(page, param) {
      subStack.push({ page, param });
      renderSub(page, param);
      const sub = document.getElementById('view-sub');
      sub.hidden = false;
      requestAnimationFrame(() => sub.classList.add('in'));
    },
    pop() {
      subStack.pop();
      const sub = document.getElementById('view-sub');
      if (subStack.length) {
        const top = subStack[subStack.length - 1];
        renderSub(top.page, top.param);
      } else {
        sub.classList.remove('in');
        setTimeout(() => {
          if (!subStack.length) sub.hidden = true;
        }, 400);
      }
    },
    popAll() {
      subStack.length = 0;
      const sub = document.getElementById('view-sub');
      sub.classList.remove('in');
      setTimeout(() => {
        if (!subStack.length) sub.hidden = true;
      }, 400);
    },
    refreshSub() {
      if (subStack.length) {
        const top = subStack[subStack.length - 1];
        renderSub(top.page, top.param);
      }
    },
    hasSub() {
      return subStack.length > 0;
    },
    songRow,
  };

  window.Views = Views;
})();
