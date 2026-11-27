// Nhạc nền: danh sách bài hát phát trên trang báo hỉ và thiệp mời (theo thứ tự, lặp lại cả danh sách).
import { api, h } from './common.js';

let root;
let listEl;
let flashEl;
let tracks = [];

const flash = (msg) => {
  if (flashEl) flashEl.textContent = msg;
};

async function act(msg, fn) {
  try {
    await fn();
    await reload();
    flash(msg);
  } catch (e) {
    flash('Lỗi: ' + e.message);
  }
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
  const fileInput = h('input', { type: 'file', accept: 'audio/*,.mp3,.m4a,.ogg,.wav', multiple: true, class: 'sr-only', 'aria-label': 'Chọn bài hát' });
  const status = h('p', { class: 'status', 'aria-live': 'polite' });
  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    if (!files.length) return;
    status.textContent = `Đang tải ${files.length} bài…`;
    try {
      // One request per track: audio files are large.
      for (const [i, f] of files.entries()) {
        status.textContent = `Đang tải ${i + 1}/${files.length}: ${f.name}`;
        await api('POST', '/api/playlist', { fileName: f.name, dataBase64: await readAsDataUrl(f) });
      }
      status.textContent = `Đã thêm ${files.length} bài.`;
      await reload();
    } catch (e) {
      status.textContent = 'Lỗi: ' + e.message;
    } finally {
      fileInput.value = '';
    }
  });
  return h(
    'div',
    { class: 'mb-4 flex flex-col gap-2 rounded-xl border-2 border-dashed border-line bg-white p-4 sm:flex-row sm:items-center' },
    h('label', { class: 'btn btn-primary min-h-12 w-full cursor-pointer text-base sm:w-auto' }, '+ Thêm bài hát', fileInput),
    h('p', { class: 'hint m-0 flex-1' }, 'MP3 / M4A / OGG, tối đa 40MB mỗi bài. Nhạc tự phát khi khách mở trang (trình duyệt có thể đợi lần chạm đầu tiên).'),
    status,
  );
}

function row(t, index) {
  const title = h('input', { type: 'text', class: 'input min-w-0', value: t.title, maxlength: 120, 'aria-label': 'Tên bài hát' });
  const move = (delta) => {
    const ids = tracks.map((x) => x.id);
    const j = index + delta;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    return act('Đã đổi thứ tự.', () => api('PUT', '/api/playlist/order', { ids }));
  };
  return h(
    'article',
    { class: 'grid gap-2 rounded-xl border border-line bg-white p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center' },
    h('span', { class: 'badge bg-navy/85 text-white' }, `#${index + 1}`),
    h('div', { class: 'grid min-w-0 gap-1.5' }, title, h('audio', { controls: true, preload: 'none', src: `/site/${t.src}`, class: 'w-full' })),
    h(
      'div',
      { class: 'flex flex-wrap items-center gap-1.5' },
      h('button', { type: 'button', class: 'btn btn-icon btn-outline btn-sm', 'aria-label': 'Phát trước', disabled: index === 0, onclick: () => move(-1) }, '↑'),
      h('button', { type: 'button', class: 'btn btn-icon btn-outline btn-sm', 'aria-label': 'Phát sau', disabled: index === tracks.length - 1, onclick: () => move(1) }, '↓'),
      h('button', { type: 'button', class: 'btn btn-sm btn-primary min-h-10 sm:min-h-8', onclick: () => act('Đã lưu tên bài.', () => api('PUT', `/api/playlist/${t.id}`, { title: title.value })) }, 'Lưu'),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-sm btn-danger min-h-10 sm:min-h-8',
          onclick: () => confirm(`Xoá bài "${t.title}"? Không thể hoàn tác.`) && act('Đã xoá bài.', () => api('DELETE', `/api/playlist/${t.id}`)),
        },
        'Xoá',
      ),
    ),
  );
}

async function reload() {
  tracks = await api('GET', '/api/playlist');
  listEl.replaceChildren(...(tracks.length ? tracks.map(row) : [h('p', { class: 'status' }, 'Chưa có bài hát — trang sẽ không phát nhạc.')]));
}

export async function init() {
  root = document.getElementById('playlist-root');
  if (!root) return;
  listEl = h('div', { class: 'grid gap-2' });
  flashEl = h('p', { class: 'status mt-2', 'aria-live': 'polite' });
  root.replaceChildren(buildUpload(), listEl, flashEl);
  await reload();
}
