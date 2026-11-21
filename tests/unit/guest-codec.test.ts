import { describe, it, expect } from 'vitest';
import {
  resolveRelationship,
  encodeGuestToken,
  decodeGuestToken,
  computeShortId,
  buildGuestsMap,
  resolveGuestFromQuery,
  resolveGuestFromLocation,
  buildInviteUrl,
  guestSlugBase,
  assignGuestSlugs,
} from '../../src/shared/guest-codec';

const GOLDEN = { salutation: 'chú thím', name: 'vợ chồng chú Chín', relationship: 'gia đình cô dâu', count: 2 };
const GOLDEN_DECODED = { salutation: 'chú thím', name: 'vợ chồng chú Chín', relationship: 'bride_family', count: 2 };

describe('resolveRelationship', () => {
  it.each([
    ['gia đình cô dâu', 'bride_family'],
    ['Gia đình cô dâu', 'bride_family'],
    ['  GIA ĐÌNH CHÚ RỂ ', 'groom_family'],
    ['bride_family', 'bride_family'],
    ['bạn bè gia đình cô dâu', 'bride_parents_friends'],
    ['khác...', 'other'],
    ['khác', 'other'],
    [5, 'groom_parents_friends'],
    ['3', 'groom_friends'],
  ])('%s -> %s', (input, key) => expect(resolveRelationship(input as string)).toBe(key));

  it('handles decomposed (NFD) Vietnamese input', () => {
    expect(resolveRelationship('gia đình cô dâu'.normalize('NFD'))).toBe('bride_family');
  });

  it('returns null for unknown values', () => {
    expect(resolveRelationship('hàng xóm')).toBeNull();
    expect(resolveRelationship(9)).toBeNull();
  });
});

describe('?g= compact Base64URL token', () => {
  it('round-trips the golden Vietnamese payload with diacritics intact', () => {
    const token = encodeGuestToken(GOLDEN);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
    expect(decodeGuestToken(token)).toEqual(GOLDEN_DECODED);
  });

  it('serializes [salutation, name, relationshipCode, count]', () => {
    const json = Buffer.from(encodeGuestToken(GOLDEN), 'base64url').toString('utf8');
    expect(JSON.parse(json)).toEqual(['chú thím', 'vợ chồng chú Chín', 2, 2]);
  });

  it.each(['invalid', '', '!!!', Buffer.from('{"a":1}').toString('base64url'), Buffer.from('["a","b",9,2]').toString('base64url'), Buffer.from('["a","b",2,0]').toString('base64url'), Buffer.from('["a","b",2,21]').toString('base64url')])(
    'returns null for malformed token %j',
    (t) => expect(decodeGuestToken(t)).toBeNull(),
  );

  it('rejects encoding an unknown relationship or out-of-range count', () => {
    expect(() => encodeGuestToken({ ...GOLDEN, relationship: 'xyz' })).toThrow();
    expect(() => encodeGuestToken({ ...GOLDEN, count: 0 })).toThrow();
  });
});

describe('short ID', () => {
  it('is a deterministic 6-char lowercase hex digest', async () => {
    const a = await computeShortId({ ...GOLDEN, phone: '+84 905 123 456' });
    const b = await computeShortId({ ...GOLDEN, phone: '0905-123-456' });
    expect(a).toMatch(/^[0-9a-f]{6}$/);
    expect(a).toBe(b); // phone is normalized before hashing
  });

  it('falls back to salutation|name|relationshipKey when phone is absent', async () => {
    const a = await computeShortId(GOLDEN);
    const b = await computeShortId({ ...GOLDEN, relationship: 'bride_family' });
    expect(a).toBe(b);
    expect(a).not.toBe(await computeShortId({ ...GOLDEN, name: 'vợ chồng chú Mười' }));
  });

  it('builds a guests-map {slug: token}', () => {
    const map = buildGuestsMap([{ rowId: '1', ...GOLDEN }, { rowId: '2', ...GOLDEN, name: 'anh Tuấn', count: 1 }]);
    expect(Object.keys(map)).toEqual(['vo-chong-chu-chin-gia-dinh-co-dau', 'anh-tuan-gia-dinh-co-dau']);
    for (const token of Object.values(map)) expect(decodeGuestToken(token)).not.toBeNull();
  });
});

describe('guest slug', () => {
  it('describes name + relationship', () => {
    expect(guestSlugBase({ name: 'Chú Chín', relationship: 'bride_family' })).toBe('chu-chin-gia-dinh-co-dau');
    expect(guestSlugBase({ name: 'Anh Tuấn', relationship: 'groom_friends' })).toBe('anh-tuan-ban-be-chu-re');
  });

  it('keeps slugs unique', () => {
    const g = { name: 'Chú Chín', relationship: 'bride_family' };
    const slugs = assignGuestSlugs([{ rowId: 'a', ...g }, { rowId: 'b', ...g }, { rowId: 'c', ...g }]);
    expect([...slugs.values()]).toEqual(['chu-chin-gia-dinh-co-dau', 'chu-chin-gia-dinh-co-dau-2', 'chu-chin-gia-dinh-co-dau-3']);
  });
});

describe('resolveGuestFromQuery', () => {
  const map = { 'vo-chong-chu-chin-gia-dinh-co-dau': encodeGuestToken(GOLDEN) };

  it('resolves ?khach=<slug> against guests-map.json', () => {
    expect(resolveGuestFromQuery('?khach=vo-chong-chu-chin-gia-dinh-co-dau', map)).toEqual(GOLDEN_DECODED);
  });

  it.each(['?g=invalid', '?khach=khong-co', '', '?foo=bar'])('returns null (default invitation) for %j', (q) => {
    expect(resolveGuestFromQuery(q, map)).toBeNull();
  });

  it('resolveGuestFromLocation fetches guests-map.json only for ?khach=', async () => {
    const calls: string[] = [];
    const fetchMap = async (url: string) => { calls.push(url); return map; };
    expect(await resolveGuestFromLocation('?khach=vo-chong-chu-chin-gia-dinh-co-dau', fetchMap)).toEqual(GOLDEN_DECODED);
    expect(calls).toEqual(['assets/data/guests-map.json']);
    expect(await resolveGuestFromLocation('', fetchMap)).toBeNull();
    expect(calls).toHaveLength(1);
    const failing = async () => { throw new Error('offline'); };
    expect(await resolveGuestFromLocation('?khach=x', failing)).toBeNull();
  });
});

describe('buildInviteUrl', () => {
  it('builds slug URLs', () => {
    expect(buildInviteUrl('https://example.com/wedding/', { slug: 'chu-chin-gia-dinh-co-dau' })).toBe('https://example.com/wedding/invite.html?khach=chu-chin-gia-dinh-co-dau');
  });
});
