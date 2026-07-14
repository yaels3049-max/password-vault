import { ICON_NORMALIZE_SIZES, type IconNormalizeSize } from './types';

export interface NormalizedIconVariant {
  size: IconNormalizeSize;
  blob: Blob;
  mimeType: 'image/png';
  width: number;
  height: number;
}

/** Fraction of the square the logo content should fill (Android-like launcher density). */
const ICON_CONTENT_FILL = 0.92;

interface ContentBounds {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Trim near-empty margins (transparent / near-white) so logos with padding
 * fill the icon like Android launcher assets.
 */
function detectContentBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): ContentBounds {
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      // Treat transparent or near-white as empty margin.
      const isEmpty = a < 12 || (a > 240 && r > 245 && g > 245 && b > 245);
      if (isEmpty) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return { sx: 0, sy: 0, sw: width, sh: height };
  }

  // Small pad so anti-aliased edges aren't clipped after trim.
  const pad = 1;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const ex = Math.min(width - 1, maxX + pad);
  const ey = Math.min(height - 1, maxY + pad);
  return { sx, sy, sw: ex - sx + 1, sh: ey - sy + 1 };
}

/**
 * Normalize an image blob to square PNG variants (32/64/128) via canvas.
 * Trims empty margins, then CONTAIN-fits content to ~92% of the square
 * (full logo visible, Android-like density — not tiny letterboxing).
 */
export async function normalizeIconToSizes(source: Blob): Promise<NormalizedIconVariant[]> {
  const bitmap = await createImageBitmap(source);
  try {
    const measure = document.createElement('canvas');
    measure.width = bitmap.width;
    measure.height = bitmap.height;
    const measureCtx = measure.getContext('2d', { willReadFrequently: true });
    if (!measureCtx) {
      throw new Error('Canvas לא זמין לנרמול אייקון.');
    }
    measureCtx.clearRect(0, 0, measure.width, measure.height);
    measureCtx.drawImage(bitmap, 0, 0);
    const bounds = detectContentBounds(measureCtx, measure.width, measure.height);

    const variants: NormalizedIconVariant[] = [];
    for (const size of ICON_NORMALIZE_SIZES) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas לא זמין לנרמול אייקון.');
      }
      ctx.clearRect(0, 0, size, size);

      const target = size * ICON_CONTENT_FILL;
      const scale = Math.min(target / bounds.sw, target / bounds.sh);
      const drawW = bounds.sw * scale;
      const drawH = bounds.sh * scale;
      const dx = (size - drawW) / 2;
      const dy = (size - drawH) / 2;
      ctx.drawImage(
        bitmap,
        bounds.sx,
        bounds.sy,
        bounds.sw,
        bounds.sh,
        dx,
        dy,
        drawW,
        drawH,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error('נכשל שמירת PNG מנורמל.'));
          },
          'image/png',
        );
      });
      variants.push({
        size,
        blob,
        mimeType: 'image/png',
        width: size,
        height: size,
      });
    }
    return variants;
  } finally {
    bitmap.close();
  }
}
