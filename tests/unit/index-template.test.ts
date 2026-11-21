import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderIndexPage } from '../../src/frontend/templates/index.template';
import { DEFAULT_CONFIG } from '../../src/shared/default-config';
import { SEATING_ZONES, type PhotoRecord } from '../../src/shared/types';

const photo = (id: string, placement: PhotoRecord['placement'] = 'gallery', portrait = false): PhotoRecord => ({
  id,
  caption: `Ảnh ${id}`,
  placement,
  sortOrder: 0,
  focalPoint: null,
  variants: (['sm', 'md', 'lg', 'fhd'] as const).flatMap((tier) =>
    (['webp', 'jpg'] as const).map((format) => {
      const width = { sm: 640, md: 1024, lg: 1440, fhd: 1920 }[tier];
      return { tier, format, width, height: portrait ? Math.round(width * 1.5) : Math.round(width / 1.5), src: `assets/images/${id}/${id}-${tier}.${format}` };
    }),
  ),
});

const render = (photos: PhotoRecord[] = [], config = DEFAULT_CONFIG) =>
  new JSDOM(renderIndexPage({ config, photos, seatingZones: SEATING_ZONES, builtAt: '' })).window.document;

describe('index.html (Announcement page)', () => {
  it('is a Vietnamese, mobile-ready document wired to the shared CSS and script', () => {
    const doc = render();
    expect(doc.documentElement.lang).toBe('vi');
    expect(doc.querySelector('meta[name="viewport"]')!.getAttribute('content')).toContain('width=device-width');
    expect(doc.querySelector('link[rel="stylesheet"][href="assets/css/main.css"]')).not.toBeNull();
    expect(doc.querySelector('script[type="module"][src="assets/js/index.js"]')).not.toBeNull();
    expect(doc.title).toContain(DEFAULT_CONFIG.groomName);
    expect(doc.querySelector('meta[property="og:title"]')).not.toBeNull();
  });

  it('shows the couple, wedding news, family details and both events', () => {
    const text = render().body.textContent!.replace(/\s+/g, ' ');
    for (const s of [
      DEFAULT_CONFIG.groomName, DEFAULT_CONFIG.brideName, DEFAULT_CONFIG.headline, DEFAULT_CONFIG.story,
      DEFAULT_CONFIG.groomParents.father, DEFAULT_CONFIG.brideParents.mother,
      DEFAULT_CONFIG.ceremony.title, DEFAULT_CONFIG.ceremony.address, DEFAULT_CONFIG.reception.venueName, DEFAULT_CONFIG.reception.address,
      '09:00', '18:00', 'Thứ Bảy, 16/01/2027',
    ]) expect(text, s).toContain(s);
    expect(render().querySelector(`a[href="${DEFAULT_CONFIG.googleMapsUrl}"]`)).not.toBeNull();
  });

  it('has Hero, Family Story, Schedule and Gallery sections with 3 parallax layers', () => {
    const doc = render([photo('h', 'hero')]);
    for (const id of ['hero', 'story', 'schedule', 'gallery']) expect(doc.getElementById(id), id).not.toBeNull();
    const speeds = [...doc.querySelectorAll('[data-parallax-speed]')].map((e) => e.getAttribute('data-parallax-speed'));
    expect(speeds).toContain('0.25');
    expect(speeds).toContain('0');
    expect(speeds).toContain('-0.15');
    expect(doc.querySelector('#hero [data-parallax-speed="0.25"] img')!.getAttribute('src')).toBe('assets/images/h/h-lg.jpg');
  });

  it('links the primary Burgundy CTA to rsvp.html', () => {
    const ctas = [...render().querySelectorAll('a.btn[href="rsvp.html"]')];
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    expect(ctas[0].getAttribute('data-cta')).toBe('rsvp');
  });

  it('renders a responsive gallery that adapts to any number of photos', () => {
    for (const n of [1, 4, 10, 23]) {
      const doc = render(Array.from({ length: n }, (_, i) => photo(`p${i}`)));
      expect(doc.querySelectorAll('#gallery .gallery__item')).toHaveLength(n);
    }
    const doc = render([photo('a'), photo('b', 'gallery', true), photo('hero1', 'hero'), photo('map', 'static_map')]);
    const items = doc.querySelectorAll('#gallery .gallery__item');
    expect(items).toHaveLength(2); // only gallery placement
    expect(items[1].classList.contains('gallery__item--portrait')).toBe(true);
    const first = items[0];
    expect(first.querySelector('source[type="image/webp"]')!.getAttribute('srcset')).toBe(
      'assets/images/a/a-sm.webp 640w, assets/images/a/a-md.webp 1024w, assets/images/a/a-lg.webp 1440w, assets/images/a/a-fhd.webp 1920w',
    );
    const img = first.querySelector('img')!;
    expect(img.getAttribute('srcset')).toContain('assets/images/a/a-fhd.jpg 1920w');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('alt')).toBe('Ảnh a');
    expect(img.getAttribute('width')).toBe('640');
    expect(first.querySelector('figcaption')!.textContent).toBe('Ảnh a');
  });

  it('gives each gallery figure the aspect ratio of its stored variant so the crop is shown as framed', () => {
    const doc = render([photo('land'), photo('port', 'gallery', true)]);
    const [land, port] = [...doc.querySelectorAll<HTMLElement>('#gallery .gallery__item')];
    expect(land.getAttribute('style')).toBe('aspect-ratio: 640 / 427');
    expect(port.getAttribute('style')).toBe('aspect-ratio: 640 / 960');
    expect(port.classList.contains('gallery__item--portrait')).toBe(true);
  });

  it('shows an empty state when there are no gallery photos', () => {
    expect(render().querySelector('#gallery .gallery__empty')).not.toBeNull();
  });

  it('escapes CMS-provided text', () => {
    const doc = render([], { ...DEFAULT_CONFIG, headline: '<script>alert(1)</script>' });
    expect(doc.querySelectorAll('script:not([type="module"]):not([type="application/ld+json"])')).toHaveLength(0);
    expect(doc.body.textContent).toContain('<script>alert(1)</script>');
  });
});
