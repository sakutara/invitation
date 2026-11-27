import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const fixture = () => JSON.parse(readFileSync(join(process.cwd(), '.tmp/e2e/fixture.json'), 'utf8')) as { shortId: string; slug: string; webhook: string };

// Keep runs hermetic: block every non-local request (Google Fonts, Maps); the RSVP webhook is mocked per test.
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
});

async function noHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth, `scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`).toBeLessThanOrEqual(innerWidth);
}

test.describe('Fluid layout & Navy-Burgundy theme', () => {
  for (const path of ['index.html', 'dang-ky/', `thiep-moi/?khach=${fixture().slug}`]) {
    test(`${path.split('?')[0]} has no horizontal overflow at 360/390/768/1920 and uses palette tokens`, async ({ page }) => {
      for (const [w, h] of [[360, 640], [390, 844], [768, 1024], [1920, 1080]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(path);
        await noHorizontalOverflow(page);
      }
      const tokens = await page.evaluate(() => {
        const s = getComputedStyle(document.documentElement);
        return ['--color-navy', '--color-burgundy', '--color-sky-blue', '--color-lotus-pink', '--color-ivory', '--color-black'].map((t) => s.getPropertyValue(t).trim());
      });
      expect(tokens).toEqual(['#0F2042', '#7A1C24', '#38BDF8', '#EC4899', '#FDFBF7', '#111827']);
    });
  }
});

test.describe('Announcement page (index.html)', () => {
  test('shows the dynamic gallery and navigates to RSVP via the Burgundy CTA', async ({ page }) => {
    await page.goto('index.html');
    await expect(page.locator('#gallery .gallery__item')).toHaveCount(7);
    // Gallery photos are lazy and sit below the envelope scene.
    await page.locator('#gallery img').first().scrollIntoViewIfNeeded();
    await expect(page.locator('#gallery img').first()).toHaveJSProperty('complete', true);
    // Back up: on desktop the later sheets are stacked over the hero once you have scrolled past it.
    await page.evaluate(() => window.scrollTo(0, 0));
    const cta = page.locator('a[data-cta="rsvp"]');
    await expect(cta).toHaveCSS('background-color', 'rgb(122, 28, 36)');
    await cta.click();
    await expect(page).toHaveURL(/\/dang-ky\/$/);
  });

  test('parallax layers translate with scroll via translate3d', async ({ page }) => {
    await page.goto('index.html');
    const layer = page.locator('#story [data-parallax-speed="-0.15"]').first();
    // #story sits below the tall envelope scene: scroll relative to it.
    const top = await page.locator('#story').evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await page.evaluate((y) => window.scrollTo(0, y), top - 600);
    await page.waitForTimeout(150);
    const before = await layer.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--parallax-y'));
    await page.evaluate((y) => window.scrollTo(0, y), top + 100);
    await page.waitForTimeout(150);
    const after = await layer.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--parallax-y'));
    expect(before).toMatch(/px$/);
    expect(after).not.toBe(before);
    const transform = await layer.evaluate((el) => getComputedStyle(el).transform);
    expect(transform).toMatch(/^matrix/);
  });

  test('disables parallax motion under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('index.html');
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(150);
    const values = await page.$$eval('[data-parallax-speed]', (els) => els.map((e) => (e as HTMLElement).style.getPropertyValue('--parallax-y')).filter(Boolean));
    expect(values.every((v) => v === '0px')).toBe(true);
    const transforms = await page.$$eval('[data-parallax-speed]', (els) => els.map((e) => getComputedStyle(e).transform));
    expect(transforms.every((t) => t === 'none')).toBe(true);
  });
});

test.describe('RSVP page (dang-ky/)', () => {
  test('fits one viewport, upserts by phone, thanks the guest and returns to the home page', async ({ page }) => {
    const { webhook } = fixture();
    const requests: { body: any; contentType: string | undefined }[] = [];
    await page.route(webhook, async (route) => {
      requests.push({ body: JSON.parse(route.request().postData() ?? '{}'), contentType: route.request().headers()['content-type'] });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, operation: 'INSERTED' }) });
    });
    await page.goto('dang-ky/');
    const dims = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
    expect(dims.sh).toBeLessThanOrEqual(dims.ih);
    await expect(page.locator('form.rsvp__form button[type="submit"]')).toBeInViewport();

    await page.getByLabel('Họ và tên').fill('Nguyễn Văn An');
    await page.getByLabel('Số điện thoại').fill('+84 905 123 456');
    await page.getByLabel('Bạn là').selectOption('groom_friends');
    await page.getByLabel('Số người tham dự').fill('2');
    await page.getByRole('button', { name: 'Gửi xác nhận' }).click();

    await expect(page.locator('.rsvp__thanks')).toBeVisible();
    await expect(page.locator('.rsvp__thanks')).toContainText('Nguyễn Văn An');
    expect(requests).toHaveLength(1);
    expect(requests[0].contentType).toContain('text/plain');
    expect(requests[0].body).toEqual({ fullName: 'Nguyễn Văn An', phone: '0905123456', relationship: 'bạn bè chú rể', attendees: 2 });
    const after = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
    expect(after.sh).toBeLessThanOrEqual(after.ih);
    await page.waitForURL((u) => u.pathname === '/', { timeout: 10_000 });
  });

  test('keeps the envelope flap hinged on the envelope while the reply card is sent', async ({ page }) => {
    await page.route(fixture().webhook, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true }) }));
    await page.goto('dang-ky/');
    await page.getByLabel('Họ và tên').fill('Nguyễn Văn An');
    await page.getByLabel('Số điện thoại').fill('0905123456');
    await page.getByLabel('Bạn là').selectOption('groom_friends');
    // the envelope keeps its resting size for the whole animation (never stretched)
    const size = () => page.locator('.rsvp-env__back').evaluate((el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
    const resting = await size();
    expect(resting[1] / resting[0]).toBeCloseTo(0.62, 2);
    await page.getByRole('button', { name: 'Gửi xác nhận' }).click();
    // sample every frame of phases 1-2: the open flap's lower edge must sit on the envelope's top edge
    const gaps = await page.evaluate(async ([w0, h0]) => {
      const stage = document.querySelector('.rsvp__stage')!;
      while (!stage.classList.contains('is-sending')) await new Promise(requestAnimationFrame);
      const out: number[] = [];
      const start = performance.now();
      while (performance.now() - start < 1100) {
        await new Promise(requestAnimationFrame);
        const flap = stage.querySelector('.rsvp-env__flap')!.getBoundingClientRect();
        const back = stage.querySelector('.rsvp-env__back')!.getBoundingClientRect();
        const pocket = stage.querySelector('.rsvp-env__pocket')!.getBoundingClientRect();
        out.push(Math.abs(flap.bottom - back.top), Math.abs(flap.width - back.width), Math.abs(back.width - w0), Math.abs(back.height - h0), Math.abs(pocket.height - h0));
      }
      return out;
    }, resting);
    expect(gaps.length).toBeGreaterThan(10);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(2);
    await expect(page.locator('.rsvp__thanks')).toBeVisible();
    await expect(page.locator('.rsvp-env__pocket')).toBeHidden();
  });

  test('blocks invalid input client-side', async ({ page }) => {
    let called = false;
    await page.route(fixture().webhook, (r) => { called = true; return r.abort(); });
    await page.goto('dang-ky/');
    await page.getByLabel('Số điện thoại').fill('12345');
    await page.getByRole('button', { name: 'Gửi xác nhận' }).click();
    await expect(page.locator('#phone')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#fullName')).toHaveAttribute('aria-invalid', 'true');
    expect(called).toBe(false);
  });
});

test.describe('Personalized invitation (thiep-moi/)', () => {
  async function expectGolden(page: Page) {
    await expect(page.locator('body')).toHaveAttribute('data-invite-ready', 'true');
    await expect(page.locator('.paper-card--main [data-role="guest-name"]')).toHaveText('vợ chồng chú Chín');
    await expect(page.locator('[data-role="presence"]')).toContainText('Sự hiện diện của chú thím');
    await expect(page.locator('.seating__map [data-zone="ZONE_B1"]')).toHaveAttribute('data-highlight', 'true');
    await expect(page.locator('.seating__map [data-highlight="true"]')).toHaveCount(1);
    await expect(page.locator('[data-role="seat-count"]')).toHaveText('2');
  }

  test('resolves ?khach=<slug> through guests-map.json', async ({ page }) => {
    await page.goto(`thiep-moi/?khach=${fixture().slug}`);
    await expectGolden(page);
  });

  test('shows the default invitation and a plain map for an unknown or missing link', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const path of ['thiep-moi/?khach=khong-ton-tai', 'thiep-moi/']) {
      await page.goto(path);
      await expect(page.locator('.paper-card--main [data-role="guest-name"]')).toHaveText('Quý khách');
      await expect(page.locator('.seating__map svg')).toBeVisible();
      await expect(page.locator('.seating__map [data-highlight="true"]')).toHaveCount(0);
      await expect(page.locator('.seating__info')).toBeHidden();
    }
    expect(errors).toEqual([]);
  });

  test('Save JPG downloads a 1080x1620 JPEG card', async ({ page }) => {
    await page.goto(`thiep-moi/?khach=${fixture().slug}`);
    await expect(page.locator('body')).toHaveAttribute('data-invite-ready', 'true');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#save-jpg').click()]);
    expect(download.suggestedFilename()).toBe('Thiep-Moi-vo-chong-chu-chin.jpg');
    const buf = readFileSync((await download.path())!);
    expect([...buf.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    const meta = await sharp(buf).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1080, 1620]);
    // the printed-card look survives rasterization: dusty-blue folder around an ivory card, wine script
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
    const near = (a: number[], b: number[], tol = 24) => a.every((v, i) => Math.abs(v - b[i]) < tol);
    expect(near(px(540, 20), [0x3f, 0x5f, 0x7b])).toBe(true);
    expect(near(px(160, 700), [0xf4, 0xf4, 0xee])).toBe(true);
    let wine = 0;
    for (let i = 0; i < data.length; i += info.channels) if (near([data[i], data[i + 1], data[i + 2]], [0x6b, 0x1a, 0x34], 30)) wine++;
    expect(wine).toBeGreaterThan(2000);
  });

  test('Share passes a JPEG file to navigator.share when supported', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__shared = null;
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d: any) => !!d?.files?.length });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (d: any) => {
          const f: File = d.files[0];
          const bmp = await createImageBitmap(f);
          (window as any).__shared = { name: f.name, type: f.type, size: f.size, width: bmp.width, height: bmp.height, title: d.title };
        },
      });
    });
    await page.goto(`thiep-moi/?khach=${fixture().slug}`);
    await expect(page.locator('body')).toHaveAttribute('data-invite-ready', 'true');
    await page.locator('#share-jpg').click();
    await expect.poll(() => page.evaluate(() => (window as any).__shared)).not.toBeNull();
    const shared = await page.evaluate(() => (window as any).__shared);
    expect(shared).toMatchObject({ name: 'Thiep-Moi-vo-chong-chu-chin.jpg', type: 'image/jpeg', width: 1080, height: 1620 });
    expect(shared.size).toBeGreaterThan(50_000);
    await expect(page.locator('.save-card__status')).toHaveText('Đã chia sẻ thiệp.');
  });
});

test.describe('Friendly URLs', () => {
  test('old page addresses redirect and keep the guest in the link', async ({ page }) => {
    await page.goto(`invite.html?khach=${fixture().slug}`);
    await page.waitForURL((u) => u.pathname === '/thiep-moi/' && u.search === `?khach=${fixture().slug}`);
    await expect(page.locator('.paper-card--main [data-role="guest-name"]')).toHaveText('vợ chồng chú Chín');
    await page.goto('rsvp.html');
    await page.waitForURL((u) => u.pathname === '/dang-ky/');
  });

  test('a folder URL without its slash is completed, and every local asset of each page loads', async ({ page }) => {
    const broken: string[] = [];
    page.on('response', (r) => { if (r.url().startsWith('http://127.0.0.1') && r.status() >= 400) broken.push(r.url()); });
    await page.goto(`thiep-moi?khach=${fixture().slug}`);
    await expect(page).toHaveURL(/\/thiep-moi\/\?khach=/);
    for (const path of ['index.html', 'thiep-moi/', 'dang-ky']) {
      await page.goto(path);
      for (const img of await page.locator('img[src]').all()) {
        await img.evaluate((el: HTMLImageElement) => { el.loading = 'eager'; });
        await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { message: `${path}: ${await img.getAttribute('src')}` }).toBe(true);
      }
    }
    expect(broken).toEqual([]);
  });
});
