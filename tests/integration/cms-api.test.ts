import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createCms, type Cms } from '../../src/backend/cms';
import { createServer } from '../../src/backend/server';
import { DEFAULT_CONFIG } from '../../src/shared/default-config';
import { SEATING_ZONES } from '../../src/shared/types';

let root: string;
let cms: Cms;
let server: Server;
let base: string;

const api = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const photoPayload = async (i: number) => ({
  filename: `cuoi-${i}.jpg`,
  dataBase64: (await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 20 * i, g: 32, b: 66 } } }).jpeg().toBuffer()).toString('base64'),
  caption: `Khoảnh khắc ${i}`,
});
const distJson = () => JSON.parse(readFileSync(join(root, 'dist/assets/data/wedding-data.json'), 'utf8'));

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'wedding-api-'));
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

describe('GET/PUT /api/config', () => {
  it('returns the seeded configuration', async () => {
    const r = await api('GET', '/api/config');
    expect(r.status).toBe(200);
    expect(r.body).toEqual(DEFAULT_CONFIG);
  });

  it('persists updates, returns the updated object and rebuilds dist', async () => {
    const r = await api('PUT', '/api/config', { groomName: 'Hoàng Long', reception: { ...DEFAULT_CONFIG.reception, address: '1 Lê Lợi, Q.1' } });
    expect(r.status).toBe(200);
    expect(r.body.groomName).toBe('Hoàng Long');
    expect(r.body.reception.address).toBe('1 Lê Lợi, Q.1');
    expect((await api('GET', '/api/config')).body.groomName).toBe('Hoàng Long');
    await cms.whenIdle();
    expect(distJson().config.groomName).toBe('Hoàng Long');
  });

  it.each([
    ['an array', [1, 2]],
    ['unknown keys', { hacker: true }],
    ['wrong types', { groomName: 42 }],
    ['invalid JSON', '{nope'],
  ])('rejects %s with 400', async (_n, body) => {
    expect((await api('PUT', '/api/config', body)).status).toBe(400);
  });
});

describe('/api/photos', () => {
  it('stores 4 then 6 more photos (10 total) in sort order and includes them in the static build', async () => {
    const first = await api('POST', '/api/photos', { photos: await Promise.all([0, 1, 2, 3].map(photoPayload)) });
    expect(first.status).toBe(201);
    expect(first.body.photos).toHaveLength(4);
    const more = await api('POST', '/api/photos', { photos: await Promise.all([4, 5, 6, 7, 8, 9].map(photoPayload)) });
    expect(more.status).toBe(201);
    const list = (await api('GET', '/api/photos')).body;
    expect(list).toHaveLength(10);
    expect(list.map((p: any) => p.sortOrder)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(list.map((p: any) => p.caption)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `Khoảnh khắc ${i}`));
    expect(list[0].variants).toHaveLength(8);
    await cms.whenIdle();
    expect(distJson().photos).toHaveLength(10);
    expect(readdirSync(join(root, 'dist/assets/images'))).toHaveLength(10);
    expect(existsSync(join(root, 'dist', list[0].variants[0].src))).toBe(true);
  });

  it('updates caption, placement and order', async () => {
    const [a, b] = (await api('GET', '/api/photos')).body;
    const r = await api('PUT', `/api/photos/${b.id}`, { caption: 'Ảnh bìa', placement: 'hero', sortOrder: -1 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: b.id, caption: 'Ảnh bìa', placement: 'hero', sortOrder: -1 });
    expect((await api('GET', '/api/photos')).body[0].id).toBe(b.id);
    const reorder = await api('PUT', '/api/photos/order', { ids: [a.id, b.id] });
    expect(reorder.status).toBe(200);
    const after = (await api('GET', '/api/photos')).body;
    expect(after.slice(0, 2).map((p: any) => p.id)).toEqual([a.id, b.id]);
  });

  it('re-crops when the focal point changes', async () => {
    const [p] = (await api('GET', '/api/photos')).body;
    const r = await api('PUT', `/api/photos/${p.id}`, { focalPoint: { x: 0.2, y: 0.5 }, placement: 'invite_portrait' });
    expect(r.status).toBe(200);
    const sm = r.body.variants.find((v: any) => v.tier === 'sm' && v.format === 'jpg');
    expect(sm.width / sm.height).toBeCloseTo(0.8, 1);
    await cms.whenIdle();
    const meta = await sharp(join(root, 'dist', sm.src)).metadata();
    expect(meta.width! / meta.height!).toBeCloseTo(0.8, 1);
  });

  it('deletes a photo from SQLite and removes its generated files from dist', async () => {
    const [p] = (await api('GET', '/api/photos')).body;
    const r = await api('DELETE', `/api/photos/${p.id}`);
    expect(r.status).toBe(204);
    expect((await api('GET', '/api/photos')).body).toHaveLength(9);
    await cms.whenIdle();
    expect(existsSync(join(root, 'dist/assets/images', p.id))).toBe(false);
    expect(existsSync(join(root, 'data/media', p.id))).toBe(false);
    expect((await api('DELETE', `/api/photos/${p.id}`)).status).toBe(404);
  });

  it('rejects invalid uploads', async () => {
    expect((await api('POST', '/api/photos', { photos: [{ dataBase64: 'bm90IGFuIGltYWdl' }] })).status).toBe(400);
    expect((await api('POST', '/api/photos', { photos: [] })).status).toBe(400);
    expect((await api('POST', '/api/photos', { photos: [{ ...(await photoPayload(1)), placement: 'roof' }] })).status).toBe(400);
  });
});

describe('/api/seating-zones', () => {
  it('reads and replaces seating zones', async () => {
    expect((await api('GET', '/api/seating-zones')).body).toEqual(SEATING_ZONES);
    const zones = SEATING_ZONES.map((z) => (z.id === 'ZONE_B1' ? { ...z, tableRange: 'Bàn 04 - Bàn 08' } : z));
    const r = await api('PUT', '/api/seating-zones', zones);
    expect(r.status).toBe(200);
    await cms.whenIdle();
    expect(distJson().seatingZones.find((z: any) => z.id === 'ZONE_B1').tableRange).toBe('Bàn 04 - Bàn 08');
  });

  it('rejects malformed zones', async () => {
    expect((await api('PUT', '/api/seating-zones', [{ id: 'ZONE_X' }])).status).toBe(400);
    expect((await api('PUT', '/api/seating-zones', SEATING_ZONES.map((z) => ({ ...z, color: 'pink' })))).status).toBe(400);
  });
});

describe('POST /api/build and misc', () => {
  it('forces a rebuild and reports timing', async () => {
    const r = await api('POST', '/api/build');
    expect(r.status).toBe(200);
    expect(r.body.durationMs).toBeLessThan(500);
    expect(r.body.files).toContain('index.html');
  });

  it('returns 404 JSON for unknown routes', async () => {
    expect((await api('GET', '/api/nope')).status).toBe(404);
  });

  it('serves a preview of dist/ under /site/', async () => {
    const res = await fetch(`${base}/site/index.html`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect((await fetch(`${base}/site/../data/wedding.db`)).status).toBe(404);
  });
});
