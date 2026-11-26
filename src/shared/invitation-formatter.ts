/** Personalized invitation copy (okf/invitation_and_seating_rules.md §1). */
import { FALLBACK_GUEST } from './types';

/** Kinship / honorific words that are lowercased mid-sentence; anything else (proper nouns) is preserved. */
const HONORIFIC_WORDS = new Set(
  'anh chị em bạn cô chú thím bác dì dượng cậu mợ ông bà cháu con hai các quý khách vợ chồng gia đình cụ thầy cưng'.split(' '),
);

export function cleanText(s: unknown): string {
  return typeof s === 'string' ? s.normalize('NFC').trim().replace(/\s+/g, ' ') : '';
}

export function normalizeSalutation(input: unknown): string {
  const s = cleanText(input);
  if (!s) return FALLBACK_GUEST.salutation;
  return s
    .split(' ')
    .map((w, i) => {
      const lower = w.toLocaleLowerCase('vi');
      if (HONORIFIC_WORDS.has(lower)) return lower;
      return i === 0 ? w.charAt(0).toLocaleLowerCase('vi') + w.slice(1) : w;
    })
    .join(' ');
}

export function normalizeName(input: unknown): string {
  return cleanText(input) || FALLBACK_GUEST.name;
}

/** Name on the dotted line of the printed-style card ("Quý khách" for the default invitation). */
export function guestNameLine(guest: { name?: string } | null | undefined): string {
  return guest ? normalizeName(guest.name) : 'Quý khách';
}

/** Fills {khach} in the presence line with the guest's salutation ("Quý vị" for the default invitation). */
export function presenceLine(template: string, guest: { salutation?: string } | null | undefined): string {
  return template.replace(/\{khach\}/g, guest ? normalizeSalutation(guest.salutation) : 'Quý vị');
}

export function formatInvitation(guest: { salutation?: string; name?: string } | null | undefined): string {
  const name = normalizeName(guest?.name);
  const salutation = normalizeSalutation(guest?.salutation);
  return `Kính mời ${name} đến chung vui cùng gia đình chúng tôi, sự hiện diện của ${salutation} là niềm vinh hạnh cho gia đình.`;
}
