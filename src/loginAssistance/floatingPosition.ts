/**
 * Phase 113 D-113-15 — position floating panel adjacent to an anchor rect,
 * flipping/shifting to stay in the viewport.
 *
 * Prefer LEFT of the clicked tile (`start` in LTR coords); flip only if needed.
 */

export interface FloatingPanelCoords {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  /** Placement relative to the tile for optional caret styling. */
  side: 'start' | 'end' | 'below' | 'above';
}

const GAP_PX = 12;
const VIEWPORT_PAD_PX = 10;
/** Compact popover — ~20% larger than original 240–300 for readability. */
const PANEL_WIDTH_MIN = 288;
const PANEL_WIDTH_MAX = 360;

function panelWidthForViewport(viewportWidth: number): number {
  const compactPrefer = Math.round(viewportWidth * 0.28);
  return Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, compactPrefer));
}

/**
 * Prefer LEFT of the tile (visual left / `start`); flip to right / below / above only
 * when the preferred side does not fit.
 */
export function computeFloatingPanelPosition(
  anchor: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right' | 'width' | 'height'>,
  options?: {
    viewportWidth?: number;
    viewportHeight?: number;
    /** Measured panel height after layout; used to clamp vertical. */
    panelHeight?: number;
  },
): FloatingPanelCoords {
  const vw = options?.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
  const vh = options?.viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 768);
  const width = panelWidthForViewport(vw);
  const estimatedHeight = options?.panelHeight ?? 384;
  const maxHeight = Math.max(216, vh - VIEWPORT_PAD_PX * 2);

  const spaceStart = anchor.left - GAP_PX - VIEWPORT_PAD_PX;
  const spaceEnd = vw - anchor.right - GAP_PX - VIEWPORT_PAD_PX;

  let left: number;
  let side: FloatingPanelCoords['side'];

  // Operator: open to the LEFT of the cube first.
  if (spaceStart >= width) {
    left = anchor.left - GAP_PX - width;
    side = 'start';
  } else if (spaceEnd >= width) {
    left = anchor.right + GAP_PX;
    side = 'end';
  } else if (anchor.bottom + GAP_PX + Math.min(estimatedHeight, maxHeight) <= vh - VIEWPORT_PAD_PX) {
    left = clamp(
      anchor.left + anchor.width / 2 - width / 2,
      VIEWPORT_PAD_PX,
      vw - width - VIEWPORT_PAD_PX,
    );
    side = 'below';
  } else {
    left = clamp(
      anchor.left + anchor.width / 2 - width / 2,
      VIEWPORT_PAD_PX,
      vw - width - VIEWPORT_PAD_PX,
    );
    side = 'above';
  }

  let top: number;
  if (side === 'below') {
    top = anchor.bottom + GAP_PX;
  } else if (side === 'above') {
    top = Math.max(VIEWPORT_PAD_PX, anchor.top - GAP_PX - Math.min(estimatedHeight, maxHeight));
  } else {
    top = clamp(anchor.top, VIEWPORT_PAD_PX, vh - VIEWPORT_PAD_PX - 80);
  }

  left = clamp(left, VIEWPORT_PAD_PX, Math.max(VIEWPORT_PAD_PX, vw - width - VIEWPORT_PAD_PX));

  if (top + Math.min(estimatedHeight, maxHeight) > vh - VIEWPORT_PAD_PX) {
    top = Math.max(VIEWPORT_PAD_PX, vh - VIEWPORT_PAD_PX - Math.min(estimatedHeight, maxHeight));
  }

  return { top, left, width, maxHeight, side };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
