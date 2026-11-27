// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderRsvpPage } from '../../src/frontend/templates/rsvp.template';
import { validateRsvp, submitRsvp, submitGoogleForm, initRsvpPage } from '../../src/frontend/scripts/rsvp';
import { sendLayout, playSendAnimation } from '../../src/frontend/scripts/rsvp-send';
import { DEFAULT_CONFIG } from '../../src/shared/default-config';
import { RELATIONSHIP_GROUPS, RELATIONSHIP_KEYS, SEATING_ZONES } from '../../src/shared/types';

const WEBHOOK = 'https://script.google.com/macros/s/TEST/exec';
const html = renderRsvpPage({ config: { ...DEFAULT_CONFIG, rsvpWebhookUrl: WEBHOOK, rsvpForm: { ...DEFAULT_CONFIG.rsvpForm, formId: '' } }, photos: [], seatingZones: SEATING_ZONES, builtAt: '' });

function mount() {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/, '').replace(/<\/html>\s*$/, '');
  document.body.className = 'page-rsvp';
}
const $ = <T extends Element = HTMLInputElement>(sel: string) => document.querySelector(sel) as unknown as T;
function fill(v: { fullName?: string; phone?: string; relationship?: string; attendees?: string }) {
  if (v.fullName !== undefined) $('#fullName').value = v.fullName;
  if (v.phone !== undefined) $('#phone').value = v.phone;
  if (v.relationship !== undefined) $<HTMLSelectElement>('#relationship').value = v.relationship;
  if (v.attendees !== undefined) $('#attendees').value = v.attendees;
}
const submit = () => $<HTMLFormElement>('form.rsvp__form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

describe('rsvp.html template', () => {
  beforeEach(mount);

  it('is a single-viewport page with exactly the 4 RSVP fields', () => {
    expect(document.body.classList.contains('page-rsvp')).toBe(true);
    const form = $<HTMLFormElement>('form.rsvp__form');
    expect(form.dataset.webhook).toBe(WEBHOOK);
    const names = [...form.querySelectorAll('input, select')].map((e) => e.getAttribute('name'));
    expect(names).toEqual(['fullName', 'phone', 'relationship', 'attendees']);
    expect($('#phone').type).toBe('tel');
    expect($('#phone').getAttribute('inputmode')).toBe('tel');
    expect($('#attendees').min).toBe('1');
    expect($('#attendees').max).toBe('20');
    expect(document.querySelector('label[for="fullName"]')).not.toBeNull();
  });

  it('offers the 7 canonical relationship groups', () => {
    const opts = [...$<HTMLSelectElement>('#relationship').options].filter((o) => o.value);
    expect(opts.map((o) => o.value)).toEqual(RELATIONSHIP_KEYS);
    expect(opts.map((o) => o.textContent)).toEqual(RELATIONSHIP_KEYS.map((k) => RELATIONSHIP_GROUPS[k].displayVi));
  });

  it('has a hidden thank-you view and a link back to index.html', () => {
    expect($<HTMLElement>('.rsvp__thanks').hidden).toBe(true);
    expect(document.querySelector('a[href="../"]')).not.toBeNull();
    expect(document.querySelector('script[src="../assets/js/rsvp.js"]')).not.toBeNull();
  });
});

describe('validateRsvp', () => {
  const good = { fullName: '  Nguyễn  Văn An ', phone: '+84 905 123 456', relationship: 'groom_friends', attendees: '2' };
  it('normalizes a valid submission', () => {
    expect(validateRsvp(good)).toEqual({
      ok: true,
      errors: {},
      submission: { fullName: 'Nguyễn Văn An', phone: '0905123456', relationship: 'bạn bè chú rể', attendees: 2 },
    });
  });
  it.each([
    ['fullName', { ...good, fullName: ' ' }],
    ['fullName', { ...good, fullName: 'A' }],
    ['phone', { ...good, phone: '12345' }],
    ['relationship', { ...good, relationship: '' }],
    ['attendees', { ...good, attendees: '0' }],
    ['attendees', { ...good, attendees: '21' }],
    ['attendees', { ...good, attendees: '1.5' }],
  ])('flags %s', (field, input) => {
    const r = validateRsvp(input);
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors)).toEqual([field]);
  });
});

describe('submitRsvp', () => {
  it('POSTs text/plain JSON (no CORS preflight) and returns the upsert operation', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, operation: 'UPDATED', phone: '0905123456' })));
    const sub = { fullName: 'An', phone: '0905123456', relationship: 'bạn bè chú rể', attendees: 2 };
    await expect(submitRsvp(WEBHOOK, sub, fetchImpl)).resolves.toEqual({ operation: 'UPDATED' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(WEBHOOK);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(JSON.parse(String(init.body))).toEqual(sub);
  });
  it('throws on Apps Script errors, HTTP errors and missing webhook', async () => {
    const sub = { fullName: 'An', phone: '0905123456', relationship: 'khác...', attendees: 1 };
    await expect(submitRsvp(WEBHOOK, sub, async () => new Response(JSON.stringify({ ok: false, error: 'Invalid phone number' })))).rejects.toThrow(/Invalid phone/);
    await expect(submitRsvp(WEBHOOK, sub, async () => new Response('x', { status: 500 }))).rejects.toThrow();
    await expect(submitRsvp('', sub, vi.fn())).rejects.toThrow();
  });
});

describe('initRsvpPage', () => {
  beforeEach(() => { mount(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('shows inline errors and does not submit invalid forms', () => {
    const fetchImpl = vi.fn();
    initRsvpPage(document, { fetchImpl, navigate: vi.fn() });
    fill({ fullName: '', phone: '123', relationship: '', attendees: '0' });
    submit();
    expect(fetchImpl).not.toHaveBeenCalled();
    for (const id of ['fullName', 'phone', 'relationship', 'attendees']) {
      expect(document.getElementById(id)!.getAttribute('aria-invalid'), id).toBe('true');
      expect(document.getElementById(`${id}-error`)!.textContent!.length, id).toBeGreaterThan(0);
    }
  });

  it('submits with phone as unique key, shows thank-you, then returns to index.html', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, operation: 'INSERTED' })));
    const navigate = vi.fn();
    initRsvpPage(document, { fetchImpl, navigate, redirectDelayMs: 5000 });
    fill({ fullName: 'Nguyễn Văn An', phone: '0905-123-456', relationship: 'bride_family', attendees: '2' });
    submit();
    expect($<HTMLButtonElement>('.rsvp__submit').disabled).toBe(true);
    await vi.waitFor(() => expect($<HTMLElement>('.rsvp__thanks').hidden).toBe(false));
    expect(JSON.parse(String((fetchImpl.mock.calls[0] as any)[1].body))).toEqual({ fullName: 'Nguyễn Văn An', phone: '0905123456', relationship: 'gia đình cô dâu', attendees: 2 });
    expect($<HTMLFormElement>('form.rsvp__form').hidden).toBe(true);
    expect($<HTMLElement>('.rsvp__thanks').textContent).toContain('Nguyễn Văn An');
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(navigate).toHaveBeenCalledWith('../');
  });

  it('tells returning guests their registration was updated', async () => {
    initRsvpPage(document, { fetchImpl: async () => new Response(JSON.stringify({ ok: true, operation: 'UPDATED' })), navigate: vi.fn() });
    fill({ fullName: 'Nguyễn Văn An', phone: '0905123456', relationship: 'other', attendees: '1' });
    submit();
    await vi.waitFor(() => expect($<HTMLElement>('.rsvp__thanks').hidden).toBe(false));
    expect($<HTMLElement>('.rsvp__thanks').textContent).toMatch(/cập nhật/i);
  });

  it('keeps the form and shows an error when submission fails', async () => {
    initRsvpPage(document, { fetchImpl: async () => { throw new TypeError('Failed to fetch'); }, navigate: vi.fn() });
    fill({ fullName: 'Nguyễn Văn An', phone: '0905123456', relationship: 'other', attendees: '1' });
    submit();
    await vi.waitFor(() => expect($<HTMLElement>('.rsvp__message').textContent!.length).toBeGreaterThan(0));
    expect($<HTMLElement>('.rsvp__thanks').hidden).toBe(true);
    expect($<HTMLButtonElement>('.rsvp__submit').disabled).toBe(false);
  });
});

describe('submitGoogleForm', () => {
  it('posts entry.* fields to the formResponse endpoint', async () => {
    const fetchImpl = vi.fn(async () => new Response(null));
    await submitGoogleForm(DEFAULT_CONFIG.rsvpForm, { fullName: 'An', phone: '0905123456', relationship: 'Bạn bè', attendees: 2 }, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://docs.google.com/forms/d/e/${DEFAULT_CONFIG.rsvpForm.formId}/formResponse`);
    const body = init.body as URLSearchParams;
    expect(body.get('entry.895620619')).toBe('An');
    expect(body.get('entry.50183105')).toBe('0905123456');
    expect(body.get('entry.1545696181')).toBe('Bạn bè');
    expect(body.get('entry.261159171')).toBe('2');
  });
});

describe('send animation', () => {
  beforeEach(mount);

  it('sits the reply card in an envelope', () => {
    expect(document.querySelector('.rsvp__stage > .rsvp-env__back')).not.toBeNull();
    expect(document.querySelector('.rsvp__stage > .rsvp-env__pocket svg')).not.toBeNull();
    expect(document.querySelector('.rsvp__stage > .rsvp-env__flap svg')).not.toBeNull();
  });

  it.each([[370, 600, 520], [296, 540, 480], [720, 340, 300]])('lays the card sideways, sized to the envelope, in a %ix%i stage', (width, height, cardH) => {
    const envW = Math.min(width, height * 0.7);
    const env = { top: cardH - 40, width: envW, height: envW * 0.62 };
    const l = sendLayout({ height }, { top: 0, width, height: cardH }, env);
    expect(l).not.toHaveProperty('env'); // the envelope is moved, never resized
    expect(env.top + l.envY + env.height).toBeLessThanOrEqual(height + 0.01); // ends up fully on stage
    const [w, h] = l.rotate ? [cardH, width] : [width, cardH];
    expect(w).toBeGreaterThanOrEqual(h); // lying sideways
    expect(w * l.scale).toBeLessThanOrEqual(env.width * 0.9 + 0.01); // fits inside...
    expect(h * l.scale).toBeLessThanOrEqual(env.height * 0.86 + 0.01);
    expect(Math.max((w * l.scale) / env.width, (h * l.scale) / env.height)).toBeGreaterThan(0.85); // ...and fills it
    expect(l.insideY).toBeGreaterThan(l.hoverY); // it moves down into the envelope
  });

  it('resolves at once without Web Animations', async () => {
    await expect(playSendAnimation(document)).resolves.toBeUndefined();
    expect(document.querySelector('.rsvp__stage')!.classList.contains('is-sending')).toBe(false);
  });

  it('shows the thank-you card only after the envelope has flown away', async () => {
    let release!: () => void;
    const animateSend = vi.fn(() => new Promise<void>((r) => { release = r; }));
    initRsvpPage(document, { fetchImpl: async () => new Response(JSON.stringify({ ok: true })), navigate: () => {}, animateSend });
    fill({ fullName: 'Nguyễn Văn An', phone: '0905123456', relationship: 'groom_friends', attendees: '1' });
    submit();
    await vi.waitFor(() => expect(animateSend).toHaveBeenCalled());
    expect($<HTMLElement>('.rsvp__thanks').hidden).toBe(true);
    release();
    await vi.waitFor(() => expect($<HTMLElement>('.rsvp__thanks').hidden).toBe(false));
  });
});
