import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processImage, removeImageVariants } from '../../src/backend/image-processor';

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'wedding-img-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** 3000x2000 navy photo with a bright red "subject" block on the right third. */
async function makePhoto(opts: { orientation?: number } = {}) {
  const subject = await sharp({ create: { width: 500, height: 500, channels: 3, background: '#ff0000' } }).png().toBuffer();
  let img = sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#0F2042' } })
    .composite([{ input: subject, left: 2350, top: 750 }])
    .jpeg({ quality: 90 });
  if (opts.orientation) img = img.withMetadata({ orientation: opts.orientation });
  return img.toBuffer();
}

describe('processImage', () => {
  it('outputs 4 width tiers in both webp and jpg for a 3000x2000 photo', async () => {
    const variants = await processImage(await makePhoto(), { outDir: dir, id: 'photo-01', placement: 'gallery' });
    expect(variants).toHaveLength(8);
    for (const tier of ['sm', 'md', 'lg', 'fhd'] as const) {
      for (const format of ['webp', 'jpg'] as const) {
        const v = variants.find((x) => x.tier === tier && x.format === format)!;
        expect(v, `${tier}.${format}`).toBeDefined();
        expect(v.src).toBe(`assets/images/photo-01/photo-01-${tier}.${format}`);
        const meta = await sharp(join(dir, 'photo-01', `photo-01-${tier}.${format}`)).metadata();
        expect(meta.format).toBe(format === 'jpg' ? 'jpeg' : 'webp');
        expect(meta.width).toBe({ sm: 640, md: 1024, lg: 1440, fhd: 1920 }[tier]);
        expect(meta.width).toBe(v.width);
        expect(meta.height).toBe(v.height);
        expect(meta.width! / meta.height!).toBeCloseTo(1.5, 1); // landscape gallery photos crop to 3:2
      }
    }
  });

  it('normalizes EXIF orientation (orientation=6 becomes portrait) and strips the tag', async () => {
    const variants = await processImage(await makePhoto({ orientation: 6 }), { outDir: dir, id: 'rotated', placement: 'gallery' });
    const sm = variants.find((v) => v.tier === 'sm' && v.format === 'jpg')!;
    expect(sm.height).toBeGreaterThan(sm.width);
    const meta = await sharp(join(dir, 'rotated', 'rotated-sm.jpg')).metadata();
    expect(meta.orientation === undefined || meta.orientation === 1).toBe(true);
  });

  it('keeps the subject when cropping around a focal point', async () => {
    const redShare = async (id: string) => {
      const { data, info } = await sharp(join(dir, id, `${id}-sm.jpg`)).raw().toBuffer({ resolveWithObject: true });
      let red = 0;
      for (let i = 0; i < data.length; i += info.channels) if (data[i] > 200 && data[i + 2] < 60) red++;
      return { share: red / (info.width * info.height), aspect: info.width / info.height };
    };
    await processImage(await makePhoto(), { outDir: dir, id: 'focal', placement: 'invite_portrait', focalPoint: { x: 0.87, y: 0.5 } });
    await processImage(await makePhoto(), { outDir: dir, id: 'focal-left', placement: 'invite_portrait', focalPoint: { x: 0.1, y: 0.5 } });
    const right = await redShare('focal');
    expect(right.aspect).toBeCloseTo(0.8, 1); // 4:5 portrait
    // 500x500 subject inside a 1600x2000 crop = 7.8% of the frame -> fully preserved
    expect(right.share).toBeGreaterThan(0.07);
    expect((await redShare('focal-left')).share).toBe(0);
  });

  it('uses attention-based smart crop when no focal point is given', async () => {
    await processImage(await makePhoto(), { outDir: dir, id: 'attn', placement: 'invite_portrait' });
    const { data, info } = await sharp(join(dir, 'attn', 'attn-sm.jpg')).raw().toBuffer({ resolveWithObject: true });
    let red = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i] > 200 && data[i + 2] < 60) red++;
    expect(red).toBeGreaterThan(1000);
  });

  it('never crops static_map images (aspect preserved, edges intact)', async () => {
    const map = await sharp({ create: { width: 2400, height: 1000, channels: 3, background: '#ffffff' } })
      .composite([
        { input: await sharp({ create: { width: 20, height: 1000, channels: 3, background: '#00ff00' } }).png().toBuffer(), left: 0, top: 0 },
        { input: await sharp({ create: { width: 20, height: 1000, channels: 3, background: '#0000ff' } }).png().toBuffer(), left: 2380, top: 0 },
      ])
      .png()
      .toBuffer();
    const variants = await processImage(map, { outDir: dir, id: 'map', placement: 'static_map' });
    const fhd = variants.find((v) => v.tier === 'fhd' && v.format === 'jpg')!;
    expect(fhd.width / fhd.height).toBeCloseTo(2.4, 2);
    const { data, info } = await sharp(join(dir, 'map', 'map-fhd.jpg')).raw().toBuffer({ resolveWithObject: true });
    const row = Math.floor(info.height / 2) * info.width * info.channels;
    expect(data[row + 1]).toBeGreaterThan(180); // left edge still green
    expect(data[row + (info.width - 1) * info.channels + 2]).toBeGreaterThan(180); // right edge still blue
  });

  it('does not upscale small sources beyond their width', async () => {
    const small = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#7A1C24' } }).jpeg().toBuffer();
    const variants = await processImage(small, { outDir: dir, id: 'small', placement: 'static_map' });
    expect(Math.max(...variants.map((v) => v.width))).toBeLessThanOrEqual(800);
    expect(variants).toHaveLength(8);
  });

  it('extracts the manual crop rectangle (pixels rounded, clamped) and skips aspect logic', async () => {
    const wide = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#334455' } }).jpeg().toBuffer();
    const variants = await processImage(wide, {
      outDir: dir,
      id: 'cropped',
      placement: 'hero', // would normally force 16:9
      crop: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
    });
    const fhd = variants.find((v) => v.tier === 'fhd' && v.format === 'jpg')!;
    expect([fhd.width, fhd.height]).toEqual([600, 400]);
    const meta = await sharp(join(dir, 'cropped', 'cropped-fhd.jpg')).metadata();
    expect([meta.width, meta.height]).toEqual([600, 400]);
  });

  it('clamps an out-of-range crop to at least 1px inside the image', async () => {
    const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#334455' } }).jpeg().toBuffer();
    const variants = await processImage(small, { outDir: dir, id: 'tiny-crop', placement: 'gallery', crop: { x: 0.999, y: 0.999, w: 0.5, h: 0.5 } });
    const sm = variants.find((v) => v.tier === 'sm' && v.format === 'jpg')!;
    expect(sm.width).toBe(1);
    expect(sm.height).toBe(1);
  });

  it('removeImageVariants deletes the photo folder', async () => {
    expect(existsSync(join(dir, 'photo-01'))).toBe(true);
    await removeImageVariants(dir, 'photo-01');
    expect(existsSync(join(dir, 'photo-01'))).toBe(false);
    expect(readdirSync(dir)).not.toContain('photo-01');
  });
});
