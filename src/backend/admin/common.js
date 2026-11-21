// Shared helpers for the admin UI modules (plain browser ES modules, no build step).
export const $ = (id) => document.getElementById(id);

export const api = async (method, path, body) => {
  const res = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(data?.error ?? res.statusText);
  return data;
};

/** Disable `btn`, show progress in `statusEl`, then show fn()'s return value (or the error). */
export const busy = async (btn, statusEl, fn) => {
  btn.disabled = true;
  statusEl.textContent = 'Đang xử lý…';
  try {
    statusEl.textContent = (await fn()) ?? 'Xong';
  } catch (e) {
    statusEl.textContent = 'Lỗi: ' + e.message;
  } finally {
    btn.disabled = false;
  }
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Tiny DOM builder: h('div', { class: 'x', onclick }, child, 'text'). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/**
 * Full-screen popup. `body` is a Node. Returns { el, body, close }.
 * actions: [{ label, kind?: 'primary' | 'secondary' | 'danger', onClick(close) }] — rendered as .btn .btn-primary / .btn-outline / .btn-danger.
 * Esc / backdrop click closes unless `dismissable: false`. Full screen on phones, centered dialog from 640px.
 */
export function openModal({ title, body, actions = [], wide = false, dismissable = true, onClose }) {
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('modal-open');
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissable) close();
  };
  const KIND = { primary: 'btn btn-primary', secondary: 'btn btn-outline', danger: 'btn btn-danger' };
  const footer = h('footer', { class: 'modal__actions' }, ...actions.map((a) => h('button', { class: KIND[a.kind ?? 'primary'] ?? KIND.primary, type: 'button', onclick: () => a.onClick(close) }, a.label)));
  const dialog = h(
    'div',
    { class: 'modal' + (wide ? ' modal--wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { class: 'modal__head' }, h('h3', {}, title), h('button', { class: 'btn btn-icon btn-outline text-xl leading-none', type: 'button', 'aria-label': 'Đóng', onclick: close }, '×')),
    h('div', { class: 'modal__body' }, body),
    footer,
  );
  const backdrop = h('div', { class: 'modal-backdrop', onclick: (e) => e.target === backdrop && dismissable && close() }, dialog);
  document.body.append(backdrop);
  document.body.classList.add('modal-open');
  document.addEventListener('keydown', onKey);
  return { el: dialog, body: dialog.querySelector('.modal__body'), close };
}
