const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

export interface UserMediaEntry {
  status: 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';
  progress: number;
  score: number;
}

export class AniListService {
  private token: string | null = null;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('yozora_anilist_token');
    }
  }

  public setToken(token: string) {
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('yozora_anilist_token', token);
    }
  }

  public clearToken() {
    this.token = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('yozora_anilist_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public isAuthenticated(): boolean {
    return !!this.token;
  }

  private async executeQuery<T>(query: string, variables: Record<string, any>): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const res = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    const body = await res.json();
    if (body.errors && body.errors.length > 0) {
      throw new Error(body.errors.map((e: any) => e.message).join('; '));
    }
    return body.data;
  }

  async updateProgress(mediaId: number, episode: number, totalEpisodes?: number): Promise<boolean> {
    if (!this.token) return false;

    const mutation = `
      mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
        SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status) {
          id
          status
          progress
        }
      }
    `;

    const isCompleted = totalEpisodes ? episode >= totalEpisodes : false;
    const variables = {
      mediaId,
      progress: episode,
      status: isCompleted ? 'COMPLETED' : 'CURRENT',
    };

    try {
      await this.executeQuery(mutation, variables);
      return true;
    } catch (err) {
      console.error('[AniList] Sync Error:', err);
      return false;
    }
  }
}

export const anilistService = new AniListService();
