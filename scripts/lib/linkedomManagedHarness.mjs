/**
 * Shared linkedom harness helpers for Managed eligibility (120.6 V8 hit-test).
 * Gives distinct rects per control and a stacking-aware elementFromPoint.
 */
export function installManagedDomGeometry(window) {
  window.innerWidth = 1024;
  window.innerHeight = 768;

  const prevStyle =
    typeof window.getComputedStyle === 'function'
      ? window.getComputedStyle.bind(window)
      : null;
  window.getComputedStyle = (el) => {
    let base;
    try {
      base = prevStyle ? prevStyle(el) : {};
    } catch (_e) {
      base = {};
    }
    const style = el?.getAttribute?.('style') || '';
    return {
      display: base.display || (/display:\s*none/i.test(style) ? 'none' : 'block'),
      visibility: base.visibility || (/visibility:\s*hidden/i.test(style) ? 'hidden' : 'visible'),
      opacity: base.opacity || (/opacity:\s*0(?:\.0+)?(?:;|$)/i.test(style) ? '0' : '1'),
      pointerEvents:
        base.pointerEvents || (/pointer-events:\s*none/i.test(style) ? 'none' : 'auto'),
    };
  };

  function layoutIndex(el) {
    if (typeof el._pvLayoutIndex === 'number') {
      return el._pvLayoutIndex;
    }
    const all = Array.from(
      el.ownerDocument.querySelectorAll('input, textarea, button, select, label, a'),
    );
    all.forEach((node, i) => {
      node._pvLayoutIndex = i;
    });
    return typeof el._pvLayoutIndex === 'number' ? el._pvLayoutIndex : 0;
  }

  function readBox(el) {
    const style = el.getAttribute?.('style') || '';
    if (/display:\s*none|visibility:\s*hidden/i.test(style)) {
      return { width: 0, height: 0, left: 0, top: 0 };
    }
    const tag = String(el.tagName || '').toUpperCase();
    const isControl =
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'BUTTON' ||
      tag === 'SELECT' ||
      tag === 'LABEL' ||
      tag === 'A';
    const hasExplicit =
      /width:\s*\d+/i.test(style) ||
      /height:\s*\d+/i.test(style) ||
      /left:\s*-?\d+/i.test(style) ||
      /top:\s*-?\d+/i.test(style);
    if (!isControl && !hasExplicit) {
      return { width: 0, height: 0, left: 0, top: 0 };
    }
    const w = /width:\s*(\d+)/i.test(style) ? Number(RegExp.$1) : isControl ? 120 : 0;
    const h = /height:\s*(\d+)/i.test(style) ? Number(RegExp.$1) : isControl ? 24 : 0;
    const left = /left:\s*(-?\d+)/i.test(style) ? Number(RegExp.$1) : 0;
    const top = /top:\s*(-?\d+)/i.test(style)
      ? Number(RegExp.$1)
      : isControl
        ? layoutIndex(el) * 40
        : 0;
    return { width: w, height: h, left, top };
  }

  const Proto = window.HTMLElement.prototype;
  Proto.getClientRects = function getClientRects() {
    const box = readBox(this);
    if (box.width < 1 || box.height < 1) return [];
    return [
      {
        width: box.width,
        height: box.height,
        top: box.top,
        left: box.left,
        bottom: box.top + box.height,
        right: box.left + box.width,
      },
    ];
  };
  Proto.getBoundingClientRect = function getBoundingClientRect() {
    const rects = this.getClientRects();
    if (!rects.length) {
      return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0 };
    }
    const r = rects[0];
    return {
      width: r.width,
      height: r.height,
      top: r.top,
      left: r.left,
      bottom: r.bottom,
      right: r.right,
      x: r.left,
      y: r.top,
    };
  };
  Proto.scrollIntoView = function scrollIntoView() {};

  window.document.elementFromPoint = function elementFromPoint(x, y) {
    const all = Array.from(window.document.querySelectorAll('*')).filter((el) => {
      const tag = String(el.tagName || '').toUpperCase();
      return tag !== 'HTML' && tag !== 'HEAD' && tag !== 'BODY' && tag !== 'SCRIPT';
    });
    let best = null;
    let bestZ = -Infinity;
    let bestOrder = -1;
    for (let order = 0; order < all.length; order += 1) {
      const el = all[order];
      const style = el.getAttribute('style') || '';
      if (/pointer-events:\s*none/i.test(style)) continue;
      if (/display:\s*none|visibility:\s*hidden/i.test(style)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) {
        const z = /z-index:\s*(-?\d+)/i.test(style) ? Number(RegExp.$1) : 0;
        if (z > bestZ || (z === bestZ && order > bestOrder)) {
          best = el;
          bestZ = z;
          bestOrder = order;
        }
      }
    }
    return best;
  };
}
