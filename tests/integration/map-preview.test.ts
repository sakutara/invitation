import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createCms, type Cms } from '../../src/backend/cms';
import { createServer } from '../../src/backend/server';
import { createMapPreview, type MapEvent } from '../../src/backend/map-preview';

let root: string;
let cms: Cms;
let server: Server;
let base: string;
const doneEvents: { event: MapEvent; src: string }[] = [];

// Offline: every network call fails, so the preview must fall back to the stylized diagram.
const offlineFetch = (async () => {
  throw new Error('network disabled in tests');
}) as typeof fetch;

const mapsDir = () => join(root, 'data/media/_maps');
const distIndex = () => readFileSync(join(root, 'dist/index.html'), 'utf8');

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'wedding-maps-'));
  cms = await createCms({ dbPath: join(root, 'data/wedding.db'), distDir: join(root, 'dist'), mediaDir: join(root, 'data/media') });
  const preview = createMapPreview({
    cms,
    fetchImpl: offlineFetch,
    onDone: (event, src) => doneEvents.push({ event, src }),
  });
  server = createServer({ cms, onConfigSaved: preview.onConfigSaved, extraRoutes: preview.routes });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  await cms.close();
  rmSync(root, { recursive: true, force: true });
});

describe('map preview (offline fallback)', () => {
  it('POST /api/map-preview/:event writes both fallback JPEGs, stores both in config and publishes them to dist', async () => {
    await cms.db.setConfig({
      reception: { ...cms.db.getConfig().reception, venueName: 'Nhà hàng Sen Vàng', address: '45 Nguyễn Văn Linh, Cần Thơ', mapsUrl: 'https://maps.app.goo.gl/abc' },
    });
    await cms.whenIdle();

    const res = await fetch(`${base}/api/map-preview/reception`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mapPreviewSrc: string; mapPreviewLargeSrc: string };
    expect(body.mapPreviewSrc).toMatch(/^assets\/maps\/reception-[0-9a-f]{8}\.jpg$/);
    expect(body.mapPreviewLargeSrc).toMatch(/^assets\/maps\/reception-[0-9a-f]{8}-lg\.jpg$/);
    expect(body.mapPreviewLargeSrc.replace(/-lg\.jpg$/, '.jpg')).toBe(body.mapPreviewSrc);

    const stored = cms.db.getConfig().reception;
    expect(stored.mapPreviewSrc).toBe(body.mapPreviewSrc);
    expect(stored.mapPreviewLargeSrc).toBe(body.mapPreviewLargeSrc);
    expect(cms.db.getConfig().ceremony.mapPreviewSrc).toBeFalsy();
    expect(cms.db.getConfig().ceremony.mapPreviewLargeSrc).toBeFalsy();
    expect(doneEvents.at(-1)).toEqual({ event: 'reception', src: body.mapPreviewSrc });

    for (const [src, size] of [
      [body.mapPreviewSrc, [800, 400]],
      [body.mapPreviewLargeSrc, [2000, 2000]],
    ] as const) {
      const file = join(mapsDir(), src.split('/').pop()!);
      expect(existsSync(file)).toBe(true);
      const meta = await sharp(readFileSync(file)).metadata();
      expect(meta.format).toBe('jpeg');
      expect([meta.width, meta.height]).toEqual(size);
    }

    await cms.whenIdle();
    expect(existsSync(join(root, 'dist/assets/maps', body.mapPreviewSrc.split('/').pop()!))).toBe(true);
    expect(existsSync(join(root, 'dist/assets/maps', body.mapPreviewLargeSrc.split('/').pop()!))).toBe(true);
    // The previews are shown in the schedule of invite.html (index.html lists only the day and the city).
    const invite = readFileSync(join(root, 'dist/invite.html'), 'utf8');
    expect(invite).toMatch(/<a class="event__map"[^>]*data-map-popup[^>]*data-map-large="assets\/maps\/reception-[0-9a-f]{8}-lg\.jpg"[^>]*>\s*<img src="assets\/maps\/reception-[0-9a-f]{8}\.jpg"[^>]*>\s*<\/a>\s*<a class="btn btn--ghost" href="https:\/\/maps\.app\.goo\.gl\/abc"/);
  });

  it('rejects an unknown event with 400', async () => {
    const res = await fetch(`${base}/api/map-preview/rsvp`, { method: 'POST' });
    expect(res.status).toBe(400);
  });

  it('onConfigSaved regenerates both previews when the address changes and removes the stale files', async () => {
    const before = readdirSync(mapsDir()).filter((n) => n.startsWith('reception-'));
    expect(before).toHaveLength(2);
    const prev = cms.db.getConfig();
    const next = cms.db.setConfig({ reception: { ...prev.reception, address: 'Số 12 Đường Mới, Cần Thơ' } });
    const countBefore = doneEvents.length;

    const preview = createMapPreview({ cms, fetchImpl: offlineFetch, onDone: (event, src) => doneEvents.push({ event, src }) });
    preview.onConfigSaved(prev, next);
    await waitFor(() => doneEvents.length > countBefore, 10_000);
    await cms.whenIdle();

    const after = readdirSync(mapsDir()).filter((n) => n.startsWith('reception-')).sort();
    expect(after).toHaveLength(2);
    expect(after.some((n) => n.endsWith('-lg.jpg'))).toBe(true);
    const reception = cms.db.getConfig().reception;
    expect(reception.mapPreviewSrc).toBe(`assets/maps/${after.find((n) => !n.endsWith('-lg.jpg'))}`);
    expect(reception.mapPreviewLargeSrc).toBe(`assets/maps/${after.find((n) => n.endsWith('-lg.jpg'))}`);
    for (const n of after) expect(existsSync(join(root, 'dist/assets/maps', n))).toBe(true);
    expect(readdirSync(join(root, 'dist/assets/maps')).filter((n) => n.startsWith('reception-')).sort()).toEqual(after);
  });
});

async function waitFor(fn: () => boolean, timeoutMs: number): Promise<void> {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > timeoutMs) throw new Error(`condition not met within ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 5));
  }
}
