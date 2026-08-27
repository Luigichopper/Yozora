import { AnimeItem, DanmakuComment, DownloadTask, LibraryEntry, TorrentSource } from '../types/anime';

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

        // Store for danmaku comments keyed by animeId_epNumber
        if (!db.objectStoreNames.contains('danmaku_store')) {
          const danmakuStore = db.createObjectStore('danmaku_store', { keyPath: 'id' });
          danmakuStore.createIndex('epKey', 'epKey', { unique: false });
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
      req.onerror = () => resolve(null);
    });
  }

  async getAllCachedAnime(): Promise<AnimeItem[]> {
    const store = await this.getStore('anime_cache', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map((r: any) => r.data));
      req.onerror = () => resolve([]);
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

  async saveBulkAnime(animeList: AnimeItem[]): Promise<void> {
    const store = await this.getStore('anime_cache', 'readwrite');
    for (const anime of animeList) {
      store.put({
        id: anime.id,
        anidbId: anime.anidbId,
        data: anime,
        cachedAt: Date.now()
      });
    }
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
      req.onerror = () => resolve({});
    });
  }

  async saveLibraryEntry(entry: LibraryEntry): Promise<void> {
    const store = await this.getStore('library_store', 'readwrite');
    store.put(entry);
  }

  // --- Danmaku Store ---
  async getDanmakuForEpisode(animeId: string, epNumber: number): Promise<DanmakuComment[]> {
    const store = await this.getStore('danmaku_store', 'readonly');
    const index = store.index('epKey');
    const epKey = `${animeId}_${epNumber}`;
    return new Promise((resolve) => {
      const req = index.getAll(epKey);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async saveDanmakuComment(animeId: string, epNumber: number, comment: DanmakuComment): Promise<void> {
    const store = await this.getStore('danmaku_store', 'readwrite');
    store.put({
      ...comment,
      epKey: `${animeId}_${epNumber}`,
      animeId,
      epNumber
    });
  }

  // --- Downloads & Cache Store ---
  async getDownloads(): Promise<DownloadTask[]> {
    const store = await this.getStore('downloads_store', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
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
      req.onerror = () => resolve([]);
    });
  }

  async saveSources(animeId: string, sources: TorrentSource[]): Promise<void> {
    const store = await this.getStore('sources_cache', 'readwrite');
    for (const src of sources) {
      store.put({ ...src, animeId });
    }
  }

  // --- Settings Store ---
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const store = await this.getStore('settings_store', 'readonly');
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
      req.onerror = () => resolve(defaultValue);
    });
  }

  async saveSetting<T>(key: string, value: T): Promise<void> {
    const store = await this.getStore('settings_store', 'readwrite');
    store.put({ key, value });
  }
}

export const db = new YozoraDB();
