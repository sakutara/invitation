import { describe, it, expect } from 'vitest';
import { normalizeVnPhone, isValidVnPhone } from '../../src/shared/phone-normalizer';

describe('normalizeVnPhone (okf/invitation_and_seating_rules.md §2)', () => {
  it.each([
    ['+84 905 123 456', '0905123456'],
    ['0905-123-456', '0905123456'],
    ['0905.123.456', '0905123456'],
    ['(090) 5123456', '0905123456'],
    ['84905123456', '0905123456'],
    ['+84-28-3822-1234', '02838221234'],
    ['  0912 345 678  ', '0912345678'],
    ['0386123456', '0386123456'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeVnPhone(input)).toBe(expected);
  });

  it('only rewrites a bare 84 prefix when exactly 11 digits long', () => {
    expect(normalizeVnPhone('8490512345')).toBe('8490512345');
    expect(normalizeVnPhone('849051234567')).toBe('849051234567');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeVnPhone(undefined as unknown as string)).toBe('');
    expect(normalizeVnPhone(null as unknown as string)).toBe('');
  });
});

describe('isValidVnPhone', () => {
  it.each(['+84 905 123 456', '0905-123-456', '0386123456', '0705123456', '0812345678', '0912345678', '0212345678', '0512345678'])(
    'accepts %s',
    (p) => expect(isValidVnPhone(p)).toBe(true),
  );
  it.each(['0105123456', '0405123456', '0605123456', '090512345', '09051234567', 'abc', '', '+1 202 555 0100'])(
    'rejects %s',
    (p) => expect(isValidVnPhone(p)).toBe(false),
  );
});
