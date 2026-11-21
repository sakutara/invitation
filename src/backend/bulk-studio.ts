/**
 * Bulk Invitation Studio (okf/google_sheets_and_bulk_playbook.md §3):
 * pull roster -> encode + rebuild guests-map -> render JPEG cards -> write links back -> dispatch (email / Zalo assist).
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Cms } from './cms';
import { HttpError, route, type Route, HANDLED } from './server';
import { SheetsClient, syncInvitationList } from './sheets-sync';
import { generateCards, cardFileName } from './bulk-card-generator';
import { buildInviteUrl, guestSlugBase } from '../shared/guest-codec';
import { formatInvitation } from '../shared/invitation-formatter';
import { formatViDateLong } from '../shared/date-format';
import { escapeHtml } from '../shared/html';
import type { GuestRecord, WeddingConfig } from '../shared/types';

export interface MailTransport {
  sendMail(msg: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    attachments: { filename: string; content: Buffer; contentType: string }[];
  }): Promise<unknown>;
}

export interface DispatchAssist {
  inviteUrl: string;
  zaloUrl: string | null;
  messengerUrl: string;
  clipboardText: string;
}

export function buildDispatchAssist(g: GuestRecord, config: WeddingConfig): DispatchAssist {
  const inviteUrl = buildInviteUrl(config.siteBaseUrl, { slug: g.slug ?? guestSlugBase(g) });
  return {
    inviteUrl,
    zaloUrl: g.phone ? `https://zalo.me/${g.phone}` : null,
    messengerUrl: `fb-messenger://share?link=${encodeURIComponent(inviteUrl)}`,
    clipboardText: `${formatInvitation(g)}\nThiệp mời: ${inviteUrl}`,
  };
}

export function buildInvitationEmail(g: GuestRecord, config: WeddingConfig) {
  const inviteUrl = buildInviteUrl(config.siteBaseUrl, { slug: g.slug ?? guestSlugBase(g) });
  const sentence = formatInvitation(g);
  const r = config.reception;
  const subject = `Thiệp mời cưới ${config.groomName} & ${config.brideName}`;
  const text = `${sentence}\n\n${r.title}: ${formatViDateLong(r.datetime)}\n${r.venueName}${r.hallName ? ' - ' + r.hallName : ''}\n${r.address}\n\nXem thiệp và sơ đồ bàn tiệc: ${inviteUrl}`;
  const html = `<div style="font-family:Georgia,serif;background:#FDFBF7;color:#111827;padding:24px;border:3px double #0F2042;max-width:560px;margin:auto">
<p style="color:#7A1C24;letter-spacing:4px;font-size:12px;text-align:center">THIỆP MỜI CƯỚI</p>
<h1 style="color:#0F2042;text-align:center;font-weight:400">${escapeHtml(config.groomName)} &amp; ${escapeHtml(config.brideName)}</h1>
<p style="font-size:18px;font-style:italic;text-align:center">${escapeHtml(sentence)}</p>
<p style="text-align:center"><strong>${escapeHtml(r.title)}</strong><br>${escapeHtml(formatViDateLong(r.datetime))}<br>${escapeHtml(r.venueName)}${r.hallName ? ' - ' + escapeHtml(r.hallName) : ''}<br>${escapeHtml(r.address)}</p>
<p style="text-align:center"><a href="${escapeHtml(inviteUrl)}" style="background:#7A1C24;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">Xem thiệp &amp; sơ đồ bàn tiệc</a></p>
<p style="font-size:13px;color:#4B5563;text-align:center">Thiệp mời được đính kèm trong email này.</p></div>`;
  return { subject, text, html, inviteUrl };
}

export interface BulkStudioOptions {
  cms: Cms;
  outputDir: string;
  client?: SheetsClient;
  transport?: MailTransport | null;
  mailFrom?: string;
}

async function findPortraitHref(cms: Cms): Promise<string | null> {
  const photos = cms.db.listPhotos();
  const p = photos.find((x) => x.placement === 'invite_portrait') ?? photos.find((x) => x.placement === 'hero') ?? photos[0];
  if (!p) return null;
  const v = p.variants.find((x) => x.tier === 'sm' && x.format === 'jpg');
  if (!v) return null;
  const file = join(cms.mediaDir, p.id, v.src.split('/').pop()!);
  return existsSync(file) ? `data:image/jpeg;base64,${(await readFile(file)).toString('base64')}` : null;
}

/** Hero photo (md JPG) as a data URI: the card background, same image as the home page hero. */
export async function findHeroHref(cms: Cms): Promise<string | null> {
  const photos = cms.db.listPhotos();
  const p = photos.find((x) => x.placement === 'hero') ?? photos.find((x) => x.placement === 'gallery');
  if (!p) return null;
  const v = p.variants.find((x) => x.tier === 'md' && x.format === 'jpg') ?? p.variants.find((x) => x.format === 'jpg');
  if (!v) return null;
  const file = join(cms.mediaDir, p.id, v.src.split('/').pop()!);
  return existsSync(file) ? `data:image/jpeg;base64,${(await readFile(file)).toString('base64')}` : null;
}

async function defaultTransport(): Promise<MailTransport | null> {
  if (!process.env.SMTP_HOST) return null;
  const nodemailer = await import('nodemailer');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? 'true') !== 'false',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  }) as unknown as MailTransport;
}

const ADMIN_HTML = join(fileURLToPath(new URL('.', import.meta.url)), 'admin.html');

export function createBulkRoutes(opts: BulkStudioOptions): Route[] {
  const { cms, outputDir } = opts;
  const client = () => {
    if (opts.client) return opts.client;
    const webhookUrl = process.env.SHEETS_WEBHOOK_URL || cms.db.getConfig().rsvpWebhookUrl;
    if (!webhookUrl || !process.env.SHEETS_ADMIN_TOKEN) throw new HttpError(400, 'Set SHEETS_WEBHOOK_URL (or config.rsvpWebhookUrl) and SHEETS_ADMIN_TOKEN');
    return new SheetsClient({ webhookUrl, adminToken: process.env.SHEETS_ADMIN_TOKEN });
  };
  let transportPromise: Promise<MailTransport | null> | null = null;
  const transport = () => (opts.transport !== undefined ? Promise.resolve(opts.transport) : (transportPromise ??= defaultTransport()));

  return [
    route('GET', '/', async ({ res }) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(await readFile(ADMIN_HTML));
      return HANDLED;
    }),

    route('POST', '/api/bulk/process', async () => {
      const c = client();
      const { guests, skipped } = await syncInvitationList(cms.db, c);
      const config = cms.db.getConfig();
      const cards = await generateCards(guests, {
        config,
        zones: cms.db.getSeatingZones(),
        layout: cms.db.getSeatingLayout(),
        outDir: outputDir,
        portraitHref: await findPortraitHref(cms),
        backgroundHref: await findHeroHref(cms),
        concurrency: 4,
      });
      const updates = guests.map((g) => ({
        rowId: g.rowId,
        shortId: g.shortId,
        inviteUrl: buildInviteUrl(config.siteBaseUrl, { slug: g.slug ?? guestSlugBase(g) }),
        status: g.status === 'SENT' ? ('SENT' as const) : ('GENERATED' as const),
      }));
      for (const u of updates) cms.db.setGuestStatus(u.rowId, u.status);
      const wb = updates.length ? await c.updateInvitationLinks(updates) : { updated: 0, missing: [] };
      return { synced: guests.length, generated: cards.length, skipped, writtenBack: wb.updated, outputDir };
    }),

    route('GET', '/api/bulk/guests', () => {
      const config = cms.db.getConfig();
      return cms.db.listGuests().map((g) => {
        const file = cardFileName(g);
        return {
          rowId: g.rowId,
          shortId: g.shortId,
          slug: g.slug,
          salutation: g.salutation,
          name: g.name,
          relationship: g.relationship,
          count: g.count,
          phone: g.phone ?? null,
          email: g.email ?? null,
          status: g.status,
          cardUrl: existsSync(join(outputDir, file)) ? `/api/bulk/cards/${file}` : null,
          assist: buildDispatchAssist(g, config),
        };
      });
    }),

    route('GET', '/api/bulk/cards/:file', async ({ params, res }) => {
      if (!/^[\w-]+\.jpg$/.test(params.file)) throw new HttpError(404, 'Not found');
      const file = join(outputDir, params.file);
      if (!existsSync(file)) throw new HttpError(404, 'Not found');
      res.writeHead(200, { 'content-type': 'image/jpeg', 'content-disposition': `inline; filename="${params.file}"` }).end(await readFile(file));
      return HANDLED;
    }),

    route('POST', '/api/bulk/email', async () => {
      const t = await transport();
      if (!t) throw new HttpError(400, 'SMTP is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM)');
      const from = opts.mailFrom ?? process.env.MAIL_FROM;
      if (!from) throw new HttpError(400, 'MAIL_FROM is not configured');
      const config = cms.db.getConfig();
      const available = new Set(existsSync(outputDir) ? await readdir(outputDir) : []);
      const sentRows: { rowId: string; shortId: string; inviteUrl: string; status: 'SENT' }[] = [];
      const failed: { rowId: string; error: string }[] = [];
      for (const g of cms.db.listGuests()) {
        if (!g.email || g.status === 'SENT') continue;
        const fileName = cardFileName(g);
        if (!available.has(fileName)) {
          failed.push({ rowId: g.rowId, error: 'Card not generated yet' });
          continue;
        }
        const mail = buildInvitationEmail(g, config);
        try {
          await t.sendMail({
            from,
            to: g.email,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
            attachments: [{ filename: `Thiep-Moi-${fileName}`, content: await readFile(join(outputDir, fileName)), contentType: 'image/jpeg' }],
          });
          cms.db.setGuestStatus(g.rowId, 'SENT');
          sentRows.push({ rowId: g.rowId, shortId: g.shortId, inviteUrl: mail.inviteUrl, status: 'SENT' });
        } catch (e) {
          failed.push({ rowId: g.rowId, error: (e as Error).message });
        }
      }
      if (sentRows.length) await client().updateInvitationLinks(sentRows);
      return { sent: sentRows.length, failed };
    }),
  ];
}
