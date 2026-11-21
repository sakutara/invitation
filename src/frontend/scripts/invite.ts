/** Personalized invitation: URL decoding, greeting, seating highlight, and 1080x1620 JPEG save/share. */
import { resolveGuestFromLocation, buildInviteUrl, GUEST_PARAM, type GuestsMap } from '../../shared/guest-codec';
import { formatInvitation } from '../../shared/invitation-formatter';
import { mapSeating, renderSeatingMapSvg } from '../../shared/seating-mapper';
import { renderCardSvg } from '../../shared/card-svg-template';
import { slugify } from '../../shared/slug';
import { CARD_SPEC, FALLBACK_GUEST, RELATIONSHIP_GROUPS, type GuestInvitePayload, type PhotoRecord, type SeatingLayout, type SeatingZone, type WeddingConfig } from '../../shared/types';
import { initParallax } from './parallax';
import { initReveal } from './reveal';
import { initMapPopup } from './map-popup';

type SaveMode = 'download' | 'share';
export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

interface InviteData {
  config: WeddingConfig;
  photos: PhotoRecord[];
  seatingZones: SeatingZone[];
  seatingLayout?: SeatingLayout | null;
}

export interface InviteOptions {
  search?: string;
  fetchJson?: (url: string) => Promise<GuestsMap>;
  renderCard?: (svg: string) => Promise<Blob>;
  saveOrShare?: typeof saveOrShare;
  loadDataUrl?: (url: string) => Promise<string>;
  nav?: Navigator;
}

export function cardFileNameFor(g: { name: string }): string {
  return `Thiep-Moi-${slugify(g.name)}.jpg`;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Rasterize the shared SVG card on a <canvas> into a JPEG blob (quality 0.92). */
export async function renderCardJpegBlob(svg: string, doc: Document = document): Promise<Blob> {
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Không dựng được ảnh thiệp'));
    img.src = svgToDataUrl(svg);
  });
  const canvas = doc.createElement('canvas');
  canvas.width = CARD_SPEC.width;
  canvas.height = CARD_SPEC.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), CARD_SPEC.mime, CARD_SPEC.quality),
  );
}

export async function saveOrShare(
  blob: Blob,
  fileName: string,
  opts: { mode: SaveMode; nav?: Navigator; doc?: Document; title?: string; text?: string },
): Promise<SaveResult> {
  const nav = opts.nav ?? navigator;
  const doc = opts.doc ?? document;
  if (opts.mode === 'share') {
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    const payload = { files: [file], title: opts.title, text: opts.text };
    if (typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
      try {
        await nav.share(payload);
        return 'shared';
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
        /* fall through to download */
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

async function defaultFetchJson(url: string): Promise<GuestsMap> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function defaultLoadDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function inviteUrlFor(config: WeddingConfig, search: string, win?: Window): string {
  const base = win?.location?.origin?.startsWith('http') ? win.location.href.replace(/[?#].*$/, '').replace(/\/[^/]*$/, '') : config.siteBaseUrl;
  const slug = new URLSearchParams(search).get(GUEST_PARAM);
  if (slug) return buildInviteUrl(base, { slug });
  return `${base.replace(/\/+$/, '')}/invite.html`;
}

export async function initInvitePage(doc: Document = document, opts: InviteOptions = {}): Promise<GuestInvitePayload> {
  const data = JSON.parse(doc.getElementById('wedding-data')!.textContent!) as InviteData;
  const { config, seatingZones, seatingLayout } = data;
  const search = opts.search ?? doc.defaultView?.location.search ?? '';
  // Guest comes from the DB-built guests-map.json via ?khach=<slug>; unknown/missing = default invitation.
  const known = await resolveGuestFromLocation(search, opts.fetchJson ?? defaultFetchJson);
  const guest = known ?? { ...FALLBACK_GUEST };
  const group = RELATIONSHIP_GROUPS[guest.relationship];
  const seat = mapSeating(guest, seatingZones);
  const layout = seatingLayout ?? null;
  const set = (role: string, value: string) => {
    const el = doc.querySelector(`[data-role="${role}"]`);
    if (el) el.textContent = value;
  };

  set('greeting', formatInvitation(guest));
  const badge = doc.querySelector<HTMLElement>('[data-role="guest-badge"]');
  if (badge) {
    badge.hidden = !known;
    if (known) {
      badge.textContent = group.displayVi;
      badge.className = `invite-card__badge badge--${group.side}`;
    }
  }
  doc.title = known ? `Thiệp mời ${guest.name} · ${config.groomName} & ${config.brideName}` : `Thiệp mời · ${config.groomName} & ${config.brideName}`;

  // Always show the hall map; table details + highlight only for a known guest.
  const mapHost = doc.querySelector('.seating__map');
  if (mapHost) mapHost.innerHTML = renderSeatingMapSvg(seatingZones, known ? { zoneId: seat.zoneId, seatCount: seat.seatCount, layout } : { zoneId: null, layout });
  const seatInfo = doc.querySelector<HTMLElement>('.seating__info');
  if (seatInfo) seatInfo.hidden = !known;
  set('seating-title', known ? 'Chỗ ngồi của bạn' : 'Sơ đồ khu vực tiệc');
  if (known) {
    set('zone-name', seat.zone.nameVi);
    set('seat-count', String(seat.seatCount));
    set('seat-guidance', seat.guidance);
    const seatsPill = doc.querySelector<HTMLElement>('.seating__seats');
    if (seatsPill) seatsPill.style.background = seat.color;
  }

  const inviteUrl = inviteUrlFor(config, search, doc.defaultView ?? undefined);
  let cardSvg = renderCardSvg({ config, zones: seatingZones, guest: known, inviteUrl, layout });
  const preview = doc.querySelector<HTMLImageElement>('.save-card__preview img');
  if (preview) preview.src = svgToDataUrl(cardSvg);

  const portrait = data.photos.find((p) => p.placement === 'invite_portrait') ?? data.photos.find((p) => p.placement === 'hero');
  const portraitSrc = portrait?.variants.find((v) => v.tier === 'sm' && v.format === 'jpg')?.src;
  // Card background = the home-page hero photo.
  const hero = data.photos.find((p) => p.placement === 'hero') ?? data.photos.find((p) => p.placement === 'gallery');
  const heroSrc = (hero?.variants.find((v) => v.tier === 'md' && v.format === 'jpg') ?? hero?.variants.find((v) => v.format === 'jpg'))?.src;
  const load = opts.loadDataUrl ?? defaultLoadDataUrl;
  let portraitHref: string | null = null;
  let backgroundHref: string | null = null;
  const redraw = () => {
    cardSvg = renderCardSvg({ config, zones: seatingZones, guest: known, inviteUrl, portraitHref, backgroundHref, layout });
    if (preview) preview.src = svgToDataUrl(cardSvg);
  };
  const portraitReady = Promise.all([
    portraitSrc ? load(portraitSrc).then((h) => { portraitHref = h; }).catch(() => {}) : Promise.resolve(),
    heroSrc ? load(heroSrc).then((h) => { backgroundHref = h; }).catch(() => {}) : Promise.resolve(),
  ]).then(() => { if (portraitHref || backgroundHref) redraw(); });

  const status = doc.querySelector<HTMLElement>('.save-card__status');
  const renderCard = opts.renderCard ?? ((svg: string) => renderCardJpegBlob(svg, doc));
  const save = opts.saveOrShare ?? saveOrShare;
  const fileName = cardFileNameFor(guest);
  const run = (mode: SaveMode) => async (ev: Event) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    if (status) status.textContent = 'Đang tạo ảnh thiệp…';
    try {
      await portraitReady;
      const blob = await renderCard(cardSvg);
      const result = await save(blob, fileName, {
        mode,
        nav: opts.nav,
        doc,
        title: `Thiệp mời ${config.groomName} & ${config.brideName}`,
        text: formatInvitation(guest),
      });
      if (status) status.textContent = result === 'shared' ? 'Đã chia sẻ thiệp.' : result === 'downloaded' ? `Đã lưu ${fileName}` : '';
    } catch (e) {
      if (status) status.textContent = `Không tạo được ảnh: ${(e as Error).message}`;
    } finally {
      btn.disabled = false;
    }
  };
  doc.getElementById('save-jpg')?.addEventListener('click', run('download'));
  doc.getElementById('share-jpg')?.addEventListener('click', run('share'));
  doc.body.dataset.inviteReady = 'true';
  return guest;
}

if (typeof document !== 'undefined' && document.body?.classList.contains('page-invite') && document.getElementById('wedding-data')) {
  document.documentElement.classList.remove('no-js');
  initParallax();
  initReveal();
  initMapPopup();
  initInvitePage(document).catch((e) => console.error(e));
}
