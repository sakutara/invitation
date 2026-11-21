/**
 * Auto-generated map previews shown above each event's "Google Maps" button.
 *
 * Flow: resolve coordinates (Google Maps URL → short-link redirect → Nominatim geocoding),
 * render an OpenStreetMap tile crop with a burgundy pin (or a stylized fallback diagram) in two sizes:
 *   <event>-<hash8>.jpg      800x400   card preview
 *   <event>-<hash8>-lg.jpg   2000x2000 popup (wider area, same zoom; square so it fills portrait phones too)
 * store them under <mediaDir>/_maps/ and point config[event].mapPreviewSrc / mapPreviewLargeSrc at them.
 * The static builder copies _maps/ to dist/assets/maps/.
 */
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Cms } from './cms';
import { HttpError, route, type Route } from './server';
import type { EventDetails, WeddingConfig } from '../shared/types';

export type MapEvent = 'ceremony' | 'reception';
const EVENTS: MapEvent[] = ['ceremony', 'reception'];

const USER_AGENT = 'wedding-cms-local/0.1';
const TIMEOUT_MS = 8000;
/** Bumping this invalidates existing previews so the next refresh regenerates them. */
const MAP_VERSION = 'v3b';
const ZOOM = 17;
const SCALE = 2;
const TILE = 256;
const TILE_CONCURRENCY = 6;
const BASE_W = 800;
const BASE_H = 400;
const CARD_SIZE = { width: 800, height: 400 };
const LARGE_SIZE = { width: 2000, height: 2000 };
const BURGUNDY = '#7A1C24';
const NAVY = '#0F2042';
const MUTED = '#4B5563';

export interface MapPreview {
  routes: Route[];
  onConfigSaved: (prev: WeddingConfig, next: WeddingConfig) => void;
}

export interface MapPreviewSources {
  mapPreviewSrc: string;
  mapPreviewLargeSrc: string;
}

export interface TileMapOptions {
  /** Output width in px. Default 800. */
  width?: number;
  /** Output height in px. Default 400. */
  height?: number;
  /** Tile zoom level. Default 17. */
  zoom?: number;
  /** Upscale factor applied to the fetched tile region. Default 2. */
  scale?: number;
}

export interface FallbackMapOptions {
  width?: number;
  height?: number;
}

export interface MapPreviewOptions {
  cms: Cms;
  fetchImpl?: typeof fetch;
  /** Where generated images are written. Default: <cms.mediaDir>/_maps */
  mapsDir?: string;
  /** Test hook: called after a preview was written and config updated. */
  onDone?: (event: MapEvent, src: string) => void;
}

export interface LatLng {
  lat: number;
  lng: number;
}

const NUM = '-?\\d+(?:\\.\\d+)?';
const COORD_PAIR = new RegExp(`^\\s*(${NUM})\\s*,\\s*(${NUM})\\s*$`);

function validLatLng(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function parsePair(s: string | null | undefined): LatLng | null {
  if (!s) return null;
  const m = COORD_PAIR.exec(s);
  if (!m) return null;
  return validLatLng(Number(m[1]), Number(m[2]));
}

function safeUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Extracts a lat/lng from the many Google Maps URL shapes. Returns null when none is found. */
export function parseLatLng(url: string): LatLng | null {
  const text = url ?? '';
  // Place pin coordinates (!3d<lat>!4d<lng>) are preferred over the viewport center (@lat,lng).
  const pin = new RegExp(`!3d(${NUM})!4d(${NUM})`).exec(text);
  if (pin) {
    const hit = validLatLng(Number(pin[1]), Number(pin[2]));
    if (hit) return hit;
  }
  const at = new RegExp(`@(${NUM}),(${NUM})`).exec(text);
  if (at) {
    const hit = validLatLng(Number(at[1]), Number(at[2]));
    if (hit) return hit;
  }
  const u = safeUrl(text);
  if (!u) return null;
  for (const key of ['q', 'query', 'll', 'center', 'destination', 'daddr']) {
    const hit = parsePair(u.searchParams.get(key));
    if (hit) return hit;
  }
  return null;
}

/** Human-readable place query from a Google Maps URL (place name, or a non-coordinate q/query/destination). */
export function placeQueryFromUrl(url: string): string | null {
  const u = safeUrl(url ?? '');
  if (!u) return null;
  const place = /\/maps\/place\/([^/]+)/.exec(u.pathname);
  if (place) {
    let name = place[1];
    try {
      name = decodeURIComponent(name);
    } catch {
      /* keep raw */
    }
    name = name.replace(/\+/g, ' ').trim();
    if (name && !COORD_PAIR.test(name)) return name;
  }
  for (const key of ['q', 'query', 'destination', 'daddr']) {
    const v = u.searchParams.get(key)?.trim();
    if (v && !COORD_PAIR.test(v)) return v;
  }
  return null;
}

function isShortLink(url: string): boolean {
  const u = safeUrl(url);
  if (!u) return false;
  return u.hostname === 'maps.app.goo.gl' || u.hostname === 'goo.gl' || u.hostname === 'g.co';
}

async function fetchWithTimeout(fetchImpl: typeof fetch, url: string, init: RequestInit = {}): Promise<Response> {
  return fetchImpl(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function geocode(query: string, fetchImpl: typeof fetch): Promise<LatLng | null> {
  const res = await fetchWithTimeout(fetchImpl, `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, {
    headers: { 'Accept-Language': 'vi' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || !data[0]) return null;
  const first = data[0] as { lat?: unknown; lon?: unknown };
  return validLatLng(Number(first.lat), Number(first.lon));
}

/**
 * Best-effort coordinates for an event. Never throws: returns null when nothing works.
 * Order: mapsUrl (direct parse) → short-link redirect → Nominatim geocoding of the place name / address.
 */
export async function resolveLatLng(details: EventDetails, fetchImpl: typeof fetch = fetch): Promise<LatLng | null> {
  try {
    const mapsUrl = details.mapsUrl?.trim() ?? '';
    if (mapsUrl) {
      const direct = parseLatLng(mapsUrl);
      if (direct) return direct;
      if (isShortLink(mapsUrl)) {
        try {
          const res = await fetchWithTimeout(fetchImpl, mapsUrl, { redirect: 'follow' });
          const fromFinal = parseLatLng(res.url);
          if (fromFinal) return fromFinal;
          const body = await res.text().catch(() => '');
          const fromBody = parseLatLng(body.slice(0, 200_000));
          if (fromBody) return fromBody;
        } catch {
          /* network failure: fall through to geocoding */
        }
      }
    }
    const query = (mapsUrl && placeQueryFromUrl(mapsUrl)) || details.address?.trim() || '';
    if (!query) return null;
    return await geocode(query, fetchImpl);
  } catch {
    return null;
  }
}

/* ---------- Tile map ---------- */

function lonToX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * TILE * 2 ** zoom;
}

function latToY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * TILE * 2 ** zoom;
}

/** Pin whose tip sits exactly on (px, py). `k` scales the pin to the output size (1 = card preview). */
function pinOverlay(px: number, py: number, k: number): string {
  const f = (n: number) => n.toFixed(1);
  return `<g>
<ellipse cx="${f(px)}" cy="${f(py + 2 * k)}" rx="${f(7 * k)}" ry="${f(3 * k)}" fill="#000" fill-opacity=".25"/>
<polygon points="${f(px - 9 * k)},${f(py - 20 * k)} ${f(px + 9 * k)},${f(py - 20 * k)} ${f(px)},${f(py)}" fill="${BURGUNDY}"/>
<circle cx="${f(px)}" cy="${f(py - 30 * k)}" r="${f(13 * k)}" fill="${BURGUNDY}" stroke="#FFFFFF" stroke-width="${f(2.5 * k)}"/>
<circle cx="${f(px)}" cy="${f(py - 30 * k)}" r="${f(4.5 * k)}" fill="#FFFFFF"/>
</g>`;
}

function attributionOverlay(width: number, height: number, k: number): string {
  return `<g font-family="Arial, sans-serif" font-size="${(12 * k).toFixed(1)}">
<rect x="${(width - 214 * k).toFixed(1)}" y="${(height - 22 * k).toFixed(1)}" width="${(214 * k).toFixed(1)}" height="${(22 * k).toFixed(1)}" fill="#FFFFFF" fill-opacity=".85"/>
<text x="${(width - 6 * k).toFixed(1)}" y="${(height - 7 * k).toFixed(1)}" text-anchor="end" fill="${MUTED}">© OpenStreetMap contributors</text>
</g>`;
}

/** Runs `fn` over `items` with at most `limit` in flight. Stops scheduling new work after the first failure. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let failed = false;
  const worker = async (): Promise<void> => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i]);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Renders an OSM tile map centered on the point with a burgundy pin, as a JPEG of `width` x `height`.
 * The region fetched is (width/scale) x (height/scale) tile-pixels at `zoom`, upscaled by `scale` (lanczos3),
 * so the default card (800x400, zoom 17, scale 2) shows a 400x200 tile-pixel area.
 * Pin and attribution are drawn after upscaling at final resolution; the pin tip is at the image center.
 * Throws if any tile fails so the caller can fall back.
 */
export async function renderTileMap(point: LatLng, fetchImpl: typeof fetch = fetch, opts: TileMapOptions = {}): Promise<Buffer> {
  const width = opts.width ?? CARD_SIZE.width;
  const height = opts.height ?? CARD_SIZE.height;
  const zoom = opts.zoom ?? ZOOM;
  const scale = opts.scale ?? SCALE;
  const regionW = Math.round(width / scale);
  const regionH = Math.round(height / scale);
  const k = width / CARD_SIZE.width;

  const cx = lonToX(point.lng, zoom);
  const cy = latToY(point.lat, zoom);
  const left = Math.round(cx - regionW / 2);
  const top = Math.round(cy - regionH / 2);
  const tileCount = 2 ** zoom;
  const tx0 = Math.floor(left / TILE);
  const ty0 = Math.floor(top / TILE);
  const tx1 = Math.floor((left + regionW - 1) / TILE);
  const ty1 = Math.floor((top + regionH - 1) / TILE);

  const coords: { tx: number; ty: number }[] = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) coords.push({ tx, ty });

  const tiles = await mapLimit(coords, TILE_CONCURRENCY, async ({ tx, ty }) => {
    if (ty < 0 || ty >= tileCount) throw new Error(`tile row out of range: ${ty}`);
    const wrappedX = ((tx % tileCount) + tileCount) % tileCount;
    const res = await fetchWithTimeout(fetchImpl, `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`, {
      headers: { Accept: 'image/png' },
    });
    if (!res.ok) throw new Error(`tile ${zoom}/${wrappedX}/${ty} HTTP ${res.status}`);
    const input = Buffer.from(await res.arrayBuffer());
    return { input, left: (tx - tx0) * TILE, top: (ty - ty0) * TILE };
  });

  const gridW = (tx1 - tx0 + 1) * TILE;
  const gridH = (ty1 - ty0 + 1) * TILE;
  const grid = await sharp({ create: { width: gridW, height: gridH, channels: 3, background: '#E8E2D6' } })
    .composite(tiles)
    .png()
    .toBuffer();

  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${pinOverlay(width / 2, height / 2, k)}${attributionOverlay(width, height, k)}</svg>`;

  return sharp(grid)
    .extract({ left: left - tx0 * TILE, top: top - ty0 * TILE, width: regionW, height: regionH })
    .resize(width, height, { kernel: 'lanczos3' })
    .composite([{ input: Buffer.from(overlay), left: 0, top: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

/* ---------- Fallback diagram ---------- */

function xmlEscape(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Stylized schematic map (no network), JPEG of `width` x `height`, with venue name and address below the pin.
 * The layout is designed on an 800x400 grid: geometry is stretched to the requested size and text/pin are scaled uniformly.
 */
export async function renderFallbackMap(details: EventDetails, opts: FallbackMapOptions = {}): Promise<Buffer> {
  const width = opts.width ?? CARD_SIZE.width;
  const height = opts.height ?? CARD_SIZE.height;
  const kx = width / BASE_W;
  const ky = height / BASE_H;
  const k = kx;

  const streets = [
    'M0 90 L800 60', 'M0 230 L800 260', 'M120 0 L150 400', 'M430 0 L400 400', 'M640 0 L700 400', 'M0 330 L800 300',
  ];
  const blocks = [
    [30, 110, 70, 50], [190, 20, 150, 55], [470, 20, 110, 60], [700, 100, 80, 70], [20, 250, 80, 60], [520, 300, 100, 80],
  ];
  const label1 = clip(details.venueName || 'Địa điểm', 40);
  const label2 = clip([details.hallName, details.address].filter(Boolean).join(' · '), 60);
  const labelW = Math.min(width - 40 * k, Math.max(260, Math.max(label1.length, label2.length) * 9 + 40) * k);
  const labelX = width / 2 - labelW / 2;
  const labelY = 232 * ky;
  const labelH = (label2 ? 80 : 56) * k;
  const pinY = 175 * ky;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Be Vietnam Pro, Arial, sans-serif">
<rect width="${width}" height="${height}" fill="#F5EFE6"/>
<g transform="scale(${kx.toFixed(4)} ${ky.toFixed(4)})">
${blocks.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#E9E0CF"/>`).join('')}
<path d="M-20 170 C 160 130, 300 200, 420 160 S 660 120, 820 170" fill="none" stroke="#BFD9EA" stroke-width="26" stroke-linecap="round" opacity=".8"/>
${streets.map((d) => `<path d="${d}" stroke="#FFFFFF" stroke-width="12" fill="none"/>`).join('')}
</g>
${pinOverlay(width / 2, pinY, k)}
<rect x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" width="${labelW.toFixed(1)}" height="${labelH.toFixed(1)}" rx="${(14 * k).toFixed(1)}" fill="#FFFFFF" stroke="rgba(15,32,66,.15)"/>
<text x="${width / 2}" y="${(268 * ky).toFixed(1)}" text-anchor="middle" font-size="${(22 * k).toFixed(1)}" font-weight="700" fill="${NAVY}">${xmlEscape(label1)}</text>
${label2 ? `<text x="${width / 2}" y="${(296 * ky).toFixed(1)}" text-anchor="middle" font-size="${(15 * k).toFixed(1)}" fill="${MUTED}">${xmlEscape(label2)}</text>` : ''}
</svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

/* ---------- Service ---------- */

async function writeAtomic(path: string, data: Buffer, tmpSuffix: string): Promise<void> {
  const tmp = `${path}.${tmpSuffix}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

export function createMapPreview(opts: MapPreviewOptions): MapPreview {
  const { cms, onDone } = opts;
  const fetchImpl: typeof fetch = opts.fetchImpl ?? fetch;
  const mapsDir = opts.mapsDir ?? join(cms.mediaDir, '_maps');

  const inflight = new Map<MapEvent, Promise<MapPreviewSources>>();
  const queued = new Map<MapEvent, Promise<MapPreviewSources>>();
  let tmpCounter = 0;

  async function generate(event: MapEvent): Promise<MapPreviewSources> {
    const details = cms.db.getConfig()[event];
    const coords = await resolveLatLng(details, fetchImpl);
    // Both sizes always come from the same source so the card and the popup never disagree.
    let tiles: { card: Buffer; large: Buffer } | null = null;
    if (coords) {
      try {
        const card = await renderTileMap(coords, fetchImpl, CARD_SIZE);
        const large = await renderTileMap(coords, fetchImpl, LARGE_SIZE);
        tiles = { card, large };
      } catch (e) {
        console.warn(`[map-preview] tiles failed for ${event}, using fallback:`, e instanceof Error ? e.message : e);
      }
    }
    const usedTiles = tiles !== null;
    const card = tiles ? tiles.card : await renderFallbackMap(details, CARD_SIZE);
    const large = tiles ? tiles.large : await renderFallbackMap(details, LARGE_SIZE);

    const hash = createHash('sha1')
      .update(`${MAP_VERSION}|${details.mapsUrl ?? ''}|${details.address ?? ''}|${details.venueName ?? ''}|${usedTiles ? 't' : 'f'}`)
      .digest('hex')
      .slice(0, 8);
    const file = `${event}-${hash}.jpg`;
    const fileLarge = `${event}-${hash}-lg.jpg`;

    await mkdir(mapsDir, { recursive: true });
    const suffix = `${process.pid}.${++tmpCounter}`;
    await writeAtomic(join(mapsDir, file), card, suffix);
    await writeAtomic(join(mapsDir, fileLarge), large, suffix);
    for (const name of await readdir(mapsDir)) {
      if (name.startsWith(`${event}-`) && name.endsWith('.jpg') && name !== file && name !== fileLarge) {
        await rm(join(mapsDir, name), { force: true });
      }
    }

    const sources: MapPreviewSources = { mapPreviewSrc: `assets/maps/${file}`, mapPreviewLargeSrc: `assets/maps/${fileLarge}` };
    const cur = cms.db.getConfig();
    const next = { ...cur[event], ...sources };
    cms.db.setConfig(event === 'ceremony' ? { ceremony: next } : { reception: next });
    onDone?.(event, sources.mapPreviewSrc);
    return sources;
  }

  /** Runs one generation per event at a time; while one runs, at most one more is queued. */
  function refresh(event: MapEvent): Promise<MapPreviewSources> {
    const running = inflight.get(event);
    if (!running) {
      const p = generate(event).finally(() => inflight.delete(event));
      inflight.set(event, p);
      return p;
    }
    const waiting = queued.get(event);
    if (waiting) return waiting;
    const next = running
      .catch(() => undefined)
      .then(() => {
        queued.delete(event);
        return refresh(event);
      });
    queued.set(event, next);
    return next;
  }

  const logFailure = (event: MapEvent) => (e: unknown) => console.error(`[map-preview] ${event} failed`, e);

  return {
    routes: [
      route('POST', '/api/map-preview/:event', async ({ params }) => {
        const event = params.event;
        if (event !== 'ceremony' && event !== 'reception') throw new HttpError(400, 'event must be ceremony or reception');
        return await refresh(event);
      }),
    ],
    onConfigSaved: (prev, next) => {
      for (const event of EVENTS) {
        const a = prev[event];
        const b = next[event];
        if (a.mapsUrl !== b.mapsUrl || a.address !== b.address || a.venueName !== b.venueName || !b.mapPreviewSrc || !b.mapPreviewLargeSrc) {
          refresh(event).catch(logFailure(event));
        }
      }
    },
  };
}
