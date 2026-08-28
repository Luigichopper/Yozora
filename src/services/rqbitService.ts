export interface RqbitStatus {
  running: boolean;
  listen_addr: string;
  pid?: number;
}

export interface StreamResult {
  torrent_id: number;
  file_index: number;
  file_name: string;
  file_size: number;
  stream_url: string;
}

export interface RqbitTorrentStats {
  id: number;
  name: string;
  progress_bytes: number;
  total_bytes: number;
  download_speed: number;
  upload_speed: number;
  state: 'downloading' | 'paused' | 'seeding' | 'error';
  peers: number;
}

class RqbitService {
  private defaultAddr = '127.0.0.1:3030';

  public isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  }

  private isTauriAvailable(): boolean {
    return this.isTauri();
  }

  private async invokeTauri<T>(cmd: string, args?: Record<string, any>): Promise<T> {
    const tauri = (window as any).__TAURI__;
    if (tauri && tauri.invoke) {
      return await tauri.invoke(cmd, args);
    }
    throw new Error('Tauri IPC not available in standard browser environment');
  }

  /**
   * Start rqbit background server process
   */
  public async startServer(listenAddr = this.defaultAddr, cacheDir?: string): Promise<RqbitStatus> {
    if (this.isTauriAvailable()) {
      try {
        return await this.invokeTauri<RqbitStatus>('start_rqbit_server', {
          listenAddr,
          cacheDir
        });
      } catch (e: any) {
        console.warn('Tauri start_rqbit_server failed:', e);
        throw new Error(typeof e === 'string' ? e : e?.message || 'Failed to spawn rqbit binary');
      }
    }

    // Direct HTTP ping check
    const status = await this.checkStatus(listenAddr);
    if (!status.running) {
      throw new Error(`rqbit daemon is not listening on ${listenAddr}. Ensure rqbit is installed ('cargo install rqbit') and running.`);
    }
    return status;
  }

  /**
   * Check if rqbit REST API is listening
   */
  public async checkStatus(listenAddr = this.defaultAddr): Promise<RqbitStatus> {
    if (this.isTauriAvailable()) {
      try {
        return await this.invokeTauri<RqbitStatus>('get_rqbit_status', { listenAddr });
      } catch (e) {
        // Fallthrough to direct fetch
      }
    }

    try {
      const res = await fetch(`http://${listenAddr}/torrents`, {
        signal: AbortSignal.timeout(1200)
      });
      return {
        running: res.ok,
        listen_addr: listenAddr
      };
    } catch {
      return {
        running: false,
        listen_addr: listenAddr
      };
    }
  }

  /**
   * Add magnet/torrent and get sequential stream endpoint for mpv / HTML5 player
   */
  /**
   * Add magnet/torrent and get sequential stream endpoint for mpv / HTML5 player
   */
  public async addTorrentAndGetStream(
    magnetUri: string,
    animeTitle: string,
    listenAddr = this.defaultAddr
  ): Promise<StreamResult> {
    // 1. If running under Tauri, ensure daemon is running
    if (this.isTauriAvailable()) {
      try {
        const status = await this.checkStatus(listenAddr);
        if (!status.running) {
          try {
            await this.startServer(listenAddr);
            // Brief pause for server socket binding
            await new Promise(r => setTimeout(r, 600));
          } catch (startErr) {
            console.warn('Auto-starting rqbit server failed:', startErr);
          }
        }

        return await this.invokeTauri<StreamResult>('add_torrent_stream', {
          listenAddr,
          magnet: magnetUri
        });
      } catch (e: any) {
        console.warn('Tauri add_torrent_stream error, attempting direct REST:', e);
      }
    }

    // 2. Direct HTTP REST API with accurate infoHash resolution
    try {
      const match = magnetUri.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
      const targetHash = match ? match[1].toLowerCase() : '';
      let torrentId: number | null = null;

      // Check if already registered in rqbit
      try {
        const listRes = await fetch(`http://${listenAddr}/torrents`, { signal: AbortSignal.timeout(2000) });
        if (listRes.ok) {
          const listData = await listRes.json();
          const torrents: any[] = Array.isArray(listData) ? listData : (listData.torrents || []);
          const found = torrents.find((t: any) => {
            const h = (t.info_hash || t.infoHash || '').toLowerCase();
            return (targetHash && h === targetHash) || (t.name && animeTitle && t.name.toLowerCase().includes(animeTitle.toLowerCase()));
          });
          if (found && found.id !== undefined) {
            torrentId = found.id;
          }
        }
      } catch {}

      // If not yet registered, POST to rqbit
      if (torrentId === null) {
        const res = await fetch(`http://${listenAddr}/torrents`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: magnetUri,
          signal: AbortSignal.timeout(4000)
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.id !== undefined) {
            torrentId = data.id;
          }
        }
      }

      if (torrentId !== null) {
        let targetFileIndex = 0;
        let fileName = `${animeTitle}.mkv`;
        let fileSize = 1420000000;

        // Query file details to ensure we stream the primary media file
        try {
          const detailsRes = await fetch(`http://${listenAddr}/torrents/${torrentId}`, { signal: AbortSignal.timeout(2000) });
          if (detailsRes.ok) {
            const details = await detailsRes.json();
            const files: any[] = details.files || [];
            if (files.length > 0) {
              const videoFiles = files.filter(f => /\.(mkv|mp4|webm|avi)$/i.test(f.name || ''));
              const pool = videoFiles.length > 0 ? videoFiles : files;
              let bestFile = pool[0];
              let maxLen = 0;
              for (const file of pool) {
                if ((file.length || 0) > maxLen) {
                  maxLen = file.length || 0;
                  bestFile = file;
                }
              }
              if (bestFile) {
                targetFileIndex = bestFile.id !== undefined ? bestFile.id : 0;
                fileName = bestFile.name || fileName;
                fileSize = bestFile.length || fileSize;
              }
            }
          }
        } catch {}

        return {
          torrent_id: torrentId,
          file_index: targetFileIndex,
          file_name: fileName,
          file_size: fileSize,
          stream_url: `http://${listenAddr}/torrents/${torrentId}/stream/${targetFileIndex}`
        };
      }
    } catch (err) {
      console.warn('Direct rqbit REST call error:', err);
    }

    // 3. Throw clear error when rqbit is unavailable rather than returning an invalid URL
    throw new Error(`rqbit streaming engine is offline at ${listenAddr}. Start the rqbit daemon in Settings or install rqbit on your system.`);
  }

  /**
   * Launch external mpv binary with hardware acceleration and IPC
   */
  public async launchExternalMpv(streamUrl: string, title: string): Promise<boolean> {
    if (this.isTauriAvailable()) {
      try {
        return await this.invokeTauri<boolean>('launch_external_mpv', {
          streamUrl,
          title
        });
      } catch (e: any) {
        console.warn('Failed to launch external mpv:', e);
        throw new Error(typeof e === 'string' ? e : e?.message || 'Failed to spawn mpv process');
      }
    }
    return false;
  }

  /**
   * Open mpv player alias
   */
  public async openMpvPlayer(streamUrl: string, title: string): Promise<void> {
    await this.launchExternalMpv(streamUrl, title);
  }
}

export const rqbitService = new RqbitService();

