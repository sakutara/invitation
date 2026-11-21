/** Shared HTML partials for the three static pages. */
import { escapeHtml } from '../../shared/html';
import { formatViDateTime } from '../../shared/date-format';
import type { EventDetails, ImageVariant, PhotoRecord, WeddingConfig } from '../../shared/types';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Great+Vibes&display=swap&subset=vietnamese';

export function documentShell(opts: {
  config: WeddingConfig;
  title: string;
  description: string;
  bodyClass: string;
  script: string;
  body: string;
  ogImage?: string | null;
  head?: string;
}): string {
  const { config } = opts;
  const og = opts.ogImage ? `<meta property="og:image" content="${escapeHtml(joinUrl(config.siteBaseUrl, opts.ogImage))}">` : '';
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
<link rel="stylesheet" href="assets/css/main.css">
${opts.head ?? ''}
<script type="module" src="assets/js/${opts.script}"></script>
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
export function ornament(position: 'tl' | 'br'): string {
  return `<svg class="parallax__ornament parallax__ornament--${position}" data-parallax-speed="-0.15" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
<path d="M6 114 C6 60 30 22 114 6"/><path d="M20 112 C22 74 44 44 92 22"/>
<path d="M30 70 c-10-6-14-18-10-26 c10 4 14 16 10 26z" fill="currentColor" fill-opacity=".18"/>
<path d="M52 44 c-4-12 0-22 8-26 c4 10 0 22-8 26z" fill="currentColor" fill-opacity=".18"/>
<path d="M70 30 c10-6 22-4 28 2 c-8 8-20 8-28-2z" fill="currentColor" fill-opacity=".18"/>
<circle cx="14" cy="96" r="4" fill="currentColor"/><circle cx="96" cy="14" r="4" fill="currentColor"/></svg>`;
}

/** Small revealing script tag removing .no-js early. */
export const NO_JS_SWAP = `<script>document.documentElement.classList.remove('no-js')</script>`;

export function eventCard(e: EventDetails, mapsUrl: string): string {
  const f = formatViDateTime(e.datetime);
  const href = escapeHtml(e.mapsUrl || mapsUrl);
  const venue = escapeHtml(e.venueName);
  // Without JS the link opens Google Maps; with the map-popup script the click opens a larger zoomable map instead.
  const largeSrc = escapeHtml(e.mapPreviewLargeSrc || e.mapPreviewSrc || '');
  const map = e.mapPreviewSrc
    ? `<a class="event__map" href="${href}" target="_blank" rel="noopener" aria-label="Xem bản đồ đến ${venue}" data-map-popup data-map-large="${largeSrc}" data-maps-url="${href}" data-map-title="${venue}" data-map-address="${escapeHtml(e.address)}"><img src="${escapeHtml(e.mapPreviewSrc)}" alt="Bản đồ đến ${venue}" width="800" height="400" loading="lazy" decoding="async"></a>\n  `
    : '';
  return `<article class="card event reveal">
  <span class="eyebrow">${escapeHtml(e.title)}</span>
  <p class="event__time">${escapeHtml(f.time)}</p>
  <p class="event__date">${escapeHtml(`${f.weekday}, ${f.date}`)}</p>
  <hr class="divider">
  <p class="event__venue">${venue}${e.hallName ? ` · ${escapeHtml(e.hallName)}` : ''}</p>
  <p class="event__address">${escapeHtml(e.address)}</p>
  ${map}<a class="btn btn--ghost" href="${href}" target="_blank" rel="noopener">Chỉ đường Google Maps</a>
</article>`;
}

