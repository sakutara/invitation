import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createGasSandbox, MockSheet } from '../helpers/gas-sandbox';
import { createCms, type Cms } from '../../src/backend/cms';
import { createServer } from '../../src/backend/server';
import { createBulkRoutes, buildDispatchAssist } from '../../src/backend/bulk-studio';
import { SheetsClient, INVITATION_HEADERS } from '../../src/backend/sheets-sync';
import { RELATIONSHIP_GROUPS, RELATIONSHIP_KEYS } from '../../src/shared/types';
import { DEFAULT_CONFIG } from '../../src/shared/default-config';

const SALUTATIONS = ['chú thím', 'anh chị', 'bạn', 'cô chú', 'hai bác'];
let root: string;
let cms: Cms;
let server: Server;
let base: string;
let gas: ReturnType<typeof createGasSandbox>;
let sheet: MockSheet;
const sent: any[] = [];

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'wedding-bulk-'));
  sheet = new MockSheet('Invitation_List', [...INVITATION_HEADERS]);
  for (let i = 1; i <= 50; i++) {
    const rel = RELATIONSHIP_GROUPS[RELATIONSHIP_KEYS[i % 7]].labelVi;
    sheet.appendRow([String(i), SALUTATIONS[i % 5], `khách mời số ${i}`, rel, (i % 4) + 1, `09051234${String(i).padStart(2, '0')}`, i % 5 === 0 ? `guest${i}@example.com` : '', '', '', '']);
  }
  gas = createGasSandbox({ adminToken: 'secret', sheets: { Invitation_List: sheet } });
  cms = await createCms({ dbPath: join(root, 'wedding.db'), distDir: join(root, 'dist'), mediaDir: join(root, 'media') });
  cms.db.setConfig({ siteBaseUrl: 'https://cuoi.example.com' });
  server = createServer({
    cms,
    extraRoutes: createBulkRoutes({
      cms,
      outputDir: join(root, 'output/invitations-jpg'),
      client: new SheetsClient({ webhookUrl: 'https://gas', adminToken: 'secret', fetchImpl: gas.fetchImpl }),
      transport: { sendMail: async (m: any) => { sent.push(m); return { messageId: String(sent.length) }; } },
      mailFrom: 'Minh Quân & Thu Hà <cuoi@example.com>',
    }),
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60_000);

afterAll(async () => {
  await new Promise((r) => server.close(r));
  await cms.close();
  rmSync(root, { recursive: true, force: true });
});

const post = (p: string, body?: unknown) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });

describe('Bulk Invitation Studio', () => {
  it('processes a 50-row roster: 50 JPEG cards, 50 slugs in guests-map.json, links written back to Sheets', async () => {
    const res = await post('/api/bulk/process');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ synced: 50, generated: 50, skipped: [], writtenBack: 50 });

    const files = readdirSync(join(root, 'output/invitations-jpg')).filter((f) => f.endsWith('.jpg'));
    expect(files).toHaveLength(50);
    for (const f of files) expect(f).toMatch(/^\d+_[0-9a-f]{6}_khach-moi-so-\d+\.jpg$/);
    for (const f of files.slice(0, 5)) {
      const meta = await sharp(readFileSync(join(root, 'output/invitations-jpg', f))).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1080, 1620]);
    }

    await cms.whenIdle();
    const map = JSON.parse(readFileSync(join(root, 'dist/assets/data/guests-map.json'), 'utf8'));
    expect(Object.keys(map)).toHaveLength(50);

    for (const row of sheet.rows.slice(1)) {
      expect(row[7]).toMatch(/^[0-9a-f]{6}$/);
      const slug = new URL(String(row[8])).searchParams.get('khach')!;
      expect(String(row[8])).toBe(`https://cuoi.example.com/invite.html?khach=${slug}`);
      expect(slug).toMatch(/^khach-moi-so-\d+-khac(-\d+)?$|^khach-moi-so-\d+-/);
      expect(row[9]).toBe('GENERATED');
      expect(map[slug]).toBeDefined();
    }
  }, 120_000);

  it('lists guests with card URLs and 1-click Zalo/Messenger assist data', async () => {
    const guests = await (await fetch(`${base}/api/bulk/guests`)).json();
    expect(guests).toHaveLength(50);
    const g = guests[0];
    expect(g.status).toBe('GENERATED');
    expect(g.cardUrl).toMatch(/^\/api\/bulk\/cards\/1_[0-9a-f]{6}_khach-moi-so-1\.jpg$/);
    expect(g.assist.zaloUrl).toBe('https://zalo.me/0905123401');
    expect(g.assist.inviteUrl).toBe(`https://cuoi.example.com/invite.html?khach=${g.slug}`);
    expect(g.assist.clipboardText).toContain('Kính mời khách mời số 1 đến chung vui');
    expect(g.assist.clipboardText).toContain(g.assist.inviteUrl);
    const card = await fetch(base + g.cardUrl);
    expect(card.status).toBe(200);
    expect(card.headers.get('content-type')).toBe('image/jpeg');
    expect((await fetch(`${base}/api/bulk/cards/..%2Fwedding.db`)).status).toBe(404);
  });

  it('emails cards to every guest with an address and marks them SENT', async () => {
    const res = await post('/api/bulk/email');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sent: 10, failed: [] });
    expect(sent).toHaveLength(10);
    const m = sent[0];
    expect(m.from).toBe('Minh Quân & Thu Hà <cuoi@example.com>');
    expect(m.to).toBe('guest5@example.com');
    expect(m.subject).toContain(DEFAULT_CONFIG.brideName);
    expect(m.html).toContain('Kính mời khách mời số 5');
    expect(m.attachments[0].filename).toMatch(/\.jpg$/);
    expect(m.attachments[0].contentType).toBe('image/jpeg');
    const statuses = sheet.rows.slice(1).map((r) => r[9]);
    expect(statuses.filter((s) => s === 'SENT')).toHaveLength(10);
    const again = await (await post('/api/bulk/email')).json();
    expect(again.sent).toBe(0); // already SENT guests are not re-mailed
  });

  it('serves the local Bulk Studio admin page', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Bulk Invitation Studio');
    expect(html).toContain('/api/bulk/process');
  });
});

describe('buildDispatchAssist', () => {
  it('builds Zalo deep link, Messenger share link and clipboard copy', () => {
    const a = buildDispatchAssist(
      { rowId: '1', shortId: 'c9a2f1', token: '', salutation: 'chú thím', name: 'vợ chồng chú Chín', relationship: 'bride_family', count: 2, phone: '0905123456' },
      DEFAULT_CONFIG,
    );
    expect(a.zaloUrl).toBe('https://zalo.me/0905123456');
    expect(a.inviteUrl).toBe('https://example.com/invite.html?khach=vo-chong-chu-chin-gia-dinh-co-dau');
    expect(a.messengerUrl).toBe(`fb-messenger://share?link=${encodeURIComponent(a.inviteUrl)}`);
    expect(a.clipboardText).toBe(
      'Kính mời vợ chồng chú Chín đến chung vui cùng gia đình chúng tôi, sự hiện diện của chú thím là niềm vinh hạnh cho gia đình.\nThiệp mời: https://example.com/invite.html?khach=vo-chong-chu-chin-gia-dinh-co-dau',
    );
  });

  it('omits Zalo link without a phone', () => {
    const a = buildDispatchAssist({ rowId: '1', shortId: 'abcdef', token: '', salutation: 'bạn', name: 'bạn Lan', relationship: 'other', count: 1 }, DEFAULT_CONFIG);
    expect(a.zaloUrl).toBeNull();
  });
});
