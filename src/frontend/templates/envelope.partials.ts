/**
 * Building blocks shared by the announcement page (index.html) and the invitation (thiep-moi/):
 * the scroll-driven envelope scene (cover -> two sheets + a vinyl record slide out), the schedule section
 * (venues, times, heart calendar), countdown, and the letter envelope that closes the page.
 * Wording comes from config.invitation (resolveInvitation), photos from the CMS placements.
 */
import { escapeHtml } from '../../shared/html';
import { formatViDateTime } from '../../shared/date-format';
import { resolveInvitation } from '../../shared/default-config';
import { monthGrid, googleCalendarUrl, WEEKDAY_HEADERS_VI } from '../../shared/wedding-calendar';
import type { EventDetails, MusicTrack, PhotoRecord, WeddingConfig } from '../../shared/types';
import { blossom, bouquet, firstPhoto, floralSpray, ornament, picture, variant } from './partials';
import { lunarLine } from '../../shared/lunar-calendar';
import { PAGE_DIRS } from '../../shared/routes';
import { presenceLine } from '../../shared/invitation-formatter';

/** Envelope flap (triangle pointing down) with a soft highlight along its folded edges. */
export function flapSvg(cls: string, height = 180, width = 400): string {
  return `<svg class="${cls}" viewBox="0 0 ${width} ${height + 4}" preserveAspectRatio="none" aria-hidden="true">
<path class="flap__shape" d="M0 0 H${width} L${width / 2} ${height} Z"/>
<path class="flap__edge" d="M0 0 L${width / 2} ${height} L${width} 0"/></svg>`;
}

/** Front pocket of an open envelope (covers the bottom of what is tucked inside). `v` = depth of the V opening (0..280). */
export function pocketSvg(cls: string, v = 168): string {
  return `<svg class="${cls}" viewBox="0 0 400 280" preserveAspectRatio="none" aria-hidden="true">
<path class="pocket__shape" d="M0 0 L200 ${v} L400 0 V280 H0 Z"/>
<path class="pocket__fold" d="M0 280 L${200 - 22} ${v - 12} M400 280 L${200 + 22} ${v - 12}"/>
<path class="pocket__edge" d="M0 0 L200 ${v} L400 0"/></svg>`;
}

/** Cream wax seal with the couple monogram and a small sprig (closed envelope cover). */
export function waxSeal(monogram: string, cls = ''): string {
  return `<span class="wax-seal ${cls}" aria-hidden="true"><span class="wax-seal__inner">
<svg class="wax-seal__sprig" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M20 36 V10"/><path d="M20 18 c-6-2-9-7-8-12 c5 1 8 6 8 12z" fill="currentColor" fill-opacity=".25"/><path d="M20 24 c6-2 9-7 8-12 c-5 1-8 6-8 12z" fill="currentColor" fill-opacity=".25"/></svg>
<span class="wax-seal__mono">${escapeHtml(monogram)}</span></span></span>`;
}

const HEART_WAX = 'M50 90C44 85 30 76 19 64C8 52 3 41 5 29C7 16 17 7 30 7C39 7 46 12 50 19C54 12 61 7 70 7C83 7 93 16 95 29C97 41 92 52 81 64C70 76 56 85 50 90Z';
const HEART_RIM = 'M50 80C40 72 29 64 21 54C14 45 12 37 14 29C16 20 23 15 31 15C39 15 45 20 50 28C55 20 61 15 69 15C77 15 84 20 86 29C88 37 86 45 79 54C71 64 60 72 50 80Z';

/** Burgundy wax seal pressed in the shape of a heart, with the couple monogram. `key` keeps gradient ids unique. */
export function heartSeal(monogram: string, key: string, cls = ''): string {
  const id = `hs-${key}`;
  return `<span class="heart-seal ${cls}" aria-hidden="true"><svg viewBox="0 0 100 96">
<defs><radialGradient id="${id}" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#B8475A"/><stop offset=".45" stop-color="#8A2333"/><stop offset="1" stop-color="#4E0F1A"/></radialGradient></defs>
<path d="M50 94C42 92 26 82 14 68C3 55 -1 42 2 28C5 13 17 3 31 3C40 3 46 7 50 12C54 7 60 3 69 3C83 3 95 13 98 28C101 42 97 55 86 68C74 82 58 92 50 94Z" fill="#5A1220" opacity=".35"/>
<path d="${HEART_WAX}" fill="url(#${id})"/>
<path d="${HEART_RIM}" fill="none" stroke="#3E0A14" stroke-opacity=".45" stroke-width="2.2"/>
<path d="${HEART_RIM}" fill="none" stroke="#F6C9D1" stroke-opacity=".28" stroke-width="1" transform="translate(-.8 -1)"/>
<path d="M24 22C28 17 34 15 39 17" fill="none" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="2.4" stroke-linecap="round"/>
</svg><span class="heart-seal__mono">${escapeHtml(monogram)}</span></span>`;
}

/** Hand-drawn heart (pathLength=1 so CSS can draw it with --sp). */
const HEART_PATH = 'M50 86 C22 66 6 50 8 31 C10 15 24 8 36 11 C44 13 49 19 50 26 C52 17 59 10 69 10 C83 10 93 22 91 37 C89 55 72 70 50 86 Z';

function calendarBlock(iso: string, title: string, time: string): string {
  const g = monthGrid(iso);
  if (!g) return '';
  const cells = g.weeks
    .flat()
    .map((d) =>
      d === null
        ? '<span class="calendar__cell calendar__cell--empty"></span>'
        : d === g.day
          ? `<span class="calendar__cell calendar__cell--day" aria-current="date">${d}<svg class="calendar__heart" viewBox="0 0 100 96" aria-hidden="true"><path d="${HEART_PATH}" pathLength="1"/></svg></span>`
          : `<span class="calendar__cell">${d}</span>`,
    )
    .join('');
  return `<div class="calendar">
  <p class="calendar__title"><span class="script">${escapeHtml(title)}</span></p>
  <div class="calendar__page">
    <span class="calendar__rings" aria-hidden="true"></span>
    <p class="calendar__month">Tháng ${String(g.month).padStart(2, '0')} · ${g.year}</p>
    <div class="calendar__grid" role="grid" aria-label="Lịch tháng ${g.month}/${g.year}, ngày cưới ${g.day}">
      ${WEEKDAY_HEADERS_VI.map((w) => `<span class="calendar__wd">${w}</span>`).join('')}
      ${cells}
    </div>
    <p class="calendar__time">${escapeHtml(time)}</p>
  </div>
</div>`;
}

/** Variant + object-position from the photo's focal point (centre when none is set). */
function photoSrc(photo: PhotoRecord | null, tier: 'sm' | 'md' | 'lg' = 'md') {
  const v = photo ? variant(photo, tier) : undefined;
  if (!v) return undefined;
  const f = photo!.focalPoint;
  return { ...v, style: f ? ` style="object-position: ${Math.round(f.x * 100)}% ${Math.round(f.y * 100)}%"` : '' };
}

const mainIsoOf = (c: WeddingConfig) => c.reception.datetime || c.ceremony.datetime;

/** "VÀO LÚC 16:30 | CHỦ NHẬT 17.01.2027" block of the printed card. */
function whenTable(iso: string): string {
  const f = formatViDateTime(iso);
  return `<div class="pc-when">
        <div class="pc-when__cell"><span class="pc-when__label">Vào lúc</span><b class="pc-when__value">${escapeHtml(f.time)}</b></div>
        <div class="pc-when__cell"><span class="pc-when__label pc-when__label--accent">${escapeHtml(f.weekday)}</span><b class="pc-when__value">${escapeHtml(f.date.replace(/\//g, '.'))}</b></div>
      </div>`;
}

const venueOf = (e: EventDetails) => escapeHtml(e.venueName);
const addressOf = (e: EventDetails) => escapeHtml([e.hallName, e.address].filter(Boolean).join(' · '));

function parentsBlock(config: WeddingConfig): string {
  const parent = (side: string, p: WeddingConfig['groomParents']) =>
    `<div class="pc-parents__side"><span class="pc-parents__label">${side}:</span>${[p.father, p.mother]
      .filter(Boolean)
      .map((n) => `<span>${escapeHtml(n)}</span>`)
      .join('')}</div>`;
  return `<div class="pc-parents">${parent('Nhà Trai', config.groomParents)}${parent('Nhà Gái', config.brideParents)}</div>`;
}

/**
 * The wording sheet of the envelope. Invitation: guest line, party venue and time, presence line, both families
 * ([data-role="guest-name"] / [data-role="presence"] are personalised by scripts/invite.ts).
 * Announcement: the news, the couple and the date only.
 */
function letterSheet(config: WeddingConfig, announce: boolean): string {
  const inv = resolveInvitation(config);
  const r = config.reception;
  const names = `<p class="pc-names script">${escapeHtml(config.groomName)}<span class="pc-names__amp">&amp;</span>${escapeHtml(config.brideName)}</p>`;
  if (announce) {
    const c = config.ceremony;
    const iso = c.datetime || mainIsoOf(config);
    return `<article class="env-sheet env-sheet--letter env-sheet--announce paper-card paper-card--main" aria-label="Lời báo hỉ">
        <div class="env-sheet__paper">
          ${floralSpray('paper-card__floral paper-card__floral--bl')}
          <p class="pc-caps">${escapeHtml(config.headline)}</p>
          <p class="pc-caps pc-caps--sm">của chúng mình</p>
          ${names}
          <p class="pc-caps pc-caps--sm">Hôn lễ được cử hành tại</p>
          <p class="pc-venue">${venueOf(c)}</p>
          <p class="pc-address">${addressOf(c)}</p>
          ${whenTable(iso)}
          <p class="pc-lunar">${escapeHtml(lunarLine(iso))}</p>
          <p class="pc-presence script">${escapeHtml(inv.scriptHeadline)}</p>
        </div>
      </article>`;
  }
  return `<article class="env-sheet env-sheet--letter paper-card paper-card--main" aria-label="Lời mời">
        <div class="env-sheet__paper">
          ${floralSpray('paper-card__floral paper-card__floral--bl')}
          <span class="invite-card__badge badge--shared" data-role="guest-badge" hidden>Khách quý</span>
          <h2 class="pc-caps">${escapeHtml(inv.joinLine)}</h2>
          <p class="pc-guest" data-role="guest-name">Quý khách</p>
          <p class="pc-caps pc-caps--sm">${escapeHtml(inv.inviteLine)}</p>
          ${names}
          <p class="pc-caps">Được tổ chức tại</p>
          <p class="pc-venue">${venueOf(r)}</p>
          <p class="pc-address">${addressOf(r)}</p>
          ${whenTable(r.datetime)}
          <p class="pc-lunar">${escapeHtml(lunarLine(r.datetime))}</p>
          <p class="pc-presence script" data-role="presence" data-template="${escapeHtml(inv.presenceLine)}">${escapeHtml(presenceLine(inv.presenceLine, null))}</p>
          ${parentsBlock(config)}
        </div>
      </article>`;
}

/** Spinning record (also the play/pause button when there is music). */
function vinyl(monogram: string, hasMusic: boolean): string {
  const tag = hasMusic ? 'button' : 'span';
  const attrs = hasMusic ? ' type="button" data-role="music-toggle" aria-label="Bật / tắt nhạc" aria-pressed="false"' : ' aria-hidden="true"';
  return `<${tag} class="vinyl"${attrs}>
          <span class="vinyl__disc"><span class="vinyl__label"><span class="vinyl__mono">${escapeHtml(monogram)}</span></span></span>
          <svg class="vinyl__waves" viewBox="0 0 120 120" aria-hidden="true"><path d="M70 30a34 34 0 0 1 0 60"/><path d="M80 18a50 50 0 0 1 0 84"/><path d="M90 6a66 66 0 0 1 0 108"/></svg>
        </${tag}>`;
}

/**
 * Sticky scroll scene. The closed envelope cover lifts away; the envelope (date and heart seal on its front)
 * opens; two sheets — the photo and the wording — slide out together with a vinyl record, fan out, then come
 * forward to be read while the envelope sinks away. Every step follows the (smoothed) scroll position.
 * `kind`: 'invite' (thiep-moi/: "Thiệp Mời" + guest line) or 'announce' (index.html: "Báo Hỉ").
 */
export function envelopeScene(config: WeddingConfig, photos: PhotoRecord[], opts: { headingTag?: 'h1' | 'p'; kind?: 'invite' | 'announce'; hasMusic?: boolean } = {}): string {
  const inv = resolveInvitation(config);
  const announce = opts.kind === 'announce';
  const [dd, mm, yyyy] = formatViDateTime(mainIsoOf(config)).date.split('/');
  const tag = opts.headingTag ?? 'h1';
  const letterPhoto = photoSrc(firstPhoto(photos, 'invite_portrait', 'hero', 'gallery'), 'md');
  const groom = escapeHtml(config.groomName);
  const bride = escapeHtml(config.brideName);
  return `
  <section id="envelope" class="envelope-scene" data-scroll-scene aria-label="${announce ? 'Báo hỉ' : 'Thiệp mời'}">
    <div class="envelope-scene__sticky">
      <div class="scene">
        ${floralSpray('scene__floral scene__floral--tl', '', 'v')}${blossom('scene__blossom', 'lavender')}
        <div class="env-part envelope__back"></div>
        ${flapSvg('env-part envelope__flap')}
        ${vinyl(inv.monogram, !!opts.hasMusic)}
        <article class="env-sheet env-sheet--photo letter-card" aria-label="Ảnh cưới">
          <div class="env-sheet__paper">
            <figure class="letter-card__arch">
              <span class="letter-card__title script">${escapeHtml(announce ? inv.announceArchTitle : inv.archTitle)}</span>
              ${letterPhoto ? `<img src="${escapeHtml(letterPhoto.src)}" alt="${groom} &amp; ${bride}" width="${letterPhoto.width}" height="${letterPhoto.height}" decoding="async"${letterPhoto.style}>` : `<span class="letter-card__fallback script">${escapeHtml(inv.monogram)}</span>`}
            </figure>
            <p class="letter-card__names">${groom} <span class="script">&amp;</span> ${bride}</p>
          </div>
        </article>
        ${letterSheet(config, announce)}
        ${pocketSvg('env-part envelope__pocket', 112)}
        <div class="env-part envelope__front">
          <p class="envelope__date"><span>${escapeHtml(dd ?? '')}</span><i aria-hidden="true">·</i><span>${escapeHtml(mm ?? '')}</span><i aria-hidden="true">·</i><span>${escapeHtml(yyyy ?? '')}</span></p>
          ${heartSeal(inv.monogram, 'env', 'envelope__seal')}
        </div>
      </div>

      <div class="envelope-cover">
        <div class="envelope-cover__paper"></div>
        ${flapSvg('envelope-cover__flap envelope-cover__flap--tall', 170)}${flapSvg('envelope-cover__flap envelope-cover__flap--wide', 170, 1100)}
        <div class="envelope-cover__text">
          <span class="envelope-cover__eyebrow">${escapeHtml(inv.coverEyebrow)}</span>
          <${tag} class="envelope-cover__names"><span>${groom}</span><span class="envelope-cover__amp script">&amp;</span><span>${bride}</span></${tag}>
        </div>
        ${floralSpray('envelope-cover__floral')}
        <button class="envelope-cover__seal" type="button" data-role="open-envelope" aria-label="Mở thiệp">${waxSeal(inv.monogram)}</button>
        <p class="envelope-cover__hint">${escapeHtml(inv.openHint)}<span aria-hidden="true">⌄</span></p>
      </div>
    </div>
  </section>`;
}

/** Caption under the scene ("Khoảnh khắc ấy đã đến…") with the page's main buttons. */
export function sceneLead(config: WeddingConfig, actions: string): string {
  const inv = resolveInvitation(config);
  return `
  <section id="hero" class="section scene-lead" data-scroll-progress data-scroll-span="0.8">
    <div class="container envelope-caption">
      <p class="envelope-caption__moment rise" style="--d:0">${escapeHtml(inv.momentLine)}</p>
      <p class="envelope-caption__script script rise" style="--d:.08">${escapeHtml(inv.scriptHeadline)}</p>
      <div class="hero__actions rise" style="--d:.16">${actions}</div>
    </div>
  </section>`;
}

/** One stop of the day: time, ceremony/party, venue and address, directions (+ map preview on the invitation). */
function scheduleItem(e: EventDetails, mapsUrl: string, withMap: boolean, i: number): string {
  const f = formatViDateTime(e.datetime);
  const href = escapeHtml(e.mapsUrl || mapsUrl);
  const venue = escapeHtml(e.venueName);
  const largeSrc = escapeHtml(e.mapPreviewLargeSrc || e.mapPreviewSrc || '');
  const map =
    withMap && e.mapPreviewSrc
      ? `<a class="event__map" href="${href}" target="_blank" rel="noopener" aria-label="Xem bản đồ đến ${venue}" data-map-popup data-map-large="${largeSrc}" data-maps-url="${href}" data-map-title="${venue}" data-map-address="${escapeHtml(e.address)}"><img src="${escapeHtml(e.mapPreviewSrc)}" alt="Bản đồ đến ${venue}" width="800" height="400" loading="lazy" decoding="async"></a>`
      : '';
  return `<article class="event sched-item rise" style="--d:${0.12 + i * 0.1}">
          <p class="sched-item__time">${escapeHtml(f.time)}</p>
          <div class="sched-item__body">
            <h3 class="sched-item__title script">${escapeHtml(e.title)}</h3>
            <p class="event__date">${escapeHtml(`${f.weekday}, ${f.date}`)}</p>
            <p class="sched-item__lunar">${escapeHtml(lunarLine(e.datetime))}</p>
            <p class="event__venue">${venue}${e.hallName ? ` · ${escapeHtml(e.hallName)}` : ''}</p>
            <p class="event__address">${escapeHtml(e.address)}</p>
            ${map}<a class="sched-item__link" href="${href}" target="_blank" rel="noopener">Chỉ đường Google Maps <span aria-hidden="true">↗</span></a>
          </div>
        </article>`;
}

/** Postmark-style circle naming the party venue. */
function venueStamp(config: WeddingConfig): string {
  const r = config.reception;
  const [dd, mm, yyyy] = formatViDateTime(r.datetime || mainIsoOf(config)).date.split('/');
  const city = resolveInvitation(config).place;
  return `<div class="venue-stamp rise" style="--d:0">
          <svg class="venue-stamp__ring" viewBox="0 0 200 200" aria-hidden="true">
            <defs><path id="vs-top" d="M34 100a66 66 0 0 1 132 0"/><path id="vs-bot" d="M26 100a74 74 0 0 0 148 0"/></defs>
            <circle cx="100" cy="100" r="96"/><circle cx="100" cy="100" r="88" class="venue-stamp__dash"/><circle cx="100" cy="100" r="58"/>
            <text><textPath href="#vs-top" startOffset="50%" text-anchor="middle">Địa điểm tiệc cưới</textPath></text>
            <text><textPath href="#vs-bot" startOffset="50%" text-anchor="middle">${escapeHtml([dd, mm, yyyy].filter(Boolean).join(' · '))}${city ? ` ✦ ${escapeHtml(city)}` : ''}</textPath></text>
          </svg>
          <p class="venue-stamp__inner"><span class="venue-stamp__name">${venueOf(r)}</span>${r.hallName ? `<span class="venue-stamp__hall">${escapeHtml(r.hallName)}</span>` : ''}</p>
        </div>`;
}

/**
 * "Lịch trình" section: venue stamp and the two stops of the day beside the heart calendar, with a bouquet,
 * a tilted photo print and a blossom around them. `withMaps` adds the map previews (invitation only).
 */
export function scheduleSection(config: WeddingConfig, photos: PhotoRecord[], opts: { root?: string; withMaps?: boolean; id?: string } = {}): string {
  const root = opts.root ?? '';
  const inv = resolveInvitation(config);
  const mainIso = mainIsoOf(config);
  const wedding = formatViDateTime(mainIso);
  const yyyy = wedding.date.split('/')[2];
  const gcal = googleCalendarUrl(config, config.reception);
  const events = [config.ceremony, config.reception].filter((e) => e.datetime);
  const print = photoSrc(firstPhoto(photos, 'story', 'gallery', 'hero'), 'sm');
  return `
  <section id="${opts.id ?? 'schedule'}" class="section schedule-section" data-scroll-progress data-scroll-span="1.1">
    ${ornament('tl')}
    <div class="container schedule">
      <div class="schedule__venue">${venueStamp(config)}</div>
      <div class="schedule__list">
        <span class="eyebrow rise" style="--d:.04">Lịch trình</span>
        <h2 class="section-title rise" style="--d:.08">Ngày vui của chúng mình</h2>
        <div class="events">${events.map((e, i) => scheduleItem(e, config.googleMapsUrl, !!opts.withMaps, i)).join('')}</div>
      </div>
      <div class="schedule__bouquet">${bouquet('schedule__bouquet-svg')}</div>
      <div id="calendar" class="schedule__calendar" data-scroll-progress data-scroll-span="0.85">
        ${calendarBlock(mainIso, inv.calendarTitle, wedding.weekday)}
        <div class="calendar__actions">
          <a class="btn" href="${root}assets/data/wedding.ics" download="dam-cuoi-${escapeHtml(yyyy ?? '')}.ics" data-role="add-calendar">Thêm vào lịch</a>
          ${gcal ? `<a class="btn btn--ghost btn--ink" href="${escapeHtml(gcal)}" target="_blank" rel="noopener">Google Calendar</a>` : ''}
        </div>
        ${blossom('schedule__blossom', 'blue')}
      </div>
      <figure class="schedule__photo photo-print${print ? '' : ' photo-print--empty'}">
        <span class="photo-print__tape photo-print__tape--l" aria-hidden="true"></span>
        <div class="photo-print__frame">${print ? `<img src="${escapeHtml(print.src)}" alt="" width="${print.width}" height="${print.height}" loading="lazy" decoding="async"${print.style}>` : `<span class="letter-card__fallback script">${escapeHtml(inv.monogram)}</span>`}</div>
      </figure>
    </div>
  </section>`;
}

/** Postage-stamp card of one family side. */
function familyStamp(side: 'groom' | 'bride', p: WeddingConfig['groomParents'], child: string, value: string): string {
  const label = side === 'groom' ? 'Nhà Trai' : 'Nhà Gái';
  return `<article class="stamp stamp--${side} family family--${side}">
          <div class="stamp__paper">
            <div class="stamp__art"><span class="stamp__side script">${label}</span><span class="stamp__value">${escapeHtml(value)}</span></div>
            <span class="family__side">${label}</span>
            <p class="family__parents">${escapeHtml(p.father)}<br>${escapeHtml(p.mother)}</p>
            <p class="family__address">${escapeHtml(p.address)}</p>
            <p class="family__child">${side === 'groom' ? 'Chú rể' : 'Cô dâu'} ${escapeHtml(child)}</p>
          </div>
        </article>`;
}

/** Nhà trai / nhà gái as two postage stamps, set off from each other, with blossoms (announcement page). */
export function familiesSection(config: WeddingConfig): string {
  const [dd, mm] = formatViDateTime(mainIsoOf(config)).date.split('/');
  const value = [dd, mm].filter(Boolean).join('.');
  return `
  <section id="family" class="section family-section" data-scroll-progress data-scroll-span="1.2">
    <div class="container">
      <span class="eyebrow rise" style="--d:0">Nhà trai · Nhà gái</span>
      <h2 class="section-title rise" style="--d:.05">Hai bên gia đình</h2>
      <div class="families">
        ${familyStamp('groom', config.groomParents, config.groomName, value)}
        ${blossom('families__blossom families__blossom--a', 'blue')}
        ${blossom('families__blossom families__blossom--b', 'wine')}
        ${familyStamp('bride', config.brideParents, config.brideName, value)}
      </div>
    </div>
  </section>`;
}

/** Our story over a background photo, followed by the album frames (announcement page). */
export function storySection(config: WeddingConfig, photos: PhotoRecord[], galleryHtml: string): string {
  const bg = firstPhoto(photos, 'story');
  return `
  <section id="story" class="section story-section parallax" data-scroll-progress data-scroll-span="1">
    <div class="parallax__layer story-section__bg" data-parallax-speed="0.25">${bg ? picture(bg, { sizes: '100vw', alt: '', fallbackTier: 'md' }) : ''}</div>
    ${ornament('br')}
    <div class="container story-wrap" data-parallax-speed="0">
      <span class="eyebrow rise" style="--d:0">Our story</span>
      <h2 class="section-title script story-title rise" style="--d:.05">Chuyện của chúng mình</h2>
      <p class="story rise" style="--d:.12">${escapeHtml(config.story)}</p>
    </div>
    <div id="gallery" class="container gallery-wrap">${galleryHtml}</div>
  </section>`;
}

/** Countdown on a hanging tag over a slow photo. */
export function countdownSection(config: WeddingConfig, photos: PhotoRecord[]): string {
  const inv = resolveInvitation(config);
  const moodPhoto = firstPhoto(photos, 'story', 'gallery', 'hero');
  const firstIso = [config.ceremony.datetime, config.reception.datetime].filter(Boolean).sort()[0] ?? mainIsoOf(config);
  return `
  <section id="countdown" class="section parallax countdown-section" data-scroll-progress data-scroll-span="1">
      <div class="parallax__layer${moodPhoto ? '' : ' hero__fallback-bg'}" data-parallax-speed="0.25">${moodPhoto ? picture(moodPhoto, { sizes: '100vw', alt: '', fallbackTier: 'md' }) : ''}</div>
      <div class="hang-tag countdown" data-role="countdown" data-target="${escapeHtml(firstIso)}">
        <span class="hang-tag__hole" aria-hidden="true"></span>
        <div class="countdown__grid" role="timer" aria-live="off">
          ${(['days', 'hours', 'minutes', 'seconds'] as const)
            .map((u, i) => `${i ? '<span class="countdown__sep" aria-hidden="true">:</span>' : ''}<span class="countdown__unit"><span class="countdown__num" data-unit="${u}">--</span><span class="countdown__label">${{ days: 'Ngày', hours: 'Giờ', minutes: 'Phút', seconds: 'Giây' }[u]}</span></span>`)
            .join('')}
        </div>
        <p class="countdown__title script" data-role="countdown-title" data-done="${escapeHtml(inv.countdownDoneText)}">${escapeHtml(inv.countdownTitle)}</p>
      </div>
  </section>`;
}

/** An open envelope with a card standing in it (rises out as the section scrolls in) and the heart seal on its front. */
function letterEnvelope(card: string, monogram: string, key: string): string {
  return `<div class="letter-env">
          <span class="letter-env__back" aria-hidden="true"></span>
          ${flapSvg('letter-env__flap', 150)}
          ${card}
          ${pocketSvg('letter-env__pocket', 120)}
          ${heartSeal(monogram, key, 'letter-env__seal')}
        </div>`;
}

function closingCard(config: WeddingConfig): string {
  const inv = resolveInvitation(config);
  return `<span class="eyebrow">${escapeHtml(inv.closingTitle)}</span>
            <p class="closing-card__note">${escapeHtml(inv.closingNote)}</p>
            ${inv.contact ? `<p class="closing-card__contact">${escapeHtml(inv.contact)}</p>` : ''}`;
}

/** "Hồi âm": the reply card in its envelope, with the closing note under it (announcement page). */
export function rsvpCtaSection(config: WeddingConfig, linkAttrs = ''): string {
  const inv = resolveInvitation(config);
  const card = `<div class="letter-env__card rsvp-cta__panel">
            <span class="eyebrow">Thiệp hồi âm</span>
            <h2 class="rsvp-cta__title script">${escapeHtml(inv.rsvpTitle)}</h2>
            <p class="rsvp-cta__note">${escapeHtml(inv.rsvpNote)}</p>
            <a class="btn" href="${PAGE_DIRS.rsvp}" ${linkAttrs}>Xác nhận tham dự</a>
          </div>`;
  return `
  <section id="rsvp-cta" class="section reply-section" data-scroll-progress data-scroll-span="1.1">
    ${floralSpray('reply-section__floral reply-section__floral--l')}${floralSpray('reply-section__floral reply-section__floral--r', '', 'h')}
    <div class="container reply-wrap">
      ${letterEnvelope(card, inv.monogram, 'reply')}
      <div id="closing" class="closing-card closing-note rise" style="--d:.55">${closingCard(config)}</div>
    </div>
  </section>`;
}

/** Closing card in its envelope (invitation page). */
export function closingSection(config: WeddingConfig): string {
  const inv = resolveInvitation(config);
  const card = `<div class="letter-env__card closing-card">${closingCard(config)}</div>`;
  return `
  <section id="closing" class="section reply-section" data-scroll-progress data-scroll-span="1.1">
    ${floralSpray('reply-section__floral reply-section__floral--l')}${floralSpray('reply-section__floral reply-section__floral--r', '', 'h')}
    <div class="container reply-wrap">${letterEnvelope(card, inv.monogram, 'closing')}</div>
  </section>`;
}

/** Background music: the playlist for scripts/music.ts and a floating record button. */
export function musicPlayer(playlist: MusicTrack[] | undefined, root = ''): string {
  const tracks = (playlist ?? []).map((t) => ({ title: t.title, src: root + t.src }));
  if (!tracks.length) return '';
  return `<script type="application/json" id="music-data">${JSON.stringify(tracks).replace(/</g, '\\u003c')}</script>
<button class="music-fab" type="button" data-role="music-toggle" aria-label="Bật / tắt nhạc" aria-pressed="false"><span class="music-fab__disc" aria-hidden="true"></span><span class="music-fab__note" aria-hidden="true">♪</span></button>`;
}
