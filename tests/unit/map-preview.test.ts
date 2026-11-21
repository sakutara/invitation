import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  parseLatLng,
  placeQueryFromUrl,
  resolveLatLng,
  renderFallbackMap,
  renderTileMap,
} from '../../src/backend/map-preview';
import { eventCard } from '../../src/frontend/templates/partials';
import type { EventDetails } from '../../src/shared/types';

/** Builds a Response-like object; `url` mimics the final URL after redirects. */
function fakeResponse(opts: { status?: number; url?: string; body?: Buffer | string }): Response {
  const body = opts.body === undefined || typeof opts.body === 'string' ? (opts.body ?? '') : new Uint8Array(opts.body);
  const res = new Response(body, { status: opts.status ?? 200 });
  if (opts.url !== undefined) Object.defineProperty(res, 'url', { value: opts.url });
  return res;
}

const details = (over: Partial<EventDetails> = {}): EventDetails => ({
  title: 'Tiệc cưới',
  datetime: '2027-01-16T18:00:00+07:00',
  venueName: 'Nhà hàng Sen Vàng',
  hallName: 'Sảnh Sen',
  address: '45 Nguyễn Văn Linh, Ninh Kiều, Cần Thơ',
  ...over,
});

describe('parseLatLng', () => {
  it('prefers the place pin (!3d/!4d) over the viewport center (@)', () => {
    const url = 'https://www.google.com/maps/place/X/@10.03,105.78,17z/data=!3d10.0312!4d105.7801';
    expect(parseLatLng(url)).toEqual({ lat: 10.0312, lng: 105.7801 });
  });

  it('reads @lat,lng when no pin is present', () => {
    expect(parseLatLng('https://www.google.com/maps/@10.03,105.78,17z')).toEqual({ lat: 10.03, lng: 105.78 });
  });

  it('reads q, query, ll, center, destination and daddr coordinate params', () => {
    expect(parseLatLng('https://maps.google.com/?q=10.1,105.2')).toEqual({ lat: 10.1, lng: 105.2 });
    expect(parseLatLng('https://www.google.com/maps/search/?api=1&query=10.1,105.2')).toEqual({ lat: 10.1, lng: 105.2 });
    expect(parseLatLng('https://www.google.com/maps/dir/?api=1&destination=10.1,105.2')).toEqual({ lat: 10.1, lng: 105.2 });
    expect(parseLatLng('https://maps.google.com/?ll=10.1,105.2')).toEqual({ lat: 10.1, lng: 105.2 });
    expect(parseLatLng('https://maps.google.com/?daddr=10.1,105.2')).toEqual({ lat: 10.1, lng: 105.2 });
  });

  it('returns null for invalid or out-of-range input', () => {
    expect(parseLatLng('not a url')).toBeNull();
    expect(parseLatLng('https://maps.google.com/?q=45+Nguyen+Van+Linh')).toBeNull();
    expect(parseLatLng('https://maps.google.com/?q=95,105')).toBeNull();
    expect(parseLatLng('https://maps.google.com/?q=10,200')).toBeNull();
    expect(parseLatLng('')).toBeNull();
  });
});

describe('placeQueryFromUrl', () => {
  it('decodes the place name from /maps/place/<name>/', () => {
    expect(placeQueryFromUrl('https://www.google.com/maps/place/Nh%C3%A0+h%C3%A0ng+Sen+V%C3%A0ng/@10.03,105.78,17z')).toBe('Nhà hàng Sen Vàng');
    expect(placeQueryFromUrl('https://www.google.com/maps/place/Sen+Vang/')).toBe('Sen Vang');
  });

  it('uses a non-coordinate q/query/destination param', () => {
    expect(placeQueryFromUrl('https://maps.google.com/?q=45+Nguyen+Van+Linh')).toBe('45 Nguyen Van Linh');
  });

  it('returns null for coordinate-only or unrelated URLs', () => {
    expect(placeQueryFromUrl('https://maps.google.com/?q=10.1,105.2')).toBeNull();
    expect(placeQueryFromUrl('https://maps.app.goo.gl/abc')).toBeNull();
    expect(placeQueryFromUrl('garbage')).toBeNull();
  });
});

describe('resolveLatLng', () => {
  it('parses coordinates from mapsUrl without any network call', async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(String(url));
      return fakeResponse({});
    }) as typeof fetch;
    const r = await resolveLatLng(details({ mapsUrl: 'https://www.google.com/maps/place/X/data=!3d10.0312!4d105.7801' }), fake);
    expect(r).toEqual({ lat: 10.0312, lng: 105.7801 });
    expect(calls).toEqual([]);
  });

  it('follows a short link redirect and reads coordinates from the final URL', async () => {
    const calls: string[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push(String(url));
      expect(init?.redirect).toBe('follow');
      return fakeResponse({ url: 'https://www.google.com/maps/place/Sen/@10,105,17z' });
    }) as typeof fetch;
    const r = await resolveLatLng(details({ mapsUrl: 'https://maps.app.goo.gl/AbCdEf' }), fake);
    expect(r).toEqual({ lat: 10, lng: 105 });
    expect(calls).toEqual(['https://maps.app.goo.gl/AbCdEf']);
  });

  it('geocodes the place name with Nominatim when the link has no coordinates', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      seen.push({ url: String(url), headers: init?.headers as Record<string, string> });
      if (String(url).startsWith('https://nominatim.openstreetmap.org/')) {
        return fakeResponse({ body: JSON.stringify([{ lat: '10.0345', lon: '105.7712' }]) });
      }
      throw new Error('unexpected url ' + url);
    }) as typeof fetch;
    const r = await resolveLatLng(details({ mapsUrl: 'https://maps.google.com/?q=Nh%C3%A0+h%C3%A0ng+Sen+V%C3%A0ng' }), fake);
    expect(r).toEqual({ lat: 10.0345, lng: 105.7712 });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent('Nhà hàng Sen Vàng')}`,
    );
    expect(seen[0].headers['User-Agent']).toBe('wedding-cms-local/0.1');
    expect(seen[0].headers['Accept-Language']).toBe('vi');
  });

  it('geocodes the address when there is no mapsUrl', async () => {
    const queries: string[] = [];
    const fake = (async (url: string) => {
      queries.push(new URL(String(url)).searchParams.get('q') ?? '');
      return fakeResponse({ body: JSON.stringify([{ lat: '10.02', lon: '105.79' }]) });
    }) as typeof fetch;
    const d = details({ mapsUrl: undefined });
    expect(await resolveLatLng(d, fake)).toEqual({ lat: 10.02, lng: 105.79 });
    expect(queries).toEqual([d.address]);
  });

  it('returns null (never throws) when every lookup fails', async () => {
    const fake = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect(await resolveLatLng(details({ mapsUrl: 'https://maps.app.goo.gl/x' }), fake)).toBeNull();
    expect(await resolveLatLng(details({ mapsUrl: undefined, address: '' }), fake)).toBeNull();
  });
});

describe('renderTileMap', () => {
  const tileFake = (log: string[], delayMs = 0) => {
    let inFlight = 0;
    let maxInFlight = 0;
    const tile = sharp({ create: { width: 256, height: 256, channels: 3, background: '#A0C8A0' } }).png().toBuffer();
    const fake = (async (url: string) => {
      log.push(String(url));
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      inFlight--;
      return fakeResponse({ body: await tile });
    }) as typeof fetch;
    return { fake, maxInFlight: () => maxInFlight };
  };

  it('defaults to an 800x400 JPEG from zoom-17 tiles', async () => {
    const requested: string[] = [];
    const { fake } = tileFake(requested);
    const jpg = await renderTileMap({ lat: 10.0312, lng: 105.7801 }, fake);
    const meta = await sharp(jpg).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(400);
    // A 400x200 tile-pixel region spans at most 3x2 tiles.
    expect(requested.length).toBeGreaterThanOrEqual(2);
    expect(requested.length).toBeLessThanOrEqual(6);
    expect(requested.every((u) => /^https:\/\/tile\.openstreetmap\.org\/17\/\d+\/\d+\.png$/.test(u))).toBe(true);
  });

  it('renders the large variant at 2000x2000 from the same zoom', async () => {
    const requested: string[] = [];
    const { fake } = tileFake(requested);
    const jpg = await renderTileMap({ lat: 10.0312, lng: 105.7801 }, fake, { width: 2000, height: 2000 });
    const meta = await sharp(jpg).metadata();
    expect(meta.format).toBe('jpeg');
    expect([meta.width, meta.height]).toEqual([2000, 2000]);
    // A 900x650 tile-pixel region spans at most 4x4 tiles.
    expect(requested.length).toBeGreaterThanOrEqual(4);
    expect(requested.every((u) => /\/17\/\d+\/\d+\.png$/.test(u))).toBe(true);
  });

  it('never has more than 6 tile requests in flight', async () => {
    const requested: string[] = [];
    const t = tileFake(requested, 5);
    await renderTileMap({ lat: 10.0312, lng: 105.7801 }, t.fake, { width: 2000, height: 2000 });
    expect(t.maxInFlight()).toBeLessThanOrEqual(6);
    expect(t.maxInFlight()).toBeGreaterThan(1);
  });

  it('throws when any tile fails so the caller can fall back', async () => {
    const fake = (async () => fakeResponse({ status: 503 })) as typeof fetch;
    await expect(renderTileMap({ lat: 10, lng: 105 }, fake)).rejects.toThrow();
  });
});

describe('renderFallbackMap', () => {
  it('returns an 800x400 JPEG by default, escaping venue text', async () => {
    const jpg = await renderFallbackMap(details({ venueName: 'Sen & <Vàng>', address: 'Số 1 "Lê" Lợi' }));
    const meta = await sharp(jpg).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(400);
  });

  it('scales its layout to the requested size', async () => {
    const jpg = await renderFallbackMap(details(), { width: 2000, height: 2000 });
    const meta = await sharp(jpg).metadata();
    expect([meta.width, meta.height]).toEqual([2000, 2000]);
  });
});

describe('eventCard map preview', () => {
  const base = details({ mapPreviewSrc: 'assets/maps/reception-ab12cd34.jpg' });

  it('places the preview link right before the Google Maps button', () => {
    const html = eventCard(base, 'https://maps.example/global');
    expect(html).toContain('<a class="event__map" href="https://maps.example/global"');
    expect(html).toContain('<img src="assets/maps/reception-ab12cd34.jpg" alt="Bản đồ đến Nhà hàng Sen Vàng" width="800" height="400" loading="lazy"');
    expect(html.indexOf('class="event__map"')).toBeLessThan(html.indexOf('btn btn--ghost'));
  });

  it('uses the event-specific mapsUrl over the global one', () => {
    const html = eventCard({ ...base, mapsUrl: 'https://maps.example/event' }, 'https://maps.example/global');
    expect(html).toContain('href="https://maps.example/event"');
    expect(html).not.toContain('https://maps.example/global');
  });

  it('marks the link for the popup with the large image and map metadata', () => {
    const html = eventCard(
      { ...base, mapPreviewLargeSrc: 'assets/maps/reception-ab12cd34-lg.jpg', mapsUrl: 'https://maps.example/event', address: '45 "Lê" & Lợi' },
      'https://maps.example/global',
    );
    expect(html).toContain('<a class="event__map" href="https://maps.example/event" target="_blank" rel="noopener"');
    expect(html).toContain('data-map-popup');
    expect(html).toContain('data-map-large="assets/maps/reception-ab12cd34-lg.jpg"');
    expect(html).toContain('data-maps-url="https://maps.example/event"');
    expect(html).toContain('data-map-title="Nhà hàng Sen Vàng"');
    expect(html).toContain('data-map-address="45 &quot;Lê&quot; &amp; Lợi"');
    expect(html).toContain('<img src="assets/maps/reception-ab12cd34.jpg"');
  });

  it('falls back to the small image for data-map-large when no large one exists', () => {
    const html = eventCard(base, 'https://maps.example/global');
    expect(html).toContain('data-map-large="assets/maps/reception-ab12cd34.jpg"');
  });

  it('omits the preview when there is no mapPreviewSrc', () => {
    const html = eventCard(details(), 'https://maps.example/global');
    expect(html).not.toContain('event__map');
    expect(html).toContain('href="https://maps.example/global"');
  });

  it('escapes venue and src values', () => {
    const html = eventCard({ ...base, venueName: '<b>X</b>', mapPreviewSrc: 'assets/maps/a"b.jpg' }, 'https://x.test/?a=1&b=2');
    expect(html).not.toContain('<b>X</b>');
    expect(html).toContain('a&quot;b.jpg');
    expect(html).toContain('href="https://x.test/?a=1&amp;b=2"');
  });
});
