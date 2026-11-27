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

  it('shows the couple, wedding news and family details; the schedule gives venue and time of both events', () => {
    const text = render().body.textContent!.replace(/\s+/g, ' ');
    for (const s of [
      DEFAULT_CONFIG.groomName, DEFAULT_CONFIG.brideName, DEFAULT_CONFIG.headline, DEFAULT_CONFIG.story,
      DEFAULT_CONFIG.groomParents.father, DEFAULT_CONFIG.brideParents.mother,
    ]) expect(text, s).toContain(s);
    const stops = [...render().querySelectorAll('#schedule .sched-item')];
    expect(stops).toHaveLength(2);
    const [ceremony, reception] = stops.map((e) => e.textContent!.replace(/\s+/g, ' '));
    for (const s of [DEFAULT_CONFIG.ceremony.title, '09:00', 'Thứ Bảy, 16/01/2027', DEFAULT_CONFIG.ceremony.venueName, DEFAULT_CONFIG.ceremony.address]) expect(ceremony, s).toContain(s);
    for (const s of [DEFAULT_CONFIG.reception.title, '18:00', DEFAULT_CONFIG.reception.venueName, DEFAULT_CONFIG.reception.address]) expect(reception, s).toContain(s);
    // the calendar shares the section; no map previews on the announcement
    expect(render().querySelector('#schedule #calendar .calendar__cell--day')).not.toBeNull();
    expect(render().querySelector('#schedule .event__map')).toBeNull();
  });

  it('labels the envelope card "Báo Hỉ" without the invitation line', () => {
    const doc = render();
    expect(doc.querySelector('.letter-card__title')!.textContent).toBe('Báo Hỉ');
    expect(doc.querySelector('#envelope [data-role="guest-name"]')).toBeNull();
    expect(doc.body.textContent).not.toMatch(/trân trọng kính mời/i);
  });

  it('lays the page out as envelope, schedule + calendar, families, story + gallery, countdown, reply', () => {
    const doc = render([photo('h', 'hero'), photo('s', 'story')]);
    expect([...doc.querySelectorAll('main > section')].map((s) => s.id)).toEqual(['envelope']);
    expect([...doc.querySelectorAll('main > .page-paper > section')].map((s) => s.id)).toEqual(['hero', 'schedule', 'family', 'story', 'countdown', 'rsvp-cta']);
    expect(doc.querySelector('#story #gallery')).not.toBeNull();
    expect(doc.querySelector('#rsvp-cta #closing')).not.toBeNull();
    const speeds = [...doc.querySelectorAll('[data-parallax-speed]')].map((e) => e.getAttribute('data-parallax-speed'));
    for (const v of ['0.25', '0', '-0.15']) expect(speeds).toContain(v);
    expect(doc.querySelector('#story [data-parallax-speed="0.25"] img')!.getAttribute('src')).toBe('assets/images/s/s-md.jpg');
  });

  it('opens two sheets — the photo and the announcement — with the date and a heart seal on the envelope front', () => {
    const doc = render([photo('h', 'hero')]);
    expect(doc.querySelectorAll('#envelope .env-sheet')).toHaveLength(2);
    expect(doc.querySelector('#envelope .env-sheet--photo img')!.getAttribute('src')).toBe('assets/images/h/h-md.jpg');
    expect(doc.querySelector('#envelope .env-sheet--letter')!.textContent).toContain(DEFAULT_CONFIG.headline);
    expect(doc.querySelector('.envelope__date')!.textContent!.replace(/\s+/g, '')).toBe('16·01·2027');
    expect(doc.querySelector('.envelope__front .heart-seal .heart-seal__mono')!.textContent).toBe('Q&H');
    expect(doc.querySelector('#envelope .vinyl')).not.toBeNull();
  });

  it('staggers the two family stamps', () => {
    const doc = render();
    expect(doc.querySelector('#family .stamp--groom')!.textContent).toContain(DEFAULT_CONFIG.groomParents.father);
    expect(doc.querySelector('#family .stamp--bride')!.textContent).toContain(DEFAULT_CONFIG.brideParents.father);
  });

  it('adds the music player only when the CMS has a playlist', () => {
    expect(render().getElementById('music-data')).toBeNull();
    const doc = new JSDOM(renderIndexPage({ config: DEFAULT_CONFIG, photos: [], seatingZones: SEATING_ZONES, playlist: [{ id: 't1', title: 'Song', src: 'assets/music/t1.mp3', sortOrder: 0 }] })).window.document;
    expect(JSON.parse(doc.getElementById('music-data')!.textContent!)).toEqual([{ title: 'Song', src: 'assets/music/t1.mp3' }]);
    expect(doc.querySelectorAll('[data-role="music-toggle"]')).toHaveLength(2); // the record in the envelope + the floating button
  });

  it('links the primary Burgundy CTA to rsvp.html', () => {
    const ctas = [...render().querySelectorAll('a.btn[href="dang-ky/"]')];
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
    expect(land.getAttribute('style')).toMatch(/^aspect-ratio: 640 \/ 427;/);
    expect(port.getAttribute('style')).toMatch(/^aspect-ratio: 640 \/ 960;/);
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
