/**
 * Phase 121.1-IF (§4.10 / D-121-28) — depth-1 frame descriptor helpers (pure).
 * Absent descriptor = top document. SPECIAL only; never used by STANDARD.
 */

import type { FrameDescriptor } from './types';

export const FRAME_TOP_KEY = 'top';

export const FRAME_TOP_LABEL_HE = 'בדף הראשי';
export const FRAME_INSIDE_LABEL_HE = 'בתוך מסגרת:';

/** HTTPS origin in exact `scheme://host[:port]` form (no path, no trailing slash). */
export function isHttpsExactOrigin(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value;
  } catch {
    return false;
  }
}

export function isValidFrameDescriptor(value: unknown): value is FrameDescriptor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.frameLocator === 'string' &&
    d.frameLocator.trim() !== '' &&
    isHttpsExactOrigin(d.frameOrigin)
  );
}

export function frameKey(d?: FrameDescriptor | null): string {
  return d ? `${d.frameLocator}|${d.frameOrigin}` : FRAME_TOP_KEY;
}

export function sameFrame(a?: FrameDescriptor | null, b?: FrameDescriptor | null): boolean {
  return frameKey(a) === frameKey(b);
}

export function cloneFrameDescriptor(d: FrameDescriptor): FrameDescriptor {
  return { frameLocator: d.frameLocator, frameOrigin: d.frameOrigin };
}

/**
 * R2 (+ Architect A2): a frame origin is approved when it is identical to the resolved
 * §4.7 entry origin, or in the approved set (draft descriptors ∪ session approvals).
 * Similar origins (subdomain / registrable domain) are NOT approval.
 */
export function isFrameOriginApproved(
  frameOrigin: string,
  approvedFrameOrigins: ReadonlySet<string>,
  entryAllowedOrigin?: string | null,
): boolean {
  if (!isHttpsExactOrigin(frameOrigin)) return false;
  if (entryAllowedOrigin && frameOrigin === entryAllowedOrigin) return true;
  return approvedFrameOrigins.has(frameOrigin);
}

/** Plain-Hebrew location for display (origin LTR-isolated). */
export function frameLocationLabelHe(d?: FrameDescriptor | null): string {
  return d ? `${FRAME_INSIDE_LABEL_HE} \u2066${d.frameOrigin}\u2069` : FRAME_TOP_LABEL_HE;
}
