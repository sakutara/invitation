/** Trang Báo Hỉ — dist/index.html */
import { PAGE_DIRS } from '../../shared/routes';
import { escapeHtml } from '../../shared/html';
import { formatViDateTime } from '../../shared/date-format';
import type { WeddingData } from '../../shared/types';
import { documentShell, firstPhoto, picture, variant } from './partials';
import { countdownSection, envelopeScene, familiesSection, musicPlayer, rsvpCtaSection, sceneLead, scheduleSection, storySection } from './envelope.partials';

type PageData = Omit<WeddingData, 'guests'> & { builtAt?: string };

export function renderIndexPage(data: PageData): string {
  const { config, photos } = data;
  const hero = firstPhoto(photos, 'hero', 'gallery');
  const gallery = photos.filter((p) => p.placement === 'gallery');
  const wedding = formatViDateTime(config.reception.datetime || config.ceremony.datetime);
  const heroImg = hero ? variant(hero, 'lg') : undefined;
  /** Prints hung slightly askew (deterministic tilt per position). */
  const TILTS = [-3, 2.5, -1.5, 3, -2.5, 1.5, -2, 2];

  const galleryHtml = gallery.length
    ? `<div class="gallery">${gallery
        .map((p, i) => {
          const sm = variant(p, 'sm');
          const portrait = sm ? sm.height > sm.width : false;
          // Frame takes the real ratio of the stored crop, so object-fit never trims the admin's framing.
          const ratio = sm ? ` style="aspect-ratio: ${sm.width} / ${sm.height}; --r: ${TILTS[i % TILTS.length]}deg; --i: ${i % 3}"` : ` style="--r: ${TILTS[i % TILTS.length]}deg; --i: ${i % 3}"`;
          return `<figure class="gallery__item${portrait ? ' gallery__item--portrait' : ''}"${ratio} data-scroll-progress data-scroll-span="0.6">${picture(p, {
            sizes: '(max-width: 560px) 100vw, (max-width: 1200px) 50vw, 33vw',
          })}${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''}</figure>`;
        })
        .join('')}</div>`
    : `<p class="gallery__empty">Album ảnh cưới sẽ sớm được cập nhật.</p>`;

  const body = `
<main>
${envelopeScene(config, photos, { kind: 'announce', hasMusic: !!data.playlist?.length })}
<div class="page-paper">
${sceneLead(config, `<a class="btn" href="${PAGE_DIRS.rsvp}" data-cta="rsvp">Đăng ký tham dự</a>
        <a class="btn btn--ghost btn--ink" href="#schedule">Xem lịch trình</a>`)}
${scheduleSection(config, photos)}
${familiesSection(config)}
${storySection(config, photos, galleryHtml)}
${countdownSection(config, photos)}
${rsvpCtaSection(config, 'data-cta="rsvp-bottom"')}
</div>
</main>
<footer class="site-footer">${escapeHtml(config.groomName)} &amp; ${escapeHtml(config.brideName)} · ${escapeHtml(wedding.date)}</footer>
${musicPlayer(data.playlist)}`;

  return documentShell({
    config,
    title: `${config.groomName} & ${config.brideName} · Báo hỉ`,
    description: `${config.headline} — ${wedding.weekday}, ${wedding.date}`,
    bodyClass: 'page-index',
    script: 'index.js',
    ogImage: heroImg?.src ?? null,
    body,
  });
}
