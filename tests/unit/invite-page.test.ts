// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderInvitePage } from '../../src/frontend/templates/invite.template';
import { initInvitePage, saveOrShare, cardFileNameFor } from '../../src/frontend/scripts/invite';
import { encodeGuestToken, buildGuestsMap } from '../../src/shared/guest-codec';
import { DEFAULT_CONFIG } from '../../src/shared/default-config';
import { SEATING_ZONES, type PhotoRecord } from '../../src/shared/types';

const SLUG = 'vo-chong-chu-chin-gia-dinh-co-dau';
const GOLDEN = { salutation: 'chú thím', name: 'vợ chồng chú Chín', relationship: 'gia đình cô dâu', count: 2 };
const SENTENCE = 'Kính mời vợ chồng chú Chín đến chung vui cùng gia đình chúng tôi, sự hiện diện của chú thím là niềm vinh hạnh cho gia đình.';
const mapPhoto: PhotoRecord = {
  id: 'map', caption: 'Bản đồ', placement: 'static_map', sortOrder: 0, focalPoint: null,
  variants: [{ tier: 'md', format: 'jpg', width: 1024, height: 700, src: 'assets/images/map/map-md.jpg' }, { tier: 'md', format: 'webp', width: 1024, height: 700, src: 'assets/images/map/map-md.webp' }],
};

function mount(photos: PhotoRecord[] = [mapPhoto]) {
  const html = renderInvitePage({ config: DEFAULT_CONFIG, photos, seatingZones: SEATING_ZONES, builtAt: '' });
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/, '').replace(/<\/html>\s*$/, '');
}
const q = <T extends Element = HTMLElement>(s: string) => document.querySelector(s) as unknown as T;
const text = (s: string) => q(s).textContent!.replace(/\s+/g, ' ').trim();

describe('invite.html template', () => {
  beforeEach(() => mount());

  it('embeds the public wedding data for zero-request rendering', () => {
    const data = JSON.parse(q('#wedding-data').textContent!);
    expect(data.config.groomName).toBe(DEFAULT_CONFIG.groomName);
    expect(data.seatingZones).toHaveLength(7);
    expect(q('script[src="../assets/js/invite.js"]')).not.toBeNull();
  });

  it('server-renders the default card wording for no-JS visitors', () => {
    expect(text('.paper-card--main [data-role="guest-name"]')).toBe('Quý khách');
    expect(q('[data-role="presence"]').textContent).toBe('Sự hiện diện của Quý vị\nlà niềm vinh hạnh cho gia đình chúng tôi!');
  });

  it('opens two sheets: the photo and the full invitation (venue, time, lunar date, families)', () => {
    expect(document.querySelectorAll('#envelope .env-sheet')).toHaveLength(2);
    expect(text('.env-sheet--photo .letter-card__title')).toBe('Thiệp Mời');
    const main = text('.paper-card--main');
    for (const s of [DEFAULT_CONFIG.reception.venueName, DEFAULT_CONFIG.reception.address, 'Vào lúc', '16.01.2027', 'Tức ngày 9 tháng 12 năm Bính Ngọ', DEFAULT_CONFIG.groomParents.father, DEFAULT_CONFIG.brideParents.mother])
      expect(main, s).toContain(s);
  });

  it('lists the ceremony and the party with their venues next to the calendar', () => {
    const events = text('#events');
    for (const s of [DEFAULT_CONFIG.ceremony.title, DEFAULT_CONFIG.ceremony.venueName, DEFAULT_CONFIG.reception.title, '09:00', '18:00']) expect(events, s).toContain(s);
    expect(q('#events #calendar .calendar__cell--day')).not.toBeNull();
    for (const id of ['family', 'story', 'gallery', 'rsvp-cta']) expect(q(`#${id}`), id).toBeNull();
  });

  it('has no directions or RSVP section (the guest already replied), but a full schedule with Google Maps', () => {
    expect(q('#directions')).toBeNull();
    expect(q('#rsvp-cta')).toBeNull();
    const events = text('#events');
    for (const s of [DEFAULT_CONFIG.ceremony.address, DEFAULT_CONFIG.reception.venueName, DEFAULT_CONFIG.reception.address]) expect(events, s).toContain(s);
    expect(q(`#events a[href="${DEFAULT_CONFIG.googleMapsUrl}"]`)).not.toBeNull();
  });

  it('has parallax layers and save/share controls', () => {
    expect(document.querySelectorAll('[data-parallax-speed]').length).toBeGreaterThanOrEqual(3);
    expect(q('#save-jpg')).not.toBeNull();
    expect(q('#share-jpg')).not.toBeNull();
  });
});

describe('initInvitePage', () => {
  beforeEach(() => mount());

  const fetchMap = vi.fn(async () => buildGuestsMap([{ rowId: '1', ...GOLDEN }]));

  it('personalizes greeting + highlights ZONE_B1 with 2 seats for ?khach=<slug>', async () => {
    await initInvitePage(document, { search: `?khach=${SLUG}`, fetchJson: fetchMap });
    for (const el of document.querySelectorAll('[data-role="guest-name"]')) expect(el.textContent).toBe('vợ chồng chú Chín');
    expect(q('[data-role="presence"]').textContent).toBe('Sự hiện diện của chú thím\nlà niềm vinh hạnh cho gia đình chúng tôi!');
    expect(q('.seating__map [data-zone="ZONE_B1"]').getAttribute('data-highlight')).toBe('true');
    expect(document.querySelectorAll('.seating__map [data-highlight="true"]')).toHaveLength(1);
    expect(text('[data-role="seat-count"]')).toBe('2');
    expect(text('[data-role="zone-name"]')).toBe('Khu B1 - Gia đình & Họ hàng Cô Dâu');
    expect(text('[data-role="seat-guidance"]')).toContain('2 chỗ ngồi');
    expect(q('[data-role="guest-badge"]').className).toContain('badge--bride');
    expect(text('[data-role="guest-badge"]')).toBe('Gia đình cô dâu');
    expect(q<HTMLElement>('[data-role="seat-count"]').closest<HTMLElement>('.seating__seats')!.style.background).toBe('rgb(236, 72, 153)');
    expect(document.title).toContain('vợ chồng chú Chín');
  });

  it('reads the guest from the DB-built guests-map.json', async () => {
    await initInvitePage(document, { search: `?khach=${SLUG}`, fetchJson: fetchMap });
    expect(fetchMap).toHaveBeenCalledWith('../assets/data/guests-map.json');
    expect(text('.paper-card--main [data-role="guest-name"]')).toBe('vợ chồng chú Chín');
  });

  it.each(['', '?khach=khong-ton-tai', '?g=invalid'])('shows the default invitation with the plain map and no table guidance for %j', async (search) => {
    await initInvitePage(document, { search, fetchJson: fetchMap });
    expect(text('.paper-card--main [data-role="guest-name"]')).toBe('Quý khách');
    expect(q('[data-role="presence"]').textContent).toContain('Quý vị');
    expect(document.querySelector('.seating__map svg')).not.toBeNull();
    expect(document.querySelectorAll('.seating__map [data-highlight="true"]')).toHaveLength(0);
    expect(q('.seating__info').hidden).toBe(true);
    expect(q('[data-role="guest-badge"]').hidden).toBe(true);
  });

  it('renders a card preview and wires Save JPG to the card renderer', async () => {
    const renderCard = vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' }));
    const save = vi.fn(async () => 'downloaded' as const);
    await initInvitePage(document, { search: `?khach=${SLUG}`, fetchJson: fetchMap, renderCard, saveOrShare: save });
    expect(q('.save-card__preview img').getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    q<HTMLButtonElement>('#save-jpg').click();
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    const [svg] = renderCard.mock.calls[0] as unknown as [string];
    expect(svg).toContain('width="1080"');
    expect(svg).toContain('vợ chồng chú Chín');
    expect((save.mock.calls[0] as any)[1]).toBe('Thiep-Moi-vo-chong-chu-chin.jpg');
    expect((save.mock.calls[0] as any)[2]).toMatchObject({ mode: 'download' });
    q<HTMLButtonElement>('#share-jpg').click();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect((save.mock.calls[1] as any)[2]).toMatchObject({ mode: 'share' });
  });
});

describe('saveOrShare', () => {
  const blob = new Blob(['x'], { type: 'image/jpeg' });

  it('uses the Web Share API with a JPEG file when supported', async () => {
    const share = vi.fn(async () => {});
    const nav = { canShare: vi.fn(() => true), share } as unknown as Navigator;
    expect(await saveOrShare(blob, 'Thiep-Moi-a.jpg', { mode: 'share', nav, doc: document })).toBe('shared');
    const arg = (share.mock.calls[0] as any)[0];
    expect(arg.files[0]).toBeInstanceOf(File);
    expect(arg.files[0].name).toBe('Thiep-Moi-a.jpg');
    expect(arg.files[0].type).toBe('image/jpeg');
  });

  it('falls back to <a download> when file sharing is unsupported (iOS in-app browsers)', async () => {
    const clicks: HTMLAnchorElement[] = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { clicks.push(this); };
    (URL as any).createObjectURL = vi.fn(() => 'blob:card');
    (URL as any).revokeObjectURL = vi.fn();
    try {
      expect(await saveOrShare(blob, 'Thiep-Moi-a.jpg', { mode: 'share', nav: {} as Navigator, doc: document })).toBe('downloaded');
      expect(await saveOrShare(blob, 'Thiep-Moi-a.jpg', { mode: 'download', nav: { canShare: () => true, share: vi.fn() } as any, doc: document })).toBe('downloaded');
    } finally {
      HTMLAnchorElement.prototype.click = orig;
    }
    expect(clicks).toHaveLength(2);
    expect(clicks[0].download).toBe('Thiep-Moi-a.jpg');
    expect(clicks[0].href).toBe('blob:card');
  });

  it('treats a user-cancelled share as a no-op', async () => {
    const nav = { canShare: () => true, share: async () => { throw new DOMException('cancel', 'AbortError'); } } as unknown as Navigator;
    expect(await saveOrShare(blob, 'a.jpg', { mode: 'share', nav, doc: document })).toBe('cancelled');
  });

  it('builds the client file name', () => {
    expect(cardFileNameFor({ name: 'vợ chồng chú Chín' })).toBe('Thiep-Moi-vo-chong-chu-chin.jpg');
  });
});
