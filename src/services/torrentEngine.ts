import WebTorrent from 'webtorrent/dist/webtorrent.min.js';
import { TorrentSource } from '../types/anime';
import { rqbitService } from './rqbitService';

export interface SwarmStats {
  infoHash: string;
  name: string;
  progress: number;
  downloaded: number;
  length: number;
  downloadSpeed: number;
  uploadSpeed: number;
  numPeers: number;
  timeRemaining: number;
  streamUrl?: string;
  state: 'connecting' | 'downloading' | 'paused' | 'seeding' | 'completed' | 'error';
}

const PUBLIC_WEBRTC_TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.files.fm:7073/announce'
];

class TorrentEngine {
  private client: any = null;
  private activeTorrents: Map<string, any> = new Map(); // Keyed by infoHash
  private taskIdToInfoHash: Map<string, string> = new Map(); // Keyed by taskId -> infoHash
  private statsListeners: Map<string, (stats: SwarmStats) => void> = new Map();

  private getClient(): any {
    if (!this.client && typeof window !== 'undefined') {
      const WT = (WebTorrent as any).default || WebTorrent;
      this.client = new WT();
      this.client.on('error', (err: any) => {
        console.warn('WebTorrent client error:', err);
      });
    }
    return this.client;
  }

  /**
   * Append WebRTC hybrid trackers to magnet URI for browser swarm discovery
   */
  public prepareMagnetUri(magnetUri: string): string {
    let uri = magnetUri.trim();
    if (!uri.startsWith('magnet:?')) {
      return uri;
    }

    const existingTrackers = new Set(
      Array.from(uri.matchAll(/&tr=([^&]+)/g)).map(m => decodeURIComponent(m[1]))
    );

    for (const tr of PUBLIC_WEBRTC_TRACKERS) {
      if (!existingTrackers.has(tr)) {
        uri += `&tr=${encodeURIComponent(tr)}`;
      }
    }

    return uri;
  }

  /**
   * Add a magnet URI or .torrent URL to the live BitTorrent transfer engine
   */
  public async addTorrent(
    magnetUriOrUrl: string,
    onProgress?: (stats: SwarmStats) => void,
    taskId?: string
  ): Promise<{ infoHash: string; name: string; streamUrl?: string }> {
    const client = this.getClient();
    const payload = (magnetUriOrUrl || '').trim();
    if (!payload) {
      throw new Error('No valid magnet link or .torrent URL provided');
    }
    const preparedMagnet = this.prepareMagnetUri(payload);

    return new Promise((resolve, reject) => {
      try {
        if (!client) {
          resolve({ infoHash: '0', name: 'BitTorrent Engine Offline' });
          return;
        }

        // If already added, return existing
        const existing = client.get(preparedMagnet);
        if (existing) {
          if (taskId) {
            this.taskIdToInfoHash.set(taskId, existing.infoHash);
          }
          this.setupTorrentEvents(existing, onProgress);
          resolve({
            infoHash: existing.infoHash,
            name: existing.name || 'Anime Stream',
            streamUrl: existing.files?.[0]?.blobURL
          });
          return;
        }

        let isResolved = false;

        const torrent = client.add(preparedMagnet, {
          announce: PUBLIC_WEBRTC_TRACKERS
        });

        if (taskId) {
          this.taskIdToInfoHash.set(taskId, torrent.infoHash);
        }

        if (onProgress) {
          this.statsListeners.set(torrent.infoHash, onProgress);
        }

        this.activeTorrents.set(torrent.infoHash, torrent);
        this.setupTorrentEvents(torrent, onProgress);

        torrent.on('ready', () => {
          if (isResolved) return;
          isResolved = true;
          // Find largest video file (MKV / MP4 / WebM)
          const videoFile = torrent.files.reduce((prev: any, curr: any) => {
            return (curr.length > (prev?.length || 0)) ? curr : prev;
          }, torrent.files[0]);

          if (videoFile) {
            videoFile.getBlobURL((err: any, url: string) => {
              resolve({
                infoHash: torrent.infoHash,
                name: torrent.name,
                streamUrl: url
              });
            });
          } else {
            resolve({
              infoHash: torrent.infoHash,
              name: torrent.name
            });
          }
        });

        torrent.on('error', (err: any) => {
          console.warn('Torrent download error:', err);
          if (!isResolved) {
            isResolved = true;
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private setupTorrentEvents(torrent: any, onProgress?: (stats: SwarmStats) => void) {
    const notify = () => {
      const stats: SwarmStats = {
        infoHash: torrent.infoHash,
        name: torrent.name || 'Anime Stream',
        progress: Math.round((torrent.progress || 0) * 100),
        downloaded: torrent.downloaded || 0,
        length: torrent.length || 0,
        downloadSpeed: torrent.downloadSpeed || 0,
        uploadSpeed: torrent.uploadSpeed || 0,
        numPeers: torrent.numPeers || 0,
        timeRemaining: torrent.timeRemaining ? Math.round(torrent.timeRemaining / 1000) : 0,
        state: torrent.done ? 'completed' : torrent.paused ? 'paused' : 'downloading'
      };

      if (onProgress) onProgress(stats);
      const registered = this.statsListeners.get(torrent.infoHash);
      if (registered) registered(stats);
    };

    torrent.on('download', notify);
    torrent.on('upload', notify);
    torrent.on('done', notify);
  }

  /**
   * Stream a torrent directly to a <video> element
   */
  public async streamToVideoElement(magnetUriOrUrl: string, videoElement: HTMLVideoElement): Promise<void> {
    const client = this.getClient();
    const payload = (magnetUriOrUrl || '').trim();
    if (!payload) {
      throw new Error('No valid magnet link or .torrent URL provided');
    }
    const preparedMagnet = this.prepareMagnetUri(payload);

    return new Promise((resolve, reject) => {
      if (!client) {
        reject(new Error('WebTorrent client not available'));
        return;
      }

      const renderTorrent = (torrent: any) => {
        const isVideo = (name: string) => /\.(mp4|mkv|webm|avi|ts)$/i.test(name);
        const videoFiles = torrent.files.filter((f: any) => isVideo(f.name || ''));
        const pool = videoFiles.length > 0 ? videoFiles : torrent.files;
        const videoFile = pool.reduce((prev: any, curr: any) => {
          return (curr.length > (prev?.length || 0)) ? curr : prev;
        }, pool[0]);

        if (videoFile) {
          videoFile.renderTo(videoElement, {
            autoplay: true,
            controls: false
          }, (err: any) => {
            if (err) {
              console.warn('Render to video element error:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        } else {
          reject(new Error('No playable video stream found in torrent'));
        }
      };

      const existing = client.get(preparedMagnet);
      if (existing) {
        if (existing.files && existing.files.length > 0) {
          renderTorrent(existing);
        } else {
          existing.once('ready', () => renderTorrent(existing));
        }
        return;
      }

      client.add(preparedMagnet, { announce: PUBLIC_WEBRTC_TRACKERS }, (torrent: any) => {
        renderTorrent(torrent);
      });
    });
  }

  /**
   * Pause / Resume torrent transfer by infoHash or taskId
   */
  public togglePause(idOrHash: string): boolean {
    const hash = this.taskIdToInfoHash.get(idOrHash) || idOrHash;
    const torrent = this.activeTorrents.get(hash);
    if (torrent) {
      if (torrent.paused) {
        torrent.resume();
        return true;
      } else {
        torrent.pause();
        return false;
      }
    }
    return false;
  }

  /**
   * Remove and clean up torrent by infoHash or taskId
   */
  public removeTorrent(idOrHash: string): void {
    const hash = this.taskIdToInfoHash.get(idOrHash) || idOrHash;
    const torrent = this.activeTorrents.get(hash);
    if (torrent) {
      torrent.destroy({ destroyStore: true });
      this.activeTorrents.delete(hash);
      this.statsListeners.delete(hash);
      this.taskIdToInfoHash.delete(idOrHash);
    }
  }
}

export const torrentEngine = new TorrentEngine();
