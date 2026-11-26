// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { monthGrid, buildIcs, toIcsUtc, googleCalendarUrl } from '../../src/shared/wedding-calendar';
import { sceneProgress, phaseValues, entryProgress, ENVELOPE_PHASES } from '../../src/frontend/scripts/scroll-scene';
import { countdownParts } from '../../src/frontend/scripts/invite';
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
    expect(document.querySelector('a[data-role="add-calendar"]')!.getAttribute('href')).toBe('assets/data/wedding.ics');
    expect(document.querySelector('.closing-card__contact')!.textContent).toBe('0905 123 456');
  });
});

describe('index.html envelope', () => {
  it('opens with the same envelope scene, heart calendar, countdown and closing card', () => {
    const html = renderIndexPage({ config: DEFAULT_CONFIG, photos: [], seatingZones: SEATING_ZONES });
    document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/, '').replace(/<\/html>\s*$/, '');
    const ids = [...document.querySelectorAll('main > section')].map((s) => s.id);
    expect(ids.slice(0, 2)).toEqual(['envelope', 'hero']);
    for (const id of ['calendar', 'countdown', 'rsvp-cta', 'closing']) expect(ids).toContain(id);
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.querySelector('.calendar__cell--day .calendar__heart')).not.toBeNull();
    expect(document.querySelector('#rsvp-cta a[data-cta="rsvp-bottom"]')!.getAttribute('href')).toBe('rsvp.html');
  });
});
