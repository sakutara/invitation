import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderCardSvg, svgTextContent, wrapText } from '../../src/shared/card-svg-template';
import { renderCardJpeg, generateCards, cardFileName } from '../../src/backend/bulk-card-generator';
import { guestSlugBase } from '../../src/shared/guest-codec';
import { DEFAULT_CONFIG } from '../../src/shared/default-config';
import { formatViDateTime } from '../../src/shared/date-format';
import { SEATING_ZONES } from '../../src/shared/types';

const GOLDEN = { salutation: 'chú thím', name: 'vợ chồng chú Chín', relationship: 'gia đình cô dâu', count: 2 };
const SENTENCE = 'Kính mời vợ chồng chú Chín đến chung vui cùng gia đình chúng tôi, sự hiện diện của chú thím là niềm vinh hạnh cho gia đình.';
const INPUT = { config: DEFAULT_CONFIG, zones: SEATING_ZONES, guest: GOLDEN, inviteUrl: 'https://example.com/invite.html?khach=vo-chong-chu-chin-gia-dinh-co-dau' };

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'wedding-card-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('helpers', () => {
  it('wrapText never splits words and respects max chars', () => {
    const lines = wrapText(SENTENCE, 40);
    expect(lines.join(' ')).toBe(SENTENCE);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(40);
  });

  it('formatViDateTime renders Vietnamese weekday and local time from ISO', () => {
    expect(formatViDateTime('2027-01-16T11:00:00+07:00')).toEqual({ time: '11:00', weekday: 'Thứ Bảy', date: '16/01/2027' });
    expect(formatViDateTime('2027-01-17T18:30:00+07:00').weekday).toBe('Chủ Nhật');
  });
});

describe('renderCardSvg (shared master template)', () => {
  const svg = renderCardSvg(INPUT);
  const text = svgTextContent(svg);

  it('is a 1080x1620 SVG', () => {
    expect(svg).toMatch(/^<svg[^>]*width="1080"[^>]*height="1620"/);
    expect(svg).toContain('viewBox="0 0 1080 1620"');
  });

  it('follows the printed card: guest on the dotted line, couple, venue, time table, lunar date, families', () => {
    for (const s of [
      'TRÂN TRỌNG KÍNH MỜI', 'vợ chồng chú Chín', 'TỚI DỰ BỮA CƠM THÂN MẬT MỪNG LỄ THÀNH HÔN', DEFAULT_CONFIG.groomName, DEFAULT_CONFIG.brideName,
      'ĐƯỢC TỔ CHỨC TẠI', DEFAULT_CONFIG.reception.address, 'VÀO LÚC', formatViDateTime(DEFAULT_CONFIG.reception.datetime).time,
      'THỨ BẢY', '16.01.2027', 'Tức ngày 9 tháng 12 năm Bính Ngọ', 'Sự hiện diện của chú thím', 'Nhà Trai:', 'Nhà Gái:',
      DEFAULT_CONFIG.groomParents.father.toUpperCase(), DEFAULT_CONFIG.brideParents.mother.toUpperCase(),
    ]) expect(text.replace(/\s+/g, ' '), s).toContain(s);
    expect(svg).toContain('data-role="qr"');
    expect(svg).toContain('#3F5F7B'); // dusty-blue folder
    expect(svg).toContain('#6B1A34'); // wine script
    expect(text).toContain('2 chỗ');
  });

  it('addresses a guest-less card to "Quý khách" / "Quý vị"', () => {
    const t = svgTextContent(renderCardSvg({ ...INPUT, guest: null }));
    expect(t).toContain('Quý khách');
    expect(t).toContain('Sự hiện diện của Quý vị');
  });

  it('escapes user-provided text', () => {
    const s = renderCardSvg({ ...INPUT, guest: { ...GOLDEN, name: 'anh <Tom> & "Jerry"' } });
    expect(s).toContain('anh &lt;Tom&gt; &amp; &quot;Jerry&quot;');
  });
});

describe('renderCardJpeg', () => {
  it('produces a valid 1080x1620 JPEG: ivory card on the dusty-blue folder', async () => {
    const buf = await renderCardJpeg(INPUT);
    expect([...buf.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    const meta = await sharp(buf).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1080, 1620]);
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
    const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 24);
    expect(near(px(540, 20), [0x3f, 0x5f, 0x7b])).toBe(true); // folder above the card
    expect(near(px(160, 700), [0xf4, 0xf4, 0xee])).toBe(true); // card paper
  });
});

describe('generateCards (bulk)', () => {
  it('names files <Row_ID>_<Short_ID>_<Slug>.jpg with ASCII slugs', () => {
    expect(cardFileName({ rowId: '12', shortId: 'c9a2f1', name: 'vợ chồng chú Chín' })).toBe('12_c9a2f1_vo-chong-chu-chin.jpg');
    expect(cardFileName({ rowId: 'R/3', shortId: 'abcdef', name: 'Đặng Thị Ánh' })).toBe('R-3_abcdef_dang-thi-anh.jpg');
  });

  it('is vector only (no photos to fetch before saving)', () => {
    expect(renderCardSvg(INPUT)).not.toContain('<image');
  });

  it('omits table guidance (but keeps the map) when there is no guest', () => {
    const text = svgTextContent(renderCardSvg({ ...INPUT, guest: null }));
    expect(text).not.toMatch(/chỗ ngồi/);
    expect(renderCardSvg({ ...INPUT, guest: null })).not.toContain('data-highlight="true"');
  });

  it('renders one JPEG per guest', async () => {
    const guests = [
      { rowId: '1', shortId: 'c9a2f1', ...GOLDEN },
      { rowId: '2', shortId: 'a1b2c3', salutation: 'anh', name: 'anh Tuấn', relationship: 'bạn bè chú rể', count: 1 },
      { rowId: '3', shortId: 'ffee00', salutation: 'bạn', name: 'bạn Lan', relationship: 'khác...', count: 1 },
    ];
    const results = await generateCards(guests, { config: DEFAULT_CONFIG, zones: SEATING_ZONES, outDir: dir });
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(existsSync(r.path)).toBe(true);
      const meta = await sharp(readFileSync(r.path)).metadata();
      expect([meta.width, meta.height]).toEqual([1080, 1620]);
      expect(r.inviteUrl).toBe(`${DEFAULT_CONFIG.siteBaseUrl.replace(/\/$/, '')}/invite.html?khach=${guestSlugBase(guests.find((g) => g.rowId === r.rowId)!)}`);
    }
  });
});
