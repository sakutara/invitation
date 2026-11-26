/** Month grid for the "heart on the calendar" block, plus .ics / Google Calendar exports of the wedding events. */
import type { EventDetails, WeddingConfig } from './types';

export interface MonthGrid {
  year: number;
  month: number; // 1..12
  day: number;
  /** Monday-first weeks; null = padding cell outside the month. */
  weeks: (number | null)[][];
}

export const WEEKDAY_HEADERS_VI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Uses the wall-clock date of the ISO string (no timezone conversion), like formatViDateTime. */
export function monthGrid(iso: string): MonthGrid | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const [year, month, day] = [+m[1], +m[2], +m[3]];
  const first = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // 0 = Monday
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, day, weeks };
}

/** '2027-01-17T16:30:00+07:00' -> '20270117T093000Z' (null for unparseable input). */
export function toIcsUtc(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

function eventLocation(e: EventDetails): string {
  return [e.venueName, e.hallName, e.address].filter(Boolean).join(', ');
}

const EVENT_HOURS = { ceremony: 2, reception: 3 } as const;

/** iCalendar file with the ceremony and the reception (each with a 1-day reminder). */
export function buildIcs(config: WeddingConfig, stamp = new Date()): string {
  const couple = `${config.groomName} & ${config.brideName}`;
  const dtstamp = toIcsUtc(stamp.toISOString())!;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//wedding-webapp//invite//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const key of ['ceremony', 'reception'] as const) {
    const e = config[key];
    const start = toIcsUtc(e.datetime);
    if (!start) continue;
    const end = toIcsUtc(new Date(Date.parse(e.datetime) + EVENT_HOURS[key] * 3600_000).toISOString())!;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${key}-${start}@wedding-webapp`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${icsText(`${e.title} · ${couple}`)}`,
      `LOCATION:${icsText(eventLocation(e))}`,
      ...(e.mapsUrl || config.googleMapsUrl ? [`URL:${e.mapsUrl || config.googleMapsUrl}`] : []),
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsText(`Ngày mai: ${e.title} ${couple}`)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function googleCalendarUrl(config: WeddingConfig, e: EventDetails, hours = 3): string | null {
  const start = toIcsUtc(e.datetime);
  if (!start) return null;
  const end = toIcsUtc(new Date(Date.parse(e.datetime) + hours * 3600_000).toISOString())!;
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${e.title} · ${config.groomName} & ${config.brideName}`,
    dates: `${start}/${end}`,
    location: eventLocation(e),
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
