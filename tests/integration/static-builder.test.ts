import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WeddingDb } from '../../src/backend/db';
import { StaticBuilder } from '../../src/backend/static-builder';
import { createCms, type Cms } from '../../src/backend/cms';
import { decodeGuestToken } from '../../src/shared/guest-codec';
import { DEFAULT_CONFIG } from '../../src/shared/default-config';
import { SEATING_ZONES, type PhotoRecord } from '../../src/shared/types';

let root: string;
const OUTPUTS = ['index.html', 'rsvp.html', 'invite.html', 'assets/data/wedding-data.json', 'assets/data/guests-map.json'];
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

function fakePhoto(id: string, sortOrder: number, mediaDir?: string): PhotoRecord {
  if (mediaDir) {
    mkdirSync(join(mediaDir, id), { recursive: true });
    writeFileSync(join(mediaDir, id, `${id}-sm.jpg`), 'jpg');
  }
  return {
    id,
    caption: `Ảnh ${id}`,
    placement: 'gallery',
    sortOrder,
    focalPoint: null,
    variants: [{ tier: 'sm', format: 'jpg', width: 640, height: 427, src: `assets/images/${id}/${id}-sm.jpg` }],
  };
}

async function waitFor(fn: () => boolean, timeoutMs: number): Promise<number> {
  const t0 = performance.now();
  while (!fn()) {
    if (performance.now() - t0 > timeoutMs) throw new Error(`condition not met within ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 5));
  }
  return performance.now() - t0;
}

beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'wedding-build-')); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('WeddingDb (SQLite)', () => {
  it('seeds default config + 7 seating zones and persists across reopen', () => {
    const path = join(root, 'wedding.db');
    const db = new WeddingDb(path);
    expect(db.getConfig()).toEqual(DEFAULT_CONFIG);
    expect(db.getSeatingZones()).toEqual(SEATING_ZONES);
    db.setConfig({ groomName: 'Hoàng Nam', reception: { ...DEFAULT_CONFIG.reception, hallName: 'Sảnh Sen' } });
    db.close();
    const again = new WeddingDb(path);
    expect(again.getConfig().groomName).toBe('Hoàng Nam');
    expect(again.getConfig().reception.hallName).toBe('Sảnh Sen');
    expect(again.getConfig().brideName).toBe(DEFAULT_CONFIG.brideName);
    again.close();
  });

  it('keeps photos ordered by sortOrder and supports update/delete', () => {
    const db = new WeddingDb(':memory:');
    db.addPhoto(fakePhoto('p2', 2));
    db.addPhoto(fakePhoto('p1', 1));
    db.updatePhoto('p2', { caption: 'Cập nhật', sortOrder: 0 });
    expect(db.listPhotos().map((p) => [p.id, p.caption])).toEqual([['p2', 'Cập nhật'], ['p1', 'Ảnh p1']]);
    expect(db.deletePhoto('p2')).toBe(true);
    expect(db.deletePhoto('nope')).toBe(false);
    expect(db.listPhotos().map((p) => p.id)).toEqual(['p1']);
  });

  it('upserts guests by rowId', () => {
    const db = new WeddingDb(':memory:');
    const g = { rowId: '1', shortId: 'abc123', token: 't', salutation: 'anh', name: 'anh Tuấn', relationship: 'groom_friends' as const, count: 1 };
    db.upsertGuests([g]);
    db.upsertGuests([{ ...g, count: 2 }]);
    expect(db.listGuests()).toHaveLength(1);
    expect(db.listGuests()[0].count).toBe(2);
  });

  it('emits a mutation event for every write', () => {
    const events: string[] = [];
    const db = new WeddingDb(':memory:', { onMutation: (t) => events.push(t) });
    db.setConfig({ groomName: 'A' });
    db.addPhoto(fakePhoto('p', 0));
    db.setSeatingZones(SEATING_ZONES);
    db.upsertGuests([]);
    expect(events).toEqual(['config', 'photos', 'seating_zones', 'guests']);
  });
});

describe('StaticBuilder', () => {
  it('emits all pages and data snapshots, without leaking guest PII', async () => {
    const db = new WeddingDb(':memory:');
    db.upsertGuests([
      { rowId: '1', shortId: 'c9a2f1', token: 'x', salutation: 'chú thím', name: 'vợ chồng chú Chín', relationship: 'bride_family', count: 2, phone: '0905123456', email: 'chin@example.com' },
    ]);
    const dist = join(root, 'dist');
    const report = await new StaticBuilder({ distDir: dist, mediaDir: join(root, 'media') }).build(db.snapshot());
    for (const f of OUTPUTS) expect(existsSync(join(dist, f)), f).toBe(true);
    expect(report.durationMs).toBeLessThan(500);

    const data = readJson(join(dist, 'assets/data/wedding-data.json'));
    expect(data.config.groomName).toBe(DEFAULT_CONFIG.groomName);
    expect(data.seatingZones).toHaveLength(7);
    expect(data.guests).toBeUndefined();

    const map = readJson(join(dist, 'assets/data/guests-map.json'));
    expect(Object.keys(map)).toEqual(['vo-chong-chu-chin-gia-dinh-co-dau']);
    expect(decodeGuestToken(map['vo-chong-chu-chin-gia-dinh-co-dau'])).toEqual({ salutation: 'chú thím', name: 'vợ chồng chú Chín', relationship: 'bride_family', count: 2 });
    const all = OUTPUTS.map((f) => readFileSync(join(dist, f), 'utf8')).join('\n');
    expect(all).not.toContain('0905123456');
    expect(all).not.toContain('chin@example.com');
  });

  it('copies photo variants into dist and prunes deleted photos', async () => {
    const media = join(root, 'media');
    const dist = join(root, 'dist');
    const db = new WeddingDb(':memory:');
    db.addPhoto(fakePhoto('photo-01', 0, media));
    db.addPhoto(fakePhoto('photo-02', 1, media));
    const builder = new StaticBuilder({ distDir: dist, mediaDir: media });
    await builder.build(db.snapshot());
    expect(existsSync(join(dist, 'assets/images/photo-01/photo-01-sm.jpg'))).toBe(true);
    db.deletePhoto('photo-01');
    await builder.build(db.snapshot());
    expect(existsSync(join(dist, 'assets/images/photo-01'))).toBe(false);
    expect(existsSync(join(dist, 'assets/images/photo-02/photo-02-sm.jpg'))).toBe(true);
  });
});

describe('Auto-rebuild on mutation (createCms)', () => {
  let cms: Cms;
  beforeEach(async () => {
    cms = await createCms({ dbPath: join(root, 'wedding.db'), distDir: join(root, 'dist'), mediaDir: join(root, 'media') });
  });
  afterEach(async () => { await cms.close(); });

  it('builds dist/ on start', () => {
    for (const f of OUTPUTS) expect(existsSync(join(root, 'dist', f)), f).toBe(true);
  });

  it.each([
    ['config', (c: Cms) => c.db.setConfig({ groomName: 'Chú Rể Mới' }), (d: any) => d.config.groomName === 'Chú Rể Mới'],
    ['photos', (c: Cms) => c.db.addPhoto(fakePhoto('p9', 9)), (d: any) => d.photos.some((p: any) => p.id === 'p9')],
    ['seating zones', (c: Cms) => c.db.setSeatingZones(SEATING_ZONES.map((z) => ({ ...z, tableRange: z.id === 'ZONE_C1' ? 'Bàn 99' : z.tableRange }))), (d: any) => d.seatingZones.some((z: any) => z.tableRange === 'Bàn 99')],
  ])('regenerates dist within 500ms after a %s mutation', async (_name, mutate, check) => {
    const jsonPath = join(root, 'dist/assets/data/wedding-data.json');
    const before = statSync(join(root, 'dist/index.html')).mtimeMs;
    mutate(cms);
    const elapsed = await waitFor(() => check(readJson(jsonPath)), 500);
    expect(elapsed).toBeLessThan(500);
    await cms.whenIdle();
    expect(statSync(join(root, 'dist/index.html')).mtimeMs).toBeGreaterThanOrEqual(before);
  });

  it('regenerates guests-map.json after a guest mutation', async () => {
    cms.db.upsertGuests([{ rowId: '7', shortId: 'abcdef', token: 'tok', salutation: 'anh', name: 'anh Tuấn', relationship: 'groom_friends', count: 1 }]);
    await waitFor(() => 'anh-tuan-ban-be-chu-re' in readJson(join(root, 'dist/assets/data/guests-map.json')), 500);
  });

  it('reflects config edits in the rendered HTML', async () => {
    cms.db.setConfig({ groomName: 'Đức Anh' });
    await waitFor(() => readFileSync(join(root, 'dist/index.html'), 'utf8').includes('Đức Anh'), 500);
  });

  it('debounces bursts of mutations into a single build', async () => {
    await cms.whenIdle();
    const before = cms.buildCount();
    for (let i = 0; i < 10; i++) cms.db.setConfig({ headline: `Tin vui ${i}` });
    await cms.whenIdle();
    expect(cms.buildCount() - before).toBe(1);
    expect(readJson(join(root, 'dist/assets/data/wedding-data.json')).config.headline).toBe('Tin vui 9');
  });
});
