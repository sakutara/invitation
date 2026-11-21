/** Trang Mời Cưới — dist/invite.html (personalized client-side from ?khach=<slug>, looked up in the DB-built guests-map.json). */
import { escapeHtml, jsonForScript } from '../../shared/html';
import { formatViDateTime } from '../../shared/date-format';
import { formatInvitation } from '../../shared/invitation-formatter';
import { mapSeating, renderSeatingMapSvg } from '../../shared/seating-mapper';
import { FALLBACK_GUEST, type WeddingData } from '../../shared/types';
import { documentShell, eventCard, firstPhoto, ornament, picture, variant } from './partials';

type PageData = Omit<WeddingData, 'guests'> & { builtAt?: string };

function illustratedMap(address: string, venue: string): string {
  return `<svg viewBox="0 0 640 400" role="img" aria-label="Bản đồ minh hoạ">
<rect width="640" height="400" fill="#F5EFE6"/>
<path d="M0 260 C160 230 220 300 360 270 S560 210 640 240" stroke="#E0F2FE" stroke-width="26" fill="none"/>
<g stroke="#FFFFFF" stroke-width="14" fill="none"><path d="M0 120 H640"/><path d="M180 0 V400"/><path d="M460 0 V400"/><path d="M0 330 L640 300"/></g>
<g stroke="#0F2042" stroke-opacity=".25" stroke-width="2" fill="none"><path d="M0 120 H640"/><path d="M180 0 V400"/><path d="M460 0 V400"/></g>
<circle cx="320" cy="190" r="46" fill="#7A1C24" fill-opacity=".14"/>
<path d="M320 120 c-26 0-44 19-44 43 0 32 44 75 44 75 s44-43 44-75 c0-24-18-43-44-43z" fill="#7A1C24"/><circle cx="320" cy="162" r="15" fill="#FDFBF7"/>
<text x="320" y="268" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#0F2042">${escapeHtml(venue)}</text>
<text x="320" y="296" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#4B5563">${escapeHtml(address)}</text></svg>`;
}

export function renderInvitePage(data: PageData): string {
  const { config, photos, seatingZones } = data;
  const hero = firstPhoto(photos, 'hero', 'gallery');
  const heroImg = hero ? variant(hero, 'lg') : undefined;
  const staticMap = firstPhoto(photos, 'static_map');
  const wedding = formatViDateTime(config.reception.datetime || config.ceremony.datetime);
  const fallbackSeat = mapSeating(FALLBACK_GUEST, seatingZones);
  const publicData = { config, photos, seatingZones, seatingLayout: data.seatingLayout ?? null };

  const body = `
<main>
  <section id="invite-hero" class="section parallax invite-hero">
    <div class="parallax__layer${hero ? '' : ' hero__fallback-bg'}" data-parallax-speed="0.25">${
      heroImg ? `<img src="${escapeHtml(heroImg.src)}" alt="" fetchpriority="high" width="${heroImg.width}" height="${heroImg.height}">` : ''
    }</div>
    ${ornament('tl')}${ornament('br')}
    <div class="container" style="display:grid;place-items:center">
      <article class="card invite-card" data-parallax-speed="0">
        <span class="eyebrow">Thiệp mời cưới</span>
        <span class="invite-card__badge badge--shared" data-role="guest-badge" hidden>Khách quý</span>
        <h1 class="invite-card__names">${escapeHtml(config.groomName)} &amp; ${escapeHtml(config.brideName)}</h1>
        <p class="invite-greeting" data-role="greeting">${escapeHtml(formatInvitation(FALLBACK_GUEST))}</p>
        <hr class="divider">
        <p class="invite-card__date">${escapeHtml(`${wedding.time} · ${wedding.weekday}, ${wedding.date}`)}</p>
        <div class="hero__actions">
          <a class="btn" href="#card">Lưu thiệp JPG</a>
          <a class="btn btn--navy" href="#seating">Xem chỗ ngồi</a>
        </div>
      </article>
    </div>
  </section>

  <section id="events" class="section parallax section--navy">
    ${ornament('tl')}
    <div class="container" data-parallax-speed="0">
      <span class="eyebrow">Thông tin hôn lễ</span>
      <h2 class="section-title">Lịch trình</h2>
      <div class="events">${eventCard(config.ceremony, config.googleMapsUrl)}${eventCard(config.reception, config.googleMapsUrl)}</div>
    </div>
  </section>

  <section id="directions" class="section">
    <div class="container">
      <span class="eyebrow">Chỉ đường</span>
      <h2 class="section-title">Đường đến tiệc cưới</h2>
      <div class="maps">
        <figure class="map-figure reveal" data-role="static-map">
          ${staticMap ? picture(staticMap, { sizes: '(max-width: 760px) 100vw, 50vw', alt: `Bản đồ đến ${config.reception.venueName}`, fallbackTier: 'md' }) : illustratedMap(config.reception.address, config.reception.venueName)}
          <figcaption>${escapeHtml(config.reception.venueName)} — ${escapeHtml(config.reception.address)}</figcaption>
        </figure>
        <figure class="map-figure reveal">
          ${config.googleMapsEmbedUrl ? `<iframe src="${escapeHtml(config.googleMapsEmbedUrl)}" title="Google Maps" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ''}
          <figcaption><a class="btn" data-role="google-maps" href="${escapeHtml(config.googleMapsUrl)}" target="_blank" rel="noopener">Mở Google Maps</a></figcaption>
        </figure>
      </div>
    </div>
  </section>

  <section id="seating" class="section section--cream parallax">
    ${ornament('br')}
    <div class="container" data-parallax-speed="0">
      <span class="eyebrow">Sơ đồ bàn tiệc</span>
      <h2 class="section-title" data-role="seating-title">Sơ đồ khu vực tiệc</h2>
      <div class="seating">
        <div class="seating__map">${renderSeatingMapSvg(seatingZones, { zoneId: null, layout: data.seatingLayout })}</div>
        <div class="seating__info" hidden>
          <p class="seating__zone" data-role="zone-name">${escapeHtml(fallbackSeat.zone.nameVi)}</p>
          <p class="seating__seats" style="background:${fallbackSeat.color}"><span data-role="seat-count">${fallbackSeat.seatCount}</span> chỗ ngồi</p>
          <p class="seating__guidance" data-role="seat-guidance">${escapeHtml(fallbackSeat.guidance)}</p>
        </div>
      </div>
    </div>
  </section>

  <section id="card" class="section">
    <div class="container save-card">
      <div class="save-card__preview"><img alt="Thiệp mời cá nhân hoá" width="1080" height="1620"></div>
      <div>
        <span class="eyebrow" style="text-align:left">Thiệp mời của bạn</span>
        <h2 class="section-title" style="text-align:left">Lưu &amp; chia sẻ thiệp</h2>
        <p>Tải thiệp mời (ảnh JPG 1080×1620) về máy hoặc chia sẻ ngay qua Zalo, Messenger.</p>
        <div class="save-card__actions" style="margin-top:var(--space-sm)">
          <button class="btn" id="save-jpg" type="button">Lưu thiệp JPG</button>
          <button class="btn btn--navy" id="share-jpg" type="button">Chia sẻ thiệp</button>
          <a class="btn btn--ghost" href="rsvp.html" style="color:var(--color-navy)">Xác nhận tham dự</a>
        </div>
        <p class="save-card__status" role="status"></p>
      </div>
    </div>
  </section>
</main>
<footer class="site-footer">${escapeHtml(config.groomName)} &amp; ${escapeHtml(config.brideName)} · ${escapeHtml(wedding.date)}</footer>
<script type="application/json" id="wedding-data">${jsonForScript(publicData)}</script>`;

  return documentShell({
    config,
    title: `Thiệp mời · ${config.groomName} & ${config.brideName}`,
    description: `Trân trọng kính mời quý khách đến dự tiệc cưới ${config.groomName} & ${config.brideName} — ${wedding.weekday}, ${wedding.date}`,
    bodyClass: 'page-invite',
    script: 'invite.js',
    ogImage: heroImg?.src ?? null,
    body,
  });
}
