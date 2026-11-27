/**
 * Local-only CMS HTTP API (binds to 127.0.0.1). Every write goes through WeddingDb, which triggers the
 * debounced auto static build of dist/.
 */
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, rm, mkdir, writeFile, stat } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { join, normalize, extname, resolve, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { Cms } from './cms';
import { processImage, removeImageVariants } from './image-processor';
import { DEFAULT_CONFIG } from '../shared/default-config';
import { SEATING_ZONES, type CropRect, type PhotoPlacement, type SeatingZone, type WeddingConfig } from '../shared/types';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  url: URL;
  body: () => Promise<unknown>;
}

export type Handler = (ctx: RouteContext) => Promise<unknown> | unknown;
export interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export function route(method: string, path: string, handler: Handler): Route {
  const keys: string[] = [];
  const pattern = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  return { method, pattern, keys, handler };
}

/** Marker for handlers that already wrote the response. */
export const HANDLED = Symbol('handled');
export const status = (code: number, body?: unknown) => ({ [STATUS]: code, body });
const STATUS = Symbol('status');

const MAX_BODY = 80 * 1024 * 1024;
const PLACEMENTS: PhotoPlacement[] = ['hero', 'story', 'gallery', 'rsvp_background', 'invite_portrait', 'calendar', 'static_map'];
const ZONE_IDS = SEATING_ZONES.map((z) => z.id);

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'Payload too large');
    chunks.push(c as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function validateConfigPatch(body: unknown): Partial<WeddingConfig> {
  if (!isObj(body)) throw new HttpError(400, 'Config must be an object');
  for (const [k, v] of Object.entries(body)) {
    if (!(k in DEFAULT_CONFIG)) throw new HttpError(400, `Unknown config key: ${k}`);
    const ref = (DEFAULT_CONFIG as unknown as Record<string, unknown>)[k];
    if (typeof ref === 'string' && typeof v !== 'string') throw new HttpError(400, `${k} must be a string`);
    if (isObj(ref)) {
      if (!isObj(v)) throw new HttpError(400, `${k} must be an object`);
      for (const [ik, iv] of Object.entries(v)) {
        if (!(ik in ref) && !(k === 'reception' || k === 'ceremony')) throw new HttpError(400, `Unknown key ${k}.${ik}`);
        if (typeof iv !== 'string') throw new HttpError(400, `${k}.${ik} must be a string`);
      }
    }
  }
  return body as Partial<WeddingConfig>;
}

export function validateZones(body: unknown): SeatingZone[] {
  if (!Array.isArray(body) || body.length === 0) throw new HttpError(400, 'Seating zones must be a non-empty array');
  for (const z of body) {
    if (!isObj(z)) throw new HttpError(400, 'Zone must be an object');
    if (!ZONE_IDS.includes(z.id as never)) throw new HttpError(400, `Unknown zone id ${String(z.id)}`);
    for (const k of ['relationship', 'nameVi', 'tableRange', 'hallSide', 'row', 'color']) {
      if (typeof z[k] !== 'string' || !(z[k] as string).trim()) throw new HttpError(400, `Zone ${String(z.id)}: ${k} is required`);
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(z.color as string)) throw new HttpError(400, `Zone ${String(z.id)}: color must be #RRGGBB`);
    if (!['left', 'right', 'center'].includes(z.hallSide as string)) throw new HttpError(400, `Zone ${String(z.id)}: invalid hallSide`);
  }
  return body as SeatingZone[];
}

function validFocal(v: unknown): { x: number; y: number } | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (isObj(v) && typeof v.x === 'number' && typeof v.y === 'number' && v.x >= 0 && v.x <= 1 && v.y >= 0 && v.y <= 1) return { x: v.x, y: v.y };
  throw new HttpError(400, 'focalPoint must be {x,y} in 0..1');
}

function validCrop(v: unknown): CropRect | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const bad = () => new HttpError(400, 'crop must be {x,y,w,h} in 0..1');
  if (!isObj(v)) throw bad();
  const { x, y, w, h } = v as Record<string, unknown>;
  if (![x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n))) throw bad();
  const [cx, cy, cw, ch] = [x, y, w, h] as number[];
  if (cx < 0 || cx > 1 || cy < 0 || cy > 1) throw bad();
  if (cw <= 0 || cw > 1 || ch <= 0 || ch > 1) throw bad();
  if (cx + cw > 1 + 1e-6 || cy + ch > 1 + 1e-6) throw bad();
  return { x: cx, y: cy, w: cw, h: ch };
}

function validPlacement(v: unknown): PhotoPlacement | undefined {
  if (v === undefined) return undefined;
  if (!PLACEMENTS.includes(v as PhotoPlacement)) throw new HttpError(400, `Invalid placement: ${String(v)}`);
  return v as PhotoPlacement;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.flac': 'audio/flac',
};

export async function serveStatic(rootDir: string, relPath: string, res: ServerResponse): Promise<boolean> {
  const root = resolve(rootDir);
  const target = resolve(root, '.' + normalize('/' + decodeURIComponent(relPath)));
  if (target !== root && !target.startsWith(root + sep)) return false;
  try {
    const s = await stat(target);
    // A folder URL needs its trailing slash, otherwise the page's relative links resolve one level too high.
    if (s.isDirectory()) {
      const url = new URL(res.req?.url ?? '/', 'http://x');
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { location: `${url.pathname.replace(/^\/+/, '/')}/${url.search}` }).end();
        return true;
      }
    }
    const file = s.isDirectory() ? join(target, 'index.html') : target;
    const data = await readFile(file);
    const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    // Safari only plays audio/video from servers that honour byte ranges.
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(res.req?.headers.range ?? ''));
    if (range && (range[1] || range[2])) {
      const size = data.length;
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
      if (start >= size || start > end) {
        res.writeHead(416, { 'content-range': `bytes */${size}` }).end();
        return true;
      }
      res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1), 'cache-control': 'no-cache' });
      res.end(data.subarray(start, end + 1));
      return true;
    }
    res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

export interface BasicAuth {
  user: string;
  password: string;
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

/** Password is mandatory whenever the CMS listens beyond loopback (e.g. HOST=0.0.0.0 for phones on Wi-Fi). */
export function resolveLanAuth(host: string, env: Record<string, string | undefined>): (BasicAuth & { generated: boolean }) | null {
  if (LOOPBACK.has(host)) return null;
  if (env.CMS_PASSWORD) return { user: env.CMS_USER || 'admin', password: env.CMS_PASSWORD, generated: false };
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const password = Array.from(randomBytes(10), (b) => alphabet[b % alphabet.length]).join('');
  return { user: env.CMS_USER || 'admin', password, generated: true };
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function isAuthorized(req: IncomingMessage, auth: BasicAuth): boolean {
  const m = /^Basic\s+(.+)$/i.exec(req.headers.authorization ?? '');
  if (!m) return false;
  const decoded = Buffer.from(m[1], 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  const userOk = safeEqual(decoded.slice(0, i), auth.user);
  const passOk = safeEqual(decoded.slice(i + 1), auth.password);
  return userOk && passOk;
}

/** Browser modules of the admin UI (src/backend/admin/*.js), served at /admin/<file>. */
export const ADMIN_ASSETS_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'admin');

export interface ServerOptions {
  cms: Cms;
  /** Called after PUT /api/config persisted a change (used by the map preview generator). Must not throw. */
  onConfigSaved?: (prev: WeddingConfig, next: WeddingConfig) => void;
  /** Require HTTP Basic auth on every request (used when exposed on the LAN). */
  auth?: BasicAuth | null;
  /** Additional routes (bulk invitation studio). */
  extraRoutes?: Route[];
}

function photoRoutes(cms: Cms): Route[] {
  const originals = join(cms.mediaDir, '_originals');
  const distImages = () => join(cms.builder.distDir, 'assets/images');

  return [
    route('GET', '/api/photos', () => cms.db.listPhotos()),
    route('POST', '/api/photos', async ({ body }) => {
      const b = await body();
      const items = isObj(b) && Array.isArray(b.photos) ? b.photos : isObj(b) && b.dataBase64 ? [b] : null;
      if (!items || items.length === 0) throw new HttpError(400, 'Provide { photos: [{ dataBase64, caption?, placement?, focalPoint? }] }');
      const prepared = items.map((p: unknown) => {
        if (!isObj(p) || typeof p.dataBase64 !== 'string' || !p.dataBase64) throw new HttpError(400, 'dataBase64 is required');
        return {
          data: Buffer.from(p.dataBase64.replace(/^data:[^,]+,/, ''), 'base64'),
          caption: typeof p.caption === 'string' ? p.caption : '',
          placement: validPlacement(p.placement) ?? 'gallery',
          focalPoint: validFocal(p.focalPoint) ?? null,
          crop: validCrop(p.crop) ?? null,
          sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : undefined,
        };
      });
      await mkdir(originals, { recursive: true });
      const created = [];
      for (const p of prepared) {
        const id = `photo-${randomBytes(4).toString('hex')}`;
        let variants;
        try {
          variants = await processImage(p.data, { outDir: cms.mediaDir, id, placement: p.placement, focalPoint: p.focalPoint, crop: p.crop });
        } catch {
          await removeImageVariants(cms.mediaDir, id);
          throw new HttpError(400, 'Unsupported or corrupted image');
        }
        await writeFile(join(originals, id), p.data);
        created.push(
          cms.db.addPhoto({ id, caption: p.caption, placement: p.placement, focalPoint: p.focalPoint, crop: p.crop, sortOrder: p.sortOrder ?? cms.db.nextPhotoSortOrder(), variants }),
        );
      }
      return status(201, { photos: created });
    }),
    route('GET', '/api/photos/:id/original', async ({ params, res }) => {
      if (!/^[\w-]+$/.test(params.id)) throw new HttpError(404, 'Photo not found');
      const buf = await readFile(join(originals, params.id)).catch(() => null);
      if (!buf) throw new HttpError(404, 'Original not found');
      const meta = await sharp(buf, { failOn: 'error' }).metadata();
      // EXIF orientation 5..8 means the stored raw file is rotated 90 degrees relative to what the browser shows.
      const swapped = (meta.orientation ?? 1) >= 5;
      const jpeg = await sharp(buf, { failOn: 'error' })
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      res.writeHead(200, {
        'content-type': 'image/jpeg',
        'cache-control': 'no-cache',
        'x-image-width': String(swapped ? meta.height : meta.width),
        'x-image-height': String(swapped ? meta.width : meta.height),
      });
      res.end(jpeg);
      return HANDLED;
    }),
    route('PUT', '/api/photos/order', async ({ body }) => {
      const b = await body();
      if (!isObj(b) || !Array.isArray(b.ids) || !b.ids.every((x) => typeof x === 'string')) throw new HttpError(400, 'Provide { ids: string[] }');
      const ids = b.ids as string[];
      const rest = cms.db.listPhotos().filter((p) => !ids.includes(p.id));
      [...ids.map((id) => cms.db.getPhoto(id)).filter(Boolean), ...rest].forEach((p, i) => cms.db.updatePhoto(p!.id, { sortOrder: i }));
      return cms.db.listPhotos();
    }),
    route('PUT', '/api/photos/:id', async ({ params, body }) => {
      const cur = cms.db.getPhoto(params.id);
      if (!cur) throw new HttpError(404, 'Photo not found');
      const b = await body();
      if (!isObj(b)) throw new HttpError(400, 'Body must be an object');
      const placement = validPlacement(b.placement);
      const focalPoint = validFocal(b.focalPoint);
      const crop = validCrop(b.crop);
      const patch: Record<string, unknown> = {};
      if (typeof b.caption === 'string') patch.caption = b.caption;
      if (typeof b.sortOrder === 'number') patch.sortOrder = b.sortOrder;
      if (placement) patch.placement = placement;
      if (focalPoint !== undefined) patch.focalPoint = focalPoint;
      const placementChanged = !!placement && placement !== cur.placement;
      // A new placement has a different aspect, so an old manual crop no longer fits unless one is sent along.
      if (crop !== undefined) patch.crop = crop;
      else if (placementChanged) patch.crop = null;
      const cropChanged = crop !== undefined && JSON.stringify(crop) !== JSON.stringify(cur.crop ?? null);
      const focalChanged = focalPoint !== undefined && JSON.stringify(focalPoint) !== JSON.stringify(cur.focalPoint ?? null);
      if (placementChanged || focalChanged || cropChanged) {
        const original = await readFile(join(originals, cur.id)).catch(() => null);
        if (original) {
          const nextCrop = patch.crop !== undefined ? (patch.crop as CropRect | null) : (cur.crop ?? null);
          await removeImageVariants(cms.mediaDir, cur.id);
          patch.variants = await processImage(original, {
            outDir: cms.mediaDir,
            id: cur.id,
            placement: placement ?? cur.placement,
            focalPoint: focalPoint === undefined ? cur.focalPoint : focalPoint,
            crop: nextCrop,
          });
          await removeImageVariants(distImages(), cur.id);
        }
      }
      return cms.db.updatePhoto(cur.id, patch);
    }),
    route('DELETE', '/api/photos/:id', async ({ params }) => {
      if (!/^[\w-]+$/.test(params.id) || !cms.db.deletePhoto(params.id)) throw new HttpError(404, 'Photo not found');
      await Promise.all([
        removeImageVariants(cms.mediaDir, params.id),
        removeImageVariants(distImages(), params.id),
        rm(join(originals, params.id), { force: true }),
      ]);
      return status(204);
    }),
  ];
}

export function createServer(opts: ServerOptions): http.Server {
  const { cms } = opts;
  const routes: Route[] = [
    route('GET', '/api/config', () => cms.db.getConfig()),
    route('PUT', '/api/config', async ({ body }) => {
      const patch = validateConfigPatch(await body());
      const prev = cms.db.getConfig();
      // mapPreviewSrc / mapPreviewLargeSrc are server-owned (written by the map preview generator): never trust the client's copy.
      for (const ev of ['ceremony', 'reception'] as const) {
        const e = patch[ev];
        if (!e) continue;
        const { mapPreviewSrc: _a, mapPreviewLargeSrc: _b, ...rest } = e;
        const kept: Record<string, string> = {};
        if (prev[ev].mapPreviewSrc) kept.mapPreviewSrc = prev[ev].mapPreviewSrc!;
        if (prev[ev].mapPreviewLargeSrc) kept.mapPreviewLargeSrc = prev[ev].mapPreviewLargeSrc!;
        patch[ev] = { ...rest, ...kept };
      }
      const next = cms.db.setConfig(patch);
      try {
        opts.onConfigSaved?.(prev, next);
      } catch (e) {
        console.error('[config] onConfigSaved failed', e);
      }
      return next;
    }),
    ...photoRoutes(cms),
    route('GET', '/api/seating-zones', () => cms.db.getSeatingZones()),
    route('PUT', '/api/seating-zones', async ({ body }) => cms.db.setSeatingZones(validateZones(await body()))),
    route('POST', '/api/build', () => cms.rebuild()),
    ...(opts.extraRoutes ?? []),
  ];

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const send = (code: number, body?: unknown) => {
      if (res.headersSent) return;
      if (body === undefined) {
        res.writeHead(code).end();
        return;
      }
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(body));
    };
    // The public static site (/site/*, incl. thiep-moi/ and its guests-map) never asks for a login; only the CMS/API does.
    const isPublicSite = req.method === 'GET' && (url.pathname === '/site' || url.pathname.startsWith('/site/'));
    if (opts.auth && !isPublicSite && !isAuthorized(req, opts.auth)) {
      res.writeHead(401, { 'www-authenticate': 'Basic realm="Wedding CMS", charset="UTF-8"', 'content-type': 'text/plain; charset=utf-8' });
      res.end('Cần đăng nhập');
      return;
    }
    try {
      if (req.method === 'GET' && url.pathname.startsWith('/admin/')) {
        if (await serveStatic(ADMIN_ASSETS_DIR, url.pathname.slice('/admin'.length), res)) return;
        return send(404, { error: 'Not found' });
      }
      if (req.method === 'GET' && (url.pathname === '/site' || url.pathname.startsWith('/site/'))) {
        if (await serveStatic(cms.builder.distDir, url.pathname.slice('/site'.length) || '/', res)) return;
        return send(404, { error: 'Not found' });
      }
      for (const r of routes) {
        const m = r.method === req.method ? r.pattern.exec(url.pathname) : null;
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const result = await r.handler({ req, res, params, url, body: () => readBody(req) });
        if (result === HANDLED) return;
        if (isObj(result) && STATUS in result) return send((result as any)[STATUS], (result as any).body);
        return send(200, result ?? null);
      }
      send(404, { error: 'Not found' });
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, { error: e.message });
      console.error(e);
      send(500, { error: 'Internal error' });
    }
  });
}

/** CLI entry: `npm run dev` -> local CMS on http://127.0.0.1:4321 with auto-build into ./dist */
export async function main() {
  const { createCms } = await import('./cms');
  const { PROJECT_ROOT } = await import('./static-builder');
  const { createBulkRoutes } = await import('./bulk-studio');
  const { createSeatingRoutes } = await import('./seating-routes');
  const { createMapPreview } = await import('./map-preview');
  const { createMusicRoutes } = await import('./music-routes');
  const cms = await createCms({
    dbPath: process.env.WEDDING_DB ?? join(PROJECT_ROOT, 'data/wedding.db'),
    distDir: process.env.WEDDING_DIST ?? join(PROJECT_ROOT, 'dist'),
    mediaDir: process.env.WEDDING_MEDIA ?? join(PROJECT_ROOT, 'data/media'),
    onBuild: (r) => console.log(`[build] dist/ rebuilt in ${r.durationMs.toFixed(0)}ms`),
    onBuildError: (e) => console.error('[build] failed', e),
  });
  const port = Number(process.env.PORT ?? 4321);
  const host = process.env.HOST ?? '127.0.0.1';
  const auth = resolveLanAuth(host, process.env);
  const mapPreview = createMapPreview({ cms });
  const server = createServer({
    cms,
    auth,
    onConfigSaved: mapPreview.onConfigSaved,
    extraRoutes: [...createSeatingRoutes({ cms }), ...createMusicRoutes({ cms }), ...mapPreview.routes, ...createBulkRoutes({ cms, outputDir: join(PROJECT_ROOT, 'output/invitations-jpg') })],
  });
  server.listen(port, host, async () => {
    if (!auth) {
      console.log(`Wedding CMS: http://127.0.0.1:${port}/  ·  site preview: http://127.0.0.1:${port}/site/`);
      return;
    }
    const { networkInterfaces } = await import('node:os');
    const ips = Object.values(networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n!.address);
    for (const ip of ips) console.log(`Wedding CMS (LAN): http://${ip}:${port}/  ·  site preview: http://${ip}:${port}/site/`);
    console.log(`Login: user "${auth.user}" / password "${auth.password}"${auth.generated ? '  (random — set CMS_PASSWORD to fix it)' : ''}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
