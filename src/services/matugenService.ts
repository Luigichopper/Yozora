import { MatugenPalette } from '../types/anime';
import { applyMatugenTheme, MATUGEN_PALETTES } from '../theme/matugen';

class MatugenService {
  /**
   * Parse live Matugen colors.json configuration
   */
  public parseMatugenJson(jsonStr: string): MatugenPalette | null {
    try {
      const data = JSON.parse(jsonStr);
      const colors = data.colors?.dark || data.colors || data;

      return {
        id: `matugen-live-${Date.now()}`,
        name: 'Matugen (Live Wallpaper Sync)',
        description: 'Dynamically generated from ~/.config/matugen/colors.json',
        primary: colors.primary || '#e4b5cb',
        onPrimary: colors.on_primary || '#442034',
        primaryContainer: colors.primary_container || '#5d354b',
        onPrimaryContainer: colors.on_primary_container || '#ffd8e8',
        secondary: colors.secondary || '#d6c1cd',
        secondaryContainer: colors.secondary_container || '#51434c',
        surface: colors.surface || '#151218',
        surfaceContainer: colors.surface_container || '#1f1a23',
        surfaceContainerHigh: colors.surface_container_high || '#2a242e',
        surfaceContainerHighest: colors.surface_container_highest || '#352e39',
        onSurface: colors.on_surface || '#ece0e6',
        onSurfaceVariant: colors.on_surface_variant || '#d0c3cc',
        outline: colors.outline || '#998d96',
        outlineVariant: colors.outline_variant || '#4d444c',
        accentGlow: `rgba(${this.hexToRgb(colors.primary || '#e4b5cb')}, 0.25)`
      };
    } catch (e) {
      console.error('Failed to parse Matugen JSON:', e);
      return null;
    }
  }

  /**
   * Extract dynamic Material You palette from any wallpaper image
   */
  public async extractPaletteFromImage(file: File): Promise<MatugenPalette> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;

        if (ctx) {
          ctx.drawImage(img, 0, 0, 64, 64);
          const imgData = ctx.getImageData(0, 0, 64, 64).data;

          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < imgData.length; i += 16) {
            r += imgData[i];
            g += imgData[i + 1];
            b += imgData[i + 2];
            count++;
          }
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);

          const primaryHex = this.rgbToHex(r, g, b);
          const palette = this.generatePaletteFromPrimary(primaryHex, file.name);
          URL.revokeObjectURL(url);
          resolve(palette);
        } else {
          URL.revokeObjectURL(url);
          resolve(MATUGEN_PALETTES[0]);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(MATUGEN_PALETTES[0]);
      };

      img.src = url;
    });
  }

  private generatePaletteFromPrimary(primaryHex: string, name: string): MatugenPalette {
    return {
      id: `wallpaper-palette-${Date.now()}`,
      name: `Wallpaper Palette (${name.slice(0, 16)})`,
      description: 'Extracted directly from desktop wallpaper image',
      primary: primaryHex,
      onPrimary: '#1a1016',
      primaryContainer: this.adjustBrightness(primaryHex, -40),
      onPrimaryContainer: this.adjustBrightness(primaryHex, 60),
      secondary: this.adjustBrightness(primaryHex, 20),
      secondaryContainer: this.adjustBrightness(primaryHex, -60),
      surface: '#120f14',
      surfaceContainer: '#1a151e',
      surfaceContainerHigh: '#241e2a',
      surfaceContainerHighest: '#2f2837',
      onSurface: '#f0e6ed',
      onSurfaceVariant: '#d0c3cd',
      outline: '#90838e',
      outlineVariant: '#483f47',
      accentGlow: `rgba(${this.hexToRgb(primaryHex)}, 0.3)`
    };
  }

  private hexToRgb(hex: string): string {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r}, ${g}, ${b}`;
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = Math.max(0, Math.min(255, x)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  private adjustBrightness(hex: string, percent: number): string {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
    return this.rgbToHex(R, G, B);
  }
}

export const matugenService = new MatugenService();
