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
  'wss://tracker.btorrent.xyz',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.fastcast.nz',
  'wss://tracker.files.fm:7073/announce'
];

class TorrentEngine {
  private client: any = null;
  private activeTorrents: Map<string, any> = new Map();
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
   * Add a magnet URI to the live BitTorrent transfer engine
   */
  public async addTorrent(
    magnetUri: string,
    onProgress?: (stats: SwarmStats) => void
  ): Promise<{ infoHash: string; name: string; streamUrl?: string }> {
    const client = this.getClient();
    const preparedMagnet = this.prepareMagnetUri(magnetUri);

    return new Promise((resolve, reject) => {
      try {
        if (!client) {
          resolve({ infoHash: '0', name: 'BitTorrent Engine Offline' });
          return;
        }

        // If already added, return existing
        const existing = client.get(preparedMagnet);
        if (existing) {
          this.setupTorrentEvents(existing, onProgress);
          resolve({
            infoHash: existing.infoHash,
            name: existing.name || 'Anime Stream',
            streamUrl: existing.files?.[0]?.blobURL
          });
          return;
        }

        const torrent = client.add(preparedMagnet, {
          announce: PUBLIC_WEBRTC_TRACKERS
        });

        if (onProgress) {
          this.statsListeners.set(torrent.infoHash, onProgress);
        }

        this.activeTorrents.set(torrent.infoHash, torrent);
        this.setupTorrentEvents(torrent, onProgress);

        torrent.on('ready', () => {
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
          reject(err);
        });

        // Timeout fallback after 4s to avoid blocking UI if metadata resolution takes longer
        setTimeout(() => {
          resolve({
            infoHash: torrent.infoHash,
            name: torrent.name || 'Connecting to BitTorrent swarm...'
          });
        }, 4000);
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
        length: torrent.length || 1400000000,
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
  public async streamToVideoElement(magnetUri: string, videoElement: HTMLVideoElement): Promise<void> {
    const client = this.getClient();
    const preparedMagnet = this.prepareMagnetUri(magnetUri);

    return new Promise((resolve, reject) => {
      if (!client) {
        reject(new Error('WebTorrent client not available'));
        return;
      }

      client.add(preparedMagnet, { announce: PUBLIC_WEBRTC_TRACKERS }, (torrent: any) => {
        const videoFile = torrent.files.find((f: any) => 
          f.name.endsWith('.mp4') || 
          f.name.endsWith('.mkv') || 
          f.name.endsWith('.webm')
        ) || torrent.files[0];

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
      });
    });
  }

  /**
   * Pause / Resume torrent transfer
   */
  public togglePause(infoHash: string): boolean {
    const torrent = this.activeTorrents.get(infoHash);
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
   * Remove and clean up torrent
   */
  public removeTorrent(infoHash: string): void {
    const torrent = this.activeTorrents.get(infoHash);
    if (torrent) {
      torrent.destroy({ destroyStore: true });
      this.activeTorrents.delete(infoHash);
      this.statsListeners.delete(infoHash);
    }
  }
}

export const torrentEngine = new TorrentEngine();
