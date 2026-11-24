/** RSVP form: validation, unique-phone webhook submission (text/plain, CORS-safe), thank-you view, auto-return. */
import { isValidVnPhone, normalizeVnPhone } from '../../shared/phone-normalizer';
import { resolveRelationship } from '../../shared/guest-codec';
import { RELATIONSHIP_GROUPS, type RsvpFormConfig, type RsvpSubmission } from '../../shared/types';

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export type RsvpField = 'fullName' | 'phone' | 'relationship' | 'attendees';

export interface RsvpValidation {
  ok: boolean;
  errors: Partial<Record<RsvpField, string>>;
  submission?: RsvpSubmission;
}

export function validateRsvp(v: Record<RsvpField, string>): RsvpValidation {
  const errors: RsvpValidation['errors'] = {};
  const fullName = String(v.fullName ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  if (fullName.length < 2) errors.fullName = 'Vui lòng nhập họ và tên.';
  if (!isValidVnPhone(v.phone)) errors.phone = 'Số điện thoại Việt Nam chưa hợp lệ (VD: 0905 123 456).';
  const rel = resolveRelationship(v.relationship);
  if (!v.relationship || !rel) errors.relationship = 'Vui lòng chọn mối quan hệ.';
  const raw = String(v.attendees ?? '').trim();
  const attendees = Number(raw);
  if (!/^\d+$/.test(raw) || attendees < 1 || attendees > 20) errors.attendees = 'Số người từ 1 đến 20.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    errors,
    submission: { fullName, phone: normalizeVnPhone(v.phone), relationship: RELATIONSHIP_GROUPS[rel!].labelVi, attendees },
  };
}

export async function submitRsvp(webhookUrl: string, sub: RsvpSubmission, fetchImpl: FetchLike = (u, i) => fetch(u, i)): Promise<{ operation: 'INSERTED' | 'UPDATED' }> {
  if (!webhookUrl) throw new Error('Chưa cấu hình địa chỉ nhận đăng ký.');
  const res = await fetchImpl(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(sub),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { ok: boolean; operation?: 'INSERTED' | 'UPDATED'; error?: string };
  if (!data.ok) throw new Error(data.error ?? 'Không gửi được đăng ký');
  return { operation: data.operation ?? 'INSERTED' };
}

/** Submit to a Google Form via its public formResponse endpoint (opaque no-cors response). */
export async function submitGoogleForm(form: RsvpFormConfig, sub: RsvpSubmission, fetchImpl: FetchLike = (u, i) => fetch(u, i)): Promise<{ operation: 'INSERTED' }> {
  const body = new URLSearchParams({
    [`entry.${form.entryFullName}`]: sub.fullName,
    [`entry.${form.entryPhone}`]: sub.phone,
    [`entry.${form.entryRelationship}`]: sub.relationship,
    [`entry.${form.entryAttendees}`]: String(sub.attendees),
  });
  await fetchImpl(`https://docs.google.com/forms/d/e/${form.formId}/formResponse`, { method: 'POST', mode: 'no-cors', body });
  return { operation: 'INSERTED' };
}

function parseGform(raw: string | undefined): RsvpFormConfig | null {
  try {
    const f = JSON.parse(raw || '{}') as Partial<RsvpFormConfig>;
    return f.formId && f.entryFullName && f.entryPhone && f.entryRelationship && f.entryAttendees ? (f as RsvpFormConfig) : null;
  } catch {
    return null;
  }
}

export interface RsvpPageOptions {
  fetchImpl?: FetchLike;
  navigate?: (url: string) => void;
  redirectDelayMs?: number;
}

export function initRsvpPage(doc: Document = document, opts: RsvpPageOptions = {}): void {
  const form = doc.querySelector<HTMLFormElement>('form.rsvp__form');
  if (!form) return;
  const thanks = doc.querySelector<HTMLElement>('.rsvp__thanks')!;
  const message = form.querySelector<HTMLElement>('.rsvp__message')!;
  const button = form.querySelector<HTMLButtonElement>('.rsvp__submit')!;
  const navigate = opts.navigate ?? ((u: string) => window.location.assign(u));
  const delay = opts.redirectDelayMs ?? 6000;
  const fields: RsvpField[] = ['fullName', 'phone', 'relationship', 'attendees'];
  const control = (f: RsvpField) => form.elements.namedItem(f) as HTMLInputElement | HTMLSelectElement;

  const showErrors = (errors: RsvpValidation['errors']) => {
    for (const f of fields) {
      const el = control(f);
      const err = doc.getElementById(`${f}-error`);
      if (errors[f]) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
      if (err) err.textContent = errors[f] ?? '';
    }
  };
  for (const f of fields) control(f).addEventListener('input', () => control(f).removeAttribute('aria-invalid'));

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    message.textContent = '';
    const values = Object.fromEntries(fields.map((f) => [f, control(f).value])) as Record<RsvpField, string>;
    const result = validateRsvp(values);
    showErrors(result.errors);
    if (!result.ok || !result.submission) {
      control(fields.find((f) => result.errors[f])!).focus();
      return;
    }
    button.disabled = true;
    button.textContent = 'Đang gửi…';
    try {
      const gform = parseGform(form.dataset.gform);
      const { operation } = gform
        ? await submitGoogleForm(gform, result.submission, opts.fetchImpl)
        : await submitRsvp(form.dataset.webhook ?? '', result.submission, opts.fetchImpl);
      form.hidden = true;
      thanks.hidden = false;
      thanks.querySelector('.rsvp__thanks-text')!.textContent =
        operation === 'UPDATED'
          ? `${result.submission.fullName} ơi, thông tin đăng ký của bạn đã được cập nhật (${result.submission.attendees} người).`
          : `${result.submission.fullName} ơi, gia đình đã nhận được xác nhận ${result.submission.attendees} người tham dự.`;
      thanks.focus();
      const countdown = thanks.querySelector('.rsvp__countdown');
      let left = Math.ceil(delay / 1000);
      if (countdown) countdown.textContent = `Tự động quay về trang báo hỉ sau ${left} giây…`;
      const tick = setInterval(() => {
        left -= 1;
        if (countdown && left > 0) countdown.textContent = `Tự động quay về trang báo hỉ sau ${left} giây…`;
      }, 1000);
      setTimeout(() => {
        clearInterval(tick);
        navigate('index.html');
      }, delay);
    } catch (e) {
      message.textContent = `Chưa gửi được: ${(e as Error).message}. Vui lòng thử lại.`;
      button.disabled = false;
      button.textContent = 'Gửi xác nhận';
    }
  });
}

if (typeof document !== 'undefined' && document.querySelector('form.rsvp__form')) {
  document.documentElement.classList.remove('no-js');
  initRsvpPage(document);
}
