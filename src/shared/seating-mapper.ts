/** Reception seating zone routing + SVG floor plan (okf/invitation_and_seating_rules.md §4). */
import { resolveRelationship } from './guest-codec';
import { normalizeSalutation } from './invitation-formatter';
import { COLOR_TOKENS, SEATING_CANVAS, SEATING_ZONES, type HallSide, type SeatingLayout, type SeatingTable, type SeatingZone, type ZoneId } from './types';

export interface SeatingAssignment {
  zoneId: ZoneId;
  zone: SeatingZone;
  color: string;
  seatCount: number;
  sideLabelVi: string;
  guidance: string;
}

export const SIDE_LABELS_VI: Record<HallSide, string> = {
  left: 'bên trái sân khấu (nhà trai)',
  right: 'bên phải sân khấu (nhà gái)',
  center: 'khu vực trung tâm sảnh',
};

export function mapSeating(
  guest: { salutation?: string; relationship: string | number; count: number },
  zones: SeatingZone[] = SEATING_ZONES,
): SeatingAssignment {
  const key = resolveRelationship(guest.relationship) ?? 'other';
  const zone = zones.find((z) => z.relationship === key) ?? zones.find((z) => z.relationship === 'other') ?? SEATING_ZONES[6];
  const seatCount = Math.min(20, Math.max(1, Math.trunc(Number(guest.count)) || 1));
  const sideLabelVi = SIDE_LABELS_VI[zone.hallSide];
  const salutation = normalizeSalutation(guest.salutation);
  const guidance = `Ban tổ chức đã chuẩn bị ${seatCount} chỗ ngồi tại ${zone.nameVi} (${zone.tableRange}). Khi đến sảnh, ${salutation} vui lòng di chuyển theo lối đi chính về phía ${sideLabelVi}.`;
  return { zoneId: zone.id, zone, color: zone.color, seatCount, sideLabelVi, guidance };
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const PASTEL: Record<string, string> = {
  '#38BDF8': COLOR_TOKENS['--color-sky-blue-pastel'],
  '#EC4899': COLOR_TOKENS['--color-lotus-pink-pastel'],
  '#7A1C24': '#F6E4E6',
};

/** Grid slot (column, row) of each zone on a 600x560 plan. */
function slot(z: SeatingZone): { x: number; y: number; w: number; h: number } {
  const rowY = { near_stage: 110, middle: 230, lower: 350, center: 478 } as const;
  if (z.hallSide === 'center') return { x: 170, y: rowY.center, w: 260, h: 70 };
  return { x: z.hallSide === 'left' ? 24 : 340, y: rowY[z.row], w: 236, h: 104 };
}

export interface SeatingSvgOptions {
  zoneId?: ZoneId | null;
  seatCount?: number;
  /** Visual floor plan. When it has tables the layout-mode drawing is used; otherwise the legacy zone grid. */
  layout?: SeatingLayout | null;
  /** Extra attributes on the root <svg> (e.g. width/height for rasterizing). */
  width?: number;
  height?: number;
  idPrefix?: string;
}

/** Canvas (1000x700) -> 600x560 view: scale 0.58, centred vertically. */
const LAYOUT_SCALE = 0.58;
const LAYOUT_OFF_X = 10;
const LAYOUT_OFF_Y = (560 - SEATING_CANVAS.height * LAYOUT_SCALE) / 2;
const TABLE_R = 22;

function toView(x: number, y: number): [number, number] {
  return [LAYOUT_OFF_X + x * LAYOUT_SCALE, LAYOUT_OFF_Y + y * LAYOUT_SCALE];
}

function renderLayoutSvg(zones: SeatingZone[], layout: SeatingLayout, opts: SeatingSvgOptions): string {
  const navy = COLOR_TOKENS['--color-navy'];
  const ivory = COLOR_TOKENS['--color-ivory'];
  const cream = COLOR_TOKENS['--color-cream'];
  const burgundy = COLOR_TOKENS['--color-burgundy'];
  const size = opts.width ? ` width="${opts.width}" height="${opts.height ?? Math.round((opts.width * 560) / 600)}"` : '';
  const { stage, aisle } = SEATING_CANVAS;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 560"${size} role="img" aria-label="Sơ đồ bàn tiệc" class="seating-map seating-map--layout">`,
    `<rect x="0" y="0" width="600" height="560" rx="18" fill="${ivory}" stroke="${navy}" stroke-width="2"/>`,
    `<g transform="translate(${LAYOUT_OFF_X} ${LAYOUT_OFF_Y.toFixed(2)}) scale(${LAYOUT_SCALE})">`,
    `<g data-role="stage"><rect x="${stage.x}" y="${stage.y}" width="${stage.w}" height="${stage.h}" rx="14" fill="${navy}"/>` +
      `<text x="${stage.x + stage.w / 2}" y="${stage.y + stage.h / 2 + 12}" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="${ivory}" letter-spacing="6">SÂN KHẤU</text></g>`,
    `<g data-role="aisle"><rect x="${aisle.x}" y="${aisle.top}" width="${aisle.w}" height="${SEATING_CANVAS.height - aisle.top}" fill="${cream}" stroke="${burgundy}" stroke-dasharray="12 10" stroke-width="2"/>` +
      `<text x="${aisle.x + aisle.w / 2}" y="420" text-anchor="middle" font-family="sans-serif" font-size="26" fill="${burgundy}" transform="rotate(-90 ${aisle.x + aisle.w / 2} 420)">LỐI ĐI CHÍNH</text></g>`,
  );

  const byZone = new Map<ZoneId, SeatingTable[]>();
  const unassigned: SeatingTable[] = [];
  for (const t of layout.tables) {
    if (!t.zoneId) {
      unassigned.push(t);
      continue;
    }
    const list = byZone.get(t.zoneId) ?? [];
    list.push(t);
    byZone.set(t.zoneId, list);
  }

  const boxes = new Map<ZoneId, { minX: number; minY: number; maxX: number; maxY: number; cx: number; cy: number; color: string }>();
  for (const z of zones) {
    const ts = byZone.get(z.id);
    if (!ts?.length) continue;
    const hi = z.id === opts.zoneId;
    const xs = ts.map((t) => t.x);
    const ys = ts.map((t) => t.y);
    const minX = Math.min(...xs) - TABLE_R - 14;
    const maxX = Math.max(...xs) + TABLE_R + 14;
    const minY = Math.max(SEATING_CANVAS.aisle.top - 6, Math.min(...ys) - TABLE_R - 44);
    const maxY = Math.max(...ys) + TABLE_R + 14;
    const cx = ts.reduce((s, t) => s + t.x, 0) / ts.length;
    const cy = ts.reduce((s, t) => s + t.y, 0) / ts.length;
    boxes.set(z.id, { minX, minY, maxX, maxY, cx, cy, color: z.color });
    const [code] = z.nameVi.split(' - ');
    const tint = PASTEL[z.color] ?? '#F3F4F6';
    const circles = ts
      .map((t) => {
        const fill = hi ? z.color : '#FFFFFF';
        const stroke = hi ? z.color : z.color === '#7A1C24' ? burgundy : navy;
        const numFill = hi ? '#FFFFFF' : navy;
        return (
          `<circle cx="${t.x}" cy="${t.y}" r="${TABLE_R}" fill="${fill}" stroke="${stroke}" stroke-width="${hi ? 3 : 2}"/>` +
          `<text x="${t.x}" y="${t.y + 6}" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="700" fill="${numFill}">${t.number}</text>`
        );
      })
      .join('');
    // A zone may be split across the aisle or interleaved with other zones, so a single bounding box would
    // cover foreign tables. Draw a tinted halo per table instead, plus one label per side-of-aisle cluster.
    const halos = ts
      .map((t) => `<circle cx="${t.x}" cy="${t.y}" r="${TABLE_R + 12}" fill="${tint}" stroke="${z.color}" stroke-width="${hi ? 4 : 1.5}"/>`)
      .join('');
    const aisleMid = SEATING_CANVAS.aisle.x + SEATING_CANVAS.aisle.w / 2;
    const labels = [ts.filter((t) => t.x < aisleMid), ts.filter((t) => t.x >= aisleMid)]
      .filter((side) => side.length)
      .map((side) => {
        const first = side.reduce((a, b) => (b.y < a.y - 1 || (Math.abs(b.y - a.y) <= 1 && b.x < a.x) ? b : a));
        const w = code.length * 11 + 16;
        const lx = first.x - w / 2;
        const ly = first.y - TABLE_R - 40;
        return (
          `<rect x="${lx}" y="${ly}" width="${w}" height="24" rx="12" fill="${z.color}"/>` +
          `<text x="${first.x}" y="${ly + 17}" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#FFFFFF">${escapeXml(code)}</text>`
        );
      })
      .join('');
    parts.push(
      `<g data-zone="${z.id}" data-highlight="${hi}" class="seating-zone${hi ? ' seating-zone--active' : ''}">` + halos + circles + labels + `</g>`,
    );
  }

  if (unassigned.length) {
    parts.push(
      `<g data-role="unassigned">` +
        unassigned
          .map(
            (t) =>
              `<circle cx="${t.x}" cy="${t.y}" r="${TABLE_R}" fill="#E5E7EB" stroke="#9CA3AF" stroke-width="2"/>` +
              `<text x="${t.x}" y="${t.y + 6}" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="700" fill="#374151">${t.number}</text>`,
          )
          .join('') +
        `</g>`,
    );
  }
  parts.push('</g>');

  const target = opts.zoneId ? boxes.get(opts.zoneId) : undefined;
  if (target) {
    const [ex, ey] = toView(SEATING_CANVAS.aisle.x + SEATING_CANVAS.aisle.w / 2, SEATING_CANVAS.height - 10);
    const [tx, ty] = toView(target.cx, target.cy);
    const [bx0, by0] = toView(target.minX, target.minY);
    const [bx1] = toView(target.maxX, target.minY);
    const seats = opts.seatCount ?? 1;
    const badgeW = 88;
    const badgeX = Math.min(596 - badgeW, Math.max(4, (bx0 + bx1) / 2 - badgeW / 2));
    const badgeY = Math.max(4, by0 - 16);
    parts.push(
      `<path data-role="route" d="M${ex.toFixed(1)} ${ey.toFixed(1)} L${ex.toFixed(1)} ${ty.toFixed(1)} L${tx.toFixed(1)} ${ty.toFixed(1)}" fill="none" stroke="${target.color}" stroke-width="4" stroke-linecap="round" stroke-dasharray="10 8"/>` +
        `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="7" fill="${navy}"/>`,
      `<g data-role="seat-badge"><rect x="${badgeX.toFixed(1)}" y="${badgeY.toFixed(1)}" width="${badgeW}" height="30" rx="15" fill="${target.color}"/>` +
        `<text x="${(badgeX + badgeW / 2).toFixed(1)}" y="${(badgeY + 21).toFixed(1)}" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#FFFFFF">${seats} chỗ</text></g>`,
    );
  }
  parts.push('</svg>');
  return parts.join('');
}

export function renderSeatingMapSvg(zones: SeatingZone[], opts: SeatingSvgOptions = {}): string {
  if (opts.layout && opts.layout.tables.length > 0) return renderLayoutSvg(zones, opts.layout, opts);
  const navy = COLOR_TOKENS['--color-navy'];
  const ivory = COLOR_TOKENS['--color-ivory'];
  const cream = COLOR_TOKENS['--color-cream'];
  const burgundy = COLOR_TOKENS['--color-burgundy'];
  const size = opts.width ? ` width="${opts.width}" height="${opts.height ?? Math.round((opts.width * 560) / 600)}"` : '';
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 560"${size} role="img" aria-label="Sơ đồ bàn tiệc" class="seating-map">`,
    `<rect x="0" y="0" width="600" height="560" rx="18" fill="${ivory}" stroke="${navy}" stroke-width="2"/>`,
    `<g data-role="stage"><rect x="150" y="18" width="300" height="62" rx="10" fill="${navy}"/>` +
      `<text x="300" y="56" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="${ivory}" letter-spacing="3">SÂN KHẤU</text></g>`,
    `<g data-role="aisle"><rect x="278" y="88" width="44" height="366" fill="${cream}" stroke="${burgundy}" stroke-dasharray="6 6" stroke-width="1.5"/>` +
      `<text x="300" y="260" text-anchor="middle" font-family="sans-serif" font-size="12" fill="${burgundy}" transform="rotate(-90 300 260)">LỐI ĐI CHÍNH</text></g>`,
  );
  const target = zones.find((z) => z.id === opts.zoneId);
  for (const z of zones) {
    const { x, y, w, h } = slot(z);
    const hi = z.id === opts.zoneId;
    const [code, ...rest] = z.nameVi.split(' - ');
    const fill = hi ? PASTEL[z.color] ?? cream : '#FFFFFF';
    const stroke = hi ? z.color : navy;
    const tables = Math.max(2, Math.min(4, (() => {
      const m = z.tableRange.match(/(\d+)\D+(\d+)/);
      return m ? Number(m[2]) - Number(m[1]) + 1 : 3;
    })()));
    const circles = Array.from({ length: tables }, (_, i) => {
      const cx = x + (w / (tables + 1)) * (i + 1);
      return `<circle cx="${cx.toFixed(1)}" cy="${y + h - (h < 90 ? 13 : 26)}" r="${h < 90 ? 9 : 13}" fill="${hi ? z.color : cream}" stroke="${stroke}" stroke-width="1.5"/>`;
    }).join('');
    parts.push(
      `<g data-zone="${z.id}" data-highlight="${hi}" class="seating-zone${hi ? ' seating-zone--active' : ''}">` +
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${hi ? 5 : 1.5}"/>` +
        `<text x="${x + 14}" y="${y + 24}" font-family="Georgia, serif" font-size="17" font-weight="700" fill="${hi ? z.color === '#7A1C24' ? burgundy : navy : navy}">${escapeXml(code)}</text>` +
        `<text x="${x + 14}" y="${y + 44}" font-family="sans-serif" font-size="12" fill="#1F2937">${escapeXml(rest.join(' - '))}</text>` +
        `<text x="${x + w - 12}" y="${y + 24}" text-anchor="end" font-family="sans-serif" font-size="11" fill="#4B5563">${escapeXml(z.tableRange)}</text>` +
        circles +
        (hi
          ? `<g data-role="seat-badge"><rect x="${x + w - 74}" y="${y - 14}" width="70" height="28" rx="14" fill="${z.color}"/>` +
            `<text x="${x + w - 39}" y="${y + 5}" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#FFFFFF">${opts.seatCount ?? 1} chỗ</text></g>`
          : '') +
        `</g>`,
    );
  }
  if (target) {
    const { x, y, w, h } = slot(target);
    const tx = target.hallSide === 'left' ? x + w : target.hallSide === 'right' ? x : x + w / 2;
    const ty = target.hallSide === 'center' ? y : y + h / 2;
    const d = target.hallSide === 'center' ? `M300 462 L300 ${y}` : `M300 462 L300 ${ty} L${tx} ${ty}`;
    parts.push(
      `<path data-role="route" d="${d}" fill="none" stroke="${target.color}" stroke-width="4" stroke-linecap="round" stroke-dasharray="10 8"/>` +
        `<circle cx="300" cy="462" r="7" fill="${target.color}"/>`,
    );
  }
  parts.push('</svg>');
  return parts.join('');
}
