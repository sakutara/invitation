/**
 * Soft watercolour-style florals shared by the web pages (partials.floralSpray / bouquet / blossom) and the
 * JPG card. Every shape is a rounded Bézier, painted in two translucent layers (a wash and a lighter
 * overlap) instead of hard outlines, so the flowers read as brush strokes. Flat fills only (no gradients
 * or filters), so the SVG renders the same in browsers and in librsvg (sharp).
 */

const f1 = (n: number) => Math.round(n * 10) / 10;

/** Rounded petal pointing up from the origin (length l, width w). */
function petal(l: number, w: number): string {
  return `M0 0C${f1(-w * 0.95)} ${f1(-l * 0.22)} ${f1(-w * 0.8)} ${f1(-l * 0.98)} 0 ${f1(-l)}C${f1(w * 0.8)} ${f1(-l * 0.98)} ${f1(w * 0.95)} ${f1(-l * 0.22)} 0 0Z`;
}

/** Five/six-petal blossom: a wash layer, an offset lighter layer, a soft stamen cluster. */
function bloom(x: number, y: number, r: number, fill: string, edge: string, opts: { n?: number; rot?: number; center?: string } = {}): string {
  const n = opts.n ?? 5;
  const rot = opts.rot ?? 0;
  const p = petal(r, r * 0.62);
  const inner = petal(r * 0.7, r * 0.45);
  const ring = (d: string, offset: number, attrs: string) =>
    Array.from({ length: n }, (_, i) => `<path d="${d}" transform="rotate(${f1(rot + offset + (360 / n) * i)})" ${attrs}/>`).join('');
  const c = opts.center ?? '#E7CF87';
  return `<g transform="translate(${f1(x)} ${f1(y)})">
${ring(p, 0, `fill="${fill}" fill-opacity=".82" stroke="${edge}" stroke-opacity=".45" stroke-width=".7"`)}
${ring(inner, 180 / n, `fill="#FFFFFF" fill-opacity=".38"`)}
<circle r="${f1(r * 0.2)}" fill="${c}" fill-opacity=".9"/>${[0, 72, 144, 216, 288]
    .map((a) => `<circle cx="${f1(Math.cos((a * Math.PI) / 180) * r * 0.2)}" cy="${f1(Math.sin((a * Math.PI) / 180) * r * 0.2)}" r="${f1(r * 0.06 + 0.4)}" fill="#A88A47" fill-opacity=".75"/>`)
    .join('')}</g>`;
}

/** Tapered leaf with a soft midrib, drawn from the origin along +x then rotated. */
function leaf(x: number, y: number, rot: number, s: number, fill: string): string {
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${rot}) scale(${s})">
<path d="M0 0C7 -10 21 -12 34 -4C22 4 9 6 0 0Z" fill="${fill}" fill-opacity=".7"/>
<path d="M3 -1C10 -6 19 -7 29 -4C20 0 11 2 3 -1Z" fill="#FFFFFF" fill-opacity=".18"/>
<path d="M1 0Q15 -4 31 -4" fill="none" stroke="#6F8A6C" stroke-opacity=".45" stroke-width=".6" stroke-linecap="round"/></g>`;
}

/** Closed bud with two sepals. */
function bud(x: number, y: number, rot: number, s: number, fill: string): string {
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${rot}) scale(${s})">
<path d="${petal(11, 6)}" fill="${fill}" fill-opacity=".85"/>
<path d="M0 0C-4 -2 -5 -5 -4 -8M0 0C4 -2 5 -5 4 -8" fill="none" stroke="#8DA48A" stroke-width="1.1" stroke-linecap="round"/></g>`;
}

const dots = (pts: [number, number][], r: number, fill: string, op = 0.85) =>
  pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${f1(r * (0.8 + ((i * 37) % 5) / 10))}" fill="${fill}" fill-opacity="${op}"/>`).join('');

/**
 * Corner spray (dusty blue, lavender, ivory blossoms, sage leaves, navy berries): inner SVG content of a
 * 220x220 box growing from the bottom-left corner.
 */
export function floralPaths(): string {
  return `
<g fill="none" stroke="#8DA48A" stroke-width="1.4" stroke-linecap="round" stroke-opacity=".85">
<path d="M8 214C34 176 72 128 150 72"/><path d="M8 214C24 160 40 104 60 34"/><path d="M8 214C70 200 128 188 204 150"/>
<path d="M60 152C80 142 96 122 104 100"/><path d="M38 122C28 104 26 84 30 64"/><path d="M118 186C138 174 158 170 178 172"/>
<path d="M96 110C112 96 126 86 140 80" stroke-width=".9"/><path d="M30 150C18 140 12 128 12 116" stroke-width=".9"/></g>
${leaf(34, 172, -72, 1.25, '#A9BCA5')}${leaf(52, 142, -38, 1.05, '#9DB3C9')}${leaf(80, 128, -18, 1.15, '#A9BCA5')}${leaf(110, 98, -36, 0.95, '#9DB3C9')}
${leaf(44, 100, -104, 1.05, '#A9BCA5')}${leaf(48, 62, -82, 0.85, '#9DB3C9')}${leaf(90, 196, -8, 1.15, '#9DB3C9')}${leaf(140, 180, -24, 1.05, '#A9BCA5')}
${leaf(176, 160, -40, 0.85, '#9DB3C9')}${leaf(62, 150, 160, 0.8, '#B9C9B4')}${leaf(128, 84, 150, 0.7, '#B9C9B4')}
${bud(140, 80, 30, 1, '#C8C2EA')}${bud(12, 116, -20, 0.9, '#FAF8F2')}${bud(178, 172, 70, 0.9, '#B7C9DF')}
${bloom(150, 70, 17, '#FBFAF5', '#AEBBCF', { rot: 8 })}${bloom(60, 32, 12.5, '#CBC5EC', '#A39ED6', { rot: -12 })}
${bloom(104, 98, 11.5, '#BACDE2', '#8EA6C2', { rot: 20 })}${bloom(204, 150, 13.5, '#FBFAF5', '#AEBBCF', { rot: -6 })}${bloom(30, 64, 9.5, '#FBFAF5', '#AEBBCF', { rot: 30 })}
${dots([[120, 60], [127, 52], [135, 46], [168, 52], [175, 60], [70, 12], [78, 19], [114, 70]], 2.1, '#FFFFFF', 0.95)}
${dots([[176, 184], [184, 179], [191, 186], [183, 191], [195, 177], [92, 120], [98, 127], [104, 121]], 2.9, '#4A6890', 0.8)}
${dots([[18, 140], [14, 129], [21, 120], [16, 109], [24, 98]], 2.4, '#B9B3E6', 0.85)}
`;
}

/** Many-petalled garden rose seen from above. */
function rose(x: number, y: number, r: number, base: string, deep: string, rot = 0): string {
  const outer = Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 + rot) * Math.PI) / 180;
    return `<ellipse cx="${f1(Math.cos(a) * r * 0.42)}" cy="${f1(Math.sin(a) * r * 0.42)}" rx="${f1(r * 0.58)}" ry="${f1(r * 0.5)}" transform="rotate(${f1(i * 60 + rot)} ${f1(Math.cos(a) * r * 0.42)} ${f1(Math.sin(a) * r * 0.42)})" fill="${base}" fill-opacity=".72"/>`;
  }).join('');
  const mid = Array.from({ length: 4 }, (_, i) => {
    const a = ((i * 90 + rot + 40) * Math.PI) / 180;
    return `<circle cx="${f1(Math.cos(a) * r * 0.2)}" cy="${f1(Math.sin(a) * r * 0.2)}" r="${f1(r * 0.42)}" fill="${base}" fill-opacity=".55"/>`;
  }).join('');
  const k = r;
  const swirl = `M${f1(-0.3 * k)} ${f1(0.08 * k)}C${f1(-0.32 * k)} ${f1(-0.3 * k)} ${f1(0.3 * k)} ${f1(-0.34 * k)} ${f1(0.32 * k)} 0C${f1(0.32 * k)} ${f1(0.26 * k)} ${f1(-0.1 * k)} ${f1(0.3 * k)} ${f1(-0.13 * k)} ${f1(0.03 * k)}C${f1(-0.13 * k)} ${f1(-0.13 * k)} ${f1(0.13 * k)} ${f1(-0.15 * k)} ${f1(0.11 * k)} ${f1(0.02 * k)}`;
  return `<g transform="translate(${f1(x)} ${f1(y)})">${outer}${mid}
<circle r="${f1(r * 0.3)}" fill="${deep}" fill-opacity=".35"/>
<path d="${swirl}" fill="none" stroke="${deep}" stroke-opacity=".7" stroke-width="1.1" stroke-linecap="round"/></g>`;
}

/**
 * Hand-tied bouquet (blush roses, small yellow blooms, eucalyptus) with a satin bow: inner content of a
 * 200x280 box, stems gathered at the bottom centre.
 */
export function bouquetPaths(): string {
  const yellow = (pts: [number, number, number][]) => pts.map(([x, y, r]) => bloom(x, y, r, '#F3D27A', '#D8B04E', { center: '#B98A2F', rot: x })).join('');
  return `
<g fill="none" stroke="#8DA48A" stroke-width="1.6" stroke-linecap="round" stroke-opacity=".9">
<path d="M100 270C98 230 92 190 70 120"/><path d="M100 270C102 228 108 186 132 110"/><path d="M100 270C100 220 100 160 100 92"/>
<path d="M100 270C94 226 72 196 40 150"/><path d="M100 270C106 226 130 196 164 156"/><path d="M100 270C96 236 84 214 56 196" stroke-width="1.1"/></g>
${leaf(40, 150, -150, 1.2, '#A9BCA5')}${leaf(164, 156, -30, 1.2, '#9DB3C9')}${leaf(56, 196, -160, 1, '#B9C9B4')}${leaf(150, 196, -20, 1, '#A9BCA5')}
${leaf(72, 132, -120, 1.1, '#9DB3C9')}${leaf(132, 120, -58, 1.1, '#A9BCA5')}${leaf(100, 150, -94, 0.9, '#B9C9B4')}${leaf(100, 150, -86, 0.9, '#A9BCA5')}
${rose(70, 104, 26, '#F2B9C6', '#C0566F', 10)}${rose(130, 96, 24, '#F7CDD6', '#C96A80', 35)}${rose(100, 66, 22, '#EFA5B6', '#B24561', 70)}
${rose(42, 136, 15, '#F7CDD6', '#C96A80', 20)}${rose(160, 138, 16, '#F2B9C6', '#C0566F', 50)}
${yellow([[100, 112, 8], [58, 70, 7], [146, 60, 7.5], [24, 112, 6], [178, 108, 6.5], [118, 40, 6]])}
${bud(80, 36, -25, 1.1, '#F2B9C6')}${bud(170, 84, 35, 1, '#F7CDD6')}
${dots([[86, 48], [92, 40], [140, 78], [148, 84], [34, 92], [40, 86], [168, 70]], 2.2, '#FFFFFF', 0.95)}
<g transform="translate(100 236)">
<path d="M0 0C-14 -16 -40 -16 -38 -4C-36 8 -14 6 0 0Z" fill="#F0CD72" fill-opacity=".92" stroke="#C9A24A" stroke-opacity=".6" stroke-width=".8"/>
<path d="M0 0C14 -16 40 -16 38 -4C36 8 14 6 0 0Z" fill="#F0CD72" fill-opacity=".92" stroke="#C9A24A" stroke-opacity=".6" stroke-width=".8"/>
<path d="M-2 2C-8 16 -16 30 -24 40L-16 38C-10 28 -4 16 0 4Z" fill="#EBC25E" fill-opacity=".9"/>
<path d="M2 2C8 16 14 30 22 42L28 36C20 28 10 16 3 3Z" fill="#EBC25E" fill-opacity=".9"/>
<ellipse rx="6" ry="5" fill="#E2B550"/></g>
`;
}

/**
 * Single hand-drawn flower: a loose inked outline over a pale wash, one leaf, a short stem (120x120 box).
 * `ink` and `wash` set the colour (dusty blue by default).
 */
export function blossomPaths(ink = '#5A7BA6', wash = '#C9D6EA'): string {
  const outline = Array.from({ length: 5 }, (_, i) => `<path d="${petal(30, 19)}" transform="rotate(${i * 72 - 8})"/>`).join('');
  return `
<path d="M60 64C58 84 52 100 40 116" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-opacity=".85"/>
<path d="M54 92C40 84 26 86 18 96C30 102 44 100 54 92Z" fill="${wash}" fill-opacity=".7" stroke="${ink}" stroke-width="1.3" stroke-opacity=".8" stroke-linejoin="round"/>
<path d="M52 93Q36 92 22 96" fill="none" stroke="${ink}" stroke-width=".9" stroke-opacity=".6"/>
<g transform="translate(60 52)">
<g fill="${wash}" fill-opacity=".75">${outline}</g>
<g fill="none" stroke="${ink}" stroke-width="1.5" stroke-opacity=".85" stroke-linejoin="round">${outline}</g>
<circle r="5.5" fill="#F1DB97" stroke="${ink}" stroke-width="1.2" stroke-opacity=".7"/>
<path d="M-2 -2l1 1M2 -1l-1 1M0 2l0 -1" stroke="${ink}" stroke-width="1" stroke-linecap="round"/></g>
`;
}
