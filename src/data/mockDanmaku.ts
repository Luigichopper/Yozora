import { DanmakuComment } from '../types/anime';

// Verified, high-throughput public media streams (200 OK without 403 blocks)
export const SAMPLE_VIDEOS = {
  default: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
  mirror1: 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-1080p.mp4',
  mirror2: 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-720p.mp4',
  mirror3: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
  mirror4: 'https://vjs.zencdn.net/v/oceans.mp4',
  hlsStream: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
};

export const MOCK_DANMAKU_COMMENTS: DanmakuComment[] = [
  { id: 'dm-1', time: 1.0, text: '🎉 前方高能！全体起立！', color: '#ffb3ba', mode: 'scroll', size: 'normal', user: 'NinaSimp' },
  { id: 'dm-2', time: 2.2, text: '这就是令和第一摇滚少女吗？！太绝了', color: '#ffffff', mode: 'scroll', size: 'normal' },
  { id: 'dm-3', time: 3.5, text: '👑 仁菜我的超人！🎸⚡', color: '#ffdfba', mode: 'scroll', size: 'large' },
  { id: 'dm-4', time: 4.8, text: '【弹幕礼仪：请勿剧透，文明观番】', color: '#ffffba', mode: 'top', size: 'normal' },
  { id: 'dm-5', time: 6.2, text: '这3D渲2D的表情作画简直刷新业界标杆！', color: '#baffc9', mode: 'scroll', size: 'normal' },
  { id: 'dm-6', time: 7.8, text: '吉他扫弦一出来的瞬间直接起鸡皮疙瘩！', color: '#bae1ff', mode: 'scroll', size: 'normal' },
  { id: 'dm-7', time: 9.4, text: '呜呜呜桃香真的太温柔太帅了', color: '#e8c5ff', mode: 'scroll', size: 'normal' },
  { id: 'dm-8', time: 11.0, text: '神曲预定！！循环了亿万遍！', color: '#ffb3ba', mode: 'scroll', size: 'large' },
  { id: 'dm-9', time: 13.2, text: '从熊本跑到东京的叛逆JK Rocker！', color: '#ffffff', mode: 'scroll', size: 'normal' },
  { id: 'dm-10', time: 15.0, text: '这才是真正的青春与摇滚精神啊！🎸⚡', color: '#ffd700', mode: 'bottom', size: 'large' },
  { id: 'dm-11', time: 17.5, text: '4K 60FPS 画质太爽了，感谢压制组', color: '#00ffff', mode: 'scroll', size: 'normal' },
  { id: 'dm-12', time: 20.0, text: '好听！词作太戳心了', color: '#ffffff', mode: 'scroll', size: 'normal' },
  { id: 'dm-13', time: 22.0, text: '这里的分镜和光影处理绝了', color: '#ffffff', mode: 'scroll', size: 'normal' },
  { id: 'dm-14', time: 25.5, text: '草（中日双语大笑）www', color: '#baffc9', mode: 'scroll', size: 'normal' },
  { id: 'dm-15', time: 28.0, text: '太好看了，每周的精神支柱', color: '#ffb3ba', mode: 'scroll', size: 'normal' },
  { id: 'dm-16', time: 31.0, text: '怒りの日！愤怒就是我们的原动力！', color: '#ff4444', mode: 'top', size: 'large' },
  { id: 'dm-17', time: 35.0, text: '各位弹幕见，下集必追！', color: '#ffffff', mode: 'scroll', size: 'normal' }
];
