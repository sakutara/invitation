import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createCms, type Cms } from '../../src/backend/cms';
import { createServer } from '../../src/backend/server';

let root: string;
let cms: Cms;
let server: Server;
let base: string;

const api = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const jpegB64 = async (width: number, height: number, orientation?: number) => {
  let img = sharp({ create: { width, height, channels: 3, background: { r: 40, g: 60, b: 90 } } }).jpeg();
  if (orientation) img = img.withMetadata({ orientation });
  return (await img.toBuffer()).toString('base64');
};

const upload = async (placement: string, opts: { width?: number; height?: number; orientation?: number } = {}) => {
  const r = await api('POST', '/api/photos', {
    photos: [{ filename: 'p.jpg', dataBase64: `data:image/jpeg;base64,${await jpegB64(opts.width ?? 1200, opts.height ?? 800, opts.orientation)}`, caption: 'x', placement }],
  });
  expect(r.status).toBe(201);
  return r.body.photos[0] as { id: string; crop: unknown; variants: { tier: string; format: string; width: number; height: number; src: string }[] };
};

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'wedding-crop-'));
  cms = await createCms({ dbPath: join(root, 'data/wedding.db'), distDir: join(root, 'dist'), mediaDir: join(root, 'data/media') });
  server = createServer({ cms });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((r) => server.close(r));
  await cms.close();
  rmSync(root, { recursive: true, force: true });
});

describe('PUT /api/photos/:id crop', () => {
  it('recrops to the manual rectangle and persists it', async () => {
    const p = await upload('gallery');
    const r = await api('PUT', `/api/photos/${p.id}`, { crop: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } });
    expect(r.status).toBe(200);
    expect(r.body.crop).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    const fhd = r.body.variants.find((v: any) => v.tier === 'fhd' && v.format === 'jpg');
    expect([fhd.width, fhd.height]).toEqual([600, 400]);
    await cms.whenIdle();
    const list = (await api('GET', '/api/photos')).body;
    expect(list.find((x: any) => x.id === p.id).crop).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  });

  it('clears the crop (null) and re-renders the full frame', async () => {
    const p = await upload('gallery');
    await api('PUT', `/api/photos/${p.id}`, { crop: { x: 0, y: 0, w: 0.5, h: 0.5 } });
    const r = await api('PUT', `/api/photos/${p.id}`, { crop: null });
    expect(r.status).toBe(200);
    expect(r.body.crop).toBeNull();
    const fhd = r.body.variants.find((v: any) => v.tier === 'fhd' && v.format === 'jpg');
    expect(fhd.width / fhd.height).toBeCloseTo(1.5, 1);
  });

  it('drops an old crop when the placement changes and no crop is sent', async () => {
    const p = await upload('gallery');
    await api('PUT', `/api/photos/${p.id}`, { crop: { x: 0.1, y: 0.1, w: 0.4, h: 0.4 } });
    const r = await api('PUT', `/api/photos/${p.id}`, { placement: 'hero' });
    expect(r.status).toBe(200);
    expect(r.body.crop).toBeNull();
    const sm = r.body.variants.find((v: any) => v.tier === 'sm' && v.format === 'jpg');
    expect(sm.width / sm.height).toBeCloseTo(16 / 9, 1);
  });

  it.each([
    ['not an object', 'abc'],
    ['missing fields', { x: 0, y: 0, w: 0.5 }],
    ['negative x', { x: -0.1, y: 0, w: 0.5, h: 0.5 }],
    ['zero width', { x: 0, y: 0, w: 0, h: 0.5 }],
    ['overflowing right edge', { x: 0.6, y: 0, w: 0.5, h: 0.5 }],
    ['width above 1', { x: 0, y: 0, w: 1.2, h: 0.5 }],
    ['non-numeric', { x: '0', y: 0, w: 0.5, h: 0.5 }],
  ])('rejects a crop with %s (400)', async (_n, crop) => {
    const p = await upload('gallery');
    const r = await api('PUT', `/api/photos/${p.id}`, { crop });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('crop must be {x,y,w,h} in 0..1');
    expect((await api('GET', '/api/photos')).body.find((x: any) => x.id === p.id).crop ?? null).toBeNull();
  });

  it('accepts a crop on POST /api/photos as well', async () => {
    const r = await api('POST', '/api/photos', {
      photos: [{ dataBase64: await jpegB64(1200, 800), placement: 'story', crop: { x: 0, y: 0, w: 1, h: 0.8 } }],
    });
    expect(r.status).toBe(201);
    expect(r.body.photos[0].crop).toEqual({ x: 0, y: 0, w: 1, h: 0.8 });
    const sm = r.body.photos[0].variants.find((v: any) => v.tier === 'sm' && v.format === 'jpg');
    expect(sm.width / sm.height).toBeCloseTo(1200 / 640, 1);
  });
});

describe('GET /api/photos/:id/original', () => {
  it('returns the EXIF-rotated original as a JPEG preview with full-size headers', async () => {
    const p = await upload('gallery', { width: 1200, height: 800, orientation: 6 });
    const res = await fetch(`${base}/api/photos/${p.id}/original`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    // orientation 6 = rotated 90 degrees: the browser sees 800 wide x 1200 tall.
    expect(res.headers.get('x-image-width')).toBe('800');
    expect(res.headers.get('x-image-height')).toBe('1200');
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.height).toBe(1200);
  });

  it('caps the preview at 2000px on the long side', async () => {
    const p = await upload('gallery', { width: 2400, height: 1600 });
    const res = await fetch(`${base}/api/photos/${p.id}/original`);
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect(meta.width).toBe(2000);
    expect(res.headers.get('x-image-width')).toBe('2400');
  });

  it('404s for an unknown photo', async () => {
    expect((await fetch(`${base}/api/photos/photo-missing/original`)).status).toBe(404);
  });
});

describe('admin photo UI module', () => {
  it('is served under /admin/photos.js and is valid JavaScript', async () => {
    const res = await fetch(`${base}/admin/photos.js`);
    expect(res.status).toBe(200);
    const src = await res.text();
    expect(src).toContain('export async function init');
  });
});
