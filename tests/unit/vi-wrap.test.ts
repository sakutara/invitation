import { describe, it, expect } from 'vitest';
import { keepParts, keepWords } from '../../src/shared/vi-wrap';

const show = (s: string) => s.replace(/ /g, '_');

describe('Vietnamese line breaking', () => {
  it('glues compounds without crossing punctuation', () => {
    expect(show(keepWords('Thành một gia đình nhỏ. Cảm ơn thời gian'))).toBe('Thành_một gia_đình_nhỏ. Cảm_ơn thời_gian');
    expect(show(keepWords('gia, đình'))).toBe('gia, đình');
  });
  it('keeps city prefixes, floors and number ranges together', () => {
    expect(show(keepWords('Opera tầng 4'))).toBe('Opera tầng_4');
    expect(show(keepWords('05 – 07 Hoàng Hoa Thám'))).toBe('05_–_07 Hoàng Hoa Thám');
    expect(show(keepWords('Tp. Huế'))).toBe('Tp._Huế');
  });
  it('keeps the text itself and escapes each address part', () => {
    const html = keepParts('Opera tầng 4 · 05 – 07 Hoàng Hoa Thám, Thuận Hóa, Tp. <Huế>');
    expect(html.match(/class="keep"/g)).toHaveLength(4);
    expect(html).toContain('&lt;Huế&gt;');
    expect(show(html.replace(/<[^>]+>/g, ''))).toBe('Opera tầng_4 ·_05_–_07 Hoàng Hoa Thám, Thuận Hóa, Tp._&lt;Huế&gt;'.replace('·_', '· '));
  });
});
