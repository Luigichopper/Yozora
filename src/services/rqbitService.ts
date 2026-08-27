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

  private isTauriAvailable(): boolean {
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

  public isTauri(): boolean {
    return this.isTauriAvailable();
  }

  /**
   * Add magnet/torrent and get sequential stream endpoint for mpv / HTML5 player
   */
  public async addTorrentAndGetStream(
    magnetUri: string,
    animeTitle: string,
    listenAddr = this.defaultAddr
  ): Promise<StreamResult> {
    // 1. Try Tauri backend command
    if (this.isTauriAvailable()) {
      try {
        return await this.invokeTauri<StreamResult>('add_torrent_stream', {
          listenAddr,
          magnet: magnetUri
        });
      } catch (e) {
        console.warn('Tauri add_torrent_stream error, attempting direct REST:', e);
      }
    }

    // 2. Direct HTTP REST API to rqbit
    try {
      const res = await fetch(`http://${listenAddr}/torrents`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: magnetUri,
        signal: AbortSignal.timeout(4000)
      });

      if (res.ok) {
        const data = await res.json();
        const torrentId = data.id !== undefined ? data.id : 0;
        
        // Return sequential streaming endpoint: GET /torrents/{id}/stream/{file_idx}
        return {
          torrent_id: torrentId,
          file_index: 0,
          file_name: `${animeTitle}.mkv`,
          file_size: 1420000000,
          stream_url: `http://${listenAddr}/torrents/${torrentId}/stream/0`
        };
      }
    } catch (err) {
      console.warn('Direct rqbit REST call error:', err);
    }

    // 3. Throw clear error when rqbit is unavailable rather than returning an invalid URL
    throw new Error(`rqbit streaming engine is offline at ${listenAddr}. Start the rqbit daemon in Settings or install rqbit on your system.`);
  }

  /**
   * Launch external mpv binary with hardware acceleration
   */
  public async launchExternalMpv(streamUrl: string, title: string): Promise<boolean> {
    if (this.isTauriAvailable()) {
      try {
        return await this.invokeTauri<boolean>('launch_external_mpv', {
          streamUrl,
          title
        });
      } catch (e) {
        console.warn('Failed to launch external mpv:', e);
      }
    }
    return false;
  }
}

export const rqbitService = new RqbitService();

