/**
 * Public URLs of the static site. The home page sits at the root; the other pages live in their own folder
 * (friendly URLs). All links are relative, so the site also works under a sub-path (e.g. the CMS /site/ preview).
 */
import type { PhotoRecord, WeddingConfig } from './types';

export const PAGE_DIRS = { invite: 'thiep-moi/', rsvp: 'dang-ky/' } as const;

/** Pre-folder file names, kept as redirects so links and QR codes already sent keep working. */
export const LEGACY_PAGES: Record<string, string> = { 'invite.html': PAGE_DIRS.invite, 'rsvp.html': PAGE_DIRS.rsvp };

/** From a page inside a folder back to the site root. */
export const SUBPAGE_ROOT = '../';

/** Prefixes every site-relative asset path (photos, map previews) with `root`, for pages inside a folder. */
export function rebaseAssets<T extends { config: WeddingConfig; photos: PhotoRecord[] }>(data: T, root: string): T {
  const at = <S extends string | undefined>(src: S) => (src && src.startsWith('assets/') ? ((root + src) as S) : src);
  const event = (e: WeddingConfig['ceremony']) => ({ ...e, mapPreviewSrc: at(e.mapPreviewSrc), mapPreviewLargeSrc: at(e.mapPreviewLargeSrc) });
  return {
    ...data,
    config: { ...data.config, ceremony: event(data.config.ceremony), reception: event(data.config.reception) },
    photos: data.photos.map((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v, src: at(v.src) })) })),
  };
}
