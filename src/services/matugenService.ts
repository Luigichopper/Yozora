import { MatugenPalette } from '../types/anime';
import { applyMatugenTheme, MATUGEN_PALETTES } from '../theme/matugen';

interface ColorBox {
  r: number;
  g: number;
  b: number;
  count: number;
  saturation: number;
  luminance: number;
}

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
   * Saturation-Weighted Pixel Cluster Sampling to extract vibrant dominant colors from wallpaper
   */
  public async extractPaletteFromImage(file: File): Promise<MatugenPalette> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 128;

        if (ctx) {
          ctx.drawImage(img, 0, 0, 128, 128);
          const imgData = ctx.getImageData(0, 0, 128, 128).data;

          // Color quantization via cluster sampling
          const clusters: ColorBox[] = [];
          const step = 8;

          for (let i = 0; i < imgData.length; i += step * 4) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];

            if (a < 128) continue; // skip transparent

            const max = Math.max(r, g, b) / 255;
            const min = Math.min(r, g, b) / 255;
            const delta = max - min;
            const sat = max === 0 ? 0 : delta / max;
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Filter out extreme blacks/whites for primary accent
            if (lum > 25 && lum < 235) {
              clusters.push({ r, g, b, count: 1, saturation: sat, luminance: lum });
            }
          }

          // Pick the most vibrant (high saturation, balanced luminance) dominant cluster
          clusters.sort((a, b) => (b.saturation * 1.5 + (b.luminance / 255)) - (a.saturation * 1.5 + (a.luminance / 255)));
          const best = clusters[0] || { r: 228, g: 181, b: 203 };

          const primaryHex = this.rgbToHex(best.r, best.g, best.b);
          const palette = this.generateMaterial3Theme(primaryHex, file.name);
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

  /**
   * Generate complete Material 3 tonal role tokens from primary seed color
   */
  private generateMaterial3Theme(primaryHex: string, name: string): MatugenPalette {
    return {
      id: `wallpaper-palette-${Date.now()}`,
      name: `Wallpaper Palette (${name.slice(0, 16)})`,
      description: 'Extracted via saturation-weighted pixel cluster sampling',
      primary: primaryHex,
      onPrimary: '#140c12',
      primaryContainer: this.adjustBrightness(primaryHex, -45),
      onPrimaryContainer: this.adjustBrightness(primaryHex, 55),
      secondary: this.adjustBrightness(primaryHex, 20),
      secondaryContainer: this.adjustBrightness(primaryHex, -65),
      surface: '#120f14',
      surfaceContainer: '#1a161f',
      surfaceContainerHigh: '#241f2a',
      surfaceContainerHighest: '#302a37',
      onSurface: '#f1e6ee',
      onSurfaceVariant: '#d0c3cd',
      outline: '#928490',
      outlineVariant: '#493f48',
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
    let r = ((num >> 16) & 255) / 255;
    let g = ((num >> 8) & 255) / 255;
    let b = (num & 255) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    let l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    // Adjust lightness proportionally
    l = Math.max(0, Math.min(1, l + (percent / 100)));

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let newR = l;
    let newG = l;
    let newB = l;

    if (s !== 0) {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      newR = hue2rgb(p, q, h + 1 / 3);
      newG = hue2rgb(p, q, h);
      newB = hue2rgb(p, q, h - 1 / 3);
    }

    return this.rgbToHex(Math.round(newR * 255), Math.round(newG * 255), Math.round(newB * 255));
  }
}

export const matugenService = new MatugenService();
