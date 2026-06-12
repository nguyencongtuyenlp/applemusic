/* ============================================================
   library.js — library state on top of DB
   songs, playlists, favorites, recently played / recently added,
   plus the "add song" flows (YouTube link or uploaded file).
   ============================================================ */
(function () {
  'use strict';

  const Library = {
    songs: [],
    playlists: [],
    recents: [], // [{songId, at}] newest first
    ready: false,
    _coverUrls: new Map(), // songId -> objectURL for blob covers

    async init() {
      const [songs, playlists, recents] = await Promise.all([
        DB.allSongs(),
        DB.allPlaylists(),
        DB.kvGet('recents', []),
      ]);
      this.songs = songs;
      this.playlists = playlists;
      this.recents = recents;
      this.songs.forEach((s) => {
        // keep audio blobs out of memory — player fetches them on demand
        delete s.audioBlob;
        this.hydrateCover(s);
      });
      this.ready = true;
    },

    /* every song gets coverDisplayUrl usable in <img src>.
       priority: synced base64 cover -> legacy local blob -> remote url -> gradient */
    hydrateCover(song) {
      if (song.coverData) {
        song.coverDisplayUrl = song.coverData;
      } else if (song.coverBlob) {
        let url = this._coverUrls.get(song.id);
        if (!url) {
          url = URL.createObjectURL(song.coverBlob);
          this._coverUrls.set(song.id, url);
        }
        song.coverDisplayUrl = url;
      } else if (song.coverUrl) {
        song.coverDisplayUrl = song.coverUrl;
      } else {
        song.coverDisplayUrl = Util.gradientCoverUrl(song.id, song.title);
      }
      return song;
    },

    byId(id) {
      return this.songs.find((s) => s.id === id);
    },

    /* ---------- add: YouTube ---------- */
    async addYouTube({ url, title, artist, album, coverFile }) {
      const ytId = YTUtil.extractId(url);
      if (!ytId) throw new Error('Link YouTube không hợp lệ.');
      const song = {
        id: DB.uuid(),
        type: 'youtube',
        ytId,
        title: (title || '').trim(),
        artist: (artist || '').trim(),
        album: (album || '').trim(),
        favorite: false,
        playCount: 0,
        addedAt: Date.now(),
      };
      if (!song.title || !song.artist) {
        const meta = await YTUtil.fetchMeta(ytId);
        if (meta) {
          if (!song.title) song.title = meta.title;
          if (!song.artist) song.artist = meta.author;
        }
      }
      if (!song.title) song.title = 'Bài hát YouTube';
      if (!song.artist) song.artist = 'Không rõ nghệ sĩ';
      if (coverFile) {
        song.coverData = await Util.fileToCoverDataUrl(coverFile);
      } else {
        song.coverUrl = await YTUtil.bestThumb(ytId);
      }
      await DB.putSong(song);
      this.songs.unshift(this.hydrateCover(song));
      return song;
    },

    /* ---------- add: uploaded audio file ---------- */
    async addFile({ audioFile, title, artist, album, coverFile }) {
      if (!audioFile) throw new Error('Chưa chọn file nhạc.');
      const song = {
        id: DB.uuid(),
        type: 'file',
        title: (title || '').trim() || audioFile.name.replace(/\.[^.]+$/, ''),
        artist: (artist || '').trim() || 'Không rõ nghệ sĩ',
        album: (album || '').trim(),
        favorite: false,
        playCount: 0,
        addedAt: Date.now(),
      };
      if (coverFile) song.coverData = await Util.fileToCoverDataUrl(coverFile);
      // measure duration up front so lists can show it
      song.duration = await new Promise((resolve) => {
        const u = URL.createObjectURL(audioFile);
        const a = new Audio();
        a.preload = 'metadata';
        a.onloadedmetadata = () => {
          URL.revokeObjectURL(u);
          resolve(isFinite(a.duration) ? a.duration : 0);
        };
        a.onerror = () => {
          URL.revokeObjectURL(u);
          resolve(0);
        };
        a.src = u;
      });
      // raw audio stays local (IndexedDB); only metadata syncs to cloud
      await DB.putAudio(song.id, audioFile);
      await DB.putSong(song);
      this.songs.unshift(this.hydrateCover(song));
      return song;
    },

    async updateSong(id, patch) {
      const song = this.byId(id);
      if (!song) return;
      Object.assign(song, patch);
      if (patch.coverData) {
        const old = this._coverUrls.get(id);
        if (old) URL.revokeObjectURL(old);
        this._coverUrls.delete(id);
        delete song.coverUrl;
        delete song.coverBlob;
        this.hydrateCover(song);
      } else if (patch.coverUrl && !song.coverData && !song.coverBlob) {
        song.coverDisplayUrl = patch.coverUrl;
      }
      await DB.putSong(song);
      return song;
    },

    async removeSong(id) {
      await DB.deleteSong(id);
      const coverUrl = this._coverUrls.get(id);
      if (coverUrl) {
        URL.revokeObjectURL(coverUrl);
        this._coverUrls.delete(id);
      }
      this.songs = this.songs.filter((s) => s.id !== id);
      this.recents = this.recents.filter((r) => r.songId !== id);
      await DB.kvSet('recents', this.recents);
      for (const pl of this.playlists) {
        if (pl.songIds.includes(id)) {
          pl.songIds = pl.songIds.filter((x) => x !== id);
          await DB.putPlaylist(pl);
        }
      }
    },

    async toggleFavorite(id) {
      const song = this.byId(id);
      if (!song) return false;
      song.favorite = !song.favorite;
      await DB.putSong(song);
      return song.favorite;
    },

    /* ---------- playlists ---------- */
    async createPlaylist(name) {
      const pl = { id: DB.uuid(), name: name || 'Playlist mới', songIds: [], createdAt: Date.now() };
      await DB.putPlaylist(pl);
      this.playlists.push(pl);
      return pl;
    },
    async addToPlaylist(plId, songId) {
      const pl = this.playlists.find((p) => p.id === plId);
      if (!pl || pl.songIds.includes(songId)) return;
      pl.songIds.push(songId);
      await DB.putPlaylist(pl);
    },
    async removeFromPlaylist(plId, songId) {
      const pl = this.playlists.find((p) => p.id === plId);
      if (!pl) return;
      pl.songIds = pl.songIds.filter((x) => x !== songId);
      await DB.putPlaylist(pl);
    },
    async deletePlaylist(plId) {
      await DB.deletePlaylist(plId);
      this.playlists = this.playlists.filter((p) => p.id !== plId);
    },
    playlistSongs(pl) {
      return pl.songIds.map((id) => this.byId(id)).filter(Boolean);
    },

    /* ---------- recents ---------- */
    async notePlayed(songId) {
      if (!this.byId(songId)) return; // song was deleted; don't persist a dangling id
      this.recents = [{ songId, at: Date.now() }].concat(
        this.recents.filter((r) => r.songId !== songId)
      ).slice(0, 30);
      await DB.kvSet('recents', this.recents);
      const song = this.byId(songId);
      if (song) {
        song.playCount = (song.playCount || 0) + 1;
        song.lastPlayedAt = Date.now();
        await DB.putSong(song);
      }
    },
    recentSongs(limit) {
      return this.recents
        .map((r) => this.byId(r.songId))
        .filter(Boolean)
        .slice(0, limit || 12);
    },

    /* ---------- derived views ---------- */
    favorites() {
      return this.songs.filter((s) => s.favorite);
    },
    artists() {
      const map = new Map();
      for (const s of this.songs) {
        const key = (s.artist || 'Không rõ nghệ sĩ').trim();
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(s);
      }
      return [...map.entries()]
        .map(([name, songs]) => ({ name, songs }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    },
    albums() {
      const map = new Map();
      for (const s of this.songs) {
        const name = (s.album || '').trim();
        if (!name) continue;
        if (!map.has(name)) map.set(name, []);
        map.get(name).push(s);
      }
      return [...map.entries()]
        .map(([name, songs]) => ({ name, songs, artist: songs[0].artist }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    },
    songsAZ() {
      return this.songs.slice().sort((a, b) => (a.title || '').localeCompare(b.title || '', 'vi'));
    },
    search(q) {
      q = (q || '').trim().toLowerCase();
      if (!q) return [];
      return this.songs.filter(
        (s) =>
          (s.title || '').toLowerCase().includes(q) ||
          (s.artist || '').toLowerCase().includes(q) ||
          (s.album || '').toLowerCase().includes(q)
      );
    },
  };

  window.Library = Library;
})();
