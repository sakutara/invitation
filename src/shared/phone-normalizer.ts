/** Vietnamese phone normalization (okf/invitation_and_seating_rules.md §2). Mirrored in src/gas/Code.gs. */
export const VN_PHONE_REGEX = /^0[235789][0-9]{8}$/;

export function normalizeVnPhone(input: string): string {
  if (input == null) return '';
  let p = String(input).trim().replace(/[\s\-.()]/g, '');
  if (p.startsWith('+84')) p = '0' + p.slice(3);
  else if (p.startsWith('84') && p.length === 11) p = '0' + p.slice(2);
  return p;
}

export function isValidVnPhone(input: string): boolean {
  return VN_PHONE_REGEX.test(normalizeVnPhone(input));
}
