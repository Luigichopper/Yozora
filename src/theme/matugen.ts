import { MatugenPalette } from '../types/anime';

export const MATUGEN_PALETTES: MatugenPalette[] = [
  {
    id: 'twilight-sakura',
    name: 'Twilight Sakura (End4-pC Default)',
    description: 'Deep violet-charcoal with soft mauve & blossom accents (Matches Image 1)',
    primary: '#e4b5cb',
    onPrimary: '#442034',
    primaryContainer: '#5d354b',
    onPrimaryContainer: '#ffd8e8',
    secondary: '#d6c1cd',
    secondaryContainer: '#51434c',
    surface: '#151218',
    surfaceContainer: '#1f1a23',
    surfaceContainerHigh: '#2a242e',
    surfaceContainerHighest: '#352e39',
    onSurface: '#ece0e6',
    onSurfaceVariant: '#d0c3cc',
    outline: '#998d96',
    outlineVariant: '#4d444c',
    accentGlow: 'rgba(228, 181, 203, 0.25)'
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha (Mauve)',
    description: 'Soothing pastel dark palette beloved by the Hyprland community',
    primary: '#cba6f7',
    onPrimary: '#11111b',
    primaryContainer: '#453564',
    onPrimaryContainer: '#f5c2e7',
    secondary: '#89b4fa',
    secondaryContainer: '#313244',
    surface: '#181825',
    surfaceContainer: '#1e1e2e',
    surfaceContainerHigh: '#313244',
    surfaceContainerHighest: '#45475a',
    onSurface: '#cdd6f4',
    onSurfaceVariant: '#a6adc8',
    outline: '#6c7086',
    outlineVariant: '#45475a',
    accentGlow: 'rgba(203, 166, 247, 0.25)'
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night Storm',
    description: 'Deep electric cyan, midnight blues and vibrant neon accents',
    primary: '#7aa2f7',
    onPrimary: '#1a1b26',
    primaryContainer: '#283457',
    onPrimaryContainer: '#bb9af7',
    secondary: '#7dcfff',
    secondaryContainer: '#24283b',
    surface: '#16161e',
    surfaceContainer: '#1a1b26',
    surfaceContainerHigh: '#24283b',
    surfaceContainerHighest: '#2f354f',
    onSurface: '#c0caf5',
    onSurfaceVariant: '#a9b1d6',
    outline: '#565f89',
    outlineVariant: '#3b4261',
    accentGlow: 'rgba(122, 162, 247, 0.25)'
  },
  {
    id: 'anidb-amber',
    name: 'AniDB Amber Sunset',
    description: 'Vibrant orange-amber accent matching the classic AniDB interface (Image 2)',
    primary: '#ff9800',
    onPrimary: '#2e1500',
    primaryContainer: '#542d00',
    onPrimaryContainer: '#ffddb6',
    secondary: '#e7bf93',
    secondaryContainer: '#4f3a22',
    surface: '#151311',
    surfaceContainer: '#1e1a17',
    surfaceContainerHigh: '#292420',
    surfaceContainerHighest: '#352f2a',
    onSurface: '#ede0d8',
    onSurfaceVariant: '#d4c3b6',
    outline: '#9d8e82',
    outlineVariant: '#50453c',
    accentGlow: 'rgba(255, 152, 0, 0.25)'
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine (Moon)',
    description: 'Earthy warm darks with rose gold, iris, and pine highlights',
    primary: '#ea9a97',
    onPrimary: '#232136',
    primaryContainer: '#4d3240',
    onPrimaryContainer: '#f6c177',
    secondary: '#9ccfd8',
    secondaryContainer: '#393552',
    surface: '#191724',
    surfaceContainer: '#1f1d2e',
    surfaceContainerHigh: '#26233a',
    surfaceContainerHighest: '#393552',
    onSurface: '#e0def4',
    onSurfaceVariant: '#908caa',
    outline: '#6e6a86',
    outlineVariant: '#44415a',
    accentGlow: 'rgba(234, 154, 151, 0.25)'
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Aurora',
    description: 'Deep botanical jade and mint highlights for a calm ambient look',
    primary: '#7ed4ad',
    onPrimary: '#003824',
    primaryContainer: '#005237',
    onPrimaryContainer: '#9af1c8',
    secondary: '#b3ccbe',
    secondaryContainer: '#364b41',
    surface: '#0f1512',
    surfaceContainer: '#151e1a',
    surfaceContainerHigh: '#1f2a24',
    surfaceContainerHighest: '#2a3730',
    onSurface: '#dfe5e0',
    onSurfaceVariant: '#bec9c2',
    outline: '#88938d',
    outlineVariant: '#3f4944',
    accentGlow: 'rgba(126, 212, 173, 0.25)'
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Edgerunner',
    description: 'High-contrast neon yellow and hot magenta over deep pitch black',
    primary: '#00f0ff',
    onPrimary: '#00363a',
    primaryContainer: '#ffe600',
    onPrimaryContainer: '#ff0055',
    secondary: '#ff0055',
    secondaryContainer: '#380016',
    surface: '#0a0a0f',
    surfaceContainer: '#12121c',
    surfaceContainerHigh: '#1c1c2b',
    surfaceContainerHighest: '#28283d',
    onSurface: '#e5e8f5',
    onSurfaceVariant: '#a2a7c4',
    outline: '#5b6188',
    outlineVariant: '#32344f',
    accentGlow: 'rgba(0, 240, 255, 0.3)'
  }
];

export function applyMatugenTheme(palette: MatugenPalette) {
  const root = document.documentElement;
  root.style.setProperty('--md-sys-color-primary', palette.primary);
  root.style.setProperty('--md-sys-color-on-primary', palette.onPrimary);
  root.style.setProperty('--md-sys-color-primary-container', palette.primaryContainer);
  root.style.setProperty('--md-sys-color-on-primary-container', palette.onPrimaryContainer);
  root.style.setProperty('--md-sys-color-secondary', palette.secondary);
  root.style.setProperty('--md-sys-color-secondary-container', palette.secondaryContainer);
  root.style.setProperty('--md-sys-color-surface', palette.surface);
  root.style.setProperty('--md-sys-color-surface-container', palette.surfaceContainer);
  root.style.setProperty('--md-sys-color-surface-container-high', palette.surfaceContainerHigh);
  root.style.setProperty('--md-sys-color-surface-container-highest', palette.surfaceContainerHighest);
  root.style.setProperty('--md-sys-color-on-surface', palette.onSurface);
  root.style.setProperty('--md-sys-color-on-surface-variant', palette.onSurfaceVariant);
  root.style.setProperty('--md-sys-color-outline', palette.outline);
  root.style.setProperty('--md-sys-color-outline-variant', palette.outlineVariant);
  root.style.setProperty('--md-sys-color-accent-glow', palette.accentGlow);
}
