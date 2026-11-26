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
import { firstPhoto, ornament, picture, variant } from './partials';

/** Scalloped lace along a straight edge: overlapping beads + pin holes (pure SVG, no image assets). */
function laceEdge(x1: number, y1: number, x2: number, y2: number, n: number, r: number): string {
  let out = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (x1 + (x2 - x1) * t).toFixed(1);
    const y = (y1 + (y2 - y1) * t).toFixed(1);
    out += `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  }
  let holes = '';
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    holes += `<circle cx="${(x1 + (x2 - x1) * t).toFixed(1)}" cy="${(y1 + (y2 - y1) * t).toFixed(1)}" r="${(r * 0.32).toFixed(1)}"/>`;
  }
  return `<g class="lace">${out}</g><g class="lace__holes">${holes}</g>`;
}

/** Envelope flap (triangle pointing down) with lace on both slanted edges. */
function flapSvg(cls: string, height = 180): string {
  return `<svg class="${cls}" viewBox="0 0 400 ${height + 14}" preserveAspectRatio="none" aria-hidden="true">
<path class="flap__shape" d="M0 0 H400 L200 ${height} Z"/>
${laceEdge(0, 0, 200, height, 22, 6.5)}${laceEdge(400, 0, 200, height, 22, 6.5)}</svg>`;
}

/** Front pocket of the open envelope (covers the bottom of the letter). */
const POCKET_SVG = `<svg class="envelope__pocket" viewBox="0 0 400 280" preserveAspectRatio="none" aria-hidden="true">
<path class="pocket__shape" d="M0 0 L200 168 L400 0 V280 H0 Z"/>
<path class="pocket__fold" d="M0 280 L178 156 M400 280 L222 156"/>
<path class="pocket__edge" d="M0 0 L200 168 L400 0"/></svg>`;

/** Cream wax seal with the couple monogram and a small sprig. */
function waxSeal(monogram: string, cls = ''): string {
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
  <p class="calendar__month">Tháng ${String(g.month).padStart(2, '0')} · ${g.year}</p>
  <div class="calendar__grid" role="grid" aria-label="Lịch tháng ${g.month}/${g.year}, ngày cưới ${g.day}">
    ${WEEKDAY_HEADERS_VI.map((w) => `<span class="calendar__wd">${w}</span>`).join('')}
    ${cells}
  </div>
  <p class="calendar__time">${escapeHtml(time)}</p>
</div>`;
}

function photoSrc(photo: PhotoRecord | null, tier: 'sm' | 'md' | 'lg' = 'md') {
  return photo ? variant(photo, tier) : undefined;
}

const mainIsoOf = (c: WeddingConfig) => c.reception.datetime || c.ceremony.datetime;

/** Sticky scroll scene: closed envelope cover -> flap opens -> photo + save-the-date slide out. */
export function envelopeScene(config: WeddingConfig, photos: PhotoRecord[], opts: { headingTag?: 'h1' | 'p' } = {}): string {
  const inv = resolveInvitation(config);
  const tag = opts.headingTag ?? 'h1';
  const letterPhoto = photoSrc(firstPhoto(photos, 'invite_portrait', 'hero', 'gallery'), 'md');
  const wedding = formatViDateTime(mainIsoOf(config));
  const [dd, mm, yyyy] = wedding.date.split('/');
  const dotDate = dd && mm && yyyy ? `${dd} · ${mm} · ${yyyy}` : wedding.date;
  const groom = escapeHtml(config.groomName);
  const bride = escapeHtml(config.brideName);
  return `
  <section id="envelope" class="envelope-scene" data-scroll-scene aria-label="Thiệp mời">
    <div class="envelope-scene__sticky">
      <div class="envelope-stage">
        <div class="envelope">
          <div class="envelope__back"></div>
          ${flapSvg('envelope__flap')}
          <div class="envelope__letter">
            <figure class="letter-photo">${
              letterPhoto ? `<img src="${escapeHtml(letterPhoto.src)}" alt="${groom} &amp; ${bride}" width="${letterPhoto.width}" height="${letterPhoto.height}" decoding="async">` : `<span class="letter-photo__fallback script">${escapeHtml(inv.monogram)}</span>`
            }</figure>
            <article class="letter-card">
              <span class="letter-card__eyebrow">${escapeHtml(inv.cardEyebrow)}</span>
              <span class="letter-card__name">${groom}</span>
              <span class="letter-card__amp script">&amp;</span>
              <span class="letter-card__name">${bride}</span>
              <span class="letter-card__date">${escapeHtml(dotDate)}</span>
            </article>
          </div>
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
        ${flapSvg('envelope-cover__flap', 170)}
        <div class="envelope-cover__text">
          <span class="envelope-cover__eyebrow">${escapeHtml(inv.coverEyebrow)}</span>
          <${tag} class="envelope-cover__names"><span>${groom}</span><span class="envelope-cover__amp script">&amp;</span><span>${bride}</span></${tag}>
        </div>
        <button class="envelope-cover__seal" type="button" data-role="open-envelope" aria-label="Mở thiệp">${waxSeal(inv.monogram)}</button>
        <p class="envelope-cover__hint">${escapeHtml(inv.openHint)}<span aria-hidden="true">⌄</span></p>
      </div>
    </div>
  </section>`;
}

export function calendarSection(config: WeddingConfig): string {
  const inv = resolveInvitation(config);
  const mainIso = mainIsoOf(config);
  const wedding = formatViDateTime(mainIso);
  const yyyy = wedding.date.split('/')[2];
  const gcal = googleCalendarUrl(config, config.reception);
  return `
  <section id="calendar" class="section parallax section--burgundy">
    ${ornament('tl')}
    <div class="container calendar-wrap" data-parallax-speed="0">
      ${calendarBlock(mainIso, inv.calendarTitle, `${config.reception.title} · ${wedding.time} · ${wedding.weekday}, ${wedding.date}`)}
      <div class="calendar__actions">
        <a class="btn btn--light" href="assets/data/wedding.ics" download="dam-cuoi-${escapeHtml(yyyy ?? '')}.ics" data-role="add-calendar">Thêm vào lịch</a>
        ${gcal ? `<a class="btn btn--ghost" href="${escapeHtml(gcal)}" target="_blank" rel="noopener">Google Calendar</a>` : ''}
      </div>
    </div>
  </section>`;
}

export function countdownSection(config: WeddingConfig, photos: PhotoRecord[]): string {
  const inv = resolveInvitation(config);
  const moodPhoto = firstPhoto(photos, 'story', 'gallery', 'hero');
  const firstIso = [config.ceremony.datetime, config.reception.datetime].filter(Boolean).sort()[0] ?? mainIsoOf(config);
  return `
  <section id="countdown" class="section parallax countdown-section">
    <div class="parallax__layer${moodPhoto ? '' : ' hero__fallback-bg'}" data-parallax-speed="0.25">${moodPhoto ? picture(moodPhoto, { sizes: '100vw', alt: '', fallbackTier: 'md' }) : ''}</div>
    <div class="container countdown reveal" data-role="countdown" data-target="${escapeHtml(firstIso)}">
      <div class="countdown__grid" role="timer" aria-live="off">
        ${(['days', 'hours', 'minutes', 'seconds'] as const)
          .map((u, i) => `${i ? '<span class="countdown__sep" aria-hidden="true">:</span>' : ''}<span class="countdown__unit"><span class="countdown__num" data-unit="${u}">--</span><span class="countdown__label">${{ days: 'Ngày', hours: 'Giờ', minutes: 'Phút', seconds: 'Giây' }[u]}</span></span>`)
          .join('')}
      </div>
      <p class="countdown__title script" data-role="countdown-title" data-done="${escapeHtml(inv.countdownDoneText)}">${escapeHtml(inv.countdownTitle)}</p>
    </div>
  </section>`;
}

/** `linkAttrs` lets each page tag its button (e.g. data-cta for analytics/tests). */
export function rsvpCtaSection(config: WeddingConfig, photos: PhotoRecord[], linkAttrs = ''): string {
  const inv = resolveInvitation(config);
  const rsvpPhoto = firstPhoto(photos, 'rsvp_background', 'story', 'hero');
  return `
  <section id="rsvp-cta" class="section parallax rsvp-cta">
    <div class="parallax__layer${rsvpPhoto ? '' : ' hero__fallback-bg'}" data-parallax-speed="0.25">${rsvpPhoto ? picture(rsvpPhoto, { sizes: '100vw', alt: '', fallbackTier: 'md' }) : ''}</div>
    <div class="container">
      <div class="rsvp-cta__panel reveal">
        <h2 class="rsvp-cta__title script">${escapeHtml(inv.rsvpTitle)}</h2>
        <p class="rsvp-cta__note">${escapeHtml(inv.rsvpNote)}</p>
        <a class="btn btn--light" href="rsvp.html" ${linkAttrs}>Xác nhận tham dự</a>
      </div>
    </div>
  </section>`;
}

export function closingSection(config: WeddingConfig): string {
  const inv = resolveInvitation(config);
  return `
  <section id="closing" class="section section--cream">
    <div class="container">
      <div class="closing-card reveal">
        <span class="eyebrow">${escapeHtml(inv.closingTitle)}</span>
        <p class="closing-card__mono script">${escapeHtml(inv.monogram)}</p>
        <p class="closing-card__note">${escapeHtml(inv.closingNote)}</p>
        ${inv.contact ? `<p class="closing-card__contact">${escapeHtml(inv.contact)}</p>` : ''}
      </div>
    </div>
  </section>`;
}
