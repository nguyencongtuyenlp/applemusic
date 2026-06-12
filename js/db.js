/* ============================================================
   db.js — data layer
   - Supabase (Postgres) = shared cloud library: song metadata,
     playlists, kv (recents / queue / settings), cover images (base64).
   - IndexedDB = local audio blobs (uploaded files) + offline cache.
   Degrades to pure-IndexedDB when Supabase isn't configured, so the
   app works with or without credentials.
   ============================================================ */
(function () {
  'use strict';

  const cfg = window.APP_CONFIG || {};
  const cloudReady = !!(
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    window.supabase &&
    window.supabase.createClient
  );
  const client = cloudReady
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
      })
    : null;

  /* ---------------- IndexedDB ---------------- */
  const DB_NAME = 'am-clone-db';
  const DB_VERSION = 2;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function idbReq(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  async function idbGet(store, key) {
    const db = await open();
    return idbReq(db.transaction(store).objectStore(store).get(key));
  }
  async function idbAll(store) {
    const db = await open();
    return idbReq(db.transaction(store).objectStore(store).getAll());
  }
  function idbWrite(store, op) {
    return open().then(
      (db) =>
        new Promise((res, rej) => {
          const t = db.transaction(store, 'readwrite');
          op(t.objectStore(store));
          t.oncomplete = () => res();
          t.onerror = () => rej(t.error);
          t.onabort = () => rej(t.error);
        })
    );
  }
  const idbPut = (store, val) => idbWrite(store, (os) => os.put(val));
  const idbDel = (store, key) => idbWrite(store, (os) => os.delete(key));

  /* ---------------- row mappers (camelCase <-> snake_case) ---------------- */
  function songToRow(s) {
    return {
      id: s.id,
      type: s.type || 'youtube',
      yt_id: s.ytId || null,
      title: s.title || '',
      artist: s.artist || '',
      album: s.album || '',
      cover_url: s.coverUrl || null,
      cover_data: s.coverData || null,
      favorite: !!s.favorite,
      play_count: s.playCount || 0,
      duration: s.duration || 0,
      added_at: s.addedAt || null,
      last_played_at: s.lastPlayedAt || null,
    };
  }
  function rowToSong(r) {
    const s = {
      id: r.id,
      type: r.type || 'youtube',
      title: r.title || '',
      artist: r.artist || '',
      album: r.album || '',
      favorite: !!r.favorite,
      playCount: r.play_count || 0,
      duration: r.duration || 0,
      addedAt: Number(r.added_at) || 0,
      lastPlayedAt: Number(r.last_played_at) || 0,
    };
    if (r.yt_id) s.ytId = r.yt_id;
    if (r.cover_url) s.coverUrl = r.cover_url;
    if (r.cover_data) s.coverData = r.cover_data;
    return s;
  }
  function plToRow(p) {
    return { id: p.id, name: p.name || 'Playlist', song_ids: p.songIds || [], created_at: p.createdAt || null };
  }
  function rowToPl(r) {
    return {
      id: r.id,
      name: r.name || 'Playlist',
      songIds: Array.isArray(r.song_ids) ? r.song_ids : [],
      createdAt: Number(r.created_at) || 0,
    };
  }

  /* strip runtime / blob fields before persisting metadata */
  function cleanSong(song) {
    const out = Object.assign({}, song);
    delete out.coverDisplayUrl;
    delete out.audioBlob;
    delete out.coverBlob;
    return out;
  }

  const DB = {
    cloud: cloudReady,

    uuid() {
      return crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
          });
    },

    /* ---------- songs (metadata) ---------- */
    async allSongs() {
      if (client) {
        try {
          const { data, error } = await client.from('songs').select('*');
          if (error) throw error;
          const songs = (data || []).map(rowToSong);
          // mirror into local cache for offline / instant reload
          songs.forEach((s) => idbPut('songs', s).catch(() => {}));
          songs.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
          return songs;
        } catch (e) {
          console.warn('[cloud] allSongs failed, using local cache:', e.message || e);
        }
      }
      const rows = await idbAll('songs');
      rows.forEach((r) => {
        delete r.audioBlob;
      });
      rows.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      return rows;
    },

    async getSong(id) {
      if (client) {
        try {
          const { data, error } = await client.from('songs').select('*').eq('id', id).maybeSingle();
          if (error) throw error;
          if (data) return rowToSong(data);
        } catch (e) {
          /* fall back to cache */
        }
      }
      return idbGet('songs', id);
    },

    async putSong(song) {
      const clean = cleanSong(song);
      await idbPut('songs', clean);
      if (client) {
        try {
          const { error } = await client.from('songs').upsert(songToRow(clean));
          if (error) throw error;
        } catch (e) {
          console.warn('[cloud] putSong failed:', e.message || e);
        }
      }
      return song;
    },

    async deleteSong(id) {
      await idbDel('songs', id);
      await idbDel('audio', id);
      if (client) {
        try {
          await client.from('songs').delete().eq('id', id);
        } catch (e) {}
      }
    },

    /* read ONLY the local cache (bypass cloud) — used for first-run migration */
    async localSongs() {
      const rows = await idbAll('songs');
      rows.forEach((r) => delete r.audioBlob);
      return rows;
    },
    localPlaylists() {
      return idbAll('playlists');
    },

    /* ---------- audio blobs (local only) ---------- */
    putAudio(id, blob) {
      return idbPut('audio', { id, blob });
    },
    async getAudio(id) {
      const rec = await idbGet('audio', id);
      if (rec && rec.blob) return rec.blob;
      const legacy = await idbGet('songs', id); // back-compat: v1 stored blob inline
      return legacy && legacy.audioBlob ? legacy.audioBlob : null;
    },

    /* ---------- playlists ---------- */
    async allPlaylists() {
      if (client) {
        try {
          const { data, error } = await client.from('playlists').select('*');
          if (error) throw error;
          const pls = (data || []).map(rowToPl);
          pls.forEach((p) => idbPut('playlists', p).catch(() => {}));
          pls.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          return pls;
        } catch (e) {
          console.warn('[cloud] allPlaylists failed, using local cache:', e.message || e);
        }
      }
      const rows = await idbAll('playlists');
      rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return rows;
    },
    async getPlaylist(id) {
      if (client) {
        try {
          const { data } = await client.from('playlists').select('*').eq('id', id).maybeSingle();
          if (data) return rowToPl(data);
        } catch (e) {}
      }
      return idbGet('playlists', id);
    },
    async putPlaylist(pl) {
      await idbPut('playlists', pl);
      if (client) {
        try {
          const { error } = await client.from('playlists').upsert(plToRow(pl));
          if (error) throw error;
        } catch (e) {
          console.warn('[cloud] putPlaylist failed:', e.message || e);
        }
      }
      return pl;
    },
    async deletePlaylist(id) {
      await idbDel('playlists', id);
      if (client) {
        try {
          await client.from('playlists').delete().eq('id', id);
        } catch (e) {}
      }
    },

    /* ---------- kv (settings / recents / queue) ---------- */
    async kvGet(key, fallback) {
      if (client) {
        try {
          const { data, error } = await client.from('kv').select('value').eq('key', key).maybeSingle();
          if (error) throw error;
          if (data) {
            idbPut('kv', { key, value: data.value }).catch(() => {});
            return data.value;
          }
        } catch (e) {
          /* fall back to cache */
        }
      }
      const row = await idbGet('kv', key);
      return row ? row.value : fallback;
    },
    async kvSet(key, value) {
      await idbPut('kv', { key, value });
      if (client) {
        try {
          await client.from('kv').upsert({ key, value });
        } catch (e) {}
      }
    },
  };

  window.DB = DB;
})();
