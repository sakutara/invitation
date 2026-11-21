/**
 * Map popup: a click on a preview map (`a[data-map-popup]`, rendered by eventCard) opens a large, pannable map
 * in a <dialog>. The large image is sized so its zoom matches the card preview, and the pin (image center)
 * is centered when the popup opens. Without JS the card link still opens Google Maps directly.
 */

const FALLBACK_RATIO = 0.5;
const POPUP_TITLE_ID = 'map-popup-title';

interface PopupRefs {
  dialog: HTMLDialogElement;
  title: HTMLElement;
  address: HTMLElement;
  viewport: HTMLElement;
  img: HTMLImageElement;
  mapsLink: HTMLAnchorElement;
}

interface PopupState {
  doc: Document;
  refs: PopupRefs;
  /** The card link that opened the popup; focus returns to it on close. */
  opener: HTMLElement | null;
  /** The small preview image inside that link, used to derive the zoom. */
  cardImg: HTMLImageElement | null;
  isOpen: boolean;
  savedBodyOverflow: string;
  onResize: () => void;
}

const popups = new WeakMap<Document, PopupState>();
const bound = new WeakSet<Document>();

/** Delegated click handler for every `a[data-map-popup]` in the document. Safe to call more than once. */
export function initMapPopup(doc: Document = document): void {
  if (bound.has(doc)) return;
  bound.add(doc);
  doc.addEventListener('click', (ev) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const target = ev.target as Element | null;
    if (!target || typeof target.closest !== 'function') return;
    const link = target.closest<HTMLAnchorElement>('a[data-map-popup]');
    if (!link) return;
    ev.preventDefault();
    openMapPopup(doc, link);
  });
}

function getState(doc: Document): PopupState {
  const existing = popups.get(doc);
  if (existing) return existing;
  const state = createPopup(doc);
  popups.set(doc, state);
  return state;
}

function createPopup(doc: Document): PopupState {
  const dialog = doc.createElement('dialog');
  dialog.className = 'map-popup';
  dialog.setAttribute('aria-labelledby', POPUP_TITLE_ID);
  // Static markup only; venue and address text are set with textContent below.
  dialog.innerHTML = `<header class="map-popup__head">
  <div class="map-popup__titles">
    <h2 class="map-popup__title" id="${POPUP_TITLE_ID}"></h2>
    <p class="map-popup__address"></p>
  </div>
  <button type="button" class="btn btn--ghost map-popup__close" aria-label="Đóng">×</button>
</header>
<div class="map-popup__viewport">
  <img class="map-popup__img" alt="" draggable="false">
</div>
<footer class="map-popup__foot">
  <a class="btn btn--navy map-popup__maps" target="_blank" rel="noopener">Mở Google Maps</a>
  <button type="button" class="btn btn--ghost map-popup__done">Đóng</button>
</footer>`;
  doc.body.appendChild(dialog);

  const q = <T extends Element>(sel: string) => dialog.querySelector(sel) as T;
  const refs: PopupRefs = {
    dialog,
    title: q<HTMLElement>('.map-popup__title'),
    address: q<HTMLElement>('.map-popup__address'),
    viewport: q<HTMLElement>('.map-popup__viewport'),
    img: q<HTMLImageElement>('.map-popup__img'),
    mapsLink: q<HTMLAnchorElement>('.map-popup__maps'),
  };

  const win = doc.defaultView ?? window;
  const state: PopupState = {
    doc,
    refs,
    opener: null,
    cardImg: null,
    isOpen: false,
    savedBodyOverflow: '',
    onResize: () => {
      if (state.isOpen) layout(state);
    },
  };

  q<HTMLButtonElement>('.map-popup__close').addEventListener('click', () => closePopup(state));
  q<HTMLButtonElement>('.map-popup__done').addEventListener('click', () => closePopup(state));

  // Backdrop click: only when the press also started on the backdrop, so a pan that ends outside the viewport does not close.
  let pressedOnBackdrop = false;
  dialog.addEventListener('pointerdown', (e) => {
    pressedOnBackdrop = e.target === dialog;
  });
  dialog.addEventListener('click', (e) => {
    if (pressedOnBackdrop && e.target === dialog) closePopup(state);
    pressedOnBackdrop = false;
  });

  // Native Esc closes the dialog and fires 'close'; the fallback (no <dialog> support) handles Esc itself.
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !supportsModal(dialog)) {
      e.preventDefault();
      closePopup(state);
    }
  });
  dialog.addEventListener('close', () => finishClose(state));

  refs.img.addEventListener('load', () => layout(state));
  refs.img.addEventListener('dragstart', (e) => e.preventDefault());
  attachMouseDrag(refs.viewport);

  win.addEventListener('resize', state.onResize);
  return state;
}

function supportsModal(dialog: HTMLDialogElement): boolean {
  return typeof dialog.showModal === 'function';
}

/** Mouse drag-to-pan. Touch and pen keep the browser's native scrolling. */
function attachMouseDrag(viewport: HTMLElement): void {
  let drag: { id: number; x: number; y: number; left: number; top: number } | null = null;

  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture?.(e.pointerId);
    viewport.classList.add('is-dragging');
    e.preventDefault();
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    viewport.scrollLeft = drag.left - (e.clientX - drag.x);
    viewport.scrollTop = drag.top - (e.clientY - drag.y);
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    viewport.releasePointerCapture?.(e.pointerId);
    viewport.classList.remove('is-dragging');
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
}

function openMapPopup(doc: Document, link: HTMLAnchorElement): void {
  const state = getState(doc);
  const { refs } = state;
  const title = link.dataset.mapTitle ?? '';
  const address = link.dataset.mapAddress ?? '';
  const large = link.dataset.mapLarge || link.querySelector('img')?.getAttribute('src') || '';

  state.opener = link;
  state.cardImg = link.querySelector<HTMLImageElement>('img');
  refs.title.textContent = title;
  refs.address.textContent = address;
  refs.address.hidden = !address;
  refs.img.alt = title ? `Bản đồ đến ${title}` : 'Bản đồ';
  refs.mapsLink.href = link.dataset.mapsUrl || link.href;
  refs.img.removeAttribute('style');
  refs.viewport.scrollLeft = 0;
  refs.viewport.scrollTop = 0;
  refs.img.setAttribute('src', large);

  showDialog(state);
  layout(state); // covers an image that is already loaded (no load event will fire)
}

function showDialog(state: PopupState): void {
  const { dialog } = state.refs;
  if (state.isOpen) return;
  state.isOpen = true;
  state.savedBodyOverflow = state.doc.body.style.overflow;
  state.doc.body.style.overflow = 'hidden';
  let modal = false;
  if (supportsModal(dialog) && !dialog.open) {
    try {
      dialog.showModal();
      modal = true;
    } catch {
      /* fall through to the attribute fallback */
    }
  }
  if (!modal) dialog.setAttribute('open', '');
}

function closePopup(state: PopupState): void {
  const { dialog } = state.refs;
  if (!state.isOpen) return;
  if (typeof dialog.close === 'function' && dialog.open) {
    dialog.close(); // fires 'close' -> finishClose
  } else {
    dialog.removeAttribute('open');
    finishClose(state);
  }
}

function finishClose(state: PopupState): void {
  if (!state.isOpen) return;
  state.isOpen = false;
  state.doc.body.style.overflow = state.savedBodyOverflow;
  (state.doc.defaultView ?? window).removeEventListener('resize', state.onResize);
  const opener = state.opener;
  state.opener = null;
  state.cardImg = null;
  opener?.focus?.();
}

/**
 * Sizes the large image so its zoom matches the card preview (cardWidth / cardNaturalWidth applied to the large
 * natural size), then centers the viewport on the image center (the pin).
 */
function layout(state: PopupState): void {
  const { img, viewport } = state.refs;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!state.isOpen || !nw || !nh) return;

  const card = state.cardImg;
  // The card <img> is lazy-loaded: before it loads naturalWidth is 0, so fall back to its width="800" attribute.
  const cardNatural = card ? card.naturalWidth || Number(card.getAttribute('width')) || 0 : 0;
  const cardRatio = card && cardNatural > 0 && card.clientWidth > 0 ? card.clientWidth / cardNatural : FALLBACK_RATIO;
  // Same zoom as the card, but never leave empty bands: grow just enough to cover the viewport (tall phone screens).
  const ratio = Math.max(cardRatio, viewport.clientWidth / nw, viewport.clientHeight / nh);
  const cssW = nw * ratio;
  const cssH = nh * ratio;
  img.style.width = `${cssW}px`;
  img.style.height = `${cssH}px`;

  viewport.scrollLeft = Math.max(0, (cssW - viewport.clientWidth) / 2);
  viewport.scrollTop = Math.max(0, (cssH - viewport.clientHeight) / 2);
}
