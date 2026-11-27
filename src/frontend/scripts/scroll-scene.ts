/**
 * Scroll-linked progress for the envelope pages:
 * - [data-scroll-scene]: a tall section with a sticky stage. Its progress (0 at the top, 1 when the stage
 *   un-sticks) is split into overlapping phases, each written as a CSS variable (--cover, --flap, --rise, …).
 * - [data-scroll-progress]: any element; --sp goes 0 -> 1 while its top travels from the viewport bottom
 *   up by `data-scroll-span` viewport heights (default 0.7). Drives entrances, the calendar heart, etc.
 * Every value eases toward its scroll target frame by frame (critically damped), so wheel steps and
 * touch flicks turn into one continuous motion instead of jumps. Reduced motion pins everything to 1.
 */

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Gentler S-curve used for the scene phases (no long dead zones at either end). */
export const easeSine = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;

/** Envelope phases as [start, end] fractions of the scene progress. Neighbouring phases overlap, so motion never stops between them. */
export const ENVELOPE_PHASES: Record<string, [number, number]> = {
  cover: [0, 0.1], // closed envelope cover lifts away
  stage: [0.02, 0.13], // the open-able envelope settles in the middle
  flap: [0.1, 0.22], // flap swings open
  rise: [0.2, 0.38], // both sheets slide straight up, still lying sideways, until fully out of the envelope (which sinks)
  fan: [0.36, 0.54], // they turn upright and spread apart
  read: [0.52, 0.72], // they come forward to be read; 0.72..1 holds the final state
};

/** Progress of a sticky scene: 0 when its top reaches the viewport top, 1 when its bottom reaches the viewport bottom. */
export function sceneProgress(top: number, height: number, viewportHeight: number): number {
  const travel = height - viewportHeight;
  if (travel <= 0) return top <= 0 ? 1 : 0;
  return clamp01(-top / travel) || 0;
}

export function phaseValues(progress: number, phases: Record<string, [number, number]> = ENVELOPE_PHASES): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, [a, b]] of Object.entries(phases)) out[name] = easeSine(clamp01((progress - a) / (b - a)));
  return out;
}

/** Entry progress of an element (see header). */
export function entryProgress(top: number, viewportHeight: number, span = 0.7): number {
  return clamp01((viewportHeight - top) / (viewportHeight * span));
}

/** One smoothing step: move `current` toward `target`, frame-rate independent (`dt` in ms). */
export function follow(current: number, target: number, dt: number, halfLifeMs = 70): number {
  const k = 1 - Math.pow(0.5, Math.max(0, dt) / halfLifeMs);
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 0.0005 ? target : next;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function initScrollScenes(root: ParentNode = document, win: Window = window): () => void {
  const scenes = Array.from(root.querySelectorAll<HTMLElement>('[data-scroll-scene]'));
  const tracked = Array.from(root.querySelectorAll<HTMLElement>('[data-scroll-progress]'));
  const mq = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = !!mq?.matches;
  let frame = 0;
  let last = 0;
  /** Displayed (smoothed) value per element; written as CSS variables only when it changes. */
  const shown = new Map<HTMLElement, number>();
  const written = new Map<HTMLElement, string>();

  const ease = (el: HTMLElement, target: number, dt: number, jump: boolean) => {
    const cur = shown.get(el);
    const next = cur === undefined || jump ? target : follow(cur, target, dt);
    shown.set(el, next);
    return next;
  };

  const writeScene = (scene: HTMLElement, p: number) => {
    const key = String(round(p));
    if (written.get(scene) === key) return;
    written.set(scene, key);
    scene.style.setProperty('--scene', key);
    const v = phaseValues(p);
    for (const [k, x] of Object.entries(v)) scene.style.setProperty(`--${k}`, String(round(x)));
    // The flap passes behind the sheets once it is edge-on (invisible switch).
    scene.classList.toggle('is-open', v.flap > 0.5);
    scene.classList.toggle('is-done', p >= 0.999);
  };

  const update = (now: number) => {
    frame = 0;
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    const vh = win.innerHeight;
    let moving = false;
    for (const scene of scenes) {
      const r = scene.getBoundingClientRect();
      const target = reduced ? 1 : sceneProgress(r.top, r.height, vh);
      const p = ease(scene, target, dt, reduced);
      if (p !== target) moving = true;
      writeScene(scene, p);
    }
    for (const el of tracked) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) continue;
      const span = Number(el.dataset.scrollSpan) || 0.7;
      const target = reduced ? 1 : entryProgress(r.top, vh, span);
      const v = ease(el, target, dt, reduced);
      if (v !== target) moving = true;
      const key = String(round(v));
      if (written.get(el) !== key) {
        written.set(el, key);
        el.style.setProperty('--sp', key);
      }
    }
    if (moving) frame = win.requestAnimationFrame(update);
    else last = 0;
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
  // First paint: jump straight to the current scroll position (no easing in from 0 on reload mid-page).
  const vh0 = win.innerHeight;
  for (const scene of scenes) {
    const r = scene.getBoundingClientRect();
    const p = reduced ? 1 : sceneProgress(r.top, r.height, vh0);
    shown.set(scene, p);
    writeScene(scene, p);
  }
  update(0);

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
