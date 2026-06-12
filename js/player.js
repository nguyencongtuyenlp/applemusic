/* ============================================================
   player.js — unified playback engine
   Two backends behind one interface:
     - 'youtube' : hidden YT IFrame player (audio rides along)
     - 'file'    : HTMLAudioElement fed from IndexedDB blobs
   Emits events: change (track/queue), state (play/pause/loading),
   time (progress), ended-queue.
   ============================================================ */
(function () {
  'use strict';

  const listeners = {};
  function on(ev, fn) {
    (listeners[ev] = listeners[ev] || []).push(fn);
  }
  function emit(ev, data) {
    (listeners[ev] || []).forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error(e);
      }
    });
  }

  /* ---------------- state ---------------- */
  const state = {
    queue: [], // array of song objects
    index: -1,
    playing: false,
    loading: false,
    shuffle: false,
    repeat: 'off', // off | all | one
    duration: 0,
    position: 0,
    volume: 1,
  };

  let ytPlayer = null;
  let ytReady = false;
  let audioEl = null;
  let audioUrl = null; // current object url, revoked on switch
  let timeTimer = null;
  let pendingSeek = null;
  let needsLoad = false; // queue restored from storage, no backend loaded yet
  let errorStreak = 0; // consecutive unplayable tracks; stops runaway skipping

  function current() {
    return state.index >= 0 ? state.queue[state.index] : null;
  }

  /* ---------------- backends ---------------- */
  function ensureAudio() {
    if (audioEl) return audioEl;
    audioEl = new Audio();
    audioEl.preload = 'auto';
    audioEl.addEventListener('ended', onTrackEnded);
    audioEl.addEventListener('play', () => setPlaying(true));
    audioEl.addEventListener('pause', () => setPlaying(false));
    audioEl.addEventListener('loadedmetadata', () => {
      state.duration = audioEl.duration || 0;
      emit('time', { position: state.position, duration: state.duration });
    });
    audioEl.addEventListener('waiting', () => setLoading(true));
    audioEl.addEventListener('canplay', () => setLoading(false));
    return audioEl;
  }

  function ensureYT() {
    return YTUtil.loadAPI().then(
      (YT) =>
        new Promise((resolve) => {
          if (ytPlayer && ytReady) {
            resolve(ytPlayer);
            return;
          }
          // #yt-player lives inside the fixed #yt-dock in index.html —
          // never re-parented (a moved iframe reloads and kills playback)
          let host = document.getElementById('yt-player');
          if (!host) {
            const dock = document.createElement('div');
            dock.id = 'yt-dock';
            host = document.createElement('div');
            host.id = 'yt-player';
            dock.appendChild(host);
            document.body.appendChild(dock);
          }
          ytPlayer = new YT.Player('yt-player', {
            width: '480',
            height: '270',
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3,
              rel: 0,
              playsinline: 1,
              enablejsapi: 1,
              origin: location.origin,
            },
            events: {
              onReady: () => {
                ytReady = true;
                try {
                  ytPlayer.setVolume(state.volume * 100);
                } catch (e) {}
                resolve(ytPlayer);
              },
              onStateChange: (e) => {
                const S = window.YT.PlayerState;
                if (e.data === S.ENDED) onTrackEnded();
                else if (e.data === S.PLAYING) {
                  errorStreak = 0;
                  setLoading(false);
                  setPlaying(true);
                  state.duration = safe(() => ytPlayer.getDuration()) || state.duration;
                  if (pendingSeek != null) {
                    ytPlayer.seekTo(pendingSeek, true);
                    pendingSeek = null;
                  }
                } else if (e.data === S.PAUSED) setPlaying(false);
                else if (e.data === S.BUFFERING) setLoading(true);
              },
              onAutoplayBlocked: () => {
                setLoading(false);
                setPlaying(false);
                emit('autoplay-blocked');
              },
              onError: (e) => {
                console.warn('YT error', e.data);
                setLoading(false);
                emit('error', {
                  code: e.data,
                  message:
                    e.data === 101 || e.data === 150
                      ? 'Video này không cho phép phát nhúng — thử video khác.'
                      : 'Không phát được video này.',
                });
                // skip unplayable embeds so the queue keeps flowing,
                // but stop once a full queue pass failed (avoid skip-loop)
                errorStreak++;
                if (errorStreak >= state.queue.length) {
                  setPlaying(false);
                  emit('error', { message: 'Không bài nào trong hàng đợi phát được.' });
                  return;
                }
                setTimeout(() => next(true), 600);
              },
            },
          });
        })
    );
  }

  function safe(fn) {
    try {
      return fn();
    } catch (e) {
      return undefined;
    }
  }

  function stopBackends() {
    if (audioEl) {
      audioEl.pause();
      audioEl.removeAttribute('src');
      audioEl.load();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    }
    if (ytPlayer && ytReady) safe(() => ytPlayer.stopVideo());
  }

  /* ---------------- progress polling ---------------- */
  function startClock() {
    stopClock();
    timeTimer = setInterval(() => {
      const song = current();
      if (!song) return;
      if (song.type === 'youtube' && ytPlayer && ytReady) {
        state.position = safe(() => ytPlayer.getCurrentTime()) || 0;
        state.duration = safe(() => ytPlayer.getDuration()) || state.duration;
      } else if (song.type === 'file' && audioEl) {
        state.position = audioEl.currentTime || 0;
        state.duration = audioEl.duration || state.duration;
      }
      emit('time', { position: state.position, duration: state.duration });
    }, 250);
  }
  function stopClock() {
    if (timeTimer) clearInterval(timeTimer);
    timeTimer = null;
  }

  function setPlaying(v) {
    if (state.playing === v) return;
    state.playing = v;
    if (v) startClock();
    emit('state', { playing: v, loading: state.loading });
    updateSessionPlaybackState();
  }
  function setLoading(v) {
    if (state.loading === v) return;
    state.loading = v;
    emit('state', { playing: state.playing, loading: v });
  }

  /* ---------------- media session ---------------- */
  function updateSession(song) {
    if (!('mediaSession' in navigator)) return;
    try {
      const artwork = song.coverDisplayUrl
        ? [{ src: song.coverDisplayUrl, sizes: '512x512', type: 'image/png' }]
        : [];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || '',
        artist: song.artist || '',
        album: song.album || '',
        artwork,
      });
      navigator.mediaSession.setActionHandler('play', () => play());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
      navigator.mediaSession.setActionHandler('seekto', (d) => {
        if (d.seekTime != null) seek(d.seekTime);
      });
    } catch (e) {}
  }
  function updateSessionPlaybackState() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused';
    } catch (e) {}
  }

  /* ---------------- core controls ---------------- */
  async function loadTrack(song, autoplay) {
    stopBackends();
    needsLoad = false;
    state.position = 0;
    state.duration = song.duration || 0;
    setLoading(true);
    emit('change', { song, index: state.index, queue: state.queue, loadedTrack: true });
    emit('time', { position: 0, duration: state.duration });

    if (song.type === 'youtube') {
      const p = await ensureYT();
      if (autoplay) safe(() => p.loadVideoById(song.ytId));
      else safe(() => p.cueVideoById(song.ytId));
    } else {
      const el = ensureAudio();
      let blob = song.audioBlob;
      if (!blob) {
        const full = await DB.getSong(song.id);
        blob = full && full.audioBlob;
      }
      if (!blob) {
        emit('error', { message: 'Không tìm thấy dữ liệu âm thanh của bài này.' });
        setLoading(false);
        return;
      }
      audioUrl = URL.createObjectURL(blob);
      el.src = audioUrl;
      el.volume = state.volume;
      if (autoplay) {
        try {
          await el.play();
        } catch (e) {
          setLoading(false);
        }
      } else setLoading(false);
    }
    updateSession(song);
  }

  function playQueue(songs, startIndex, opts) {
    opts = opts || {};
    state.queue = songs.slice();
    if (opts.shuffle) {
      state.shuffle = true;
      const first = startIndex != null ? state.queue.splice(startIndex, 1) : [];
      shuffleArray(state.queue);
      state.queue = first.concat(state.queue);
      state.index = 0;
    } else {
      state.index = startIndex || 0;
    }
    loadTrack(state.queue[state.index], true);
  }

  function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  function play() {
    const song = current();
    if (!song) return;
    // queue was restored from storage: no backend is loaded yet
    if (needsLoad) {
      loadTrack(song, true);
      return;
    }
    if (song.type === 'youtube') {
      if (ytPlayer && ytReady) safe(() => ytPlayer.playVideo());
      else loadTrack(song, true);
    } else if (audioEl && audioEl.src) audioEl.play().catch(() => {});
    else loadTrack(song, true);
  }
  function pause() {
    const song = current();
    if (!song) return;
    if (song.type === 'youtube') {
      if (ytPlayer && ytReady) safe(() => ytPlayer.pauseVideo());
    } else if (audioEl) audioEl.pause();
  }
  function toggle() {
    state.playing ? pause() : play();
  }

  function next(auto) {
    if (!state.queue.length) return;
    if (state.repeat === 'one' && auto) {
      seek(0);
      play();
      return;
    }
    let i = state.index + 1;
    if (i >= state.queue.length) {
      if (state.repeat === 'all' || !auto) i = 0;
      else {
        setPlaying(false);
        emit('ended-queue');
        return;
      }
    }
    state.index = i;
    loadTrack(state.queue[i], true);
  }
  function prev() {
    if (!state.queue.length) return;
    if (state.position > 3) {
      seek(0);
      return;
    }
    let i = state.index - 1;
    if (i < 0) i = state.repeat === 'all' ? state.queue.length - 1 : 0;
    state.index = i;
    loadTrack(state.queue[i], true);
  }

  function onTrackEnded() {
    emit('track-ended', current());
    next(true);
  }

  function seek(sec) {
    const song = current();
    if (!song) return;
    state.position = sec;
    if (song.type === 'youtube') {
      if (ytPlayer && ytReady) {
        if (state.loading) pendingSeek = sec;
        else safe(() => ytPlayer.seekTo(sec, true));
      }
    } else if (audioEl) audioEl.currentTime = sec;
    emit('time', { position: sec, duration: state.duration });
  }

  function setVolume(v) {
    state.volume = Math.min(1, Math.max(0, v));
    if (audioEl) audioEl.volume = state.volume;
    if (ytPlayer && ytReady) safe(() => ytPlayer.setVolume(state.volume * 100));
    emit('volume', state.volume);
  }

  function toggleShuffle() {
    state.shuffle = !state.shuffle;
    if (state.shuffle && state.queue.length > 1) {
      const cur = state.queue[state.index];
      const rest = state.queue.filter((_, i) => i !== state.index);
      shuffleArray(rest);
      state.queue = [cur].concat(rest);
      state.index = 0;
    }
    emit('change', { song: current(), index: state.index, queue: state.queue, loadedTrack: false });
    return state.shuffle;
  }
  function cycleRepeat() {
    state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
    return state.repeat;
  }

  function playNext(song) {
    if (state.index < 0) {
      playQueue([song], 0);
      return;
    }
    state.queue.splice(state.index + 1, 0, song);
    emit('change', { song: current(), index: state.index, queue: state.queue, loadedTrack: false });
  }
  function addToQueue(song) {
    if (state.index < 0) {
      playQueue([song], 0);
      return;
    }
    state.queue.push(song);
    emit('change', { song: current(), index: state.index, queue: state.queue, loadedTrack: false });
  }
  function jumpTo(i) {
    if (i < 0 || i >= state.queue.length) return;
    state.index = i;
    loadTrack(state.queue[i], true);
  }

  /* restore a saved queue without starting playback */
  function restore(songs, index) {
    state.queue = songs.slice();
    state.index = Math.min(Math.max(0, index || 0), songs.length - 1);
    needsLoad = true;
    emit('change', { song: current(), index: state.index, queue: state.queue, loadedTrack: false });
  }

  /* drop a song (e.g. deleted from library) from the live queue */
  function removeFromQueue(songId) {
    const i = state.queue.findIndex((s) => s.id === songId);
    if (i < 0) return;
    const wasCurrent = i === state.index;
    state.queue.splice(i, 1);
    if (i < state.index) state.index--;
    if (wasCurrent) {
      stopBackends();
      if (!state.queue.length) {
        state.index = -1;
        setPlaying(false);
        emit('change', { song: null, index: -1, queue: state.queue, loadedTrack: false });
        return;
      }
      if (state.index >= state.queue.length) state.index = 0;
      loadTrack(state.queue[state.index], state.playing);
      return;
    }
    emit('change', { song: current(), index: state.index, queue: state.queue, loadedTrack: false });
  }

  window.Player = {
    on,
    state,
    current,
    playQueue,
    play,
    pause,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    playNext,
    addToQueue,
    jumpTo,
    restore,
    removeFromQueue,
  };
})();
