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

  it('contains all mandatory visual blocks', () => {
    expect(text).toContain(DEFAULT_CONFIG.groomName);
    expect(text).toContain(DEFAULT_CONFIG.brideName);
    expect(text).toContain('16/01/2027');
    expect(text).toContain(SENTENCE);
    expect(text).toContain(DEFAULT_CONFIG.reception.venueName);
    expect(text).toContain(DEFAULT_CONFIG.reception.address);
    expect(text).toContain(formatViDateTime(DEFAULT_CONFIG.ceremony.datetime).time);
    expect(svg).toContain('data-role="portrait"');
    expect(svg).toContain('data-role="qr"');
    expect(svg).toMatch(/data-zone="ZONE_B1"[^>]*data-highlight="true"/);
    expect(svg).toContain('#EC4899');
    expect(text).toContain('2 chỗ');
  });

  it('falls back to the default greeting for missing guest data', () => {
    expect(svgTextContent(renderCardSvg({ ...INPUT, guest: null }))).toContain('Kính mời bạn đến chung vui');
  });

  it('escapes user-provided text', () => {
    const s = renderCardSvg({ ...INPUT, guest: { ...GOLDEN, name: 'anh <Tom> & "Jerry"' } });
    expect(s).toContain('anh &lt;Tom&gt; &amp; &quot;Jerry&quot;');
  });
});

describe('renderCardJpeg', () => {
  it('produces a valid 1080x1620 JPEG with the Lotus Pink zone highlight', async () => {
    const buf = await renderCardJpeg(INPUT);
    expect([...buf.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    const meta = await sharp(buf).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1080, 1620]);
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    let pink = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (Math.abs(data[i] - 0xec) < 20 && Math.abs(data[i + 1] - 0x48) < 25 && Math.abs(data[i + 2] - 0x99) < 25) pink++;
    }
    expect(pink).toBeGreaterThan(500);
  });

  it('embeds a portrait image when provided', async () => {
    const portrait = await sharp({ create: { width: 400, height: 500, channels: 3, background: '#00ff00' } }).jpeg().toBuffer();
    const svg = renderCardSvg({ ...INPUT, portraitHref: `data:image/jpeg;base64,${portrait.toString('base64')}` });
    expect(svg).toContain('<image');
    const { data, info } = await sharp(await renderCardJpeg({ ...INPUT, portraitHref: `data:image/jpeg;base64,${portrait.toString('base64')}` }))
      .raw()
      .toBuffer({ resolveWithObject: true });
    let green = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i + 1] > 200 && data[i] < 60) green++;
    expect(green).toBeGreaterThan(10_000);
  });
});

describe('generateCards (bulk)', () => {
  it('names files <Row_ID>_<Short_ID>_<Slug>.jpg with ASCII slugs', () => {
    expect(cardFileName({ rowId: '12', shortId: 'c9a2f1', name: 'vợ chồng chú Chín' })).toBe('12_c9a2f1_vo-chong-chu-chin.jpg');
    expect(cardFileName({ rowId: 'R/3', shortId: 'abcdef', name: 'Đặng Thị Ánh' })).toBe('R-3_abcdef_dang-thi-anh.jpg');
  });

  it('draws the hero photo as the card background when provided', () => {
    const bg = 'data:image/jpeg;base64,/9j/4AAQ';
    expect(renderCardSvg({ ...INPUT, backgroundHref: bg })).toContain('data-role="background"');
    expect(renderCardSvg(INPUT)).not.toContain('data-role="background"');
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
