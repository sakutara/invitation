// Visual banquet seating plan (admin section C).
// Auto-layout is NOT re-implemented here: POST /api/seating-layout/auto calls src/shared/seating-layout.ts
// (single source of truth), so the browser only handles drawing and editing.
import { $, api, h, openModal } from './common.js';

const CANVAS = { w: 1000, h: 700 };
const STAGE = { x: 300, y: 20, w: 400, h: 70 };
const AISLE = { x: 470, w: 60, top: 100 };
const TABLE_R = 22;
const HIT_R = TABLE_R + 10; // invisible, larger hit circle on touch screens
const SNAP = 5;
const MIN_Y = 120; // keep tables below the stage
const MAX_TABLES = 80;
const MIN_VIEW_W = 120;
const MAX_VIEW_W = 2400;
const SVG_NS = 'http://www.w3.org/2000/svg';
// Palette tokens (src/shared/types.ts COLOR_TOKENS)
const NAVY = '#0F2042';
const IVORY = '#FDFBF7';
const CREAM = '#F5EFE6';
const BURGUNDY = '#7A1C24';

// Tailwind class strings. Complete literals only: Tailwind scans this file for class names.
const TB = 'btn btn-sm btn-outline min-h-10 shrink-0 text-sm sm:min-h-8 sm:text-xs';
const TB_ICON = 'btn btn-sm btn-outline btn-icon min-h-10 shrink-0 text-base sm:min-h-8';
const PANEL = 'grid gap-2 rounded-xl border border-line bg-white p-3';
const SWATCH = 'inline-block h-4 w-4 shrink-0 rounded ring-1 ring-black/10';
const ZONE_GRID = 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.6fr)]';
const ZONE_HEAD = 'hidden gap-x-3 px-3 text-xs font-semibold text-muted sm:grid sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.6fr)]';

const GROUP_VI = {
  groom_family: 'Gia đình chú rể',
  bride_family: 'Gia đình cô dâu',
  groom_friends: 'Bạn bè chú rể',
  bride_friends: 'Bạn bè cô dâu',
  groom_parents_friends: 'Khách bố mẹ chú rể',
  bride_parents_friends: 'Khách bố mẹ cô dâu',
  other: 'Khác',
};

let root = null;
let editor = null;

const clone = (v) => JSON.parse(JSON.stringify(v));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clampInt = (v, lo, hi) => clamp(Math.trunc(Number(v)) || lo, lo, hi);
const snap = (v) => Math.round(v / SNAP) * SNAP;
const clampX = (v) => clamp(v, TABLE_R, CANVAS.w - TABLE_R);
const clampY = (v) => clamp(v, MIN_Y, CANVAS.h - TABLE_R);
/** Keep a view of `size` inside the canvas (with a 150-unit margin); centre it when it is larger than that. */
const clampPos = (p, size, full) => {
  const lo = -150;
  const hi = full + 150 - size;
  return lo <= hi ? clamp(p, lo, hi) : (lo + hi) / 2;
};

/** Ink colour (navy or white) that reads on a zone colour. */
function inkOn(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const lum = ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  return lum > 150 ? NAVY : '#FFFFFF';
}

function svgEl(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) el.setAttribute(k, String(v));
  el.append(...children);
  return el;
}

export async function init() {
  root = $('seating-root');
  if (!root) return;
  await renderMain();
}

function zoneRow(z) {
  return h(
    'li',
    { class: ZONE_GRID + ' rounded-xl border border-line bg-white p-3' },
    h('span', { class: 'row-span-3 row-start-1 col-start-1 h-4 w-4 rounded ring-1 ring-black/10 sm:row-span-1 sm:col-start-1', style: { background: z.color } }),
    h('strong', { class: 'col-start-2 row-start-1 min-w-0 break-words font-semibold text-navy sm:col-start-2' }, z.nameVi),
    h('span', { class: 'col-start-2 row-start-2 text-xs text-muted sm:col-start-3 sm:row-start-1 sm:text-sm' }, GROUP_VI[z.relationship] ?? z.relationship),
    h('span', { class: 'col-start-2 row-start-3 min-w-0 break-words text-sm sm:col-start-4 sm:row-start-1' }, z.tableRange),
  );
}

async function renderMain(note) {
  root.replaceChildren(h('p', { class: 'hint' }, 'Đang tải sơ đồ…'));
  try {
    const data = await api('GET', '/api/seating-layout');
    root.replaceChildren(
      h(
        'p',
        { class: 'text-sm text-muted' },
        data.isDefault
          ? 'Sơ đồ đang theo cách xếp khu cũ. Bấm "Chỉnh sơ đồ bàn" để xếp bàn trực quan và đặt tên khu.'
          : 'Sơ đồ bàn tiệc đã được chỉnh. Khách sẽ thấy sơ đồ này trong thiệp mời.',
      ),
      h('img', { class: 'mt-3 block w-full max-w-3xl rounded-xl border border-line bg-white', src: `/api/seating-layout/preview.svg?t=${Date.now()}`, alt: 'Xem trước sơ đồ bàn tiệc' }),
      h(
        'div',
        { class: 'mt-3 flex flex-col gap-2 sm:flex-row sm:items-center' },
        h('button', { type: 'button', class: 'btn btn-primary w-full sm:w-auto', onclick: () => openEditor() }, 'Chỉnh sơ đồ bàn'),
        note ? h('span', { class: 'status' }, note) : null,
      ),
      h(
        'div',
        { class: 'mt-5' },
        h('h3', { class: 'mb-2 text-sm font-semibold text-navy' }, 'Khu vực'),
        h('div', { class: ZONE_HEAD }, h('span', {}, ''), h('span', {}, 'Tên khu vực'), h('span', {}, 'Nhóm khách'), h('span', {}, 'Bàn')),
        h('ul', { class: 'grid gap-2' }, data.zones.map(zoneRow)),
      ),
    );
  } catch (e) {
    root.replaceChildren(h('p', { class: 'text-sm text-red-700' }, 'Không tải được sơ đồ: ' + e.message));
  }
}

async function openEditor() {
  let data;
  try {
    data = await api('GET', '/api/seating-layout');
  } catch (e) {
    return renderMain('Lỗi: ' + e.message);
  }

  const s = {
    layout: clone(data.layout),
    zones: clone(data.zones),
    sel: new Set(),
    dirty: false,
    dragged: false,
    panMode: false,
    space: false,
    multi: false, // "Chọn nhiều": tapping a table toggles it in the selection
    manual: false, // true once the user zooms or pans; until then the view refits on resize
    ar: CANVAS.h / CANVAS.w, // canvas height / width, updated from the real element size
    view: { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h },
    drag: null,
    pointers: new Map(), // pointerId -> {x, y} client coords of pressed pointers
  };
  editor = s;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches === true;
  let ro = null;

  // ----- canvas -----
  const svg = svgEl('svg', {
    viewBox: `0 0 ${CANVAS.w} ${CANVAS.h}`,
    class: 'absolute inset-0 h-full w-full touch-none select-none cursor-crosshair',
    role: 'application',
    'aria-label': 'Sơ đồ bàn tiệc 1000 x 700',
  });
  const tablesG = svgEl('g', { 'data-role': 'tables' });
  const bandRect = svgEl('rect', { fill: 'rgba(15,32,66,0.08)', stroke: NAVY, 'stroke-width': 2, 'stroke-dasharray': '6 4', display: 'none', 'pointer-events': 'none' });
  svg.append(
    svgEl('rect', { x: 0, y: 0, width: CANVAS.w, height: CANVAS.h, rx: 18, fill: IVORY, stroke: NAVY, 'stroke-width': 3, 'pointer-events': 'none' }),
    svgEl('rect', { x: STAGE.x, y: STAGE.y, width: STAGE.w, height: STAGE.h, rx: 14, fill: NAVY, 'pointer-events': 'none' }),
    svgEl('text', { x: STAGE.x + STAGE.w / 2, y: STAGE.y + STAGE.h / 2 + 12, 'text-anchor': 'middle', 'font-family': 'Georgia, serif', 'font-size': 34, fill: IVORY, 'letter-spacing': 6, 'pointer-events': 'none' }, 'SÂN KHẤU'),
    svgEl('rect', { x: AISLE.x, y: AISLE.top, width: AISLE.w, height: CANVAS.h - AISLE.top, fill: CREAM, stroke: BURGUNDY, 'stroke-width': 2, 'stroke-dasharray': '12 10', 'pointer-events': 'none' }),
    svgEl('text', { x: AISLE.x + AISLE.w / 2, y: 420, 'text-anchor': 'middle', 'font-family': 'sans-serif', 'font-size': 26, fill: BURGUNDY, transform: `rotate(-90 ${AISLE.x + AISLE.w / 2} 420)`, 'pointer-events': 'none' }, 'LỐI ĐI CHÍNH'),
    tablesG,
    bandRect,
  );
  const canvasWrap = h('div', { class: 'relative min-h-[50dvh] min-w-0 flex-1 touch-none overflow-hidden rounded-xl border border-line bg-white' }, svg);

  // ----- toolbar -----
  const countInput = h('input', { type: 'number', min: 1, max: MAX_TABLES, inputmode: 'numeric', class: 'input w-16 text-center', 'aria-label': 'Số bàn' });
  const zoomLabel = h('span', { class: 'min-w-12 text-center text-xs tabular-nums text-muted', 'aria-live': 'polite' }, '');
  const modeSelect = h('button', { type: 'button', class: TB, 'aria-pressed': 'true', onclick: () => setPanMode(false) }, 'Chọn');
  const modePan = h('button', { type: 'button', class: TB, 'aria-pressed': 'false', 'aria-label': 'Kéo khung nhìn', onclick: () => setPanMode(true) }, 'Kéo khung');
  const modeMulti = h('button', { type: 'button', class: TB, 'aria-pressed': 'false', onclick: () => setMulti(!s.multi) }, 'Chọn nhiều');
  const group = (...kids) => h('div', { class: 'flex shrink-0 items-center gap-1.5' }, ...kids);
  const toolbar = h(
    'div',
    { class: 'flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:items-center sm:overflow-visible' },
    group(
      h('span', { class: 'whitespace-nowrap text-sm font-medium text-navy' }, 'Số bàn'),
      h('button', { type: 'button', class: TB_ICON, 'aria-label': 'Giảm số bàn', onclick: () => reflow(s.layout.tables.length - 1) }, '−'),
      countInput,
      h('button', { type: 'button', class: TB_ICON, 'aria-label': 'Tăng số bàn', onclick: () => reflow(s.layout.tables.length + 1) }, '+'),
    ),
    h('button', { type: 'button', class: TB, onclick: () => reflow(s.layout.tables.length) }, 'Tự xếp'),
    group(
      h('button', { type: 'button', class: TB_ICON, 'aria-label': 'Thu nhỏ', onclick: () => zoomAt(centerOfView(), 1 / 0.8) }, '−'),
      h('button', { type: 'button', class: TB_ICON, 'aria-label': 'Phóng to', onclick: () => zoomAt(centerOfView(), 0.8) }, '+'),
      h('button', { type: 'button', class: TB, onclick: () => { s.manual = false; fitView(); } }, 'Vừa khung'),
      zoomLabel,
    ),
    group(modeSelect, modePan, modeMulti),
    h(
      'p',
      { class: 'hint hidden basis-full sm:block' },
      'Kéo bàn để di chuyển · Shift/Ctrl-click hoặc bật "Chọn nhiều" để chọn nhiều · Kéo vùng trống để chọn cả nhóm · Giữ Space hoặc chọn "Kéo khung" để di chuyển khung · Con lăn để phóng to · Mũi tên để nhích 5 đơn vị',
    ),
  );
  countInput.addEventListener('change', () => reflow(Number(countInput.value)));

  // ----- side panel (phones: below the canvas; desktop: right column) -----
  const selLabel = h('p', { class: 'text-sm font-semibold text-navy' }, '');
  const zoneSelect = h('select', { class: 'input', 'aria-label': 'Chọn khu vực' }, s.zones.map((z) => h('option', { value: z.id }, z.nameVi)));
  const swatch = h('span', { class: SWATCH });
  const nameInput = h('input', { type: 'text', maxlength: 160, class: 'input', 'aria-label': 'Tên khu vực', placeholder: 'Tên khu vực hiển thị' });
  const zoneList = h('div', { class: 'mt-1 grid gap-1.5' });
  const panelStatus = h('p', { class: 'status', role: 'status' }, '');
  const status = h('p', { class: 'status', role: 'status' }, '');
  zoneSelect.addEventListener('change', () => syncZoneFields(zoneSelect.value));
  const zoneDetails = h(
    'details',
    { class: 'rounded-xl border border-line bg-white px-3 py-1' },
    h('summary', { class: 'flex min-h-10 cursor-pointer list-none items-center text-sm font-semibold text-navy [&::-webkit-details-marker]:hidden' }, 'Danh sách khu vực (bấm để chọn các bàn)'),
    zoneList,
  );
  zoneDetails.open = window.matchMedia('(min-width: 1024px)').matches; // open on desktop, closed on phones
  const panel = h(
    'aside',
    { class: 'flex shrink-0 flex-col gap-3 lg:w-80 lg:min-h-0 lg:shrink-0 lg:overflow-auto' },
    h(
      'section',
      { class: PANEL },
      selLabel,
      h('p', { class: 'hint' }, 'Chọn bàn trên sơ đồ, rồi chọn khu và bấm Gán để đưa các bàn đó vào khu.'),
      h('div', { class: 'grid gap-1' }, h('span', { class: 'label' }, 'Khu vực'), h('div', { class: 'flex min-w-0 items-center gap-2' }, swatch, zoneSelect)),
      h('label', { class: 'grid gap-1' }, h('span', { class: 'label' }, 'Tên khu vực'), nameInput),
      h(
        'div',
        { class: 'flex flex-wrap gap-2' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: assignSelected }, 'Gán vào khu vực'),
        h('button', { type: 'button', class: 'btn btn-outline', onclick: unassignSelected }, 'Bỏ khỏi khu vực'),
      ),
      panelStatus,
    ),
    zoneDetails,
  );

  const body = h(
    'div',
    // Phones: natural height, the modal body scrolls. lg+: fill the modal, canvas grows, panel scrolls.
    { class: 'flex flex-col gap-3 lg:h-full' },
    toolbar,
    h('div', { class: 'flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:flex-row' }, canvasWrap, panel),
    status,
  );

  const cancel = () => {
    if (s.dirty && !confirm('Bỏ các thay đổi chưa lưu?')) return;
    modal.close();
  };
  const save = async () => {
    status.textContent = 'Đang lưu…';
    try {
      await api('PUT', '/api/seating-layout', { layout: s.layout, zones: s.zones });
      s.dirty = false;
      modal.close();
      await renderMain('Đã lưu sơ đồ bàn.');
    } catch (e) {
      status.textContent = 'Lỗi: ' + e.message;
    }
  };

  const modal = openModal({
    title: 'Chỉnh sơ đồ bàn tiệc',
    body,
    wide: true,
    dismissable: false,
    actions: [
      { label: 'Huỷ', kind: 'secondary', onClick: cancel },
      { label: 'Lưu sơ đồ', onClick: save },
    ],
    onClose: () => {
      ro?.disconnect();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      editor = null;
    },
  });
  // The header × closes unconditionally; intercept it while there are unsaved changes.
  modal.el.addEventListener(
    'click',
    (e) => {
      if (s.dirty && e.target.closest('.modal__x') && !confirm('Bỏ các thay đổi chưa lưu?')) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );

  // ----- helpers bound to this session -----
  const tableByNum = (n) => s.layout.tables.find((t) => t.number === n);
  const zoneById = (id) => s.zones.find((z) => z.id === id);
  const selectedTables = () => s.layout.tables.filter((t) => s.sel.has(t.number));
  const setStatus = (msg) => (status.textContent = msg);

  /** Read the canvas's real aspect ratio so the view never letterboxes. */
  function measure() {
    const r = svg.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) s.ar = r.height / r.width;
  }
  /** Show the whole hall, centred, with the view's aspect matching the canvas element. */
  function fitView() {
    measure();
    const w = s.ar >= CANVAS.h / CANVAS.w ? CANVAS.w : CANVAS.h / s.ar;
    const h = w * s.ar;
    s.view = { x: (CANVAS.w - w) / 2, y: (CANVAS.h - h) / 2, w, h };
    applyView();
  }
  function applyView() {
    const v = s.view;
    v.w = clamp(v.w, MIN_VIEW_W, MAX_VIEW_W);
    v.h = v.w * s.ar;
    v.x = clampPos(v.x, v.w, CANVAS.w);
    v.y = clampPos(v.y, v.h, CANVAS.h);
    svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    zoomLabel.textContent = `${Math.round((CANVAS.w / v.w) * 100)}%`;
  }
  function centerOfView() {
    return { x: s.view.x + s.view.w / 2, y: s.view.y + s.view.h / 2 };
  }
  function zoomAt(p, factor) {
    const v = s.view;
    const w = clamp(v.w * factor, MIN_VIEW_W, MAX_VIEW_W);
    const h = w * s.ar;
    const fx = (p.x - v.x) / v.w;
    const fy = (p.y - v.y) / v.h;
    s.view = { x: p.x - fx * w, y: p.y - fy * h, w, h };
    s.manual = true;
    applyView();
  }
  function toCanvas(e) {
    const m = svg.getScreenCTM();
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  }

  function paintCursor() {
    const grab = s.panMode || s.space;
    svg.classList.remove('cursor-grabbing');
    svg.classList.toggle('cursor-grab', grab);
    svg.classList.toggle('cursor-crosshair', !grab);
  }
  function setPanMode(on) {
    s.panMode = on;
    modeSelect.setAttribute('aria-pressed', String(!on));
    modePan.setAttribute('aria-pressed', String(on));
    paintCursor();
  }
  function setMulti(on) {
    s.multi = on;
    modeMulti.setAttribute('aria-pressed', String(on));
  }

  function drawTables() {
    const kids = s.layout.tables.map((t) => {
      const zone = zoneById(t.zoneId);
      const selected = s.sel.has(t.number);
      const group = svgEl('g', { 'data-num': t.number });
      if (coarse) group.append(svgEl('circle', { cx: t.x, cy: t.y, r: HIT_R, fill: 'transparent' }));
      if (selected) group.append(svgEl('circle', { cx: t.x, cy: t.y, r: TABLE_R + 7, fill: 'none', stroke: '#F59E0B', 'stroke-width': 4, 'pointer-events': 'none' }));
      group.append(
        svgEl('circle', { cx: t.x, cy: t.y, r: TABLE_R, fill: zone ? zone.color : '#E5E7EB', stroke: zone ? '#FFFFFF' : '#9CA3AF', 'stroke-width': 2 }),
        svgEl(
          'text',
          { x: t.x, y: t.y + 6, 'text-anchor': 'middle', 'font-family': 'sans-serif', 'font-size': 18, 'font-weight': 700, fill: zone ? inkOn(zone.color) : '#374151', 'pointer-events': 'none' },
          String(t.number),
        ),
      );
      return group;
    });
    tablesG.replaceChildren(...kids);
  }

  function updateSide(syncSelect = false) {
    const picked = selectedTables();
    selLabel.textContent = `Đã chọn: ${picked.length} bàn`;
    if (syncSelect && picked.length) {
      const ids = new Set(picked.map((t) => t.zoneId));
      if (ids.size === 1) {
        const [id] = ids;
        if (id) syncZoneFields(id);
      }
    }
    zoneList.replaceChildren(
      ...s.zones.map((z) => {
        const count = s.layout.tables.filter((t) => t.zoneId === z.id).length;
        return h(
          'button',
          {
            type: 'button',
            class: 'flex min-h-10 w-full items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-left text-sm text-ink hover:bg-cream',
            onclick: () => select(new Set(s.layout.tables.filter((t) => t.zoneId === z.id).map((t) => t.number))),
          },
          h('span', { class: SWATCH, style: { background: z.color } }),
          h('span', { class: 'min-w-0 break-words' }, z.nameVi),
          h('span', { class: 'ml-auto whitespace-nowrap text-xs text-muted' }, `${count} bàn`),
        );
      }),
    );
  }

  function syncZoneFields(id) {
    const z = zoneById(id);
    if (!z) return;
    zoneSelect.value = z.id;
    swatch.style.background = z.color;
    nameInput.value = z.nameVi;
  }

  function redraw(syncSelect = false) {
    drawTables();
    updateSide(syncSelect);
    countInput.value = String(s.layout.tables.length);
  }

  function select(next, opts = {}) {
    s.sel = next;
    redraw(opts.sync ?? true);
  }

  function assignSelected() {
    const picked = selectedTables();
    if (!picked.length) return (panelStatus.textContent = 'Chọn ít nhất một bàn trước.');
    const name = nameInput.value.trim();
    if (!name) return (panelStatus.textContent = 'Nhập tên khu vực.');
    const z = zoneById(zoneSelect.value);
    z.nameVi = name;
    for (const t of picked) t.zoneId = z.id;
    s.dirty = true;
    redraw(false);
    panelStatus.textContent = `Đã gán ${picked.length} bàn vào "${name}".`;
  }

  function unassignSelected() {
    const picked = selectedTables();
    if (!picked.length) return (panelStatus.textContent = 'Chọn ít nhất một bàn trước.');
    for (const t of picked) t.zoneId = null;
    s.dirty = true;
    redraw(false);
    panelStatus.textContent = `Đã bỏ ${picked.length} bàn khỏi khu vực.`;
  }

  async function reflow(count) {
    const n = clampInt(count, 1, MAX_TABLES);
    if (s.dragged && !confirm('Vị trí các bàn sẽ được sắp xếp lại tự động. Tiếp tục?')) {
      countInput.value = String(s.layout.tables.length);
      return;
    }
    try {
      const next = await api('POST', '/api/seating-layout/auto', { count: n, layout: s.layout });
      s.layout = next;
      s.dragged = false;
      s.dirty = true;
      s.sel = new Set([...s.sel].filter((x) => x <= n));
      redraw(false);
      setStatus(`Đã xếp ${n} bàn.`);
    } catch (e) {
      setStatus('Lỗi: ' + e.message);
      countInput.value = String(s.layout.tables.length);
    }
  }

  // ----- pointer interaction (mouse, pen and touch share one path) -----
  /** Abort a single-pointer gesture in progress: undo an unfinished group move, hide the rubber band. */
  function cancelDrag() {
    const d = s.drag;
    s.drag = null;
    if (!d) return;
    if (d.type === 'move' && d.moved) {
      for (const [n, o] of d.orig) {
        const t = tableByNum(n);
        if (t) {
          t.x = o.x;
          t.y = o.y;
        }
      }
      drawTables();
    }
    if (d.type === 'band') bandRect.setAttribute('display', 'none');
  }

  /** Two fingers (or a second pointer): pinch-zoom around the midpoint, plus pan with the midpoint. */
  function startPinch() {
    cancelDrag();
    const [a, b] = [...s.pointers.values()];
    const rect = svg.getBoundingClientRect();
    const fx = ((a.x + b.x) / 2 - rect.left) / rect.width;
    const fy = ((a.y + b.y) / 2 - rect.top) / rect.height;
    const v = s.view;
    s.drag = {
      type: 'pinch',
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      w0: v.w,
      anchor: { x: v.x + fx * v.w, y: v.y + fy * v.h }, // canvas point under the fingers at start
    };
    s.manual = true;
  }
  function updatePinch() {
    const d = s.drag;
    const [a, b] = [...s.pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const w = clamp((d.w0 * d.d0) / dist, MIN_VIEW_W, MAX_VIEW_W);
    const h = w * s.ar;
    const rect = svg.getBoundingClientRect();
    const fx = ((a.x + b.x) / 2 - rect.left) / rect.width;
    const fy = ((a.y + b.y) / 2 - rect.top) / rect.height;
    s.view = { x: d.anchor.x - fx * w, y: d.anchor.y - fy * h, w, h };
    applyView();
  }

  function onDown(e) {
    if (e.button !== 0) return;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable */
    }
    if (s.pointers.size === 2) return startPinch();
    if (s.pointers.size > 2) return;

    if (s.panMode || s.space) {
      s.drag = { type: 'pan', s0: { x: e.clientX, y: e.clientY }, v0: { ...s.view }, k: s.view.w / svg.getBoundingClientRect().width };
      svg.classList.remove('cursor-grab');
      svg.classList.add('cursor-grabbing');
      return;
    }
    const hit = e.target.closest ? e.target.closest('[data-num]') : null;
    if (hit) {
      const n = Number(hit.dataset.num);
      if (e.shiftKey || e.ctrlKey || e.metaKey || s.multi) {
        const next = new Set(s.sel);
        next.has(n) ? next.delete(n) : next.add(n);
        select(next);
        return;
      }
      if (!s.sel.has(n)) {
        s.sel = new Set([n]);
        redraw(true);
      }
      const orig = new Map(selectedTables().map((t) => [t.number, { x: t.x, y: t.y }]));
      s.drag = { type: 'move', p0: toCanvas(e), orig, moved: false, n, multi: s.sel.size > 1 };
      return;
    }
    // Empty space: rubber-band selection (one finger on touch screens).
    s.drag = { type: 'band', p0: toCanvas(e), add: e.shiftKey || s.multi, moved: false };
  }

  function onMove(e) {
    if (s.pointers.has(e.pointerId)) s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = s.drag;
    if (!d) return;
    if (d.type === 'pinch') return updatePinch();
    if (d.type === 'pan') {
      s.view.x = d.v0.x - (e.clientX - d.s0.x) * d.k;
      s.view.y = d.v0.y - (e.clientY - d.s0.y) * d.k;
      s.manual = true;
      applyView();
      return;
    }
    const p = toCanvas(e);
    const dx = p.x - d.p0.x;
    const dy = p.y - d.p0.y;
    if (d.type === 'move') {
      if (!d.moved && Math.hypot(dx, dy) < 2) return;
      d.moved = true;
      for (const [n, o] of d.orig) {
        const t = tableByNum(n);
        if (!t) continue;
        t.x = clampX(snap(o.x + dx));
        t.y = clampY(snap(o.y + dy));
      }
      drawTables();
      return;
    }
    if (d.type === 'band') {
      if (!d.moved && Math.hypot(dx, dy) < 3) return;
      d.moved = true;
      bandRect.setAttribute('display', 'inline');
      bandRect.setAttribute('x', Math.min(d.p0.x, p.x));
      bandRect.setAttribute('y', Math.min(d.p0.y, p.y));
      bandRect.setAttribute('width', Math.abs(dx));
      bandRect.setAttribute('height', Math.abs(dy));
    }
  }

  function onUp(e) {
    s.pointers.delete(e.pointerId);
    try {
      svg.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    const d = s.drag;
    if (!d) return;
    if (d.type === 'pinch') {
      // Pinch ends when a finger lifts; the remaining finger does nothing until it is pressed again.
      if (s.pointers.size < 2) {
        s.drag = null;
        paintCursor();
      }
      return;
    }
    s.drag = null;
    paintCursor();
    if (d.type === 'move') {
      if (d.moved) {
        s.dirty = true;
        s.dragged = true;
        redraw(false);
      } else if (d.multi) {
        select(new Set([d.n]));
      }
    } else if (d.type === 'band') {
      bandRect.setAttribute('display', 'none');
      if (d.moved) {
        const p = toCanvas(e);
        const x0 = Math.min(d.p0.x, p.x);
        const x1 = Math.max(d.p0.x, p.x);
        const y0 = Math.min(d.p0.y, p.y);
        const y1 = Math.max(d.p0.y, p.y);
        const inside = s.layout.tables.filter((t) => t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1).map((t) => t.number);
        select(new Set(d.add ? [...s.sel, ...inside] : inside));
      } else if (!d.add) {
        select(new Set());
      }
    }
  }

  function onWheel(e) {
    e.preventDefault();
    zoomAt(toCanvas(e), e.deltaY < 0 ? 0.88 : 1 / 0.88);
  }

  const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

  function onKeyDown(e) {
    if (!editor || isTyping(e.target)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!s.space) {
        s.space = true;
        paintCursor();
      }
      return;
    }
    if (e.key === 'Escape') {
      select(new Set());
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault(); // deliberately non-destructive
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      select(new Set(s.layout.tables.map((t) => t.number)));
      return;
    }
    const step = { ArrowLeft: [-SNAP, 0], ArrowRight: [SNAP, 0], ArrowUp: [0, -SNAP], ArrowDown: [0, SNAP] }[e.key];
    if (step && s.sel.size) {
      e.preventDefault();
      for (const t of selectedTables()) {
        t.x = clampX(t.x + step[0]);
        t.y = clampY(t.y + step[1]);
      }
      s.dirty = true;
      s.dragged = true;
      redraw(false);
    }
  }

  function onKeyUp(e) {
    if (e.code === 'Space' && editor) {
      s.space = false;
      paintCursor();
    }
  }

  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);
  svg.addEventListener('wheel', onWheel, { passive: false });
  // Belt and braces for iOS Safari: no page scroll or pinch-zoom while touching the canvas.
  canvasWrap.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  canvasWrap.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // Refit on open and on any resize/orientation change, unless the user has zoomed or panned by hand.
  ro = new ResizeObserver(() => {
    if (s.manual) {
      measure();
      applyView();
    } else {
      fitView();
    }
  });
  ro.observe(canvasWrap);
  fitView();
  redraw(false);
  syncZoneFields(s.zones[0]?.id);
  panelStatus.textContent = '';
  setStatus(s.dirty ? '' : 'Chưa có thay đổi.');
  paintCursor();
}
