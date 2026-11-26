/**
 * Card-stack transitions below the envelope: every `[data-sheet]` section is one invitation sheet.
 * - `--in`  0 -> 1 while the sheet's top travels from the viewport bottom up to 20% of the viewport
 *           (the sheet slides up, straightens and plays its own entrance).
 * - `--out` 0 -> 1 while the NEXT sheet slides over this one (it steps back and dims).
 * - `--sheet-top` sticky offset: a sheet sticks once its bottom meets the viewport bottom, so tall
 *   sheets are read in full before the next one covers them (desktop only, see main.css).
 * Reduced motion pins everything to the final state (--in 1, --out 0).
 */
import { clamp01 } from './scroll-scene';

export const SHEET_ENTRY_SPAN = 0.8;

export function sheetIn(top: number, viewportHeight: number): number {
  return clamp01((viewportHeight - top) / (viewportHeight * SHEET_ENTRY_SPAN)) || 0;
}

/** Sticky top for a sheet of height h: 0 when it fits the viewport, negative when it is taller. */
export function sheetStickyTop(height: number, viewportHeight: number): number {
  return Math.min(0, Math.round(viewportHeight - height)) || 0;
}

/**
 * `--end` of the last sheet: 0 when its (unstuck) top enters at the viewport bottom, 1 at the very end of the page,
 * so its closing animation always completes whatever the screen size.
 */
export function sheetEnd(naturalTop: number, viewportHeight: number, scrollY: number, maxScroll: number): number {
  const topAtEnd = naturalTop + scrollY - maxScroll;
  return clamp01((viewportHeight - naturalTop) / Math.max(1, viewportHeight - topAtEnd)) || 0;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function initSheetStack(root: ParentNode = document, win: Window = window): () => void {
  const sheets = Array.from(root.querySelectorAll<HTMLElement>('[data-sheet]'));
  if (!sheets.length) return () => {};
  const mq = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = !!mq?.matches;
  let frame = 0;
  let measured = false;

  const measure = () => {
    const vh = win.innerHeight;
    for (const s of sheets) s.style.setProperty('--sheet-top', `${sheetStickyTop(s.offsetHeight, vh)}px`);
    measured = true;
  };
  const update = () => {
    frame = 0;
    if (!measured) measure();
    const vh = win.innerHeight;
    const ins = sheets.map((s) => (reduced ? 1 : sheetIn(s.getBoundingClientRect().top, vh)));
    sheets.forEach((s, i) => {
      s.style.setProperty('--in', String(round(ins[i])));
      s.style.setProperty('--out', String(reduced || i === sheets.length - 1 ? 0 : round(ins[i + 1])));
    });
    const last = sheets[sheets.length - 1];
    const desk = last.parentElement;
    if (desk) {
      // Natural (unstuck) top of the last sheet, from the bottom of its container.
      const pad = parseFloat(win.getComputedStyle(desk).paddingBottom) || 0;
      const naturalTop = desk.getBoundingClientRect().bottom - pad - last.offsetHeight;
      const maxScroll = Math.max(0, win.document.documentElement.scrollHeight - vh);
      // Reduced motion: keep the closing card readable (envelope left open).
      last.style.setProperty('--end', String(reduced ? 0.5 : round(sheetEnd(naturalTop, vh, win.scrollY, maxScroll))));
    }
  };
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(update);
  };
  const onResize = () => {
    measured = false;
    schedule();
  };
  const onMotion = (e: MediaQueryListEvent) => {
    reduced = e.matches;
    schedule();
  };

  // Lazy images and fonts change sheet heights after load.
  const ro = 'ResizeObserver' in win ? new (win as Window & typeof globalThis).ResizeObserver(onResize) : null;
  sheets.forEach((s) => ro?.observe(s));
  win.addEventListener('scroll', schedule, { passive: true });
  win.addEventListener('resize', onResize, { passive: true });
  mq?.addEventListener?.('change', onMotion);
  update();

  return () => {
    ro?.disconnect();
    win.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', onResize);
    mq?.removeEventListener?.('change', onMotion);
    if (frame) win.cancelAnimationFrame(frame);
  };
}
