/**
 * Shared 1080x1620 invitation card master template (design.md decision #4).
 * Consumed by sharp on the backend (bulk JPEG) and by <canvas> in the browser (invite.html save/share).
 */
import QRCode from 'qrcode';
import { formatInvitation } from './invitation-formatter';
import { mapSeating, renderSeatingMapSvg, escapeXml } from './seating-mapper';
import { formatViDateTime } from './date-format';
import { CARD_SPEC, COLOR_TOKENS, FALLBACK_GUEST, type SeatingLayout, type SeatingZone, type WeddingConfig } from './types';

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

const C = {
  navy: COLOR_TOKENS['--color-navy'],
  navyDeep: COLOR_TOKENS['--color-navy-deep'],
  burgundy: COLOR_TOKENS['--color-burgundy'],
  ivory: COLOR_TOKENS['--color-ivory'],
  cream: COLOR_TOKENS['--color-cream'],
  charcoal: COLOR_TOKENS['--color-charcoal'],
  muted: COLOR_TOKENS['--color-muted'],
};
const SERIF = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const SCRIPT = "'Great Vibes', 'Alex Brush', Georgia, serif";
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

function textBlock(lines: string[], x: number, y: number, lineHeight: number, attrs: string): string {
  const tspans = lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(l)}</tspan>`).join('');
  return `<text x="${x}" y="${y}" ${attrs}>${tspans}</text>`;
}

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

function eventColumn(label: string, iso: string, venue: string, address: string, cx: number, y: number): string {
  const f = formatViDateTime(iso);
  return (
    `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="20" letter-spacing="4" fill="${C.burgundy}" font-weight="700">${escapeXml(label.toUpperCase())}</text>` +
    `<text x="${cx}" y="${y + 52}" text-anchor="middle" font-family="${SERIF}" font-size="46" font-weight="700" fill="${C.navy}">${escapeXml(f.time)}</text>` +
    `<text x="${cx}" y="${y + 88}" text-anchor="middle" font-family="${SANS}" font-size="22" fill="${C.charcoal}">${escapeXml(`${f.weekday}, ${f.date}`)}</text>` +
    textBlock(wrapText(venue, 30), cx, y + 124, 28, `text-anchor="middle" font-family="${SANS}" font-size="22" font-weight="600" fill="${C.navy}"`) +
    textBlock(wrapText(address, 36), cx, y + 124 + 28 * wrapText(venue, 30).length, 26, `text-anchor="middle" font-family="${SANS}" font-size="19" fill="${C.muted}"`)
  );
}

export function renderCardSvg(input: CardInput): string {
  const { config, zones } = input;
  // No guest = default invitation ("bạn") with the hall map but no table guidance.
  const guest = input.guest ?? FALLBACK_GUEST;
  const W = CARD_SPEC.width;
  const H = CARD_SPEC.height;
  const seating = input.guest ? mapSeating(input.guest, zones) : null;
  const sentence = formatInvitation(guest);
  const wedding = formatViDateTime(config.reception.datetime || config.ceremony.datetime);

  const portrait = input.portraitHref
    ? `<g data-role="portrait"><clipPath id="card-portrait-clip"><path d="M400 520 V350 a140 140 0 0 1 280 0 V520 Z"/></clipPath>` +
      `<image href="${escapeXml(input.portraitHref)}" x="400" y="210" width="280" height="310" preserveAspectRatio="xMidYMid slice" clip-path="url(#card-portrait-clip)"/>` +
      `<path d="M400 520 V350 a140 140 0 0 1 280 0 V520 Z" fill="none" stroke="${C.burgundy}" stroke-width="5"/></g>`
    : `<g data-role="portrait"><path d="M400 520 V350 a140 140 0 0 1 280 0 V520 Z" fill="${C.cream}" stroke="${C.burgundy}" stroke-width="5"/>` +
      `<text x="540" y="400" text-anchor="middle" font-family="${SCRIPT}" font-size="84" fill="${C.burgundy}">${escapeXml(
        `${config.groomName.trim().split(/\s+/).pop()?.charAt(0) ?? ''}&${config.brideName.trim().split(/\s+/).pop()?.charAt(0) ?? ''}`,
      )}</text></g>`;

  const chartW = 520;
  const chart = renderSeatingMapSvg(zones, { zoneId: seating?.zoneId ?? null, seatCount: seating?.seatCount, layout: input.layout }).replace(
    /^<svg /,
    `<svg x="80" y="1062" width="${chartW}" height="${Math.round((chartW * 560) / 600)}" `,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="${C.navy}"/>`,
    input.backgroundHref
      ? `<image data-role="background" href="${escapeXml(input.backgroundHref)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` +
        `<rect width="${W}" height="${H}" fill="${C.navyDeep}" fill-opacity="0.35"/>`
      : '',
    `<rect x="36" y="36" width="${W - 72}" height="${H - 72}" rx="28" fill="${C.ivory}" fill-opacity="${input.backgroundHref ? 0.9 : 1}"/>`,
    `<rect x="54" y="54" width="${W - 108}" height="${H - 108}" rx="20" fill="none" stroke="${C.navy}" stroke-width="3"/>`,
    `<rect x="64" y="64" width="${W - 128}" height="${H - 128}" rx="16" fill="none" stroke="${C.burgundy}" stroke-width="1.5"/>`,
    `<text x="540" y="128" text-anchor="middle" font-family="${SANS}" font-size="22" letter-spacing="8" fill="${C.burgundy}" font-weight="700">THIỆP MỜI CƯỚI</text>`,
    `<text x="540" y="186" text-anchor="middle" font-family="${SCRIPT}" font-size="64" fill="${C.navy}">${escapeXml(config.groomName)} &amp; ${escapeXml(config.brideName)}</text>`,
    portrait,
    `<text x="540" y="572" text-anchor="middle" font-family="${SERIF}" font-size="36" font-weight="700" letter-spacing="2" fill="${C.burgundy}">${escapeXml(`${wedding.weekday}, ${wedding.date}`)}</text>`,
    `<line x1="340" y1="600" x2="740" y2="600" stroke="${C.burgundy}" stroke-width="2"/>`,
    textBlock(wrapText(sentence, 52), 540, 652, 44, `data-role="greeting" text-anchor="middle" font-family="${SERIF}" font-size="34" font-style="italic" fill="${C.charcoal}"`),
    eventColumn(config.ceremony.title, config.ceremony.datetime, config.ceremony.venueName, config.ceremony.address, 300, 830),
    eventColumn(
      config.reception.title,
      config.reception.datetime,
      [config.reception.venueName, config.reception.hallName].filter(Boolean).join(' - '),
      config.reception.address,
      780,
      830,
    ),
    `<line x1="540" y1="820" x2="540" y2="1030" stroke="${C.navy}" stroke-opacity="0.25" stroke-width="2"/>`,
    chart,
    qrSvg(input.inviteUrl, 650, 1090, 330),
    ...(seating
      ? [
          `<text x="815" y="1462" text-anchor="middle" font-family="${SANS}" font-size="24" font-weight="700" fill="${seating.color}">${escapeXml(
            `${seating.zone.nameVi.split(' - ')[0]} · ${seating.seatCount} chỗ ngồi`,
          )}</text>`,
          `<text x="815" y="1496" text-anchor="middle" font-family="${SANS}" font-size="19" fill="${C.muted}">${escapeXml(seating.zone.tableRange)}</text>`,
        ]
      : []),
    `<text x="815" y="1532" text-anchor="middle" font-family="${SANS}" font-size="18" fill="${C.muted}">Quét mã QR để mở thiệp mời</text>`,
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
