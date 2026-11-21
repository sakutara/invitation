/**
 * Visual banquet seating plan: pure, browser-safe helpers (no node imports).
 * The admin editor (src/backend/admin/seating-editor.js) gets its auto-layout from the
 * POST /api/seating-layout/auto endpoint, so this file stays the single source of truth.
 */
import { SEATING_CANVAS, SEATING_ZONES, type SeatingLayout, type SeatingTable, type SeatingZone, type ZoneId } from './types';

/** Table radius in canvas units (1000x700). Tables closer than 2 * TABLE_RADIUS would overlap. */
export const TABLE_RADIUS = 22;
export const MAX_TABLES = 80;
export const MIN_TABLES = 1;

const W = SEATING_CANVAS.width;
const H = SEATING_CANVAS.height;
const AISLE_CENTER_X = SEATING_CANVAS.aisle.x + SEATING_CANVAS.aisle.w / 2;
const AISLE_HALF = SEATING_CANVAS.aisle.w / 2;
/** Usable vertical band for table centers: below the stage and aisle top. */
const Y_MIN = 140;
const Y_MAX = H - 40;
/** Horizontal band for table centers, per block (left block mirrors the right one). */
const X_MIN = 62;
const X_MAX = AISLE_CENTER_X - AISLE_HALF - 30 - TABLE_RADIUS;
/** Maximum spacing so few tables do not spread over the whole hall. */
const CAP_X = 150;
const CAP_Y = 130;

const ZONE_IDS = SEATING_ZONES.map((z) => z.id);

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.trunc(v)));

function tableId(n: number): string {
  return `t${n}`;
}

/**
 * Grid for `count` tables: `c` columns per block (left/right of the aisle), rows filled top to bottom.
 * Picks the column count that maximises the smallest spacing (capped), so 30 tables spread wider than 60.
 */
function pickGrid(count: number): { cols: number; rows: number; dx: number; dy: number } {
  const spanX = X_MAX - X_MIN;
  let best: { cols: number; rows: number; dx: number; dy: number; score: number; empty: number } | null = null;
  for (let c = 1; c <= count; c++) {
    const rows = Math.ceil(count / (2 * c));
    const dxRaw = c > 1 ? spanX / (c - 1) : CAP_X;
    const dyRaw = rows > 1 ? (Y_MAX - Y_MIN) / (rows - 1) : CAP_Y;
    const dx = Math.min(CAP_X, dxRaw);
    const dy = Math.min(CAP_Y, dyRaw);
    const score = Math.min(dx, dy);
    const empty = rows * 2 * c - count;
    if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && empty < best.empty)) {
      best = { cols: c, rows, dx, dy, score, empty };
    }
    if (rows === 1) break; // more columns only shrink spacing once a single row holds everything
  }
  return best!;
}

/** Auto layout: two blocks left/right of the aisle, numbered row by row (left→right, then right block). */
export function autoLayout(count: number, prev?: SeatingLayout | null): SeatingLayout {
  const n = clampInt(Number(count) || MIN_TABLES, MIN_TABLES, MAX_TABLES);
  const { cols, rows, dx, dy } = pickGrid(n);
  const prevZone = new Map<number, ZoneId | null>();
  for (const t of prev?.tables ?? []) prevZone.set(t.number, t.zoneId ?? null);

  const gridH = (rows - 1) * dy;
  const top = (Y_MIN + Y_MAX) / 2 - gridH / 2;
  const leftCenter = (X_MIN + X_MAX) / 2;
  const rightCenter = W - leftCenter;

  const tables: SeatingTable[] = [];
  let number = 0;
  for (let r = 0; r < rows; r++) {
    const k = Math.min(2 * cols, n - r * 2 * cols);
    const left = Math.ceil(k / 2);
    const right = k - left;
    const y = top + r * dy;
    const place = (cnt: number, mid: number) => {
      for (let i = 0; i < cnt; i++) {
        const x = mid + (i - (cnt - 1) / 2) * dx;
        number++;
        tables.push({ id: tableId(number), number, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, zoneId: prevZone.get(number) ?? null });
      }
    };
    place(left, leftCenter);
    place(right, rightCenter);
  }
  return { version: 1, tables };
}

/** Parse "Bàn 01 - Bàn 03", "Bàn 01, 03, 07" or mixes into table numbers. */
export function parseTableNumbers(range: string): number[] {
  const out = new Set<number>();
  for (const part of String(range ?? '').split(',')) {
    const m = part.match(/(\d+)\s*[-–]\s*(?:Bàn\s*)?(\d+)/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      for (let i = Math.min(a, b); i <= Math.max(a, b) && out.size < 1000; i++) out.add(i);
    } else {
      for (const d of part.match(/\d+/g) ?? []) out.add(Number(d));
    }
  }
  return [...out].filter((n) => n > 0).sort((a, b) => a - b);
}

/** Default layout from the zones' current tableRange, so the first editor open matches the old plan. */
export function layoutFromZones(zones: SeatingZone[]): SeatingLayout {
  const owner = new Map<number, ZoneId>();
  let maxNumber = 0;
  for (const z of zones) {
    for (const n of parseTableNumbers(z.tableRange)) {
      if (!owner.has(n)) owner.set(n, z.id);
      maxNumber = Math.max(maxNumber, n);
    }
  }
  const layout = autoLayout(Math.max(24, maxNumber));
  for (const t of layout.tables) t.zoneId = owner.get(t.number) ?? null;
  return layout;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Recompute tableRange / hallSide / row of every zone from the tables assigned to it. */
export function deriveZones(layout: SeatingLayout, zones: SeatingZone[]): SeatingZone[] {
  return zones.map((z) => {
    const tables = layout.tables.filter((t) => t.zoneId === z.id).sort((a, b) => a.number - b.number);
    if (tables.length === 0) return { ...z, tableRange: 'Chưa xếp bàn' };
    const nums = tables.map((t) => t.number);
    const contiguous = nums.every((n, i) => n === nums[0] + i);
    const tableRange =
      nums.length === 1
        ? `Bàn ${pad2(nums[0])}`
        : contiguous
          ? `Bàn ${pad2(nums[0])} - Bàn ${pad2(nums[nums.length - 1])}`
          : `Bàn ${nums.map(pad2).join(', ')}`;
    const meanX = tables.reduce((s, t) => s + t.x, 0) / tables.length;
    const meanY = tables.reduce((s, t) => s + t.y, 0) / tables.length;
    const leftCount = tables.filter((t) => t.x < AISLE_CENTER_X).length;
    const rightCount = tables.length - leftCount;
    const hallSide: SeatingZone['hallSide'] =
      Math.abs(meanX - AISLE_CENTER_X) <= 40 || Math.min(leftCount, rightCount) >= 0.4 * tables.length
        ? 'center'
        : meanX < AISLE_CENTER_X
          ? 'left'
          : 'right';
    const row: SeatingZone['row'] = hallSide === 'center' ? 'center' : meanY < 300 ? 'near_stage' : meanY < 480 ? 'middle' : 'lower';
    return { ...z, tableRange, hallSide, row };
  });
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Throws a plain Error (English message) when the value is not a valid layout. */
export function validateLayout(x: unknown): SeatingLayout {
  if (!isObj(x)) throw new Error('layout must be an object');
  if (x.version !== 1) throw new Error('layout.version must be 1');
  if (!Array.isArray(x.tables)) throw new Error('layout.tables must be an array');
  if (x.tables.length > MAX_TABLES) throw new Error(`layout.tables must have at most ${MAX_TABLES} tables`);
  const ids = new Set<string>();
  const numbers = new Set<number>();
  const tables: SeatingTable[] = x.tables.map((raw, i) => {
    if (!isObj(raw)) throw new Error(`table ${i} must be an object`);
    if (typeof raw.id !== 'string' || !raw.id.trim()) throw new Error(`table ${i}: id is required`);
    if (ids.has(raw.id)) throw new Error(`table ${i}: duplicate id ${raw.id}`);
    ids.add(raw.id);
    if (typeof raw.number !== 'number' || !Number.isInteger(raw.number) || raw.number < 1 || raw.number > 9999) {
      throw new Error(`table ${raw.id}: number must be an integer 1..9999`);
    }
    if (numbers.has(raw.number)) throw new Error(`table ${raw.id}: duplicate number ${raw.number}`);
    numbers.add(raw.number);
    if (typeof raw.x !== 'number' || !Number.isFinite(raw.x) || raw.x < 0 || raw.x > W) throw new Error(`table ${raw.id}: x out of canvas`);
    if (typeof raw.y !== 'number' || !Number.isFinite(raw.y) || raw.y < 0 || raw.y > H) throw new Error(`table ${raw.id}: y out of canvas`);
    const zoneId = raw.zoneId ?? null;
    if (zoneId !== null && !(ZONE_IDS as string[]).includes(zoneId as string)) throw new Error(`table ${raw.id}: unknown zoneId`);
    return { id: raw.id, number: raw.number, x: raw.x, y: raw.y, zoneId: zoneId as ZoneId | null };
  });
  return { version: 1, tables };
}
