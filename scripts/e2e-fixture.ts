/** Builds a deterministic static site into dist-e2e/ for Playwright. */
import sharp from 'sharp';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCms } from '../src/backend/cms';
import { processImage } from '../src/backend/image-processor';
import { computeShortId, encodeGuestToken } from '../src/shared/guest-codec';
import { PROJECT_ROOT } from '../src/backend/static-builder';
import type { PhotoPlacement } from '../src/shared/types';

export const E2E_WEBHOOK = 'https://script.google.com/macros/s/E2E-TEST/exec';
export const E2E_DIR = join(PROJECT_ROOT, '.tmp/e2e');
export const E2E_DIST = join(PROJECT_ROOT, 'dist-e2e');
export const GOLDEN_SLUG = 'vo-chong-chu-chin-gia-dinh-co-dau';
export const GOLDEN = { salutation: 'chú thím', name: 'vợ chồng chú Chín', relationship: 'bride_family' as const, count: 2, phone: '0905123456' };

async function placeholder(i: number, w: number, h: number, label: string) {
  const hue = [[15, 32, 66], [122, 28, 36], [56, 189, 248], [236, 72, 153], [86, 16, 22]][i % 5];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgb(${hue.join(',')})"/><stop offset="1" stop-color="#091326"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w * 0.6}" cy="${h * 0.45}" r="${Math.min(w, h) * 0.22}" fill="#FDFBF7" fill-opacity=".85"/><text x="50%" y="${h * 0.9}" text-anchor="middle" font-family="Georgia" font-size="${Math.round(h / 14)}" fill="#FDFBF7">${label}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

export async function buildE2eSite(): Promise<{ shortId: string; slug: string }> {
  await rm(E2E_DIR, { recursive: true, force: true });
  await rm(E2E_DIST, { recursive: true, force: true });
  await mkdir(E2E_DIR, { recursive: true });
  const cms = await createCms({ dbPath: join(E2E_DIR, 'wedding.db'), distDir: E2E_DIST, mediaDir: join(E2E_DIR, 'media'), debounceMs: 5 });
  cms.db.setConfig({ rsvpWebhookUrl: E2E_WEBHOOK, siteBaseUrl: 'https://cuoi.example.com', googleMapsEmbedUrl: '' });
  const plan: [PhotoPlacement, number, number, string][] = [
    ['hero', 2400, 1600, 'Hero'],
    ['rsvp_background', 2400, 1600, 'RSVP'],
    ['invite_portrait', 1600, 2000, 'Portrait'],
    ['static_map', 1600, 1000, 'Map'],
    ...Array.from({ length: 7 }, (_, i) => ['gallery', i % 3 === 1 ? 1200 : 1800, i % 3 === 1 ? 1800 : 1200, `Gallery ${i + 1}`] as [PhotoPlacement, number, number, string]),
  ];
  for (const [i, [placement, w, h, label]] of plan.entries()) {
    const id = `e2e-${String(i).padStart(2, '0')}`;
    const variants = await processImage(await placeholder(i, w, h, label), { outDir: join(E2E_DIR, 'media'), id, placement });
    cms.db.addPhoto({ id, caption: label, placement, sortOrder: i, focalPoint: null, variants });
  }
  const shortId = await computeShortId(GOLDEN);
  cms.db.upsertGuests([{ rowId: '1', shortId, token: encodeGuestToken(GOLDEN), ...GOLDEN }]);
  await cms.whenIdle();
  await cms.rebuild();
  await cms.close();
  await writeFile(join(E2E_DIR, 'fixture.json'), JSON.stringify({ shortId, slug: GOLDEN_SLUG, webhook: E2E_WEBHOOK }));
  return { shortId, slug: GOLDEN_SLUG };
}
