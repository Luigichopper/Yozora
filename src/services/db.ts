import { AnimeItem, DownloadTask, LibraryEntry, TorrentSource } from '../types/anime';

const DB_NAME = 'yozora_db';
const DB_VERSION = 1;

export class YozoraDB {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store for cached anime metadata with TTL
        if (!db.objectStoreNames.contains('anime_cache')) {
          const animeStore = db.createObjectStore('anime_cache', { keyPath: 'id' });
          animeStore.createIndex('anidbId', 'anidbId', { unique: true });
          animeStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }

        // Store for library watch status
        if (!db.objectStoreNames.contains('library_store')) {
          db.createObjectStore('library_store', { keyPath: 'animeId' });
        }

        // Store for offline BitTorrent downloads and cache
        if (!db.objectStoreNames.contains('downloads_store')) {
          db.createObjectStore('downloads_store', { keyPath: 'id' });
        }

        // Store for RSS and BitTorrent sources cache
        if (!db.objectStoreNames.contains('sources_cache')) {
          const srcStore = db.createObjectStore('sources_cache', { keyPath: 'id' });
          srcStore.createIndex('animeId', 'animeId', { unique: false });
        }

        // Store for user settings, RSS feeds, and Matugen config
        if (!db.objectStoreNames.contains('settings_store')) {
          db.createObjectStore('settings_store', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.dbPromise;
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  // --- Anime Cache (TTL = 7 Days) ---
  async getAnime(id: string): Promise<AnimeItem | null> {
    const store = await this.getStore('anime_cache', 'readonly');
    return new Promise((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => {
        console.error(`IndexedDB read failed for anime ${id}:`, req.error);
        resolve(null);
      };
    });
  }

  async getAnimeCacheRecord(id: string): Promise<{ data: AnimeItem; cachedAt: number } | null> {
    const store = await this.getStore('anime_cache', 'readonly');
    return new Promise((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ? { data: req.result.data, cachedAt: req.result.cachedAt } : null);
      req.onerror = () => {
        console.error(`IndexedDB cache record read failed for anime ${id}:`, req.error);
        resolve(null);
      };
    });
  }

  async getAllCachedAnime(): Promise<AnimeItem[]> {
    const store = await this.getStore('anime_cache', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map((r: any) => r.data));
      req.onerror = () => {
        console.error('IndexedDB getAllCachedAnime failed:', req.error);
        resolve([]);
      };
    });
  }

  async saveAnime(anime: AnimeItem): Promise<void> {
    const store = await this.getStore('anime_cache', 'readwrite');
    store.put({
      id: anime.id,
      anidbId: anime.anidbId,
      data: anime,
      cachedAt: Date.now()
    });
  }

  async deleteAnime(id: string): Promise<void> {
    const store = await this.getStore('anime_cache', 'readwrite');
    store.delete(id);
  }

  async saveBulkAnime(animeList: AnimeItem[]): Promise<void> {
    if (animeList.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction('anime_cache', 'readwrite');
    const store = tx.objectStore('anime_cache');
    const now = Date.now();

    for (const anime of animeList) {
      store.put({
        id: anime.id,
        anidbId: anime.anidbId,
        data: anime,
        cachedAt: now
      });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.error('IndexedDB saveBulkAnime transaction failed:', tx.error);
        reject(tx.error);
      };
    });
  }

  // --- Library Tracking ---
  async getLibrary(): Promise<Record<string, LibraryEntry>> {
    const store = await this.getStore('library_store', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const dict: Record<string, LibraryEntry> = {};
        for (const item of req.result) {
          dict[item.animeId] = item;
        }
        resolve(dict);
      };
      req.onerror = () => {
        console.error('IndexedDB getLibrary failed:', req.error);
        resolve({});
      };
    });
  }

  async saveLibraryEntry(entry: LibraryEntry): Promise<void> {
    const store = await this.getStore('library_store', 'readwrite');
    store.put(entry);
  }

  // --- Downloads & Cache Store ---
  async getDownloads(): Promise<DownloadTask[]> {
    const store = await this.getStore('downloads_store', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => {
        console.error('IndexedDB getDownloads failed:', req.error);
        resolve([]);
      };
    });
  }

  async saveDownloadTask(task: DownloadTask): Promise<void> {
    const store = await this.getStore('downloads_store', 'readwrite');
    store.put(task);
  }

  async deleteDownloadTask(id: string): Promise<void> {
    const store = await this.getStore('downloads_store', 'readwrite');
    store.delete(id);
  }

  // --- Sources Cache ---
  async getSourcesForAnime(animeId: string): Promise<TorrentSource[]> {
    const store = await this.getStore('sources_cache', 'readonly');
    const index = store.index('animeId');
    return new Promise((resolve) => {
      const req = index.getAll(animeId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => {
        console.error(`IndexedDB getSourcesForAnime failed for ${animeId}:`, req.error);
        resolve([]);
      };
    });
  }

  async saveSources(animeId: string, sources: TorrentSource[]): Promise<void> {
    if (sources.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction('sources_cache', 'readwrite');
    const store = tx.objectStore('sources_cache');

    for (const src of sources) {
      store.put({ ...src, animeId });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.error(`IndexedDB saveSources transaction failed for anime ${animeId}:`, tx.error);
        reject(tx.error);
      };
    });
  }

  // --- Settings Store ---
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const store = await this.getStore('settings_store', 'readonly');
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
      req.onerror = () => {
        console.error(`IndexedDB getSetting failed for key ${key}:`, req.error);
        resolve(defaultValue);
      };
    });
  }

  async saveSetting<T>(key: string, value: T): Promise<void> {
    const store = await this.getStore('settings_store', 'readwrite');
    store.put({ key, value });
  }
}

export const db = new YozoraDB();
