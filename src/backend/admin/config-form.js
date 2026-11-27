// Grouped form for the wedding content (replaces the raw-JSON config textarea).
// Loads GET /api/config, renders fieldsets, saves a PUT /api/config patch.
import { $, api, busy, h } from './common.js';

const DEFAULT_OFFSET = '+07:00';
const EVENTS = ['ceremony', 'reception'];
const EVENT_NAMES = { ceremony: 'Lễ thành hôn', reception: 'Tiệc cưới' };

let root;
let status;
let cfg = {}; // last config loaded from the server
let fields = new Map(); // config path -> { input, label, where, required, url }
let offsets = {}; // event key -> ISO offset kept from the stored datetime
let previews = {}; // event key -> { src, large } map preview paths written by the server (never edited here)
let previewBoxes = {}; // event key -> container element of the preview image

export async function init() {
  root = $('config-root');
  status = $('config-status');
  try {
    await load();
  } catch (e) {
    status.textContent = 'Lỗi tải nội dung: ' + e.message;
  }
}

async function load() {
  render(await api('GET', '/api/config'));
}

// --- rendering -------------------------------------------------------------

const get = (path) => path.split('.').reduce((o, k) => o?.[k], cfg) ?? '';
const section = (legend, ...children) => h('fieldset', { class: 'fieldset min-w-0' }, h('legend', { class: 'legend' }, legend), ...children);
const row = (...children) => h('div', { class: 'grid gap-x-4 sm:grid-cols-2' }, ...children);

function render(config) {
  cfg = config;
  fields = new Map();
  offsets = {};
  previewBoxes = {};
  previews = Object.fromEntries(EVENTS.map((k) => [k, { src: config[k]?.mapPreviewSrc ?? '', large: config[k]?.mapPreviewLargeSrc ?? '' }]));

  root.replaceChildren(
    section(
      'Cô dâu & chú rể',
      row(f('groomName', 'Tên chú rể', { required: true }), f('brideName', 'Tên cô dâu', { required: true })),
      f('headline', 'Câu mở đầu'),
      f('story', 'Câu chuyện', { multiline: true }),
    ),
    parentsSection('groomParents', 'Gia đình nhà trai'),
    parentsSection('brideParents', 'Gia đình nhà gái'),
    h(
      'div',
      { class: 'grid gap-4 lg:grid-cols-2' },
      eventSection('ceremony', 'Lễ thành hôn'),
      eventSection('reception', 'Tiệc cưới'),
    ),
    invitationSection(),
    googleFormSection(),
    h(
      'details',
      { class: 'mt-2' },
      h('summary', { class: 'cursor-pointer font-semibold text-navy py-2' }, 'Cài đặt kỹ thuật'),
      section(
        'Kỹ thuật',
        f('siteBaseUrl', 'Địa chỉ website'),
        f('rsvpWebhookUrl', 'Webhook Google Apps Script (đồng bộ danh sách khách)'),
        f('googleMapsEmbedUrl', 'Link nhúng bản đồ (iframe)'),
      ),
    ),
    h(
      'div',
      { class: 'sticky bottom-0 -mx-4 sm:-mx-6 bg-ivory/95 backdrop-blur border-t border-line px-4 py-3 flex gap-2' },
      h('button', { type: 'button', class: 'btn btn-primary flex-1 sm:flex-none', onclick: (e) => save(e.currentTarget) }, 'Lưu nội dung'),
      h('button', { type: 'button', class: 'btn btn-outline flex-1 sm:flex-none', onclick: (e) => reload(e.currentTarget) }, 'Làm mới'),
    ),
  );
  for (const key of EVENTS) paintPreview(key);
}

// Wording of the scroll-driven envelope invitation (invite.html). Empty = default / auto value.
const INVITATION_FIELDS = [
  ['coverEyebrow', 'Dòng trên tên (phong bì đóng)'],
  ['openHint', 'Gợi ý mở thiệp'],
  ['archTitle', 'Tiêu đề trong vòm ảnh · trang thiệp mời'],
  ['announceArchTitle', 'Tiêu đề trong vòm ảnh · trang báo hỉ'],
  ['monogram', 'Chữ lồng trên con dấu sáp', 'Để trống = chữ cái đầu tên (vd. T&C)'],
  ['momentLine', 'Câu dẫn'],
  ['scriptHeadline', 'Câu chữ viết tay'],
  ['joinLine', 'Câu mời'],
  ['inviteLine', 'Lời mời dưới tên khách', 'Xuống dòng bằng Enter'],
  ['presenceLine', 'Câu viết tay trên thiệp', '{khach} = cách xưng hô với khách (mặc định Quý vị)'],
  ['ceremonyWelcome', 'Câu cuối thiệp lễ thành hôn'],
  ['place', 'Nơi tổ chức (thành phố)', 'Để trống = phần cuối địa chỉ tiệc cưới'],
  ['calendarTitle', 'Tiêu đề lịch'],
  ['countdownTitle', 'Câu dưới đồng hồ đếm ngược'],
  ['countdownDoneText', 'Câu khi đã tới ngày cưới'],
  ['rsvpTitle', 'Tiêu đề xác nhận tham dự'],
  ['rsvpNote', 'Ghi chú xác nhận', 'Vd. Vui lòng phản hồi trước ngày 01/01/2027'],
  ['closingTitle', 'Lời kết'],
  ['closingNote', 'Ghi chú cuối thiệp'],
  ['groomPhone', 'SĐT chú rể'],
  ['bridePhone', 'SĐT cô dâu'],
];

function invitationSection() {
  const MULTILINE = new Set(['inviteLine', 'presenceLine']);
  const fieldsFor = (list) => list.map(([k, label, hint]) => f(`invitation.${k}`, label, { hint, multiline: MULTILINE.has(k) }));
  const all = fieldsFor(INVITATION_FIELDS);
  const rows = [];
  for (let i = 0; i < all.length; i += 2) rows.push(row(...all.slice(i, i + 2)));
  return section('Thiệp mời (trang phong bì)', h('p', { class: 'hint mb-2' }, 'Chữ hiển thị trên thiệp mời dạng phong bì mở khi cuộn. Ảnh trong phong bì lấy từ mục Ảnh cưới: "Ảnh chân dung trên thiệp" (nếu chưa có thì dùng "Ảnh bìa trang chủ"); nền đếm ngược dùng ảnh "Câu chuyện"; nền xác nhận dùng ảnh "Nền trang đăng ký".'), ...rows);
}

const FORM_ENTRIES = [
  ['entryFullName', 'Họ và tên'],
  ['entryPhone', 'Số điện thoại'],
  ['entryRelationship', 'Mối quan hệ'],
  ['entryAttendees', 'Số người tham dự'],
];

// RSVP goes to a Google Form: only the Form ID and the 4 question (entry) IDs are needed.
function googleFormSection() {
  return section(
    'Google Form nhận đăng ký',
    f('rsvpForm.formId', 'Form ID', {
      hint: 'Chuỗi trong link form: docs.google.com/forms/d/e/<Form ID>/viewform (dán cả link cũng được).',
    }),
    row(...FORM_ENTRIES.slice(0, 2).map(([k, label]) => f(`rsvpForm.${k}`, `Mã ô "${label}"`, { digits: true, hint: 'Số sau entry. trong link điền sẵn' }))),
    row(...FORM_ENTRIES.slice(2).map(([k, label]) => f(`rsvpForm.${k}`, `Mã ô "${label}"`, { digits: true, hint: 'Số sau entry. trong link điền sẵn' }))),
  );
}

function parentsSection(key, legend) {
  return section(legend, row(f(`${key}.father`, 'Bố'), f(`${key}.mother`, 'Mẹ')), f(`${key}.address`, 'Địa chỉ'));
}

function eventSection(key, legend) {
  const ev = cfg[key] ?? {};
  const { local, offset } = splitDatetime(ev.datetime);
  offsets[key] = offset;
  const mapBox = h('div', { class: 'mt-3 grid justify-items-start gap-2' });
  previewBoxes[key] = mapBox;
  return section(
    legend,
    row(
      f(`${key}.title`, 'Tên sự kiện', { required: true }),
      f(`${key}.datetime`, 'Ngày giờ', { type: 'datetime-local', required: true, value: local }),
    ),
    row(
      f(`${key}.venueName`, 'Địa điểm', { required: true }),
      f(`${key}.hallName`, 'Sảnh', { hint: 'Không bắt buộc' }),
    ),
    f(`${key}.address`, 'Địa chỉ', { required: true }),
    f(`${key}.mapsUrl`, 'Link Google Maps', {
      url: true,
      value: ev.mapsUrl || cfg.googleMapsUrl || '',
      hint: 'Dán link chia sẻ từ Google Maps (vd. https://maps.app.goo.gl/...)',
    }),
    mapBox,
  );
}

/** Creates a labelled input and registers it under its config path for validation and saving. */
function f(name, label, { multiline = false, type = 'text', required = false, url = false, digits = false, hint, value } = {}) {
  const input = multiline ? h('textarea', { class: 'input', rows: 4 }) : h('input', { class: 'input', type, autocomplete: 'off' });
  input.value = value ?? get(name);
  const where = EVENT_NAMES[name.split('.')[0]];
  fields.set(name, { input, label, where, required, url, digits });
  input.addEventListener('input', () => mark(input, false));
  return h('label', { class: 'field min-w-0' }, h('span', { class: 'label' }, label), input, hint ? h('small', { class: 'hint' }, hint) : null);
}

function paintPreview(key) {
  const box = previewBoxes[key];
  if (!box) return;
  const { src, large } = previews[key];
  const t = Date.now();
  box.replaceChildren(
    src
      ? h('img', { src: `/site/${src}?t=${t}`, alt: `Bản đồ ${EVENT_NAMES[key]}`, loading: 'lazy', class: 'block aspect-[2/1] w-full max-w-md rounded-lg border border-line object-cover' })
      : h('p', { class: 'hint' }, 'Sơ đồ bản đồ sẽ tự tạo sau khi lưu'),
    large
      ? h('a', { href: `/site/${large}?t=${t}`, target: '_blank', rel: 'noopener', class: 'text-sm font-semibold text-burgundy hover:underline' }, 'Xem bản đồ lớn ↗')
      : null,
  );
}

// --- datetime helpers ------------------------------------------------------

/** '2027-01-16T09:00:00+07:00' -> { local: '2027-01-16T09:00', offset: '+07:00' } */
function splitDatetime(iso = '') {
  const offset = iso.match(/(Z|[+-]\d{2}:\d{2})$/)?.[1] ?? DEFAULT_OFFSET;
  return { local: iso.slice(0, 16), offset };
}

/** '2027-01-16T09:00' + '+07:00' -> '2027-01-16T09:00:00+07:00' */
const toIso = (local, offset) => (local ? `${local.length === 16 ? local + ':00' : local}${offset}` : '');

// --- validation, collect, save ---------------------------------------------

/** Sets aria-invalid (the .input class draws the red state); clears on input. */
function mark(input, invalid) {
  input.setAttribute('aria-invalid', String(invalid));
}

/** Marks invalid inputs and returns Vietnamese problem messages (empty when valid). */
function validate() {
  const problems = [];
  for (const { input, label, where, required, url, digits } of fields.values()) {
    const value = input.value.trim();
    const prefix = where ? `${where} · ` : '';
    let problem = null;
    if (required && !value) problem = `${prefix}${label} không được để trống`;
    else if (url && value && !value.startsWith('http')) problem = `${prefix}${label} phải bắt đầu bằng http`;
    else if (digits && value && !/^\d+$/.test(value)) problem = `${label} chỉ gồm chữ số`;
    mark(input, Boolean(problem));
    if (problem) problems.push(problem);
  }
  return problems;
}

/** Accepts a bare Form ID or a pasted form link (…/forms/d/e/<id>/viewform) and returns the ID. */
const parseFormId = (value) => value.match(/\/forms\/d\/e\/([\w-]+)/)?.[1] ?? value;

const v = (name) => fields.get(name).input.value.trim();

function eventPatch(key) {
  const ev = {
    title: v(`${key}.title`),
    datetime: toIso(v(`${key}.datetime`), offsets[key] ?? DEFAULT_OFFSET),
    venueName: v(`${key}.venueName`),
    address: v(`${key}.address`),
    mapsUrl: v(`${key}.mapsUrl`),
  };
  const hall = v(`${key}.hallName`);
  if (hall) ev.hallName = hall;
  // Not editable here, but setConfig replaces the whole event object: keep the server-written preview paths.
  if (previews[key].src) ev.mapPreviewSrc = previews[key].src;
  if (previews[key].large) ev.mapPreviewLargeSrc = previews[key].large;
  return ev;
}

function collect() {
  const ceremony = eventPatch('ceremony');
  const reception = eventPatch('reception');
  return {
    groomName: v('groomName'),
    brideName: v('brideName'),
    headline: v('headline'),
    story: v('story'),
    groomParents: { father: v('groomParents.father'), mother: v('groomParents.mother'), address: v('groomParents.address') },
    brideParents: { father: v('brideParents.father'), mother: v('brideParents.mother'), address: v('brideParents.address') },
    ceremony,
    reception,
    googleMapsUrl: reception.mapsUrl || ceremony.mapsUrl || cfg.googleMapsUrl || '',
    googleMapsEmbedUrl: v('googleMapsEmbedUrl'),
    siteBaseUrl: v('siteBaseUrl'),
    rsvpWebhookUrl: v('rsvpWebhookUrl'),
    invitation: Object.fromEntries(INVITATION_FIELDS.map(([k]) => [k, v(`invitation.${k}`)])),
    rsvpForm: {
      formId: parseFormId(v('rsvpForm.formId')),
      entryFullName: v('rsvpForm.entryFullName'),
      entryPhone: v('rsvpForm.entryPhone'),
      entryRelationship: v('rsvpForm.entryRelationship'),
      entryAttendees: v('rsvpForm.entryAttendees'),
    },
  };
}

async function save(btn) {
  const problems = validate();
  if (problems.length) {
    status.textContent = 'Chưa lưu · ' + problems.join(' · ');
    return;
  }
  await busy(btn, status, async () => {
    await api('PUT', '/api/config', collect());
    await load();
    // The server generates the map preview after the save; pick it up once it is ready.
    setTimeout(() => refreshPreviews().catch((e) => console.error('[config-form] preview refresh failed', e)), 4000);
    return 'Đã lưu · trang web đang build lại · bản đồ xem trước sẽ cập nhật sau vài giây';
  });
}

async function refreshPreviews() {
  cfg = await api('GET', '/api/config');
  for (const key of EVENTS) {
    previews[key] = { src: cfg[key]?.mapPreviewSrc ?? '', large: cfg[key]?.mapPreviewLargeSrc ?? '' };
    paintPreview(key);
  }
}

async function reload(btn) {
  await busy(btn, status, async () => {
    await load();
    return 'Đã làm mới';
  });
}
