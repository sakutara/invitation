/** Shared runtime of the envelope pages (index.html, thiep-moi/): scroll scenes, wax-seal tap, countdown, music. */
import { initScrollScenes, scrollSceneTo } from './scroll-scene';
import { initMusic } from './music';

/** d/h/m/s left until `target` (all zero once it has passed). */
export function countdownParts(target: number, now: number): { days: number; hours: number; minutes: number; seconds: number; done: boolean } {
  const ms = Math.max(0, target - now);
  const s = Math.floor(ms / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60, done: ms === 0 };
}

export function initCountdown(doc: Document = document, now: () => number = Date.now): () => void {
  const host = doc.querySelector<HTMLElement>('[data-role="countdown"]');
  const target = Date.parse(host?.dataset.target ?? '');
  if (!host || Number.isNaN(target)) return () => {};
  const nums = Object.fromEntries(Array.from(host.querySelectorAll<HTMLElement>('[data-unit]')).map((el) => [el.dataset.unit!, el]));
  const title = host.querySelector<HTMLElement>('[data-role="countdown-title"]');
  let timer = 0;
  const tick = () => {
    const p = countdownParts(target, now());
    for (const k of ['days', 'hours', 'minutes', 'seconds'] as const) if (nums[k]) nums[k].textContent = k === 'days' ? String(p[k]) : String(p[k]).padStart(2, '0');
    if (p.done) {
      if (title?.dataset.done) title.textContent = title.dataset.done;
      host.classList.add('is-done');
      clearInterval(timer);
    }
  };
  tick();
  timer = (doc.defaultView ?? window).setInterval(tick, 1000) as unknown as number;
  return () => clearInterval(timer);
}

/** Tapping the wax seal scrolls the envelope scene to its opened state (both sheets out, ready to read). */
export function initEnvelope(doc: Document = document): void {
  const scene = doc.querySelector<HTMLElement>('[data-scroll-scene]');
  doc.querySelector('[data-role="open-envelope"]')?.addEventListener('click', () => scene && scrollSceneTo(scene, 0.8,doc.defaultView ?? window));
}

export function initEnvelopePage(doc: Document = document): void {
  initScrollScenes(doc, doc.defaultView ?? window);
  initEnvelope(doc);
  initCountdown(doc);
  initMusic(doc);
}
