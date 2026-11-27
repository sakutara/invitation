/**
 * Line breaking for Vietnamese text. Words are written as separate syllables, so a browser happily breaks
 * "gia | đình" or "Tp. | Huế". keepWords() glues the syllables of a compound with a no-break space, and
 * keepParts() lets an address or venue line break only between its parts.
 */
import { escapeHtml } from './html';

const NBSP = ' ';

/** Compounds common in wedding wording and addresses (lower case). Add to the list when one gets split. */
const COMPOUNDS = [
  'hai người', 'người thân', 'xa lạ', 'tri kỷ', 'trở thành', 'thành một', 'những ngày', 'đầu tiên', 'gặp gỡ', 'đồng hành',
  'gia đình nhỏ', 'gia đình', 'bạn bè', 'cảm ơn', 'thời gian', 'chúng mình', 'chúng tôi', 'đến bên', 'bên nhau', 'cùng nhau', 'của nhau', 'luôn là',
  'bến đỗ', 'bình yên', 'thế giới', 'rộng lớn này', 'rộng lớn', 'hành trình', 'bắt đầu', 'hôm nay', 'tương lai', 'con đường', 'cuộc sống',
  'cuộc đời', 'tình yêu', 'yêu thương', 'hạnh phúc', 'niềm vui', 'kỷ niệm', 'thật nhiều', 'đi qua', 'mong muốn', 'muốn được',
  'chia sẻ', 'khoảnh khắc', 'trọng đại', 'mãi mãi', 'chung vui', 'ngày vui', 'ngày cưới', 'đám cưới', 'lễ cưới', 'tiệc cưới', 'hôn lễ',
  'lễ thành hôn', 'thành hôn', 'trân trọng', 'kính mời', 'quý khách', 'hiện diện', 'vinh hạnh', 'đón tiếp', 'chu đáo', 'chuẩn bị',
  'xác nhận', 'tham dự', 'liên hệ', 'thắc mắc', 'cô dâu', 'chú rể', 'nhà trai', 'nhà gái', 'tư gia', 'trung tâm', 'hội nghị',
  'khách sạn', 'nhà hàng', 'white lotus huế',
];
/** Words that always stay with the one after them ("Tp. Huế", "tầng 4"). */
const LEADS = new Set(['tp.', 'tp', 'q.', 'p.', 'tx.', 'tầng', 'sảnh', 'số', 'ông', 'bà']);

const clean = (w: string) => w.normalize('NFC').toLocaleLowerCase('vi').replace(/^[("“'.,;:!?…]+|[)"”',;:!?…]+$/g, '').replace(/(?<!^(tp|q|p|tx))\.$/, '');
const PHRASES = COMPOUNDS.map((c) => c.normalize('NFC').split(' ')).sort((a, b) => b.length - a.length);

export function keepWords(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const words = line.split(/ +/);
      const keys = words.map(clean);
      /** glue[i]: no break between word i and word i + 1 */
      const glue = words.map(() => false);
      for (let i = 0; i < words.length; ) {
        // a phrase never runs across punctuation ("gia, đình")
        const hit = PHRASES.find((p) => p.every((w, k) => keys[i + k] === w && (k === p.length - 1 || !/[.,;:!?…]$/.test(words[i + k]))));
        if (hit) for (let k = 0; k < hit.length - 1; k++) glue[i + k] = true;
        i += hit?.length ?? 1;
      }
      words.forEach((w, i) => {
        if (LEADS.has(keys[i])) glue[i] = true;
        if (w === '–' || w === '-') {
          if (i > 0) glue[i - 1] = true;
          glue[i] = true;
        }
      });
      return words.map((w, i) => (i === words.length - 1 ? w : w + (glue[i] ? NBSP : ' '))).join('');
    })
    .join('\n');
}

/**
 * Escaped HTML in which each part (split after ", " and around " · ") is one block: lines break between parts,
 * and inside a part only when it is wider than the line (then still never inside a compound).
 */
export function keepParts(text: string): string {
  return text
    .split(/(?<=,)\s+|\s+(?=·)/)
    .filter(Boolean)
    .map((part) => `<span class="keep">${escapeHtml(keepWords(part))}</span>`)
    .join(' ');
}
