import { describe, it, expect } from 'vitest';
import {
  autoLayout,
  deriveZones,
  layoutFromZones,
  parseTableNumbers,
  validateLayout,
  TABLE_RADIUS,
} from '../../src/shared/seating-layout';
import { SEATING_CANVAS, SEATING_ZONES, type SeatingLayout } from '../../src/shared/types';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const minPairDistance = (layout: SeatingLayout) => {
  let min = Infinity;
  const t = layout.tables;
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) min = Math.min(min, dist(t[i], t[j]));
  return min;
};
const stageBottom = SEATING_CANVAS.stage.y + SEATING_CANVAS.stage.h;

describe('autoLayout', () => {
  it.each([30, 45, 60, 80])('places %i tables inside the canvas without overlaps or aisle intrusion', (n) => {
    const layout = autoLayout(n);
    expect(layout.version).toBe(1);
    expect(layout.tables).toHaveLength(n);
    const { width, height, aisle } = SEATING_CANVAS;
    for (const t of layout.tables) {
      expect(t.x).toBeGreaterThanOrEqual(TABLE_RADIUS);
      expect(t.x).toBeLessThanOrEqual(width - TABLE_RADIUS);
      expect(t.y).toBeGreaterThan(stageBottom + TABLE_RADIUS);
      expect(t.y).toBeLessThanOrEqual(height - TABLE_RADIUS);
      const inAisle = t.x > aisle.x - TABLE_RADIUS && t.x < aisle.x + aisle.w + TABLE_RADIUS;
      expect(inAisle).toBe(false);
    }
    expect(minPairDistance(layout)).toBeGreaterThanOrEqual(2 * TABLE_RADIUS);
  });

  it('spreads tables wider at 30 than at 60', () => {
    expect(minPairDistance(autoLayout(30))).toBeGreaterThan(minPairDistance(autoLayout(60)));
  });

  it('numbers tables 1..n row by row with ids t<number>, unique', () => {
    const layout = autoLayout(24);
    expect(layout.tables.map((t) => t.number)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(layout.tables[0].id).toBe('t1');
    expect(new Set(layout.tables.map((t) => t.id)).size).toBe(24);
    // Row-major: table 1 is the top-left of the left block, and the first row is above the second.
    expect(layout.tables[0].y).toBeLessThan(layout.tables[layout.tables.length - 1].y);
    expect(layout.tables[0].x).toBeLessThan(AISLE_X());
  });

  it('clamps the count to 1..80', () => {
    expect(autoLayout(0).tables).toHaveLength(1);
    expect(autoLayout(500).tables).toHaveLength(80);
  });

  it('keeps zoneId from prev layout by table number', () => {
    const prev: SeatingLayout = {
      version: 1,
      tables: [
        { id: 't1', number: 1, x: 0, y: 0, zoneId: 'ZONE_B1' },
        { id: 't2', number: 2, x: 0, y: 0, zoneId: 'ZONE_A1' },
      ],
    };
    const layout = autoLayout(5, prev);
    expect(layout.tables.find((t) => t.number === 1)?.zoneId).toBe('ZONE_B1');
    expect(layout.tables.find((t) => t.number === 2)?.zoneId).toBe('ZONE_A1');
    expect(layout.tables.find((t) => t.number === 3)?.zoneId).toBeNull();
  });
});

describe('layoutFromZones', () => {
  it('builds 24 tables from the default zones, each assigned to its zone', () => {
    const layout = layoutFromZones(SEATING_ZONES);
    expect(layout.tables).toHaveLength(24);
    const bnTable = (n: number) => layout.tables.find((t) => t.number === n);
    expect(bnTable(1)?.zoneId).toBe('ZONE_A1');
    expect(bnTable(4)?.zoneId).toBe('ZONE_B1');
    expect(bnTable(24)?.zoneId).toBe('ZONE_C1');
    expect(layout.tables.every((t) => t.zoneId !== null)).toBe(true);
  });
});

describe('parseTableNumbers', () => {
  it('parses ranges, lists and mixes', () => {
    expect(parseTableNumbers('Bàn 01 - Bàn 03')).toEqual([1, 2, 3]);
    expect(parseTableNumbers('Bàn 01, 03, 07')).toEqual([1, 3, 7]);
    expect(parseTableNumbers('Bàn 01 - Bàn 02, Bàn 09')).toEqual([1, 2, 9]);
    expect(parseTableNumbers('Chưa xếp bàn')).toEqual([]);
  });
});

describe('deriveZones', () => {
  const zones = SEATING_ZONES;
  const empty = () => {
    const layout = autoLayout(30);
    layout.tables = layout.tables.map((t) => ({ ...t, zoneId: null }));
    return layout;
  };
  const byNum = (layout: SeatingLayout, n: number) => layout.tables.find((t) => t.number === n)!;

  it('writes a contiguous range as "Bàn 01 - Bàn 03"', () => {
    const layout = empty();
    for (const n of [1, 2, 3]) byNum(layout, n).zoneId = 'ZONE_A1';
    const out = deriveZones(layout, zones).find((z) => z.id === 'ZONE_A1')!;
    expect(out.tableRange).toBe('Bàn 01 - Bàn 03');
    expect(out.hallSide).toBe('left');
    expect(out.row).toBe('near_stage');
  });

  it('writes non-contiguous numbers as a list', () => {
    const layout = empty();
    for (const n of [4, 6, 10]) byNum(layout, n).zoneId = 'ZONE_B1';
    const out = deriveZones(layout, zones).find((z) => z.id === 'ZONE_B1')!;
    expect(out.tableRange).toBe('Bàn 04, 06, 10');
    expect(out.hallSide).toBe('right');
  });

  it('reports "Chưa xếp bàn" when a zone has no tables and keeps its other fields', () => {
    const out = deriveZones(empty(), zones).find((z) => z.id === 'ZONE_C1')!;
    expect(out.tableRange).toBe('Chưa xếp bàn');
    expect(out).toEqual({ ...zones.find((z) => z.id === 'ZONE_C1')!, tableRange: 'Chưa xếp bàn' });
  });

  it('derives row from the mean height', () => {
    const layout = empty();
    const lowerLeft = layout.tables.filter((t) => t.x < 470 && t.y > 500);
    for (const t of lowerLeft) t.zoneId = 'ZONE_A2';
    const derived = deriveZones(layout, zones).find((z) => z.id === 'ZONE_A2')!;
    expect(derived.row).toBe('lower');
    expect(derived.hallSide).toBe('left');
  });

  it('marks a zone spread across both sides of the aisle as centre', () => {
    const layout = empty();
    for (const n of [1, 4]) byNum(layout, n).zoneId = 'ZONE_C1';
    expect(deriveZones(layout, zones).find((z) => z.id === 'ZONE_C1')!.hallSide).toBe('center');
  });
});

describe('validateLayout', () => {
  const ok = () => ({ version: 1, tables: [{ id: 't1', number: 1, x: 100, y: 200, zoneId: 'ZONE_A1' }] });

  it('accepts a valid layout', () => {
    expect(validateLayout(ok())).toEqual(ok());
  });

  it.each([
    ['not an object', null],
    ['wrong version', { ...ok(), version: 2 }],
    ['tables not array', { version: 1, tables: {} }],
    ['too many tables', { version: 1, tables: Array.from({ length: 81 }, (_, i) => ({ id: `t${i + 1}`, number: i + 1, x: 10, y: 200, zoneId: null })) }],
    ['duplicate id', { version: 1, tables: [{ id: 'a', number: 1, x: 1, y: 200, zoneId: null }, { id: 'a', number: 2, x: 1, y: 200, zoneId: null }] }],
    ['duplicate number', { version: 1, tables: [{ id: 'a', number: 1, x: 1, y: 200, zoneId: null }, { id: 'b', number: 1, x: 1, y: 200, zoneId: null }] }],
    ['x outside canvas', { version: 1, tables: [{ id: 'a', number: 1, x: 1200, y: 200, zoneId: null }] }],
    ['y not finite', { version: 1, tables: [{ id: 'a', number: 1, x: 1, y: NaN, zoneId: null }] }],
    ['unknown zone', { version: 1, tables: [{ id: 'a', number: 1, x: 1, y: 200, zoneId: 'ZONE_X' }] }],
  ])('rejects %s', (_label, value) => {
    expect(() => validateLayout(value)).toThrow(Error);
  });
});

function AISLE_X() {
  return SEATING_CANVAS.aisle.x;
}
