/**
 * Shared 1080x1620 invitation card master template (design.md decision #4).
 * Consumed by sharp on the backend (bulk JPEG) and by <canvas> in the browser (invite.html save/share).
 */
import QRCode from 'qrcode';
import { guestNameLine, presenceLine } from './invitation-formatter';
import { FLORAL_ASPECT, FLORAL_PNG_DATA_URI } from './floral-image';
import { lunarLine } from './lunar-calendar';
import { resolveInvitation } from './default-config';
import { mapSeating, escapeXml } from './seating-mapper';
import { formatViDateTime } from './date-format';
import { CARD_SPEC, COLOR_TOKENS, type SeatingLayout, type SeatingZone, type WeddingConfig } from './types';

export interface CardGuest {
  salutation: string;
  name: string;
  relationship: string | number;
  count: number;
}

export interface CardInput {
  config: WeddingConfig;
  zones: SeatingZone[];
  guest: CardGuest | null;
  inviteUrl: string;
  /** data: URI or absolute URL of the couple portrait. */
  portraitHref?: string | null;
  /** data: URI or absolute URL of the background photo (the home-page hero). */
  backgroundHref?: string | null;
  /** Visual floor plan; null/absent = legacy zone grid. */
  layout?: SeatingLayout | null;
}

/** Colours of the printed invitation (dusty-blue folder, ivory card, navy rules, wine script). */
const C = {
  folder: '#3F5F7B',
  folderDeep: '#2F4C66',
  paper: '#F4F4EE',
  rule: '#2B4A6B',
  wine: '#6B1A34',
  ink: '#2A2D33',
  muted: COLOR_TOKENS['--color-muted'],
  navy: COLOR_TOKENS['--color-navy'],
};
const SERIF = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const SCRIPT = "'Great Vibes', 'Alex Brush', 'Snell Roundhand', cursive";
const SANS = "'Be Vietnam Pro', 'Helvetica Neue', Arial, sans-serif";

export function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line && line.length + 1 + w.length > maxChars) {
      lines.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines;
}

const center = (y: number, text: string, attrs: string) => `<text x="540" y="${y}" text-anchor="middle" ${attrs}>${escapeXml(text)}</text>`;

function qrSvg(url: string, x: number, y: number, size: number): string {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  const vb = n + quiet * 2;
  return (
    `<svg data-role="qr" x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}" shape-rendering="crispEdges">` +
    `<rect width="${vb}" height="${vb}" fill="#FFFFFF"/><path d="${d}" fill="${C.navy}"/></svg>`
  );
}

/**
 * 1080x1620 invitation in the style of the printed card: ivory card with a navy rule on a dusty-blue folder,
 * "TRÂN TRỌNG KÍNH MỜI" + the guest on the dotted line, the couple in wine script, venue, the
 * "VÀO LÚC | weekday" table, the lunar date, the presence line and both families; seat + QR under the card.
 */
export function renderCardSvg(input: CardInput): string {
  const { config, zones } = input;
  const inv = resolveInvitation(config);
  const W = CARD_SPEC.width;
  const H = CARD_SPEC.height;
  const seating = input.guest ? mapSeating(input.guest, zones) : null;
  const r = config.reception;
  const when = formatViDateTime(r.datetime || config.ceremony.datetime);
  const caps = (size: number, fill = C.ink, extra = '') => `font-family="${SANS}" font-size="${size}" letter-spacing="1.5" fill="${fill}" ${extra}`;
  const out: string[] = [];
  let y = 140;

  out.push(center(y, inv.joinLine.toUpperCase(), caps(34, C.ink, 'font-weight="600"')));
  y += 70;
  out.push(center(y, guestNameLine(input.guest), `data-role="guest-name" font-family="${SERIF}" font-size="48" font-style="italic" font-weight="500" fill="${C.wine}"`));
  out.push(`<line x1="230" y1="${y + 22}" x2="850" y2="${y + 22}" stroke="${C.ink}" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>`);
  y += 92;
  for (const l of inv.inviteLine.split('\n')) {
    out.push(center(y, l.toUpperCase(), caps(27)));
    y += 38;
  }
  y += 104;
  out.push(center(y, config.groomName, `font-family="${SCRIPT}" font-size="100" fill="${C.wine}"`));
  out.push(center(y + 74, '&', `font-family="${SCRIPT}" font-size="62" fill="${C.wine}"`));
  out.push(center(y + 164, config.brideName, `font-family="${SCRIPT}" font-size="100" fill="${C.wine}"`));
  y += 236;
  out.push(center(y, 'ĐƯỢC TỔ CHỨC TẠI', caps(28)));
  y += 56;
  for (const l of wrapText(r.venueName, 31)) {
    out.push(center(y, l, `font-family="${SERIF}" font-size="46" font-weight="600" fill="${C.ink}"`));
    y += 50;
  }
  for (const l of wrapText([r.hallName, r.address].filter(Boolean).join(' · '), 60)) {
    out.push(center(y - 6, l, `font-family="${SANS}" font-size="25" fill="${C.ink}"`));
    y += 34;
  }
  // VÀO LÚC 16:30 | CHỦ NHẬT 17.01.2027
  const T = y + 4;
  out.push(
    `<g data-role="when" stroke="${C.ink}" stroke-width="2.5"><line x1="230" y1="${T}" x2="850" y2="${T}"/><line x1="230" y1="${T + 130}" x2="850" y2="${T + 130}"/><line x1="460" y1="${T}" x2="460" y2="${T + 130}"/></g>`,
    `<text x="345" y="${T + 48}" text-anchor="middle" ${caps(30)}>VÀO LÚC</text>`,
    `<text x="345" y="${T + 112}" text-anchor="middle" font-family="${SANS}" font-size="66" font-weight="500" fill="${C.wine}">${escapeXml(when.time)}</text>`,
    `<text x="655" y="${T + 48}" text-anchor="middle" ${caps(32, C.wine)}>${escapeXml(when.weekday.toUpperCase())}</text>`,
    `<text x="655" y="${T + 112}" text-anchor="middle" font-family="${SANS}" font-size="66" font-weight="500" fill="${C.wine}">${escapeXml(when.date.replace(/\//g, '.'))}</text>`,
  );
  y = T + 178;
  const lunar = lunarLine(r.datetime || config.ceremony.datetime);
  if (lunar) out.push(center(y, lunar, `font-family="${SANS}" font-size="30" fill="${C.ink}"`));
  y += 64;
  for (const l of presenceLine(inv.presenceLine, input.guest).split('\n')) {
    out.push(center(y, l, `data-role="presence" font-family="${SCRIPT}" font-size="46" fill="${C.ink}"`));
    y += 50;
  }
  y += 12;
  const family = (x: number, side: string, p: WeddingConfig['groomParents']) =>
    [side, p.father, p.mother]
      .filter(Boolean)
      .map((t, i) => `<text x="${x}" y="${y + i * 38}" text-anchor="middle" font-family="${SANS}" font-size="${i ? 25 : 27}" fill="${C.ink}">${escapeXml(i ? t.toUpperCase() : t)}</text>`)
      .join('');
  out.push(family(320, 'Nhà Trai:', config.groomParents), family(760, 'Nhà Gái:', config.brideParents));
  const cardBottom = Math.max(1380, y + 2 * 38 + 34);

  // Forget-me-not motif: a 250px-wide image; the top-right one is mirrored horizontally.
  const FLORAL_W_PX = 250;
  const FLORAL_H_PX = Math.round(FLORAL_W_PX / FLORAL_ASPECT);
  const floralImage = `<image x="0" y="0" width="${FLORAL_W_PX}" height="${FLORAL_H_PX}" href="${FLORAL_PNG_DATA_URI}" xlink:href="${FLORAL_PNG_DATA_URI}" preserveAspectRatio="xMidYMid meet"/>`;
  const seatText = seating ? `Chỗ ngồi: ${seating.zone.nameVi.split(' - ')[0]} · ${seating.seatCount} chỗ` : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs><linearGradient id="card-folder" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.folder}"/><stop offset="1" stop-color="${C.folderDeep}"/></linearGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="url(#card-folder)"/>`,
    `<rect x="60" y="50" width="${W - 120}" height="${cardBottom - 50}" rx="34" fill="${C.paper}"/>`,
    `<rect x="82" y="72" width="${W - 164}" height="${cardBottom - 94}" rx="20" fill="none" stroke="${C.rule}" stroke-width="2.5"/>`,
    `<g transform="translate(${W - 60 - FLORAL_W_PX + 30 + FLORAL_W_PX} 30) scale(-1 1)">${floralImage}</g>`, // top-right corner, mirrored
    ...out,
    `<g transform="translate(20 ${cardBottom - FLORAL_H_PX + 40})">${floralImage}</g>`, // bottom-left corner
    seating
      ? `<text x="600" y="${cardBottom + 78}" text-anchor="end" font-family="${SANS}" font-size="27" font-weight="700" fill="${C.paper}">${escapeXml(seatText)}</text>` +
        `<text x="600" y="${cardBottom + 116}" text-anchor="end" font-family="${SANS}" font-size="21" fill="${C.paper}" fill-opacity=".85">${escapeXml(seating.zone.tableRange)}</text>`
      : '',
    `<text x="600" y="${cardBottom + (seating ? 152 : 100)}" text-anchor="end" font-family="${SANS}" font-size="21" fill="${C.paper}" fill-opacity=".85">Quét mã QR để mở thiệp mời</text>`,
    `<rect x="${W - 260}" y="${cardBottom + 22}" width="176" height="176" rx="14" fill="#FFFFFF"/>`,
    qrSvg(input.inviteUrl, W - 252, cardBottom + 30, 160),
    '</svg>',
  ].join('');
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/** Plain-text view of every <text> element (tspans joined by spaces). Used by tests and accessibility alt text. */
export function svgTextContent(svg: string): string {
  const out: string[] = [];
  for (const m of svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)) {
    const inner = m[1];
    const spans = [...inner.matchAll(/<tspan\b[^>]*>([\s\S]*?)<\/tspan>/g)].map((s) => s[1]);
    out.push((spans.length ? spans.join(' ') : inner).replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e]));
  }
  return out.join('\n');
}
