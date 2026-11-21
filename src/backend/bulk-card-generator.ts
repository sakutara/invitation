/** Backend batch rasterization of the shared SVG card template into 1080x1620 JPEG files via sharp. */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderCardSvg, type CardInput, type CardGuest } from '../shared/card-svg-template';
import { buildInviteUrl, guestSlugBase } from '../shared/guest-codec';
import { slugify } from '../shared/slug';
export { slugify };
import { CARD_SPEC, type SeatingLayout, type SeatingZone, type WeddingConfig } from '../shared/types';

export async function renderCardJpeg(input: CardInput): Promise<Buffer> {
  const svg = renderCardSvg(input);
  return sharp(Buffer.from(svg), { density: 72 })
    .resize(CARD_SPEC.width, CARD_SPEC.height)
    .flatten({ background: '#FFFFFF' })
    .jpeg({ quality: Math.round(CARD_SPEC.quality * 100), chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer();
}

export function cardFileName(g: { rowId: string; shortId: string; name: string }): string {
  const safeRow = String(g.rowId).replace(/[^\w-]+/g, '-');
  return `${safeRow}_${g.shortId}_${slugify(g.name)}.jpg`;
}

export interface BulkGuest extends CardGuest {
  rowId: string;
  shortId: string;
  slug?: string;
}

export interface GeneratedCard {
  rowId: string;
  shortId: string;
  inviteUrl: string;
  path: string;
  fileName: string;
}

export async function generateCards(
  guests: BulkGuest[],
  opts: { config: WeddingConfig; zones: SeatingZone[]; layout?: SeatingLayout | null; outDir: string; portraitHref?: string | null; backgroundHref?: string | null; concurrency?: number },
): Promise<GeneratedCard[]> {
  await mkdir(opts.outDir, { recursive: true });
  const results: GeneratedCard[] = new Array(guests.length);
  let next = 0;
  const worker = async () => {
    while (next < guests.length) {
      const i = next++;
      const g = guests[i];
      const inviteUrl = buildInviteUrl(opts.config.siteBaseUrl, { slug: g.slug ?? guestSlugBase(g) });
      const jpeg = await renderCardJpeg({ config: opts.config, zones: opts.zones, layout: opts.layout, guest: g, inviteUrl, portraitHref: opts.portraitHref, backgroundHref: opts.backgroundHref });
      const fileName = cardFileName(g);
      const path = join(opts.outDir, fileName);
      await writeFile(path, jpeg);
      results[i] = { rowId: g.rowId, shortId: g.shortId, inviteUrl, path, fileName };
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 4) }, worker));
  return results;
}
