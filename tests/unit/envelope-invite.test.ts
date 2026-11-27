// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { monthGrid, buildIcs, toIcsUtc, googleCalendarUrl } from '../../src/shared/wedding-calendar';
import { sceneProgress, phaseValues, entryProgress, ENVELOPE_PHASES } from '../../src/frontend/scripts/scroll-scene';
import { countdownParts } from '../../src/frontend/scripts/invite';
import { sheetEnd, sheetIn, sheetStickyTop } from '../../src/frontend/scripts/sheet-stack';
import { lunarLine, solarToLunar, canChiYear } from '../../src/shared/lunar-calendar';
import { guestNameLine, presenceLine } from '../../src/shared/invitation-formatter';
import { DEFAULT_CONFIG, DEFAULT_INVITATION, defaultMonogram, resolveInvitation } from '../../src/shared/default-config';
import { renderInvitePage } from '../../src/frontend/templates/invite.template';
import { renderIndexPage } from '../../src/frontend/templates/index.template';
import { SEATING_ZONES } from '../../src/shared/types';

describe('monthGrid', () => {
  it('builds a Monday-first grid (Jan 2027 starts on a Friday)', () => {
    const g = monthGrid('2027-01-17T16:30:00+07:00')!;
    expect([g.year, g.month, g.day]).toEqual([2027, 1, 17]);
    expect(g.weeks[0]).toEqual([null, null, null, null, 1, 2, 3]);
    expect(g.weeks.flat().filter((d) => d !== null)).toHaveLength(31);
    expect(g.weeks.every((w) => w.length === 7)).toBe(true);
    expect(g.weeks[2][6]).toBe(17); // Sunday
  });
  it('returns null for an empty date', () => expect(monthGrid('')).toBeNull());
});

describe('calendar exports', () => {
  it('converts the local wedding time to UTC', () => expect(toIcsUtc('2027-01-17T16:30:00+07:00')).toBe('20270117T093000Z'));
  it('writes both events with reminders into the .ics', () => {
    const ics = buildIcs(DEFAULT_CONFIG, new Date('2026-11-26T00:00:00Z'));
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART:20270116T020000Z');
    expect(ics).toContain('DTSTART:20270116T110000Z');
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).toContain('\r\n');
    expect(ics).toMatch(/SUMMARY:Tiệc Cưới · Minh Quân & Thu Hà/);
  });
  it('builds a Google Calendar template link', () => {
    expect(googleCalendarUrl(DEFAULT_CONFIG, DEFAULT_CONFIG.reception)).toContain('dates=20270116T110000Z%2F20270116T140000Z');
  });
});

describe('scroll scene math', () => {
  it('maps the sticky scene scroll to 0..1', () => {
    expect(sceneProgress(0, 3800, 1000)).toBe(0);
    expect(sceneProgress(-1400, 3800, 1000)).toBe(0.5);
    expect(sceneProgress(-5000, 3800, 1000)).toBe(1);
    expect(sceneProgress(200, 3800, 1000)).toBe(0);
  });
  it('runs the phases in order: cover lifts, flap opens, then the card slides out', () => {
    const at = (p: number) => phaseValues(p);
    expect(at(0)).toMatchObject({ cover: 0, flap: 0, card: 0 });
    expect(at(0.3)).toMatchObject({ cover: 1, card: 0 });
    expect(at(0.3).flap).toBeGreaterThan(0);
    expect(at(0.5)).toMatchObject({ flap: 1 });
    expect(at(1)).toEqual(Object.fromEntries(Object.keys(ENVELOPE_PHASES).map((k) => [k, 1])));
  });
  it('entry progress grows as the element rises into view', () => {
    expect(entryProgress(1000, 1000)).toBe(0);
    expect(entryProgress(300, 1000)).toBe(1);
  });
});

describe('countdownParts', () => {
  it('splits the remaining time and stops at zero', () => {
    const t = Date.parse('2027-01-17T09:30:00+07:00');
    expect(countdownParts(t, t - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5, done: false });
    expect(countdownParts(t, t + 1000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
  });
});

describe('invitation content', () => {
  it('derives the monogram from the given names', () => expect(defaultMonogram('Hoàng Trung', 'Bảo Châu')).toBe('T&C'));
  it('falls back to defaults for blank or missing keys and derives the place', () => {
    const inv = resolveInvitation({ ...DEFAULT_CONFIG, invitation: { momentLine: '  ', rsvpTitle: 'Đến nhé!' } });
    expect(inv.momentLine).toBe(DEFAULT_INVITATION.momentLine);
    expect(inv.rsvpTitle).toBe('Đến nhé!');
    expect(inv.place).toBe('TP. Cần Thơ');
    expect(inv.monogram).toBe('Q&H');
  });
  it('renders the envelope scene, heart calendar and countdown from the config', () => {
    const html = renderInvitePage({
      config: { ...DEFAULT_CONFIG, invitation: { coverEyebrow: 'Thư tay của', contact: '0905 123 456' } },
      photos: [],
      seatingZones: SEATING_ZONES,
    });
    document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/, '').replace(/<\/html>\s*$/, '');
    expect(document.querySelector('[data-scroll-scene] .envelope__flap')).not.toBeNull();
    expect(document.querySelector('.envelope-cover__eyebrow')!.textContent).toBe('Thư tay của');
    expect(document.querySelectorAll('.wax-seal__mono')[0].textContent).toBe('Q&H');
    const day = document.querySelector('.calendar__cell--day')!;
    expect(day.textContent).toBe('16');
    expect(day.querySelector('.calendar__heart path')).not.toBeNull();
    expect(document.querySelector<HTMLElement>('[data-role="countdown"]')!.dataset.target).toBe(DEFAULT_CONFIG.ceremony.datetime);
    expect(document.querySelector('a[data-role="add-calendar"]')!.getAttribute('href')).toBe('../assets/data/wedding.ics');
    expect(document.querySelector('.closing-card__contact')!.textContent).toBe('0905 123 456');
  });
});

describe('index.html envelope', () => {
  it('opens with the same envelope scene, heart calendar, countdown and closing card', () => {
    const html = renderIndexPage({ config: DEFAULT_CONFIG, photos: [], seatingZones: SEATING_ZONES });
    document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/, '').replace(/<\/html>\s*$/, '');
    expect([...document.querySelectorAll('main > section')].map((s) => s.id)).toEqual(['envelope']);
    const ids = [...document.querySelectorAll('main > .paper-desk > section[data-sheet]')].map((s) => s.id);
    expect(ids.slice(0, 2)).toEqual(['hero', 'story']);
    for (const id of ['calendar', 'countdown', 'rsvp-cta', 'closing']) expect(ids).toContain(id);
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.querySelector('.calendar__cell--day .calendar__heart')).not.toBeNull();
    expect(document.querySelector('#rsvp-cta a[data-cta="rsvp-bottom"]')!.getAttribute('href')).toBe('dang-ky/');
  });
});

describe('sheet stack', () => {
  it('slides a sheet in while its top rises from the viewport bottom to 20% of the viewport', () => {
    expect(sheetIn(1000, 1000)).toBe(0);
    expect(sheetIn(600, 1000)).toBe(0.5);
    expect(sheetIn(200, 1000)).toBe(1);
    expect(sheetIn(-900, 1000)).toBe(1);
  });
  it('runs the last sheet to 1 exactly at the end of the page', () => {
    // last sheet's top at 900 in a 1000px viewport; the page can still scroll 500px, after which its top sits at 400
    expect(sheetEnd(1000, 1000, 2000, 2500)).toBe(0);
    expect(sheetEnd(700, 1000, 2200, 2500)).toBe(0.5);
    expect(sheetEnd(400, 1000, 2500, 2500)).toBe(1);
  });
  it('sticks short sheets at the top and tall sheets once their bottom meets the viewport bottom', () => {
    expect(sheetStickyTop(800, 1000)).toBe(0);
    expect(sheetStickyTop(1600, 1000)).toBe(-600);
  });
  it('wraps every section below the envelope in a sheet on both pages', () => {
    const pages = [
      renderIndexPage({ config: DEFAULT_CONFIG, photos: [], seatingZones: SEATING_ZONES }),
      renderInvitePage({ config: DEFAULT_CONFIG, photos: [], seatingZones: SEATING_ZONES }),
    ];
    for (const html of pages) {
      document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/, '').replace(/<\/html>\s*$/, '');
      const sheets = document.querySelectorAll('[data-sheet]');
      expect(sheets.length).toBeGreaterThanOrEqual(6);
      for (const s of sheets) expect(s.firstElementChild!.classList.contains('sheet')).toBe(true);
      expect(document.querySelector('.closing-env .closing-card')).not.toBeNull();
    }
    document.documentElement.innerHTML = pages[0].replace(/^[\s\S]*?<html[^>]*>/, '').replace(/<\/html>\s*$/, '');
    expect(document.querySelectorAll('.tickets .event')).toHaveLength(1);
    expect(document.querySelector('.reply .reply__card a[href="dang-ky/"]')).not.toBeNull();
    document.documentElement.innerHTML = pages[1].replace(/^[\s\S]*?<html[^>]*>/, '').replace(/<\/html>\s*$/, '');
    // invite.html: the printed cards carry the details; no directions, no RSVP (guests already replied)
    expect(document.querySelectorAll('.card-pair .paper-card')).toHaveLength(2);
    for (const id of ['directions', 'rsvp-cta']) expect(document.getElementById(id), id).toBeNull();
    expect(document.querySelector('.letter-card__title')!.textContent).toBe('Thiệp Mời');
    // full schedule with Google Maps, right above the seating plan
    const ids = [...document.querySelectorAll('[data-sheet]')].map((s) => s.id);
    expect(ids.indexOf('events')).toBe(ids.indexOf('seating') - 1);
    expect(document.querySelectorAll('#events .event a[href*="maps"]').length).toBeGreaterThanOrEqual(2);
  });
});

describe('lunar date', () => {
  it('matches the printed card: 17/01/2027 = 10 tháng 12 năm Bính Ngọ', () => {
    expect(lunarLine('2027-01-17T16:30:00+07:00')).toBe('Tức ngày 10 tháng 12 năm Bính Ngọ');
  });
  it('knows Tết and leap months', () => {
    expect(solarToLunar(17, 2, 2026)).toEqual({ day: 1, month: 1, year: 2026, leap: false });
    expect(lunarLine('2023-03-22')).toBe('Tức ngày 1 tháng 2 nhuận năm Quý Mão');
    expect(canChiYear(2027)).toBe('Đinh Mùi');
    expect(lunarLine('')).toBe('');
  });
});

describe('printed-card wording', () => {
  it('puts the guest on the dotted line and their salutation in the presence line', () => {
    expect(guestNameLine({ name: 'vợ chồng chú Chín' })).toBe('vợ chồng chú Chín');
    expect(guestNameLine(null)).toBe('Quý khách');
    expect(presenceLine('Sự hiện diện của {khach}', { salutation: 'Chú thím' })).toBe('Sự hiện diện của chú thím');
    expect(presenceLine('Sự hiện diện của {khach}', null)).toBe('Sự hiện diện của Quý vị');
  });
});
