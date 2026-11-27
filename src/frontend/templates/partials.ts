/** Shared HTML partials for the three static pages. */
import { blossomPaths, bouquetPaths, floralPaths } from '../../shared/florals';
import { FONTS_HREF } from '../../shared/web-fonts';
import { escapeHtml } from '../../shared/html';
import { formatViDateTime } from '../../shared/date-format';
import type { EventDetails, ImageVariant, PhotoRecord, WeddingConfig } from '../../shared/types';


export function documentShell(opts: {
  config: WeddingConfig;
  title: string;
  description: string;
  bodyClass: string;
  script: string;
  body: string;
  ogImage?: string | null;
  head?: string;
  /** Path from this page to the site root ('' for the home page, '../' inside a folder). */
  root?: string;
}): string {
  const { config } = opts;
  const root = opts.root ?? '';
  // og:image must be absolute: drop the page-relative prefix before joining with the site address.
  const og = opts.ogImage ? `<meta property="og:image" content="${escapeHtml(joinUrl(config.siteBaseUrl, opts.ogImage.replace(/^(\.\.\/)+/, '')))}">` : '';
  return `<!doctype html>
<html lang="vi" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<meta name="theme-color" content="#0F2042">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(opts.title)}">
<meta property="og:description" content="${escapeHtml(opts.description)}">
${og}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS_HREF}">
<link rel="stylesheet" href="${root}assets/css/main.css">
${opts.head ?? ''}
<script type="module" src="${root}assets/js/${opts.script}"></script>
</head>
<body class="${opts.bodyClass}">
${opts.body}
</body>
</html>`;
}

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function srcset(variants: ImageVariant[], format: 'webp' | 'jpg'): string {
  return variants
    .filter((v) => v.format === format)
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.src} ${v.width}w`)
    .join(', ');
}

export function variant(photo: PhotoRecord, tier: ImageVariant['tier'], format: ImageVariant['format'] = 'jpg'): ImageVariant | undefined {
  return photo.variants.find((v) => v.tier === tier && v.format === format) ?? photo.variants.find((v) => v.format === format);
}

export function picture(photo: PhotoRecord, opts: { sizes: string; lazy?: boolean; alt?: string; fallbackTier?: ImageVariant['tier']; className?: string }): string {
  const fallback = variant(photo, opts.fallbackTier ?? 'sm');
  if (!fallback) return '';
  const lazy = opts.lazy === false ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return `<picture${opts.className ? ` class="${opts.className}"` : ''}><source type="image/webp" srcset="${escapeHtml(srcset(photo.variants, 'webp'))}" sizes="${opts.sizes}">` +
    `<img src="${escapeHtml(fallback.src)}" srcset="${escapeHtml(srcset(photo.variants, 'jpg'))}" sizes="${opts.sizes}" width="${fallback.width}" height="${fallback.height}" alt="${escapeHtml(opts.alt ?? photo.caption)}" ${lazy}></picture>`;
}

export function firstPhoto(photos: PhotoRecord[], ...placements: PhotoRecord['placement'][]): PhotoRecord | null {
  for (const p of placements) {
    const hit = photos.find((x) => x.placement === p);
    if (hit) return hit;
  }
  return null;
}

/** Botanical corner ornament (foreground parallax layer). */
/** Watercolour-style floral spray (shared with the JPG card, see shared/florals.ts). */
const FLIP = { none: '', h: 'matrix(-1 0 0 1 220 0)', v: 'matrix(1 0 0 -1 0 220)', both: 'matrix(-1 0 0 -1 220 220)' };

/** `flip` mirrors the spray inside its box (h: grows from the bottom-right, v: from the top-left, both: top-right). */
export function floralSpray(cls = '', attrs = '', flip: keyof typeof FLIP = 'none'): string {
  const inner = FLIP[flip] ? `<g transform="${FLIP[flip]}">${floralPaths()}</g>` : floralPaths();
  return `<svg class="floral ${cls}"${attrs} viewBox="0 0 220 220" fill="none" aria-hidden="true">${inner}</svg>`;
}

/** Hand-tied bouquet (blush roses, yellow blooms, bow). */
export function bouquet(cls = '', attrs = ''): string {
  return `<svg class="floral floral--bouquet ${cls}"${attrs} viewBox="0 0 200 280" fill="none" aria-hidden="true">${bouquetPaths()}</svg>`;
}

/** Single inked flower (dusty blue by default, or wine/blush). */
export function blossom(cls = '', tone: 'blue' | 'wine' | 'lavender' = 'blue', attrs = ''): string {
  const [ink, wash] = { blue: ['#5A7BA6', '#C9D6EA'], wine: ['#8E2F45', '#F3C9D3'], lavender: ['#7067A8', '#D7D2F0'] }[tone];
  return `<svg class="floral floral--blossom ${cls}"${attrs} viewBox="0 0 120 120" fill="none" aria-hidden="true">${blossomPaths(ink, wash)}</svg>`;
}

/** Corner florals; kept under the parallax ornament contract (data-parallax-speed="-0.15"). */
export function ornament(position: 'tl' | 'br'): string {
  return floralSpray(`parallax__ornament parallax__ornament--${position}`, ' data-parallax-speed="-0.15"', position === 'tl' ? 'v' : 'h');
}

/** Small revealing script tag removing .no-js early. */
export const NO_JS_SWAP = `<script>document.documentElement.classList.remove('no-js')</script>`;

/** `compact` (index.html): only time, date and city, no venue or map. */
export function eventCard(e: EventDetails, mapsUrl: string, opts: { compact?: boolean } = {}): string {
  const f = formatViDateTime(e.datetime);
  if (opts.compact) {
    const city = e.address.split(',').pop()?.trim() ?? '';
    return `<article class="card event event--compact">
  <span class="eyebrow">${escapeHtml(e.title)}</span>
  <p class="event__time">${escapeHtml(f.time)}</p>
  <p class="event__date">${escapeHtml(`${f.weekday}, ${f.date}`)}</p>
  ${city ? `<hr class="divider">\n  <p class="event__city">${escapeHtml(city)}</p>` : ''}
</article>`;
  }
  const href = escapeHtml(e.mapsUrl || mapsUrl);
  const venue = escapeHtml(e.venueName);
  // Without JS the link opens Google Maps; with the map-popup script the click opens a larger zoomable map instead.
  const largeSrc = escapeHtml(e.mapPreviewLargeSrc || e.mapPreviewSrc || '');
  const map = e.mapPreviewSrc
    ? `<a class="event__map" href="${href}" target="_blank" rel="noopener" aria-label="Xem bản đồ đến ${venue}" data-map-popup data-map-large="${largeSrc}" data-maps-url="${href}" data-map-title="${venue}" data-map-address="${escapeHtml(e.address)}"><img src="${escapeHtml(e.mapPreviewSrc)}" alt="Bản đồ đến ${venue}" width="800" height="400" loading="lazy" decoding="async"></a>\n  `
    : '';
  return `<article class="card event">
  <span class="eyebrow">${escapeHtml(e.title)}</span>
  <p class="event__time">${escapeHtml(f.time)}</p>
  <p class="event__date">${escapeHtml(`${f.weekday}, ${f.date}`)}</p>
  <hr class="divider">
  <p class="event__venue">${venue}${e.hallName ? ` · ${escapeHtml(e.hallName)}` : ''}</p>
  <p class="event__address">${escapeHtml(e.address)}</p>
  ${map}<a class="btn btn--ghost" href="${href}" target="_blank" rel="noopener">Chỉ đường Google Maps</a>
</article>`;
}

