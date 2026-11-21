/** Trang Đăng Ký — dist/rsvp.html (single 100dvh viewport, no vertical scroll). */
import { escapeHtml } from '../../shared/html';
import { formatViDateTime } from '../../shared/date-format';
import { RELATIONSHIP_GROUPS, RELATIONSHIP_KEYS, type WeddingData } from '../../shared/types';
import { documentShell, firstPhoto, picture } from './partials';

type PageData = Omit<WeddingData, 'guests'> & { builtAt?: string };

function field(id: string, label: string, control: string): string {
  return `<div class="field"><label for="${id}">${label}</label>${control}<span class="field__error" id="${id}-error" aria-live="polite"></span></div>`;
}

export function renderRsvpPage(data: PageData): string {
  const { config, photos } = data;
  const bg = firstPhoto(photos, 'rsvp_background', 'hero', 'gallery');
  const wedding = formatViDateTime(config.reception.datetime || config.ceremony.datetime);
  const options = RELATIONSHIP_KEYS.map((k) => `<option value="${k}">${escapeHtml(RELATIONSHIP_GROUPS[k].displayVi)}</option>`).join('');

  const body = `
<main class="rsvp" id="rsvp">
  <div class="rsvp__bg">${bg ? picture(bg, { sizes: '100vw', alt: '', lazy: false, fallbackTier: 'lg' }) : ''}</div>
  <section class="rsvp__panel" aria-labelledby="rsvp-title">
    <h1 class="rsvp__title" id="rsvp-title">Xác nhận tham dự</h1>
    <p class="rsvp__lead">${escapeHtml(config.groomName)} &amp; ${escapeHtml(config.brideName)} · ${escapeHtml(`${wedding.weekday}, ${wedding.date}`)}</p>
    <form class="rsvp__form" novalidate data-webhook="${escapeHtml(config.rsvpWebhookUrl)}">
      ${field('fullName', 'Họ và tên', `<input id="fullName" name="fullName" type="text" autocomplete="name" required maxlength="120" placeholder="Nguyễn Văn A" aria-describedby="fullName-error">`)}
      ${field('phone', 'Số điện thoại', `<input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="09xx xxx xxx" aria-describedby="phone-error">`)}
      <div class="rsvp__row">
        ${field('relationship', 'Bạn là', `<select id="relationship" name="relationship" required aria-describedby="relationship-error"><option value="">Chọn…</option>${options}</select>`)}
        ${field('attendees', 'Số người tham dự', `<input id="attendees" name="attendees" type="number" inputmode="numeric" min="1" max="20" step="1" value="1" required aria-describedby="attendees-error">`)}
      </div>
      <button class="btn rsvp__submit" type="submit">Gửi xác nhận</button>
      <p class="rsvp__message" role="alert"></p>
    </form>
    <div class="rsvp__thanks" hidden tabindex="-1">
      <h2>Cảm ơn bạn!</h2>
      <p class="rsvp__thanks-text"></p>
      <p class="rsvp__countdown"></p>
      <a class="btn btn--ghost" href="index.html">Về trang báo hỉ</a>
    </div>
    <a class="rsvp__back" href="index.html">← Quay lại trang báo hỉ</a>
  </section>
</main>`;

  return documentShell({
    config,
    title: `Xác nhận tham dự · ${config.groomName} & ${config.brideName}`,
    description: `Đăng ký tham dự đám cưới ${config.groomName} & ${config.brideName}`,
    bodyClass: 'page-rsvp',
    script: 'rsvp.js',
    body,
  });
}
