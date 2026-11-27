/** Trang Báo Hỉ — dist/index.html */
import { PAGE_DIRS } from '../../shared/routes';
import { escapeHtml } from '../../shared/html';
import { formatViDateTime } from '../../shared/date-format';
import type { WeddingData } from '../../shared/types';
import { documentShell, firstPhoto, ornament, picture, variant } from './partials';
import { calendarSection, closingSection, countdownSection, dayTicket, envelopeScene, rsvpCtaSection, sheet, waxSeal } from './envelope.partials';
import { resolveInvitation } from '../../shared/default-config';

type PageData = Omit<WeddingData, 'guests'> & { builtAt?: string };

export function renderIndexPage(data: PageData): string {
  const { config, photos } = data;
  const hero = firstPhoto(photos, 'hero', 'gallery');
  const storyBg = firstPhoto(photos, 'story');
  const gallery = photos.filter((p) => p.placement === 'gallery');
  const wedding = formatViDateTime(config.reception.datetime || config.ceremony.datetime);
  const heroImg = hero ? variant(hero, 'lg') : undefined;
  const inv = resolveInvitation(config);
  /** Scattered prints settle as they enter (deterministic tilt per position). */
  const TILTS = [-6, 4, -3, 7, -5, 3, -2, 5];

  const galleryHtml = gallery.length
    ? `<div class="gallery">${gallery
        .map((p, i) => {
          const sm = variant(p, 'sm');
          const portrait = sm ? sm.height > sm.width : false;
          // Frame takes the real ratio of the stored crop, so object-fit never trims the admin's framing.
          const ratio = sm ? ` style="aspect-ratio: ${sm.width} / ${sm.height}; --r: ${TILTS[i % TILTS.length]}deg"` : ` style="--r: ${TILTS[i % TILTS.length]}deg"`;
          return `<figure class="gallery__item${portrait ? ' gallery__item--portrait' : ''}"${ratio} data-scroll-progress data-scroll-span="0.6">${picture(p, {
            sizes: '(max-width: 560px) 100vw, (max-width: 1200px) 50vw, 33vw',
          })}${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''}</figure>`;
        })
        .join('')}</div>`
    : `<p class="gallery__empty">Album ảnh cưới sẽ sớm được cập nhật.</p>`;

  const body = `
<main>
${envelopeScene(config, photos, { kind: 'announce' })}
<div class="paper-desk">
${sheet('hero', 'hero-sheet', `
      ${ornament('tl')}${ornament('br')}
      <div class="container hero-sheet__grid" data-parallax-speed="0">
        <figure class="photo-print${hero ? '' : ' photo-print--empty'}">
          <span class="photo-print__tape photo-print__tape--l" aria-hidden="true"></span><span class="photo-print__tape photo-print__tape--r" aria-hidden="true"></span>
          <div class="photo-print__frame"><div class="photo-print__img${hero ? '' : ' hero__fallback-bg'}" data-parallax-speed="0.25">${
            heroImg ? `<img src="${escapeHtml(heroImg.src)}" alt="${escapeHtml(config.groomName)} &amp; ${escapeHtml(config.brideName)}" fetchpriority="high" width="${heroImg.width}" height="${heroImg.height}">` : ''
          }</div></div>
        </figure>
        <div class="hero__letter" data-scroll-progress data-scroll-span="0.9">
          <h2 class="hero__script script rise" style="--d:.1">${escapeHtml(config.headline)}</h2>
          <hr class="divider rise" style="--d:.18">
          <div class="hero__actions rise" style="--d:.24">
            <a class="btn" href="${PAGE_DIRS.rsvp}" data-cta="rsvp">Đăng ký tham dự</a>
            <a class="btn btn--ghost btn--ink" href="#schedule">Xem lịch trình</a>
          </div>
        </div>
      </div>`)}
${sheet('story', 'story-sheet', `
      ${storyBg ? `<div class="parallax__layer" data-parallax-speed="0.25" style="opacity:.1">${picture(storyBg, { sizes: '100vw', alt: '' })}</div>` : ''}
      ${ornament('tl')}
      <div class="container" data-parallax-speed="0">
        <span class="eyebrow">Nhà trai · Nhà gái</span>
        <h2 class="section-title">Hai bên gia đình</h2>
        <div class="families">
          <article class="card family family--groom">
            <span class="family__side">Nhà trai</span>
            <p class="family__parents">${escapeHtml(config.groomParents.father)}<br>${escapeHtml(config.groomParents.mother)}</p>
            <p class="family__address">${escapeHtml(config.groomParents.address)}</p>
            <p class="family__child">Chú rể ${escapeHtml(config.groomName)}</p>
          </article>
          ${waxSeal(inv.monogram, 'families__seal')}
          <article class="card family family--bride">
            <span class="family__side">Nhà gái</span>
            <p class="family__parents">${escapeHtml(config.brideParents.father)}<br>${escapeHtml(config.brideParents.mother)}</p>
            <p class="family__address">${escapeHtml(config.brideParents.address)}</p>
            <p class="family__child">Cô dâu ${escapeHtml(config.brideName)}</p>
          </article>
        </div>
        <p class="story">${escapeHtml(config.story)}</p>
      </div>`)}
${calendarSection(config)}
${sheet('schedule', 'schedule-sheet', `
      ${ornament('br')}
      <div class="container" data-parallax-speed="0">
        <span class="eyebrow">Lịch trình</span>
        <h2 class="section-title">Ngày vui của chúng mình</h2>
        <div class="events tickets tickets--single">${dayTicket(config)}</div>
      </div>`)}
${countdownSection(config, photos)}
${sheet('gallery', 'gallery-sheet', `
      ${ornament('tl')}
      <div class="container" data-parallax-speed="0">
        <span class="eyebrow">Album</span>
        <h2 class="section-title">Khoảnh khắc của chúng mình</h2>
        ${galleryHtml}
      </div>`)}
${rsvpCtaSection(config, photos, 'data-cta="rsvp-bottom"')}
${closingSection(config)}
</div>
</main>
<footer class="site-footer">${escapeHtml(config.groomName)} &amp; ${escapeHtml(config.brideName)} · ${escapeHtml(wedding.date)}</footer>`;

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
