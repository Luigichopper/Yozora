import { DanmakuComment } from '../types/anime';
import { db } from './db';
import { MOCK_DANMAKU_COMMENTS } from '../data/mockDanmaku';

class DanmakuService {
  private forbiddenWords: string[] = ['spoiler_death', 'fake_link', 'advertisement_bot'];

  /**
   * Fetch danmaku comments for a specific anime episode
   */
  public async getDanmaku(animeId: string, epNumber: number): Promise<DanmakuComment[]> {
    const cached = await db.getDanmakuForEpisode(animeId, epNumber);
    if (cached.length > 0) {
      return this.filterComments(cached);
    }

    // Initialize with seed comments if empty
    const seed = MOCK_DANMAKU_COMMENTS;
    for (const comment of seed) {
      await db.saveDanmakuComment(animeId, epNumber, comment);
    }
    return seed;
  }

  /**
   * Post a user danmaku comment tied to exact playback second
   */
  public async sendDanmaku(
    animeId: string,
    epNumber: number,
    text: string,
    color = '#ffffff',
    mode: 'scroll' | 'top' | 'bottom' = 'scroll',
    exactPlayheadTime = 0
  ): Promise<DanmakuComment | null> {
    const cleanText = text.trim();
    if (!cleanText) return null;

    // Filter check
    if (this.forbiddenWords.some(w => cleanText.toLowerCase().includes(w))) {
      console.warn('Danmaku comment rejected by content filter.');
      return null;
    }

    const comment: DanmakuComment = {
      id: `dm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      time: Math.max(0, exactPlayheadTime),
      text: cleanText,
      color,
      mode,
      size: 'normal',
      user: 'You'
    };

    await db.saveDanmakuComment(animeId, epNumber, comment);
    return comment;
  }

  /**
   * Filter comments against moderation list
   */
  private filterComments(comments: DanmakuComment[]): DanmakuComment[] {
    return comments.filter(c => !this.forbiddenWords.some(w => c.text.toLowerCase().includes(w)));
  }
}

export const danmakuService = new DanmakuService();
