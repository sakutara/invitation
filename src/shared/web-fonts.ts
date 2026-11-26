/** Google Fonts stylesheet of the site, plus embedding of those fonts into an SVG (for the JPG card). */
export const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Great+Vibes&display=swap&subset=vietnamese';

/** Unicode subsets the card needs (Vietnamese text); Cyrillic etc. are skipped to keep the card small. */
const SUBSETS = new Set(['vietnamese', 'latin-ext', 'latin']);

type FetchLike = (url: string) => Promise<{ ok: boolean; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }>;

/** `/* latin *\/ @font-face {...}` blocks of a Google Fonts stylesheet, filtered by subset. */
export function fontFacesOf(css: string): { subset: string; face: string; url: string }[] {
  const out: { subset: string; face: string; url: string }[] = [];
  for (const m of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)) {
    const url = /url\((https:[^)]+)\)/.exec(m[2])?.[1];
    if (url && SUBSETS.has(m[1])) out.push({ subset: m[1], face: m[2], url });
  }
  return out;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * An SVG drawn through <img>/<canvas> cannot reach the page's web fonts, so the script names would fall back to
 * a system font. This inlines the site fonts as data: URLs. Resolves to the embeddable CSS ('' on failure).
 */
export async function embeddedFontCss(fetchImpl: FetchLike = (u) => fetch(u)): Promise<string> {
  try {
    const res = await fetchImpl(FONTS_HREF);
    if (!res.ok) return '';
    const faces = fontFacesOf(await res.text());
    const parts = await Promise.all(
      faces.map(async ({ face, url }) => {
        const r = await fetchImpl(url);
        return r.ok ? face.replace(url, `data:font/woff2;base64,${toBase64(await r.arrayBuffer())}`) : '';
      }),
    );
    return parts.join('\n');
  } catch {
    return '';
  }
}

export function withFontCss(svg: string, css: string): string {
  return css ? svg.replace(/(<svg\b[^>]*>)/, `$1<style>${css}</style>`) : svg;
}
