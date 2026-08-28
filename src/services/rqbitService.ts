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
    if (this.isTauri()) {
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
   * Stop rqbit background server process
   */
  public async stopServer(): Promise<boolean> {
    if (this.isTauri()) {
      try {
        return await this.invokeTauri<boolean>('stop_rqbit_server');
      } catch (e) {
        console.warn('Tauri stop_rqbit_server error:', e);
      }
    }
    return false;
  }

  /**
   * Check if rqbit REST API is listening
   */
  public async checkStatus(listenAddr = this.defaultAddr): Promise<RqbitStatus> {
    if (this.isTauri()) {
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
   * Add magnet/torrent URL and get sequential stream endpoint for mpv / HTML5 player
   */
  public async addTorrentAndGetStream(
    torrentUriOrMagnet: string,
    animeTitle: string,
    listenAddr = this.defaultAddr
  ): Promise<StreamResult> {
    const payload = (torrentUriOrMagnet || '').trim();
    if (!payload) {
      throw new Error('No valid magnet link or .torrent URL provided for streaming');
    }

    // 1. If running under Tauri, ensure daemon is running
    if (this.isTauri()) {
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
          magnet: payload
        });
      } catch (e: any) {
        console.warn('Tauri add_torrent_stream error, attempting direct REST:', e);
      }
    }

    // 2. Direct HTTP REST API with accurate infoHash resolution
    try {
      const match = payload.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
      const targetHash = match ? match[1].toLowerCase() : '';
      let torrentId: number | null = null;
      let initialFiles: any[] = [];

      // Check if already registered in rqbit (strict infoHash match only)
      try {
        const listRes = await fetch(`http://${listenAddr}/torrents`, { signal: AbortSignal.timeout(2000) });
        if (listRes.ok) {
          const listData = await listRes.json();
          const torrents: any[] = Array.isArray(listData) ? listData : (listData.torrents || []);
          const found = targetHash ? torrents.find((t: any) => {
            const h = (t.info_hash || t.infoHash || '').toLowerCase();
            return h === targetHash;
          }) : null;
          if (found && found.id !== undefined) {
            torrentId = found.id;
          }
        }
      } catch {}

      // If not yet registered, POST to rqbit (rqbit accepts magnet:?, http://, https://, or local file)
      if (torrentId === null) {
        const res = await fetch(`http://${listenAddr}/torrents?overwrite=true`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: payload,
          signal: AbortSignal.timeout(4000)
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.id !== undefined) {
            torrentId = data.id;
          } else if (data?.details?.id !== undefined) {
            torrentId = data.details.id;
          }
          if (data?.details?.files && Array.isArray(data.details.files)) {
            initialFiles = data.details.files;
          }
        }
      }

      if (torrentId !== null) {
        let targetFileIndex = 0;
        let fileName = `${animeTitle}.mkv`;
        let fileSize = 0;

        // Query file details to ensure we stream the primary media file
        try {
          let files: any[] = initialFiles;
          if (files.length === 0) {
            const detailsRes = await fetch(`http://${listenAddr}/torrents/${torrentId}`, { signal: AbortSignal.timeout(2000) });
            if (detailsRes.ok) {
              const details = await detailsRes.json();
              files = details.files || [];
            }
          }
          if (files.length > 0) {
              let bestIdx = 0;
              let maxLen = 0;
              let bestFile = files[0];

              // 1. Prioritize video files
              for (let idx = 0; idx < files.length; idx++) {
                const f = files[idx];
                const isVid = /\.(mkv|mp4|webm|avi|ts)$/i.test(f.name || '');
                const len = f.length || 0;
                if (isVid && len > maxLen) {
                  maxLen = len;
                  bestIdx = idx;
                  bestFile = f;
                }
              }

              // 2. Fallback to largest file overall
              if (maxLen === 0) {
                for (let idx = 0; idx < files.length; idx++) {
                  const f = files[idx];
                  const len = f.length || 0;
                  if (len > maxLen) {
                    maxLen = len;
                    bestIdx = idx;
                    bestFile = f;
                  }
                }
              }

              targetFileIndex = bestIdx;
              fileName = bestFile.name || fileName;
              fileSize = bestFile.length || fileSize;
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
      if (this.isTauri()) {
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

