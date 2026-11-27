/** Shared HTML partials for the three static pages. */
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

export type FloralFlip = 'none' | 'h' | 'v' | 'both';

/**
 * Decorative forget-me-not motif (one watercolour raster, src/frontend/images, styled by .floral in main.css).
 * `flip` mirrors the image: h = horizontal, v = vertical, both = half turn.
 */
export function floralSpray(cls = '', attrs = '', flip: FloralFlip = 'none'): string {
  return `<span class="floral ${cls}"${attrs} aria-hidden="true"><span class="floral__img floral__img--${flip}"></span></span>`;
}

/** Bouquet slot: the same motif, unflipped. */
export function bouquet(cls = '', attrs = ''): string {
  return floralSpray(cls, attrs, 'none');
}

/** Single flower slot: the same motif mirrored horizontally (`tone` is no longer used). */
export function blossom(cls = '', _tone: 'blue' | 'wine' | 'lavender' = 'blue', attrs = ''): string {
  return floralSpray(cls, attrs, 'h');
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

