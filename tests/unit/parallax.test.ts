// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeParallaxOffset, initParallax } from '../../src/frontend/scripts/parallax';
import { COLOR_TOKENS, FLUID_TEXT_TOKENS, FONT_TOKENS } from '../../src/shared/types';

describe('computeParallaxOffset', () => {
  const base = { elementTop: 900, elementHeight: 400, viewportHeight: 800 };

  it('is 0 when the element is centred in the viewport', () => {
    expect(computeParallaxOffset({ ...base, elementTop: 200, speed: 0.25 })).toBe(0);
  });

  it('moves background layers (0.25) slower than scroll and ornaments (-0.15) against it', () => {
    // element centre is 700px below viewport centre
    expect(computeParallaxOffset({ ...base, speed: 0.25 })).toBeCloseTo(-175);
    expect(computeParallaxOffset({ ...base, speed: -0.15 })).toBeCloseTo(105);
    expect(computeParallaxOffset({ ...base, speed: 0 })).toBe(0);
  });

  it('changes monotonically with scroll progress', () => {
    const offsets = [1200, 900, 600, 300, 0, -300].map((top) => computeParallaxOffset({ ...base, elementTop: top, speed: 0.25 }));
    for (let i = 1; i < offsets.length; i++) expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
  });

  it('clamps to maxShift', () => {
    expect(computeParallaxOffset({ ...base, elementTop: 10_000, speed: 0.25, maxShift: 120 })).toBe(-120);
  });

  it('evaluates to 0 under prefers-reduced-motion', () => {
    expect(computeParallaxOffset({ ...base, speed: 0.25, reducedMotion: true })).toBe(0);
  });
});

describe('initParallax (DOM)', () => {
  let observed: Element[];
  let ioCallback: (entries: Partial<IntersectionObserverEntry>[]) => void;
  let rafQueue: FrameRequestCallback[];
  let reduced: boolean;
  const cleanups: (() => void)[] = [];
  const init = () => { const d = initParallax(document, window); cleanups.push(d); return d; };
  afterEach(() => cleanups.splice(0).forEach((d) => d()));

  beforeEach(() => {
    observed = [];
    rafQueue = [];
    reduced = false;
    document.body.innerHTML = `
      <section><div class="bg" data-parallax-speed="0.25"></div><div class="card" data-parallax-speed="0"></div><div class="orn" data-parallax-speed="-0.15"></div></section>`;
    for (const el of document.querySelectorAll<HTMLElement>('[data-parallax-speed]')) {
      el.getBoundingClientRect = () => ({ top: 900, height: 400, bottom: 1300, left: 0, right: 0, width: 0, x: 0, y: 900, toJSON() {} }) as DOMRect;
    }
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    (window as any).IntersectionObserver = class {
      constructor(cb: any) { ioCallback = cb; }
      observe(el: Element) { observed.push(el); }
      disconnect() {}
    };
    window.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
    window.cancelAnimationFrame = vi.fn();
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce') && reduced, addEventListener() {}, removeEventListener() {} })) as any;
  });

  const flush = () => { const q = rafQueue.splice(0); q.forEach((cb) => cb(0)); };
  const visible = () => ioCallback(observed.map((target) => ({ target, isIntersecting: true })));
  const y = (sel: string) => document.querySelector<HTMLElement>(sel)!.style.getPropertyValue('--parallax-y');

  it('observes every layer and writes --parallax-y via requestAnimationFrame on scroll', () => {
    init();
    expect(observed).toHaveLength(3);
    visible();
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    expect(rafQueue.length).toBe(1); // coalesced into one frame
    flush();
    expect(y('.bg')).toBe('-175px');
    expect(y('.card')).toBe('0px');
    expect(y('.orn')).toBe('105px');
    expect(document.querySelector<HTMLElement>('.bg')!.style.willChange).toBe('transform');
  });

  it('skips layers that are off-screen', () => {
    init();
    ioCallback(observed.map((target) => ({ target, isIntersecting: false })));
    window.dispatchEvent(new Event('scroll'));
    flush();
    expect(y('.bg')).toBe('');
  });

  it('forces 0px offsets when prefers-reduced-motion: reduce', () => {
    reduced = true;
    init();
    visible();
    window.dispatchEvent(new Event('scroll'));
    flush();
    expect(y('.bg')).toBe('0px');
    expect(y('.orn')).toBe('0px');
  });

  it('returns a destroy function that stops listening', () => {
    const destroy = init();
    destroy();
    visible();
    window.dispatchEvent(new Event('scroll'));
    expect(rafQueue).toHaveLength(0);
  });
});

describe('src/frontend/styles/main.css design system', () => {
  const css = readFileSync(join(__dirname, '../../src/frontend/styles/main.css'), 'utf8');
  const root = css.match(/:root\s*{([\s\S]*?)}/)![1];
  const decl = (name: string) => root.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1].trim();

  it('declares every OKF colour, font and fluid type token on :root', () => {
    for (const [k, v] of Object.entries({ ...COLOR_TOKENS, ...FONT_TOKENS, ...FLUID_TEXT_TOKENS })) expect(decl(k), k).toBe(v);
  });

  it('applies GPU translate3d parallax driven by --parallax-y', () => {
    expect(css).toMatch(/\[data-parallax-speed\][^{]*{[^}]*transform:\s*translate3d\(0,\s*var\(--parallax-y,\s*0px\),\s*0\)/);
  });

  it('disables motion under prefers-reduced-motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it('locks the RSVP page to a single 100dvh viewport', () => {
    expect(css).toMatch(/\.page-rsvp[^{]*{[^}]*height:\s*100dvh;[^}]*max-height:\s*100dvh;[^}]*overflow:\s*hidden;/);
  });

  it('prevents horizontal overflow', () => {
    expect(css).toMatch(/overflow-x:\s*(hidden|clip)/);
  });
});
