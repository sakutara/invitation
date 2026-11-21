// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { initMapPopup } from '../../src/frontend/scripts/map-popup';

// jsdom may not implement <dialog> modal methods; mock them so the popup path can be exercised.
beforeAll(() => {
  const D = (globalThis as { HTMLDialogElement?: typeof HTMLDialogElement }).HTMLDialogElement;
  if (D && !D.prototype.showModal) {
    D.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    D.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
});

const container = document.createElement('div');
container.innerHTML = `<a class="event__map" href="https://maps.example/x" target="_blank" rel="noopener" data-map-popup data-map-large="assets/maps/reception-ab12cd34-lg.jpg" data-maps-url="https://maps.example/x" data-map-title="Nhà hàng Sen Vàng" data-map-address="45 Nguyễn Văn Linh"><img src="assets/maps/reception-ab12cd34.jpg" alt="Bản đồ" width="800" height="400"></a>
<a class="other" href="#other">other</a>`;
document.body.appendChild(container);
initMapPopup(document);
const link = container.querySelector<HTMLAnchorElement>('a[data-map-popup]')!;

const clickLink = (init: MouseEventInit = {}) => {
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  link.dispatchEvent(ev);
  return ev;
};
const popup = () => document.querySelector<HTMLDialogElement>('dialog.map-popup');

describe('initMapPopup', () => {
  it('prevents the default navigation and opens a popup with the large map', () => {
    const ev = clickLink();
    expect(ev.defaultPrevented).toBe(true);

    const dialog = popup();
    expect(dialog).not.toBeNull();
    expect(dialog!.hasAttribute('open')).toBe(true);
    expect(dialog!.querySelector('img')!.getAttribute('src')).toBe('assets/maps/reception-ab12cd34-lg.jpg');
    expect(dialog!.querySelector('h2')!.textContent).toBe('Nhà hàng Sen Vàng');
    expect(dialog!.querySelector('.map-popup__address')!.textContent).toBe('45 Nguyễn Văn Linh');
    const mapsLink = [...dialog!.querySelectorAll('a')].find((a) => a.textContent?.trim() === 'Mở Google Maps');
    expect(mapsLink?.getAttribute('href')).toBe('https://maps.example/x');
    expect(mapsLink?.getAttribute('target')).toBe('_blank');
  });

  it('reuses one popup across openings and restores focus and body scroll on close', () => {
    clickLink();
    const first = popup();
    document.querySelector<HTMLButtonElement>('.map-popup__done')!.click();
    expect(popup()!.hasAttribute('open')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(link);

    clickLink();
    expect(document.querySelectorAll('dialog.map-popup')).toHaveLength(1);
    expect(popup()).toBe(first);
    expect(document.body.style.overflow).toBe('hidden');
    document.querySelector<HTMLButtonElement>('.map-popup__close')!.click();
    expect(popup()!.hasAttribute('open')).toBe(false);
  });

  it('leaves modifier clicks and non-map links alone', () => {
    const ctrl = clickLink({ ctrlKey: true });
    expect(ctrl.defaultPrevented).toBe(false);

    const other = container.querySelector<HTMLAnchorElement>('a.other')!;
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    other.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});
