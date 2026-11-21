/**
 * 3-layer parallax (okf/design_tokens.md "Parallax Transition Policy"):
 * IntersectionObserver gates work to visible layers, requestAnimationFrame coalesces scroll events,
 * and each layer's `--parallax-y` feeds a GPU `translate3d` transform in main.css.
 */
export interface ParallaxInput {
  speed: number;
  elementTop: number;
  elementHeight: number;
  viewportHeight: number;
  reducedMotion?: boolean;
  maxShift?: number;
}

export function computeParallaxOffset(i: ParallaxInput): number {
  if (i.reducedMotion || !i.speed) return 0;
  const distance = i.elementTop + i.elementHeight / 2 - i.viewportHeight / 2;
  let offset = -distance * i.speed;
  const max = i.maxShift ?? Infinity;
  offset = Math.max(-max, Math.min(max, offset));
  return Math.round(offset * 10) / 10 || 0;
}

export function initParallax(root: ParentNode = document, win: Window = window): () => void {
  const layers = Array.from(root.querySelectorAll<HTMLElement>('[data-parallax-speed]'));
  const visible = new Set<HTMLElement>();
  const mq = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = !!mq?.matches;
  let frame = 0;
  let active = true;

  const update = () => {
    frame = 0;
    const vh = win.innerHeight;
    for (const el of visible) {
      const speed = Number(el.dataset.parallaxSpeed) || 0;
      const rect = el.getBoundingClientRect();
      const y = computeParallaxOffset({ speed, elementTop: rect.top, elementHeight: rect.height, viewportHeight: vh, reducedMotion: reduced, maxShift: vh * 0.5 });
      el.style.setProperty('--parallax-y', `${y}px`);
    }
  };
  const schedule = () => {
    if (active && !frame) frame = win.requestAnimationFrame(update);
  };

  for (const el of layers) if (Number(el.dataset.parallaxSpeed)) el.style.willChange = 'transform';
  const io = new (win as Window & typeof globalThis).IntersectionObserver(
    (entries: IntersectionObserverEntry[]) => {
      if (!active) return;
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) visible.add(el);
        else visible.delete(el);
      }
      schedule();
    },
    { rootMargin: '20% 0px' },
  );
  layers.forEach((el) => io.observe(el));

  const onMotionChange = (e: MediaQueryListEvent) => {
    reduced = e.matches;
    schedule();
  };
  win.addEventListener('scroll', schedule, { passive: true });
  win.addEventListener('resize', schedule, { passive: true });
  mq?.addEventListener?.('change', onMotionChange);

  return () => {
    active = false;
    io.disconnect();
    win.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', schedule);
    mq?.removeEventListener?.('change', onMotionChange);
    if (frame) win.cancelAnimationFrame(frame);
  };
}
