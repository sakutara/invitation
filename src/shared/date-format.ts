/** Deterministic Vietnamese date formatting from the wall-clock part of an ISO string (no TZ conversion). */
const WEEKDAYS_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function formatViDateTime(iso: string): { time: string; weekday: string; date: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso ?? '');
  if (!m) return { time: '', weekday: '', date: iso ?? '' };
  const [, y, mo, d, hh = '00', mm = '00'] = m;
  const weekday = WEEKDAYS_VI[new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay()];
  return { time: `${hh}:${mm}`, weekday, date: `${d}/${mo}/${y}` };
}

export function formatViDateLong(iso: string): string {
  const f = formatViDateTime(iso);
  return [f.time, f.weekday && `${f.weekday}, ${f.date}`].filter(Boolean).join(' · ');
}
