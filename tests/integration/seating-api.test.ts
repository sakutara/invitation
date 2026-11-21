import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createCms, type Cms } from '../../src/backend/cms';
import { createServer } from '../../src/backend/server';
import { createSeatingRoutes } from '../../src/backend/seating-routes';
import { SEATING_ZONES, type SeatingLayout, type SeatingZone } from '../../src/shared/types';

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

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'wedding-seating-api-'));
  cms = await createCms({ dbPath: join(root, 'data/wedding.db'), distDir: join(root, 'dist'), mediaDir: join(root, 'data/media') });
  server = createServer({ cms, extraRoutes: createSeatingRoutes({ cms }) });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((r) => server.close(r));
  await cms.close();
  rmSync(root, { recursive: true, force: true });
});

describe('GET /api/seating-layout', () => {
  it('returns the default layout derived from the zones when nothing is stored', async () => {
    const r = await api('GET', '/api/seating-layout');
    expect(r.status).toBe(200);
    expect(r.body.isDefault).toBe(true);
    expect(r.body.layout.tables).toHaveLength(24);
    expect(r.body.zones).toHaveLength(SEATING_ZONES.length);
    const t4 = r.body.layout.tables.find((t: { number: number }) => t.number === 4);
    expect(t4.zoneId).toBe('ZONE_B1');
  });
});

describe('PUT /api/seating-layout', () => {
  it('persists a valid layout and derives zone table ranges', async () => {
    const current = (await api('GET', '/api/seating-layout')).body;
    const layout: SeatingLayout = structuredClone(current.layout);
    // Table 1 moves from the groom-family area to the bride-family area: B1 becomes 1, 4, 5, 6.
    layout.tables.find((t) => t.number === 1)!.zoneId = 'ZONE_B1';
    const zones = structuredClone(current.zones) as SeatingZone[];
    zones.find((z) => z.id === 'ZONE_A1')!.nameVi = 'Khu A1 - Họ hàng nhà trai';

    const r = await api('PUT', '/api/seating-layout', { layout, zones });
    expect(r.status).toBe(200);
    const b1 = r.body.zones.find((z: SeatingZone) => z.id === 'ZONE_B1');
    expect(b1.tableRange).toBe('Bàn 01, 04, 05, 06');
    expect(r.body.zones.find((z: SeatingZone) => z.id === 'ZONE_A1').nameVi).toBe('Khu A1 - Họ hàng nhà trai');
    expect(r.body.zones.find((z: SeatingZone) => z.id === 'ZONE_A1').tableRange).toBe('Bàn 02 - Bàn 03');

    const again = (await api('GET', '/api/seating-layout')).body;
    expect(again.isDefault).toBe(false);
    expect(again.layout.tables.find((t: { number: number }) => t.number === 1).zoneId).toBe('ZONE_B1');
    expect(cms.db.getSeatingZones().find((z) => z.id === 'ZONE_B1')!.tableRange).toBe('Bàn 01, 04, 05, 06');
  });

  it('ignores edits to fields other than nameVi in zones', async () => {
    const current = (await api('GET', '/api/seating-layout')).body;
    const zones = structuredClone(current.zones) as SeatingZone[];
    zones.find((z) => z.id === 'ZONE_C1')!.color = '#000000';
    zones.find((z) => z.id === 'ZONE_C1')!.tableRange = 'Bàn 99';
    const r = await api('PUT', '/api/seating-layout', { layout: current.layout, zones });
    expect(r.status).toBe(200);
    const c1 = r.body.zones.find((z: SeatingZone) => z.id === 'ZONE_C1');
    expect(c1.color).toBe('#7A1C24');
    expect(c1.tableRange).toBe('Bàn 23 - Bàn 24');
  });

  it('rejects an invalid layout with 400', async () => {
    const r = await api('PUT', '/api/seating-layout', { layout: { version: 2, tables: [] } });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/version/);
  });

  it('rejects a table with an unknown zone with 400', async () => {
    const layout = { version: 1, tables: [{ id: 't1', number: 1, x: 100, y: 200, zoneId: 'ZONE_X' }] };
    expect((await api('PUT', '/api/seating-layout', { layout })).status).toBe(400);
  });

  it('rejects invalid zones payload with 400', async () => {
    const current = (await api('GET', '/api/seating-layout')).body;
    const zones = structuredClone(current.zones);
    zones[0].color = 'blue';
    expect((await api('PUT', '/api/seating-layout', { layout: current.layout, zones })).status).toBe(400);
  });
});

describe('POST /api/seating-layout/auto', () => {
  it('re-flows to the requested count and keeps zone ids by table number', async () => {
    const current = (await api('GET', '/api/seating-layout')).body;
    const r = await api('POST', '/api/seating-layout/auto', { count: 30, layout: current.layout });
    expect(r.status).toBe(200);
    expect(r.body.tables).toHaveLength(30);
    expect(r.body.tables.find((t: { number: number }) => t.number === 4).zoneId).toBe('ZONE_B1');
  });

  it('rejects a missing count with 400', async () => {
    expect((await api('POST', '/api/seating-layout/auto', {})).status).toBe(400);
  });
});

describe('GET /api/seating-layout/preview.svg', () => {
  it('serves the current plan as SVG without caching', async () => {
    const res = await fetch(`${base}/api/seating-layout/preview.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^image\/svg\+xml/);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    const text = await res.text();
    expect(text.startsWith('<svg')).toBe(true);
    expect(text).toContain('data-zone="ZONE_B1"');
    expect(text).toContain('viewBox="0 0 600 560"');
  });
});
