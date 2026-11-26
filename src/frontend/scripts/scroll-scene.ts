/**
 * Scroll-linked progress for the envelope invitation:
 * - [data-scroll-scene]: a tall section with a sticky stage. Its progress (0 at the top, 1 when the stage
 *   un-sticks) is split into named phases, each written as a CSS variable (--cover, --flap, --card, …).
 * - [data-scroll-progress]: any element; --sp goes 0 -> 1 while its top travels from the viewport bottom
 *   up by `data-scroll-span` viewport heights (default 0.7). Used for the hand-drawn heart and staggered text.
 * Everything is batched in one requestAnimationFrame; reduced motion pins every value to 1 (final state).
 */

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Envelope phases as [start, end] fractions of the scene progress. */
export const ENVELOPE_PHASES: Record<string, [number, number]> = {
  cover: [0.0, 0.2], // closed envelope cover lifts away
  stage: [0.1, 0.26], // envelope settles in the middle of the ivory page
  flap: [0.26, 0.44], // flap swings open
  card: [0.44, 0.72], // photo + save-the-date slide out
  fan: [0.66, 0.84], // photo and card fan apart
  caption: [0.8, 0.96], // caption under the envelope
};

/** Progress of a sticky scene: 0 when its top reaches the viewport top, 1 when its bottom reaches the viewport bottom. */
export function sceneProgress(top: number, height: number, viewportHeight: number): number {
  const travel = height - viewportHeight;
  if (travel <= 0) return top <= 0 ? 1 : 0;
  return clamp01(-top / travel) || 0;
}

export function phaseValues(progress: number, phases: Record<string, [number, number]> = ENVELOPE_PHASES): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, [a, b]] of Object.entries(phases)) out[name] = easeInOut(clamp01((progress - a) / (b - a)));
  return out;
}

/** Entry progress of an element (see header). */
export function entryProgress(top: number, viewportHeight: number, span = 0.7): number {
  return clamp01((viewportHeight - top) / (viewportHeight * span));
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function initScrollScenes(root: ParentNode = document, win: Window = window): () => void {
  const scenes = Array.from(root.querySelectorAll<HTMLElement>('[data-scroll-scene]'));
  const tracked = Array.from(root.querySelectorAll<HTMLElement>('[data-scroll-progress]'));
  const mq = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = !!mq?.matches;
  let frame = 0;

  const update = () => {
    frame = 0;
    const vh = win.innerHeight;
    for (const scene of scenes) {
      const r = scene.getBoundingClientRect();
      const p = reduced ? 1 : sceneProgress(r.top, r.height, vh);
      scene.style.setProperty('--scene', String(round(p)));
      for (const [k, v] of Object.entries(phaseValues(p))) scene.style.setProperty(`--${k}`, String(round(v)));
      scene.classList.toggle('is-open', reduced || phaseValues(p).flap > 0.5);
      scene.classList.toggle('is-done', p >= 0.999);
    }
    for (const el of tracked) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) continue;
      const span = Number(el.dataset.scrollSpan) || 0.7;
      el.style.setProperty('--sp', String(reduced ? 1 : round(entryProgress(r.top, vh, span))));
    }
  };
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(update);
  };
  const onMotion = (e: MediaQueryListEvent) => {
    reduced = e.matches;
    schedule();
  };

  win.addEventListener('scroll', schedule, { passive: true });
  win.addEventListener('resize', schedule, { passive: true });
  mq?.addEventListener?.('change', onMotion);
  update();

  return () => {
    win.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', schedule);
    mq?.removeEventListener?.('change', onMotion);
    if (frame) win.cancelAnimationFrame(frame);
  };
}

/** Smooth-scrolls so the scene reaches the given progress (tap on the wax seal = open the envelope). */
export function scrollSceneTo(scene: HTMLElement, progress: number, win: Window = window): void {
  const r = scene.getBoundingClientRect();
  const travel = r.height - win.innerHeight;
  const behavior: ScrollBehavior = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  win.scrollTo({ top: win.scrollY + r.top + travel * progress, behavior });
}
