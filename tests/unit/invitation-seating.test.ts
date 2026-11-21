import { describe, it, expect } from 'vitest';
import { formatInvitation, normalizeSalutation } from '../../src/shared/invitation-formatter';
import { mapSeating, renderSeatingMapSvg } from '../../src/shared/seating-mapper';
import { layoutFromZones } from '../../src/shared/seating-layout';
import { SEATING_ZONES } from '../../src/shared/types';

const GOLDEN_SENTENCE =
  'Kính mời vợ chồng chú Chín đến chung vui cùng gia đình chúng tôi, sự hiện diện của chú thím là niềm vinh hạnh cho gia đình.';

describe('formatInvitation', () => {
  it('produces the golden sentence', () => {
    expect(formatInvitation({ salutation: 'chú thím', name: 'vợ chồng chú Chín' })).toBe(GOLDEN_SENTENCE);
  });

  it('trims and collapses whitespace, preserves proper nouns in name', () => {
    expect(formatInvitation({ salutation: '  chú   thím ', name: ' vợ  chồng   chú Chín  ' })).toBe(GOLDEN_SENTENCE);
  });

  it('lowercases capitalised salutations mid-sentence', () => {
    expect(formatInvitation({ salutation: 'Chú Thím', name: 'vợ chồng chú Chín' })).toBe(GOLDEN_SENTENCE);
    expect(formatInvitation({ salutation: 'Anh Chị', name: 'vợ chồng anh Tuấn' })).toContain('sự hiện diện của anh chị là');
  });

  it('keeps proper nouns inside salutation capitalised', () => {
    expect(normalizeSalutation('Anh Tuấn')).toBe('anh Tuấn');
    expect(normalizeSalutation('Hai Bác')).toBe('hai bác');
  });

  it.each([
    [{}],
    [{ salutation: '', name: '   ' }],
    [null],
  ])('falls back to bạn defaults for %j', (input) => {
    expect(formatInvitation(input as never)).toBe(
      'Kính mời bạn đến chung vui cùng gia đình chúng tôi, sự hiện diện của bạn là niềm vinh hạnh cho gia đình.',
    );
  });

  it('normalizes NFD input to NFC', () => {
    expect(formatInvitation({ salutation: 'chú thím'.normalize('NFD'), name: 'vợ chồng chú Chín'.normalize('NFD') })).toBe(GOLDEN_SENTENCE);
  });
});

describe('mapSeating', () => {
  it('routes the golden bride-family guest to ZONE_B1 in Lotus Pink with 2 seats', () => {
    const s = mapSeating({ salutation: 'chú thím', relationship: 'gia đình cô dâu', count: 2 });
    expect(s.zoneId).toBe('ZONE_B1');
    expect(s.zone.hallSide).toBe('right');
    expect(s.color).toBe('#EC4899');
    expect(s.seatCount).toBe(2);
    expect(s.guidance).toBe(
      'Ban tổ chức đã chuẩn bị 2 chỗ ngồi tại Khu B1 - Gia đình & Họ hàng Cô Dâu (Bàn 04 - Bàn 06). Khi đến sảnh, chú thím vui lòng di chuyển theo lối đi chính về phía bên phải sân khấu (nhà gái).',
    );
  });

  it.each([
    ['groom_family', 'ZONE_A1', '#38BDF8', 'left'],
    ['bride_family', 'ZONE_B1', '#EC4899', 'right'],
    ['groom_friends', 'ZONE_A2', '#38BDF8', 'left'],
    ['bride_friends', 'ZONE_B2', '#EC4899', 'right'],
    ['groom_parents_friends', 'ZONE_A3', '#38BDF8', 'left'],
    ['bride_parents_friends', 'ZONE_B3', '#EC4899', 'right'],
    ['other', 'ZONE_C1', '#7A1C24', 'center'],
  ])('%s -> %s', (rel, zone, color, side) => {
    const s = mapSeating({ salutation: 'bạn', relationship: rel, count: 1 });
    expect([s.zoneId, s.color, s.zone.hallSide]).toEqual([zone, color, side]);
  });

  it('routes unknown relationships to the shared zone and clamps count', () => {
    const s = mapSeating({ salutation: 'bạn', relationship: 'hàng xóm', count: 0 });
    expect(s.zoneId).toBe('ZONE_C1');
    expect(s.seatCount).toBe(1);
  });

  it('honours CMS-edited zones', () => {
    const zones = SEATING_ZONES.map((z) => (z.id === 'ZONE_B1' ? { ...z, tableRange: 'Bàn 30 - Bàn 31' } : z));
    expect(mapSeating({ salutation: 'cô', relationship: 'bride_family', count: 3 }, zones).guidance).toContain('(Bàn 30 - Bàn 31)');
  });
});

describe('renderSeatingMapSvg', () => {
  it('renders stage, aisle and all 7 zones, highlighting only the assigned zone', () => {
    const svg = renderSeatingMapSvg(SEATING_ZONES, { zoneId: 'ZONE_B1', seatCount: 2 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('data-role="stage"');
    expect(svg).toContain('data-role="aisle"');
    for (const z of SEATING_ZONES) expect(svg).toContain(`data-zone="${z.id}"`);
    expect(svg.match(/data-highlight="true"/g)).toHaveLength(1);
    expect(svg).toMatch(/data-zone="ZONE_B1"[^>]*data-highlight="true"/);
    expect(svg).toContain('#EC4899');
    expect(svg).toContain('2 chỗ');
  });

  it('escapes XML special characters in zone names', () => {
    const svg = renderSeatingMapSvg(SEATING_ZONES, { zoneId: 'ZONE_A1', seatCount: 1 });
    expect(svg).toContain('Gia đình &amp; Họ hàng');
    expect(svg).not.toMatch(/& Họ/);
  });
});

describe('renderSeatingMapSvg layout mode', () => {
  const layout = layoutFromZones(SEATING_ZONES);

  it('draws the 600x560 plan with one data-zone group per zone that has tables', () => {
    const svg = renderSeatingMapSvg(SEATING_ZONES, { zoneId: 'ZONE_B1', seatCount: 2, layout });
    expect(svg).toContain('viewBox="0 0 600 560"');
    expect(svg).toContain('data-role="stage"');
    expect(svg).toContain('data-role="aisle"');
    for (const z of SEATING_ZONES) expect(svg).toContain(`data-zone="${z.id}"`);
    expect(svg.match(/data-highlight="true"/g)).toHaveLength(1);
    expect(svg).toMatch(/data-zone="ZONE_B1"[^>]*data-highlight="true"/);
    expect(svg.match(/<circle /g)!.length).toBeGreaterThanOrEqual(24);
  });

  it('adds the seat badge and route only for the highlighted zone', () => {
    const svg = renderSeatingMapSvg(SEATING_ZONES, { zoneId: 'ZONE_B1', seatCount: 2, layout });
    expect(svg).toContain('data-role="seat-badge"');
    expect(svg).toContain('2 chỗ');
    expect(svg).toContain('data-role="route"');
    expect(svg.match(/data-role="route"/g)).toHaveLength(1);
  });

  it('draws unassigned tables in a separate grey group', () => {
    const partial = { ...layout, tables: layout.tables.map((t) => (t.number === 24 ? { ...t, zoneId: null } : t)) };
    const svg = renderSeatingMapSvg(SEATING_ZONES, { zoneId: null, layout: partial });
    expect(svg).toContain('data-role="unassigned"');
    expect(svg).not.toContain('seat-badge');
    expect(svg).not.toContain('data-role="route"');
  });

  it('falls back to the legacy zone grid when the layout has no tables', () => {
    const legacy = renderSeatingMapSvg(SEATING_ZONES, { zoneId: 'ZONE_B1', seatCount: 2 });
    expect(renderSeatingMapSvg(SEATING_ZONES, { zoneId: 'ZONE_B1', seatCount: 2, layout: { version: 1, tables: [] } })).toBe(legacy);
  });

  it('escapes zone names in layout mode', () => {
    const svg = renderSeatingMapSvg(SEATING_ZONES, { zoneId: 'ZONE_A1', seatCount: 1, layout });
    expect(svg).not.toMatch(/& Họ/);
  });
});
