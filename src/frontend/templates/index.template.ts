/** Trang Báo Hỉ — dist/index.html */
import { escapeHtml } from '../../shared/html';
import { formatViDateTime } from '../../shared/date-format';
import type { WeddingData } from '../../shared/types';
import { documentShell, eventCard, firstPhoto, ornament, picture, variant } from './partials';

type PageData = Omit<WeddingData, 'guests'> & { builtAt?: string };

export function renderIndexPage(data: PageData): string {
  const { config, photos } = data;
  const hero = firstPhoto(photos, 'hero', 'gallery');
  const storyBg = firstPhoto(photos, 'story');
  const gallery = photos.filter((p) => p.placement === 'gallery');
  const wedding = formatViDateTime(config.reception.datetime || config.ceremony.datetime);
  const heroImg = hero ? variant(hero, 'lg') : undefined;

  const galleryHtml = gallery.length
    ? `<div class="gallery">${gallery
        .map((p) => {
          const sm = variant(p, 'sm');
          const portrait = sm ? sm.height > sm.width : false;
          // Frame takes the real ratio of the stored crop, so object-fit never trims the admin's framing.
          const ratio = sm ? ` style="aspect-ratio: ${sm.width} / ${sm.height}"` : '';
          return `<figure class="gallery__item reveal${portrait ? ' gallery__item--portrait' : ''}"${ratio}>${picture(p, {
            sizes: '(max-width: 560px) 100vw, (max-width: 1200px) 50vw, 33vw',
          })}${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''}</figure>`;
        })
        .join('')}</div>`
    : `<p class="gallery__empty">Album ảnh cưới sẽ sớm được cập nhật.</p>`;

  const body = `
<main>
  <section id="hero" class="section parallax hero">
    <div class="parallax__layer${hero ? '' : ' hero__fallback-bg'}" data-parallax-speed="0.25">${
      heroImg ? `<img src="${escapeHtml(heroImg.src)}" alt="" fetchpriority="high" width="${heroImg.width}" height="${heroImg.height}">` : ''
    }</div>
    ${ornament('tl')}${ornament('br')}
    <div class="container" data-parallax-speed="0">
      <span class="eyebrow hero__eyebrow">Save the date</span>
      <h1 class="hero__names">${escapeHtml(config.groomName)}<span class="hero__amp">&amp;</span>${escapeHtml(config.brideName)}</h1>
      <p class="hero__date">${escapeHtml(`${wedding.weekday} · ${wedding.date}`)}</p>
      <p class="hero__headline">${escapeHtml(config.headline)}</p>
      <div class="hero__actions">
        <a class="btn" href="rsvp.html" data-cta="rsvp">Đăng ký tham dự</a>
        <a class="btn btn--ghost" href="#schedule">Xem lịch trình</a>
      </div>
    </div>
    <a class="hero__scroll" href="#story" aria-label="Cuộn xuống">CUỘN XUỐNG ↓</a>
  </section>

  <section id="story" class="section parallax section--cream">
    ${storyBg ? `<div class="parallax__layer" data-parallax-speed="0.25" style="opacity:.12">${picture(storyBg, { sizes: '100vw', alt: '' })}</div>` : ''}
    ${ornament('tl')}
    <div class="container" data-parallax-speed="0">
      <span class="eyebrow">Hai gia đình</span>
      <h2 class="section-title">Trân trọng báo tin</h2>
      <div class="families">
        <article class="card family family--groom reveal">
          <span class="family__side">Nhà trai</span>
          <p class="family__parents">${escapeHtml(config.groomParents.father)}<br>${escapeHtml(config.groomParents.mother)}</p>
          <p class="family__address">${escapeHtml(config.groomParents.address)}</p>
          <p class="family__child">Chú rể ${escapeHtml(config.groomName)}</p>
        </article>
        <article class="card family family--bride reveal">
          <span class="family__side">Nhà gái</span>
          <p class="family__parents">${escapeHtml(config.brideParents.father)}<br>${escapeHtml(config.brideParents.mother)}</p>
          <p class="family__address">${escapeHtml(config.brideParents.address)}</p>
          <p class="family__child">Cô dâu ${escapeHtml(config.brideName)}</p>
        </article>
      </div>
      <p class="story reveal">${escapeHtml(config.story)}</p>
    </div>
  </section>

  <section id="schedule" class="section parallax section--navy">
    ${ornament('br')}
    <div class="container" data-parallax-speed="0">
      <span class="eyebrow">Lịch trình</span>
      <h2 class="section-title">Ngày chung đôi</h2>
      <div class="events">
        ${eventCard(config.ceremony, config.googleMapsUrl)}
        ${eventCard(config.reception, config.googleMapsUrl)}
      </div>
    </div>
  </section>

  <section id="gallery" class="section parallax">
    ${ornament('tl')}
    <div class="container" data-parallax-speed="0">
      <span class="eyebrow">Album</span>
      <h2 class="section-title">Khoảnh khắc của chúng mình</h2>
      ${galleryHtml}
    </div>
  </section>

  <section id="rsvp-cta" class="section section--cream">
    <div class="container cta">
      <h2 class="section-title">Bạn sẽ đến chứ?</h2>
      <p>Hãy cho chúng mình biết bạn có thể tham dự để gia đình chuẩn bị chu đáo nhất nhé.</p>
      <a class="btn" href="rsvp.html" data-cta="rsvp-bottom">Đăng ký tham dự</a>
    </div>
  </section>
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
