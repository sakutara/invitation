/**
 * Envelope invitation blocks shared by index.html and invite.html: the scroll-driven envelope scene,
 * heart calendar, countdown, RSVP call-to-action and closing lace card. Wording comes from
 * config.invitation (resolveInvitation), photos from the CMS placements.
 */
import { escapeHtml } from '../../shared/html';
import { formatViDateTime } from '../../shared/date-format';
import { resolveInvitation } from '../../shared/default-config';
import { monthGrid, googleCalendarUrl, WEEKDAY_HEADERS_VI } from '../../shared/wedding-calendar';
import type { PhotoRecord, WeddingConfig } from '../../shared/types';
import { firstPhoto, floralSpray, ornament, picture, variant } from './partials';
import { lunarLine } from '../../shared/lunar-calendar';
import { PAGE_DIRS } from '../../shared/routes';
import { presenceLine } from '../../shared/invitation-formatter';
import type { EventDetails } from '../../shared/types';

/** Envelope flap (triangle pointing down) with a soft highlight along its folded edges. */
export function flapSvg(cls: string, height = 180, width = 400): string {
  return `<svg class="${cls}" viewBox="0 0 ${width} ${height + 4}" preserveAspectRatio="none" aria-hidden="true">
<path class="flap__shape" d="M0 0 H${width} L${width / 2} ${height} Z"/>
<path class="flap__edge" d="M0 0 L${width / 2} ${height} L${width} 0"/></svg>`;
}

/** Front pocket of an open envelope (covers the bottom of what is tucked inside). */
export function pocketSvg(cls: string): string {
  return `<svg class="${cls}" viewBox="0 0 400 280" preserveAspectRatio="none" aria-hidden="true">
<path class="pocket__shape" d="M0 0 L200 168 L400 0 V280 H0 Z"/>
<path class="pocket__fold" d="M0 280 L178 156 M400 280 L222 156"/>
<path class="pocket__edge" d="M0 0 L200 168 L400 0"/></svg>`;
}
const POCKET_SVG = pocketSvg('envelope__pocket');

/** Cream wax seal with the couple monogram and a small sprig. */
export function waxSeal(monogram: string, cls = ''): string {
  return `<span class="wax-seal ${cls}" aria-hidden="true"><span class="wax-seal__inner">
<svg class="wax-seal__sprig" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M20 36 V10"/><path d="M20 18 c-6-2-9-7-8-12 c5 1 8 6 8 12z" fill="currentColor" fill-opacity=".25"/><path d="M20 24 c6-2 9-7 8-12 c-5 1-8 6-8 12z" fill="currentColor" fill-opacity=".25"/></svg>
<span class="wax-seal__mono">${escapeHtml(monogram)}</span></span></span>`;
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
  return `<div class="calendar" data-scroll-progress data-scroll-span="0.85">
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

/** Sticky scroll scene: closed envelope cover -> flap opens -> photo + save-the-date slide out. */
/** `kind`: 'invite' (invite.html: "Thiệp Mời" + guest line) or 'announce' (index.html: "Báo Hỉ" + the date, no invitation line). */
export function envelopeScene(config: WeddingConfig, photos: PhotoRecord[], opts: { headingTag?: 'h1' | 'p'; kind?: 'invite' | 'announce' } = {}): string {
  const inv = resolveInvitation(config);
  const announce = opts.kind === 'announce';
  const [dd, mm, yyyy] = formatViDateTime(mainIsoOf(config)).date.split('/');
  const tag = opts.headingTag ?? 'h1';
  const letterPhoto = photoSrc(firstPhoto(photos, 'invite_portrait', 'hero', 'gallery'), 'md');
  const groom = escapeHtml(config.groomName);
  const bride = escapeHtml(config.brideName);
  return `
  <section id="envelope" class="envelope-scene" data-scroll-scene aria-label="Thiệp mời">
    <div class="envelope-scene__sticky">
      <div class="envelope-stage">
        <div class="envelope">
          <div class="envelope__back"></div>
          ${flapSvg('envelope__flap')}
          <article class="envelope__letter letter-card">
            <div class="letter-card__paper">
              ${floralSpray('letter-card__floral letter-card__floral--l')}${floralSpray('letter-card__floral letter-card__floral--r', '', 'h')}
              <figure class="letter-card__arch">
                <span class="letter-card__title script">${escapeHtml(announce ? inv.announceArchTitle : inv.archTitle)}</span>
                ${letterPhoto ? `<img src="${escapeHtml(letterPhoto.src)}" alt="${groom} &amp; ${bride}" width="${letterPhoto.width}" height="${letterPhoto.height}" decoding="async"${letterPhoto.style}>` : `<span class="letter-card__fallback script">${escapeHtml(inv.monogram)}</span>`}
              </figure>
              ${
                announce
                  ? `<p class="letter-card__date">${escapeHtml(dd && mm && yyyy ? `${dd} · ${mm} · ${yyyy}` : '')}</p>`
                  : `<p class="letter-card__invite">${escapeHtml(inv.joinLine)}</p>
              <p class="letter-card__guest" data-role="guest-name"></p>`
              }
            </div>
          </article>
          ${POCKET_SVG}
          ${waxSeal(inv.monogram, 'envelope__seal')}
        </div>
        <div class="envelope-caption">
          <p class="envelope-caption__moment">${escapeHtml(inv.momentLine)}</p>
          <p class="envelope-caption__script script">${escapeHtml(inv.scriptHeadline)}</p>
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

/** "VÀO LÚC 16:30 | CHỦ NHẬT 17.01.2027" block of the printed card. */
function whenTable(iso: string): string {
  const f = formatViDateTime(iso);
  return `<div class="pc-when">
        <div class="pc-when__cell"><span class="pc-when__label">Vào lúc</span><b class="pc-when__value">${escapeHtml(f.time)}</b></div>
        <div class="pc-when__cell"><span class="pc-when__label pc-when__label--accent">${escapeHtml(f.weekday)}</span><b class="pc-when__value">${escapeHtml(f.date.replace(/\//g, '.'))}</b></div>
      </div>`;
}

/** Monogram ("TC") inside a hand-drawn ring of leaves, open at the top right like the printed card. */
function monogramWreath(monogram: string): string {
  const leaves = Array.from({ length: 22 }, (_, i) => {
    const a = -20 + i * 14;
    const flip = i % 2 ? -1 : 1;
    return `<path d="M0 -46 c${3 * flip} -7 ${9 * flip} -9 ${14 * flip} -7 c${-3 * flip} 6 ${-8 * flip} 8 ${-14 * flip} 7z" transform="rotate(${a})"/>`;
  }).join('');
  return `<div class="pc-wreath" aria-hidden="true"><svg viewBox="-60 -60 120 120"><path class="pc-wreath__ring" d="M-12 -45 A46 46 0 1 0 30 -35"/><g class="pc-wreath__leaves">${leaves}</g></svg>
        <span class="pc-wreath__mono script">${escapeHtml(monogram.replace(/\s*&\s*/g, ''))}</span></div>`;
}

const venueOf = (e: EventDetails) => escapeHtml(e.venueName);
const addressOf = (e: EventDetails) => escapeHtml([e.hallName, e.address].filter(Boolean).join(' · '));

/**
 * The pair of printed-style cards of invite.html: the party invitation (left) and the ceremony card (right).
 * [data-role="guest-name"] and [data-role="presence"] are personalised by scripts/invite.ts.
 */
export function invitationCards(config: WeddingConfig): string {
  const inv = resolveInvitation(config);
  const r = config.reception;
  const c = config.ceremony;
  const parent = (side: string, p: WeddingConfig['groomParents']) =>
    `<div class="pc-parents__side"><span class="pc-parents__label">${side}:</span>${[p.father, p.mother]
      .filter(Boolean)
      .map((n) => `<span>${escapeHtml(n)}</span>`)
      .join('')}</div>`;
  return `<div class="card-pair">
      <article class="paper-card paper-card--main" data-scroll-progress data-scroll-span="0.9">
        ${floralSpray('paper-card__floral paper-card__floral--bl')}
        <span class="invite-card__badge badge--shared" data-role="guest-badge" hidden>Khách quý</span>
        <h2 class="pc-caps rise" style="--d:0">${escapeHtml(inv.joinLine)}</h2>
        <p class="pc-guest rise" style="--d:.05" data-role="guest-name">Quý khách</p>
        <p class="pc-caps pc-caps--sm rise" style="--d:.1">${escapeHtml(inv.inviteLine)}</p>
        <p class="pc-names script rise" style="--d:.16">${escapeHtml(config.groomName)}<span class="pc-names__amp">&amp;</span>${escapeHtml(config.brideName)}</p>
        <p class="pc-caps rise" style="--d:.22">Được tổ chức tại</p>
        <p class="pc-venue rise" style="--d:.25">${venueOf(r)}</p>
        <p class="pc-address rise" style="--d:.28">${addressOf(r)}</p>
        <div class="rise" style="--d:.32">${whenTable(r.datetime)}</div>
        <p class="pc-lunar rise" style="--d:.36">${escapeHtml(lunarLine(r.datetime))}</p>
        <p class="pc-presence script rise" style="--d:.4" data-role="presence" data-template="${escapeHtml(inv.presenceLine)}">${escapeHtml(presenceLine(inv.presenceLine, null))}</p>
        <div class="pc-parents rise" style="--d:.46">${parent('Nhà Trai', config.groomParents)}${parent('Nhà Gái', config.brideParents)}</div>
      </article>
      <article class="paper-card paper-card--ceremony">
        ${floralSpray('paper-card__floral paper-card__floral--tr', '', 'both')}
        ${monogramWreath(inv.monogram)}
        <h2 class="pc-title script">${escapeHtml(c.title)}</h2>
        <p class="pc-caps">Được tổ chức tại</p>
        <p class="pc-venue">${venueOf(c)}</p>
        <p class="pc-address">${addressOf(c)}</p>
        ${whenTable(c.datetime)}
        <p class="pc-lunar">${escapeHtml(lunarLine(c.datetime))}</p>
        <p class="pc-presence script">${escapeHtml(inv.ceremonyWelcome)}</p>
      </article>
    </div>`;
}

/**
 * index.html schedule: only the wedding day(s) and city(ies), no event names, times or venues.
 * Both events normally share one day; different days/cities are each listed.
 */
export function dayTicket(config: WeddingConfig): string {
  const events = [config.ceremony, config.reception].filter((e) => e.datetime);
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  const days = uniq(events.map((e) => { const f = formatViDateTime(e.datetime); return `${f.weekday}|${f.date}`; }));
  const cities = uniq(events.map((e) => e.address.split(',').pop()?.trim() ?? ''));
  return `<article class="card event event--day">
          <span class="eyebrow">Ngày cưới</span>
          ${days
            .map((d) => {
              const [weekday, date] = d.split('|');
              return `<p class="event__weekday">${escapeHtml(weekday)}</p><p class="event__time">${escapeHtml(date.replace(/\//g, '.'))}</p>`;
            })
            .join('')}
          ${cities.length ? `<hr class="divider"><p class="event__city">${cities.map(escapeHtml).join(' · ')}</p>` : ''}
        </article>`;
}

/** One invitation sheet of the card stack (transitions in scripts/sheet-stack.ts + main.css). */
export function sheet(id: string, sheetClass: string, inner: string): string {
  return `
  <section id="${id}" class="sheet-section" data-sheet>
    <div class="sheet section parallax ${sheetClass}">${inner}
    </div>
  </section>`;
}

export function calendarSection(config: WeddingConfig, root = ''): string {
  const inv = resolveInvitation(config);
  const mainIso = mainIsoOf(config);
  const wedding = formatViDateTime(mainIso);
  const yyyy = wedding.date.split('/')[2];
  const gcal = googleCalendarUrl(config, config.reception);
  return sheet('calendar', 'calendar-sheet', `
      ${ornament('tl')}
      <div class="container calendar-wrap" data-parallax-speed="0">
        ${calendarBlock(mainIso, inv.calendarTitle, wedding.weekday)}
        <div class="calendar__actions">
          <a class="btn" href="${root}assets/data/wedding.ics" download="dam-cuoi-${escapeHtml(yyyy ?? '')}.ics" data-role="add-calendar">Thêm vào lịch</a>
          ${gcal ? `<a class="btn btn--ghost btn--ink" href="${escapeHtml(gcal)}" target="_blank" rel="noopener">Google Calendar</a>` : ''}
        </div>
      </div>`);
}

/** Countdown on a hanging tag over a slow photo. */
export function countdownSection(config: WeddingConfig, photos: PhotoRecord[]): string {
  const inv = resolveInvitation(config);
  const moodPhoto = firstPhoto(photos, 'story', 'gallery', 'hero');
  const firstIso = [config.ceremony.datetime, config.reception.datetime].filter(Boolean).sort()[0] ?? mainIsoOf(config);
  return sheet('countdown', 'sheet--photo countdown-section', `
      <div class="parallax__layer${moodPhoto ? '' : ' hero__fallback-bg'}" data-parallax-speed="0.25">${moodPhoto ? picture(moodPhoto, { sizes: '100vw', alt: '', fallbackTier: 'md' }) : ''}</div>
      <div class="hang-tag countdown" data-role="countdown" data-target="${escapeHtml(firstIso)}">
        <span class="hang-tag__hole" aria-hidden="true"></span>
        <div class="countdown__grid" role="timer" aria-live="off">
          ${(['days', 'hours', 'minutes', 'seconds'] as const)
            .map((u, i) => `${i ? '<span class="countdown__sep" aria-hidden="true">:</span>' : ''}<span class="countdown__unit"><span class="countdown__num" data-unit="${u}">--</span><span class="countdown__label">${{ days: 'Ngày', hours: 'Giờ', minutes: 'Phút', seconds: 'Giây' }[u]}</span></span>`)
            .join('')}
        </div>
        <p class="countdown__title script" data-role="countdown-title" data-done="${escapeHtml(inv.countdownDoneText)}">${escapeHtml(inv.countdownTitle)}</p>
      </div>`);
}

/** Reply card sliding out of a small envelope. `linkAttrs` tags the button (e.g. data-cta for analytics/tests). */
export function rsvpCtaSection(config: WeddingConfig, photos: PhotoRecord[], linkAttrs = ''): string {
  const inv = resolveInvitation(config);
  const rsvpPhoto = firstPhoto(photos, 'rsvp_background', 'story', 'hero');
  return sheet('rsvp-cta', 'sheet--photo rsvp-cta', `
      <div class="parallax__layer${rsvpPhoto ? '' : ' hero__fallback-bg'}" data-parallax-speed="0.25">${rsvpPhoto ? picture(rsvpPhoto, { sizes: '100vw', alt: '', fallbackTier: 'md' }) : ''}</div>
      <div class="container">
        <div class="reply">
          <span class="reply__back" aria-hidden="true"></span>
          <div class="reply__card rsvp-cta__panel">
            <span class="eyebrow">Thiệp hồi âm</span>
            <h2 class="rsvp-cta__title script">${escapeHtml(inv.rsvpTitle)}</h2>
            <p class="rsvp-cta__note">${escapeHtml(inv.rsvpNote)}</p>
            <a class="btn" href="${PAGE_DIRS.rsvp}" ${linkAttrs}>Xác nhận tham dự</a>
          </div>
          ${pocketSvg('reply__pocket')}
        </div>
      </div>`);
}

/** Closing card that slides into a small envelope; the flap then closes and the seal stamps (driven by --end). */
export function closingSection(config: WeddingConfig): string {
  const inv = resolveInvitation(config);
  return sheet('closing', 'closing-sheet', `
      <div class="container closing-wrap">
        <div class="closing-env">
          <span class="closing-env__back" aria-hidden="true"></span>
          ${flapSvg('closing-env__flap closing-env__flap--behind', 150)}
          <div class="closing-card">
            <span class="eyebrow">${escapeHtml(inv.closingTitle)}</span>
            <p class="closing-card__note">${escapeHtml(inv.closingNote)}</p>
            ${inv.contact ? `<p class="closing-card__contact">${escapeHtml(inv.contact)}</p>` : ''}
          </div>
          ${pocketSvg('closing-env__pocket')}
          ${flapSvg('closing-env__flap closing-env__flap--front', 150)}
          ${waxSeal(inv.monogram, 'closing-env__seal')}
        </div>
      </div>`);
}
