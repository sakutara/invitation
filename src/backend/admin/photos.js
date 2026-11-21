// Ảnh cưới: danh sách ảnh, tải lên, sắp xếp, chỉnh sửa và popup chỉnh khung ảnh (crop).
import { api, h, openModal } from './common.js';

const PLACEMENTS = [
  ['hero', 'Ảnh bìa trang chủ'],
  ['story', 'Nền mục "Câu chuyện"'],
  ['gallery', 'Album ảnh'],
  ['rsvp_background', 'Nền trang đăng ký'],
  ['invite_portrait', 'Ảnh chân dung trên thiệp'],
  ['static_map', 'Ảnh bản đồ (không cắt)'],
];
const PLACEMENT_LABEL = Object.fromEntries(PLACEMENTS);
/** Fixed frame ratios (width / height). Gallery is handled separately (3:2 or 2:3). */
const FIXED_ASPECT = { hero: 16 / 9, rsvp_background: 16 / 9, story: 4 / 5, invite_portrait: 4 / 5 };
const MAX_ZOOM = 5;
/** Double-tap: max gap between taps (ms) and max distance (px). A tap is a press that moved less than TAP_MOVE_PX. */
const TAP_MS = 300;
const TAP_PX = 24;
const TAP_MOVE_PX = 12;

let root;
let listEl;
let flashEl;
let photos = [];
/** Per-photo cache-busting stamp, bumped after a recrop so thumbnails refresh. */
const versions = new Map();
const loadedAt = Date.now();

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function flash(msg) {
  if (flashEl) flashEl.textContent = msg;
}

/** Run a mutation, reload the list, and show the outcome in the flash line. */
async function act(msg, fn) {
  try {
    await fn();
    await reload();
    flash(msg);
  } catch (e) {
    flash('Lỗi: ' + e.message);
  }
}

function placementSelect(value) {
  const sel = h('select', { class: 'input' }, ...PLACEMENTS.map(([v, label]) => h('option', { value: v }, label)));
  sel.value = value;
  return sel;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error ?? new Error('Không đọc được tệp'));
    reader.readAsDataURL(file);
  });
}

function buildUpload() {
  let picked = [];
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr-only', 'aria-label': 'Chọn ảnh' });
  const placement = placementSelect('gallery');
  const status = h('p', { class: 'status', 'aria-live': 'polite' });
  const btn = h('button', { type: 'button', class: 'btn btn-primary min-h-10 w-full sm:w-auto' }, 'Tải ảnh lên');

  const showPicked = () => {
    status.textContent = picked.length ? `Đã chọn ${picked.length} ảnh.` : '';
  };
  fileInput.addEventListener('change', () => {
    picked = [...fileInput.files];
    showPicked();
  });

  // Drag & drop of image files onto the drop zone (desktop).
  const zone = h(
    'div',
    { class: 'flex flex-col gap-3 rounded-xl border-2 border-dashed border-line bg-white p-4 transition' },
    h(
      'div',
      { class: 'flex flex-col items-center gap-2 text-center' },
      h('p', { class: 'label' }, 'Kéo ảnh vào đây (máy tính) hoặc'),
      h(
        'label',
        { class: 'btn btn-primary min-h-12 w-full cursor-pointer text-base focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-burgundy sm:w-auto' },
        'Chọn ảnh',
        fileInput,
      ),
      h('p', { class: 'hint' }, 'Có thể chọn nhiều ảnh cùng lúc.'),
      status,
    ),
    h(
      'div',
      { class: 'flex flex-col gap-3 sm:flex-row sm:items-end' },
      h('label', { class: 'field sm:w-72' }, h('span', { class: 'label' }, 'Hiển thị ở'), placement),
      btn,
    ),
  );
  const highlight = (on) => {
    zone.classList.toggle('ring-2', on);
    zone.classList.toggle('ring-burgundy/40', on);
  };
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    highlight(true);
  });
  zone.addEventListener('dragleave', () => highlight(false));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    highlight(false);
    picked = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    showPicked();
  });

  btn.addEventListener('click', async () => {
    if (!picked.length) {
      status.textContent = 'Chọn ít nhất một ảnh.';
      return;
    }
    const files = picked;
    btn.disabled = true;
    status.textContent = `Đang tải ${files.length} ảnh…`;
    try {
      const items = await Promise.all(
        files.map(async (f) => ({ filename: f.name, dataBase64: await readAsDataUrl(f), caption: '', placement: placement.value })),
      );
      await api('POST', '/api/photos', { photos: items });
      picked = [];
      fileInput.value = '';
      status.textContent = `Đã tải ${items.length} ảnh.`;
      await reload();
    } catch (e) {
      status.textContent = 'Lỗi: ' + e.message;
    } finally {
      btn.disabled = false;
    }
  });
  return h('div', { class: 'mb-4' }, zone);
}

function thumbUrl(p) {
  const v = p.variants.find((x) => x.tier === 'sm' && x.format === 'jpg') ?? p.variants.find((x) => x.format === 'jpg') ?? p.variants[0];
  return { v, src: `/site/${v.src}?v=${versions.get(p.id) ?? loadedAt}` };
}

function card(p, index) {
  const { v, src } = thumbUrl(p);
  const img = h('img', {
    src,
    alt: p.caption || PLACEMENT_LABEL[p.placement],
    loading: 'lazy',
    class: 'block h-auto w-full',
    style: { aspectRatio: `${v.width} / ${v.height}` },
  });
  // Thumbnails can briefly 404 right after a recrop (dist rebuilds in the background); retry once.
  img.addEventListener('error', () => {
    if (img.dataset.retried) return;
    img.dataset.retried = '1';
    setTimeout(() => (img.src = src + '&r=1'), 1500);
  });
  const caption = h('input', { type: 'text', class: 'input min-w-0', value: p.caption ?? '', maxlength: 200 });
  const placement = placementSelect(p.placement);

  const save = () => act('Đã lưu ảnh.', () => api('PUT', `/api/photos/${p.id}`, { caption: caption.value, placement: placement.value }));
  const move = (delta) => {
    const ids = photos.map((x) => x.id);
    const j = index + delta;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    return act('Đã đổi thứ tự.', () => api('PUT', '/api/photos/order', { ids }));
  };
  const remove = () => {
    if (!confirm(`Xoá ảnh "${p.caption || PLACEMENT_LABEL[p.placement]}"? Không thể hoàn tác.`)) return;
    return act('Đã xoá ảnh.', () => api('DELETE', `/api/photos/${p.id}`));
  };

  const actions = [
    h('button', { type: 'button', class: 'btn btn-icon btn-outline btn-sm', 'aria-label': 'Đưa ảnh lên trước', title: 'Đưa ảnh lên trước', disabled: index === 0, onclick: () => move(-1) }, '↑'),
    h('button', { type: 'button', class: 'btn btn-icon btn-outline btn-sm', 'aria-label': 'Đưa ảnh xuống sau', title: 'Đưa ảnh xuống sau', disabled: index === photos.length - 1, onclick: () => move(1) }, '↓'),
  ];
  if (p.placement !== 'static_map') {
    actions.push(h('button', { type: 'button', class: 'btn btn-sm btn-secondary min-h-10 sm:min-h-8', onclick: () => openCrop(p) }, '✂ Khung'));
  }
  actions.push(h('button', { type: 'button', class: 'btn btn-sm btn-primary min-h-10 sm:min-h-8', onclick: save }, 'Lưu'));
  actions.push(h('button', { type: 'button', class: 'btn btn-sm btn-danger min-h-10 sm:min-h-8', onclick: remove }, 'Xoá'));

  return h(
    'article',
    { class: 'flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-white p-2 shadow-sm' },
    h(
      'div',
      { class: 'relative overflow-hidden rounded-lg bg-cream' },
      img,
      h('span', { class: 'badge absolute left-1.5 top-1.5 bg-navy/85 text-white shadow-sm' }, `Vị trí #${index + 1}`),
    ),
    h('label', { class: 'field min-w-0 py-0' }, h('span', { class: 'label' }, 'Chú thích'), caption),
    h('label', { class: 'field min-w-0 py-0' }, h('span', { class: 'label' }, 'Hiển thị ở'), placement),
    h('div', { class: 'flex flex-wrap items-center gap-1.5' }, ...actions),
  );
}

function renderList() {
  listEl.replaceChildren(
    ...(photos.length ? photos.map((p, i) => card(p, i)) : [h('p', { class: 'hint col-span-full' }, 'Chưa có ảnh nào. Hãy tải ảnh lên ở trên.')]),
  );
}

async function reload() {
  photos = await api('GET', '/api/photos');
  renderList();
}

/** Crop popup. Image is drawn at natural size * scale, offset (ox, oy) from the frame's top-left. */
function openCrop(p) {
  let orient = 'landscape';
  const isGallery = p.placement === 'gallery';
  const aspect = () => (isGallery ? (orient === 'landscape' ? 3 / 2 : 2 / 3) : FIXED_ASPECT[p.placement]);

  const img = h('img', { class: 'pointer-events-none absolute max-w-none select-none', alt: '', draggable: 'false' });
  const frame = h(
    'div',
    { class: 'pointer-events-none absolute box-border border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]' },
    h('i', { class: 'absolute inset-y-0 left-1/3 w-px bg-white/50' }),
    h('i', { class: 'absolute inset-y-0 left-2/3 w-px bg-white/50' }),
    h('i', { class: 'absolute inset-x-0 top-1/3 h-px bg-white/50' }),
    h('i', { class: 'absolute inset-x-0 top-2/3 h-px bg-white/50' }),
  );
  // Stage fills the modal body; its size is measured, the frame is computed from it.
  const stage = h(
    'div',
    { class: 'relative h-[min(70dvh,640px)] w-full touch-none select-none cursor-grab overflow-hidden rounded-lg bg-navy-deep' },
    img,
    frame,
  );
  const status = h('p', { class: 'status mt-2' }, 'Đang tải ảnh gốc…');
  const zoom = h('input', { type: 'range', min: '1', max: String(MAX_ZOOM), step: '0.01', value: '1', 'aria-label': 'Phóng to', class: 'w-full accent-burgundy' });
  const zoomLabel = h('span', { class: 'w-14 shrink-0 text-right text-sm tabular-nums text-muted' }, '×1.00');
  const btnLandscape = h('button', { type: 'button', class: 'btn btn-sm btn-outline', 'aria-pressed': 'false' }, 'Ngang 3:2');
  const btnPortrait = h('button', { type: 'button', class: 'btn btn-sm btn-outline', 'aria-pressed': 'false' }, 'Dọc 2:3');

  // Geometry state
  let url = null;
  let ready = false;
  let nw = 0;
  let nh = 0;
  let FW = 0;
  let FH = 0;
  let FL = 0;
  let FT = 0;
  let minScale = 1;
  let scale = 1;
  let z = 1;
  let ox = 0;
  let oy = 0;

  const layoutFrame = () => {
    const SW = stage.clientWidth;
    const SH = stage.clientHeight;
    if (!SW || !SH || !nw) return;
    const a = aspect();
    if (SW / SH > a) {
      FH = SH * 0.9;
      FW = FH * a;
    } else {
      FW = SW * 0.9;
      FH = FW / a;
    }
    FL = (SW - FW) / 2;
    FT = (SH - FH) / 2;
    Object.assign(frame.style, { left: FL + 'px', top: FT + 'px', width: FW + 'px', height: FH + 'px' });
    minScale = Math.max(FW / nw, FH / nh);
  };
  const clampView = () => {
    ox = clamp(ox, FW - nw * scale, 0);
    oy = clamp(oy, FH - nh * scale, 0);
  };
  const render = () => {
    Object.assign(img.style, { width: nw * scale + 'px', height: nh * scale + 'px', left: FL + ox + 'px', top: FT + oy + 'px' });
    zoom.value = String(z);
    zoomLabel.textContent = `×${z.toFixed(2)}`;
  };
  /** Set zoom (relative to cover) keeping natural-image point (cx, cy) at the frame centre. */
  const setView = (newZ, cx, cy) => {
    z = clamp(newZ, 1, MAX_ZOOM);
    scale = minScale * z;
    ox = FW / 2 - cx * scale;
    oy = FH / 2 - cy * scale;
    clampView();
    render();
  };
  /** Zoom keeping the point at frame coordinate (ax, ay) fixed. */
  const zoomAt = (newZ, ax, ay) => {
    const nz = clamp(newZ, 1, MAX_ZOOM);
    const ix = (ax - ox) / scale;
    const iy = (ay - oy) / scale;
    z = nz;
    scale = minScale * nz;
    ox = ax - ix * scale;
    oy = ay - iy * scale;
    clampView();
    render();
  };
  const centre = () => ({ cx: (FW / 2 - ox) / scale, cy: (FH / 2 - oy) / scale });
  /** Client (viewport) coordinates -> frame coordinates. */
  const toFrame = (x, y) => {
    const r = stage.getBoundingClientRect();
    return { fx: x - r.left - FL, fy: y - r.top - FT };
  };
  const setToggle = () => {
    btnLandscape.setAttribute('aria-pressed', String(orient === 'landscape'));
    btnPortrait.setAttribute('aria-pressed', String(orient === 'portrait'));
  };
  const switchOrient = (next) => {
    if (!ready || orient === next) return;
    const { cx, cy } = centre();
    orient = next;
    setToggle();
    layoutFrame();
    setView(z, cx, cy);
  };
  btnLandscape.addEventListener('click', () => switchOrient('landscape'));
  btnPortrait.addEventListener('click', () => switchOrient('portrait'));
  zoom.addEventListener('input', () => ready && zoomAt(parseFloat(zoom.value), FW / 2, FH / 2));

  // Touch / pointer gestures. pointers: id -> current and start client position.
  // gesture: one pointer = pan; two pointers = pinch-zoom around their midpoint.
  const pointers = new Map();
  let gesture = null;
  let lastTap = null;

  const beginGesture = () => {
    const pts = [...pointers.values()];
    if (pts.length === 1) {
      gesture = { pan: true, x: pts[0].x, y: pts[0].y, ox, oy };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      const m = toFrame((a.x + b.x) / 2, (a.y + b.y) / 2);
      gesture = {
        pinch: true,
        d: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        z0: z,
        ix: (m.fx - ox) / scale,
        iy: (m.fy - oy) / scale,
      };
    } else {
      gesture = null;
    }
  };
  const pinchMove = () => {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const m = toFrame((a.x + b.x) / 2, (a.y + b.y) / 2);
    z = clamp(gesture.z0 * (d / gesture.d), 1, MAX_ZOOM);
    scale = minScale * z;
    ox = m.fx - gesture.ix * scale;
    oy = m.fy - gesture.iy * scale;
    clampView();
    render();
  };

  stage.addEventListener('pointerdown', (e) => {
    if (!ready) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (pointers.size === 1) {
      const last = lastTap;
      lastTap = null;
      if (last && performance.now() - last.t < TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < TAP_PX) {
        // Double-tap: toggle between cover scale and 2x around the tapped point.
        const { fx, fy } = toFrame(e.clientX, e.clientY);
        zoomAt(z > 1.01 ? 1 : 2, fx, fy);
      }
    }
    stage.classList.add('cursor-grabbing');
    beginGesture();
  });
  stage.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p || !gesture) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (gesture.pinch && pointers.size >= 2) {
      pinchMove();
    } else if (gesture.pan && pointers.size === 1) {
      ox = gesture.ox + (e.clientX - gesture.x);
      oy = gesture.oy + (e.clientY - gesture.y);
      clampView();
      render();
    }
  });
  const release = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (e.type === 'pointerup' && pointers.size === 1 && Math.hypot(p.x - p.sx, p.y - p.sy) < TAP_MOVE_PX) {
      lastTap = { t: performance.now(), x: p.x, y: p.y };
    }
    pointers.delete(e.pointerId);
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    beginGesture(); // a remaining finger continues as a pan
    if (!pointers.size) stage.classList.remove('cursor-grabbing');
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  // Mouse wheel zoom around the cursor
  stage.addEventListener(
    'wheel',
    (e) => {
      if (!ready) return;
      e.preventDefault();
      const { fx, fy } = toFrame(e.clientX, e.clientY);
      zoomAt(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), fx, fy);
    },
    { passive: false },
  );

  // Keep the view centred when the stage size changes (window resize, orientation change).
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (!ready) return;
    const { cx, cy } = centre();
    layoutFrame();
    setView(z, cx, cy);
  }) : null;
  ro?.observe(stage);

  const currentCrop = () => {
    const dw = nw * scale;
    const dh = nh * scale;
    const w = Math.min(1, FW / dw);
    const hh = Math.min(1, FH / dh);
    const x = clamp(-ox / dw, 0, 1 - w);
    const y = clamp(-oy / dh, 0, 1 - hh);
    const r = (n) => Math.round(n * 1e6) / 1e6;
    return { x: r(x), y: r(y), w: r(w), h: r(hh) };
  };

  const body = h(
    'div',
    {},
    h(
      'p',
      { class: 'hint' },
      'Kéo để chọn vị trí. Hai ngón để phóng to, chạm đúp để phóng to/thu nhỏ, lăn chuột hoặc kéo thanh trượt cũng được. Phần trong khung là phần hiển thị trên web.',
    ),
    h('div', { class: 'mt-3' }, stage),
    h(
      'div',
      { class: 'mt-3 flex flex-col gap-3 sm:flex-row sm:items-center' },
      h(
        'label',
        { class: 'flex flex-1 items-center gap-3' },
        h('span', { class: 'label shrink-0' }, 'Phóng to'),
        zoom,
        zoomLabel,
      ),
      ...(isGallery ? [h('div', { class: 'flex shrink-0 gap-2' }, btnLandscape, btnPortrait)] : []),
    ),
    status,
  );

  const modal = openModal({
    title: `Chỉnh khung ảnh · ${PLACEMENT_LABEL[p.placement]}`,
    body,
    wide: true,
    onClose: () => {
      ro?.disconnect();
      if (url) URL.revokeObjectURL(url);
    },
    actions: [
      { label: 'Đặt lại', kind: 'secondary', onClick: () => ready && setView(1, nw / 2, nh / 2) },
      { label: 'Huỷ', kind: 'secondary', onClick: (close) => close() },
      {
        label: 'Lưu khung ảnh',
        onClick: async (close) => {
          if (!ready) return;
          try {
            await api('PUT', `/api/photos/${p.id}`, { crop: currentCrop() });
            versions.set(p.id, Date.now());
            close();
            await reload();
            flash('Đã lưu khung ảnh. Trang chính sẽ cập nhật sau vài giây.');
          } catch (e) {
            status.textContent = 'Lỗi: ' + e.message;
          }
        },
      },
    ],
  });

  // Load the EXIF-rotated original (max 2000px) and initialise the frame.
  (async () => {
    try {
      const res = await fetch(`/api/photos/${p.id}/original`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const origW = Number(res.headers.get('x-image-width')) || 0;
      const origH = Number(res.headers.get('x-image-height')) || 0;
      url = URL.createObjectURL(await res.blob());
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('không đọc được ảnh'));
        img.src = url;
      });
      nw = img.naturalWidth;
      nh = img.naturalHeight;
      const c = p.crop;
      if (isGallery) {
        // Existing crop decides the orientation; otherwise follow the photo itself.
        const landscape = c && origW && origH ? (c.w * origW) / (c.h * origH) >= 1 : (origW || nw) >= (origH || nh);
        orient = landscape ? 'landscape' : 'portrait';
      }
      setToggle();
      layoutFrame();
      if (c) {
        // Frame width covers c.w of the image; centre on the crop's centre.
        const dw = FW / c.w;
        setView(dw / nw / minScale, (c.x + c.w / 2) * nw, (c.y + c.h / 2) * nh);
      } else {
        setView(1, nw / 2, nh / 2);
      }
      ready = true;
      status.textContent = '';
    } catch (e) {
      status.textContent = 'Không tải được ảnh gốc: ' + e.message;
    }
  })();
  return modal;
}

export async function init() {
  root = document.getElementById('photos-root');
  if (!root) return;
  listEl = h('div', { class: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' });
  flashEl = h('p', { class: 'status my-2', 'aria-live': 'polite' });
  root.replaceChildren(buildUpload(), flashEl, listEl);
  await reload();
}
