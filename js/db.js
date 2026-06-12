/* ============================================================
   db.js — IndexedDB storage layer
   Songs (metadata + cover blob + audio blob), playlists, kv.
   Static-host friendly: everything lives in the browser.
   ============================================================ */
(function () {
  'use strict';

  const DB_NAME = 'am-clone-db';
  const DB_VERSION = 1;

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('songs')) {
          const s = db.createObjectStore('songs', { keyPath: 'id' });
          s.createIndex('addedAt', 'addedAt');
          s.createIndex('artist', 'artist');
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const t = db.transaction(store, mode);
          const os = t.objectStore(store);
          const out = fn(os);
          t.oncomplete = () => resolve(out && out.__result !== undefined ? out.__result : out);
          t.onerror = () => reject(t.error);
          t.onabort = () => reject(t.error);
        })
    );
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const DB = {
    uuid() {
      return crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
          });
    },

    /* ---------- songs ---------- */
    async putSong(song) {
      await tx('songs', 'readwrite', (os) => os.put(song));
      return song;
    },
    async getSong(id) {
      const db = await open();
      return reqToPromise(db.transaction('songs').objectStore('songs').get(id));
    },
    async deleteSong(id) {
      return tx('songs', 'readwrite', (os) => os.delete(id));
    },
    async allSongs() {
      const db = await open();
      const rows = await reqToPromise(db.transaction('songs').objectStore('songs').getAll());
      rows.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      return rows;
    },

    /* ---------- playlists ---------- */
    async putPlaylist(pl) {
      await tx('playlists', 'readwrite', (os) => os.put(pl));
      return pl;
    },
    async getPlaylist(id) {
      const db = await open();
      return reqToPromise(db.transaction('playlists').objectStore('playlists').get(id));
    },
    async deletePlaylist(id) {
      return tx('playlists', 'readwrite', (os) => os.delete(id));
    },
    async allPlaylists() {
      const db = await open();
      const rows = await reqToPromise(db.transaction('playlists').objectStore('playlists').getAll());
      rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return rows;
    },

    /* ---------- kv (settings, recents, ...) ---------- */
    async kvGet(key, fallback) {
      const db = await open();
      const row = await reqToPromise(db.transaction('kv').objectStore('kv').get(key));
      return row ? row.value : fallback;
    },
    async kvSet(key, value) {
      return tx('kv', 'readwrite', (os) => os.put({ key, value }));
    },
  };

  window.DB = DB;
})();
