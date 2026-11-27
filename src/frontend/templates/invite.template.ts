/** Trang Mời Cưới — dist/thiep-moi/index.html (personalized client-side from ?khach=<slug>, looked up in the DB-built guests-map.json). */
import { escapeHtml, jsonForScript } from '../../shared/html';
import { formatViDateTime } from '../../shared/date-format';
import { mapSeating, renderSeatingMapSvg } from '../../shared/seating-mapper';
import { FALLBACK_GUEST, type WeddingData } from '../../shared/types';
import { rebaseAssets, SUBPAGE_ROOT } from '../../shared/routes';
import { documentShell, eventCard, firstPhoto, ornament, variant } from './partials';
import { calendarSection, closingSection, countdownSection, envelopeScene, invitationCards, sheet } from './envelope.partials';

type PageData = Omit<WeddingData, 'guests'> & { builtAt?: string };

export function renderInvitePage(input: PageData): string {
  const data = rebaseAssets(input, SUBPAGE_ROOT);
  const { config, photos, seatingZones } = data;
  const hero = firstPhoto(photos, 'hero', 'gallery');
  const heroImg = hero ? variant(hero, 'lg') : undefined;
  const mainIso = config.reception.datetime || config.ceremony.datetime;
  const wedding = formatViDateTime(mainIso);
  const fallbackSeat = mapSeating(FALLBACK_GUEST, seatingZones);
  const publicData = { config, photos, seatingZones, seatingLayout: data.seatingLayout ?? null };
  const groom = escapeHtml(config.groomName);
  const bride = escapeHtml(config.brideName);

  const body = `
<main>
${envelopeScene(config, photos)}
<div class="paper-desk">
${sheet('invite-hero', 'sheet--pair', `
      <div class="container">
        ${invitationCards(config)}
        <div class="hero__actions">
          <a class="btn" href="#card">Lưu thiệp JPG</a>
          <a class="btn btn--navy" href="#seating">Xem chỗ ngồi</a>
        </div>
      </div>`)}
${calendarSection(config, SUBPAGE_ROOT)}
${countdownSection(config, photos)}
${sheet('events', 'schedule-sheet', `
      ${ornament('tl')}
      <div class="container" data-parallax-speed="0">
        <span class="eyebrow">Thông tin hôn lễ</span>
        <h2 class="section-title">Lịch trình</h2>
        <div class="events tickets">${eventCard(config.ceremony, config.googleMapsUrl)}${eventCard(config.reception, config.googleMapsUrl)}</div>
      </div>`)}
${sheet('seating', 'seating-sheet', `
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
      </div>`)}
${sheet('card', 'card-sheet', `
    <div class="container save-card">
      <div class="save-card__preview"><img alt="Thiệp mời cá nhân hoá" width="1080" height="1620"></div>
      <div>
        <span class="eyebrow" style="text-align:left">Thiệp mời của bạn</span>
        <h2 class="section-title" style="text-align:left">Lưu &amp; chia sẻ thiệp</h2>
        <p>Tải thiệp mời (ảnh JPG 1080×1620) về máy hoặc chia sẻ ngay qua Zalo, Messenger.</p>
        <div class="save-card__actions" style="margin-top:var(--space-sm)">
          <button class="btn" id="save-jpg" type="button">Lưu thiệp JPG</button>
          <button class="btn btn--navy" id="share-jpg" type="button">Chia sẻ thiệp</button>
        </div>
        <p class="save-card__status" role="status"></p>
      </div>
    </div>`)}
${closingSection(config)}
</div>
</main>
<footer class="site-footer">${groom} &amp; ${bride} · ${escapeHtml(wedding.date)}</footer>
<script type="application/json" id="wedding-data">${jsonForScript(publicData)}</script>`;

  return documentShell({
    config,
    title: `Thiệp mời · ${config.groomName} & ${config.brideName}`,
    description: `Trân trọng kính mời quý khách đến dự tiệc cưới ${config.groomName} & ${config.brideName} — ${wedding.weekday}, ${wedding.date}`,
    bodyClass: 'page-invite',
    script: 'invite.js',
    root: SUBPAGE_ROOT,
    ogImage: heroImg?.src ?? null,
    body,
  });
}
