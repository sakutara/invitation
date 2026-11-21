/**
 * Smart image pipeline (openspec smart-image-and-card-pipeline):
 * EXIF auto-rotation -> focal-point / attention crop -> 4 width tiers x (webp, jpg).
 */
import sharp from 'sharp';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { IMAGE_TIERS, type CropRect, type ImageTier, type ImageVariant, type PhotoPlacement } from '../shared/types';

export interface ProcessImageOptions {
  /** Directory that will receive `<id>/<id>-<tier>.<ext>` (normally dist/assets/images or the media cache). */
  outDir: string;
  id: string;
  placement: PhotoPlacement;
  focalPoint?: { x: number; y: number } | null;
  /** Manual crop, normalized 0..1 on the EXIF-rotated image. When set, aspect/focal logic is skipped. */
  crop?: CropRect | null;
  /** Override the target aspect ratio (width / height). */
  aspect?: number;
  /** URL prefix relative to dist/ used in variant `src`. */
  publicPrefix?: string;
}

/** Target crop aspect per placement; `null` = never crop (static maps). */
export function aspectFor(placement: PhotoPlacement, srcW: number, srcH: number): number | null {
  switch (placement) {
    case 'static_map':
      return null;
    case 'hero':
    case 'rsvp_background':
      return 16 / 9;
    case 'invite_portrait':
    case 'story':
      return 4 / 5;
    case 'gallery':
    default:
      return srcW >= srcH ? 3 / 2 : 2 / 3;
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

async function cropMaster(oriented: Buffer, w: number, h: number, aspect: number, focal?: { x: number; y: number } | null) {
  let cw = w;
  let ch = Math.round(w / aspect);
  if (ch > h) {
    ch = h;
    cw = Math.round(h * aspect);
  }
  if (focal) {
    const left = Math.round(clamp(focal.x * w - cw / 2, 0, w - cw));
    const top = Math.round(clamp(focal.y * h - ch / 2, 0, h - ch));
    return sharp(oriented).extract({ left, top, width: cw, height: ch }).toBuffer({ resolveWithObject: true });
  }
  return sharp(oriented).resize({ width: cw, height: ch, fit: 'cover', position: sharp.strategy.attention }).toBuffer({ resolveWithObject: true });
}

/** Extract the normalized rect as pixels (rounded, clamped inside the image, at least 1px). */
async function cropByRect(oriented: Buffer, w: number, h: number, crop: CropRect) {
  const left = Math.round(clamp(crop.x * w, 0, w - 1));
  const top = Math.round(clamp(crop.y * h, 0, h - 1));
  const width = Math.round(clamp(crop.w * w, 1, w - left));
  const height = Math.round(clamp(crop.h * h, 1, h - top));
  return sharp(oriented).extract({ left, top, width, height }).toBuffer({ resolveWithObject: true });
}

export async function processImage(input: string | Buffer, opts: ProcessImageOptions): Promise<ImageVariant[]> {
  const { data: oriented, info } = await sharp(input, { failOn: 'error' }).rotate().toBuffer({ resolveWithObject: true });
  let master: { data: Buffer; info: { width: number; height: number } };
  if (opts.crop) {
    master = await cropByRect(oriented, info.width, info.height, opts.crop);
  } else {
    const aspect = opts.aspect ?? aspectFor(opts.placement, info.width, info.height);
    master = aspect ? await cropMaster(oriented, info.width, info.height, aspect, opts.focalPoint) : { data: oriented, info };
  }
  const mw = master.info.width;
  const mh = master.info.height;

  const dir = join(opts.outDir, opts.id);
  await mkdir(dir, { recursive: true });
  const prefix = (opts.publicPrefix ?? 'assets/images').replace(/\/+$/, '');

  const jobs: Promise<ImageVariant>[] = [];
  for (const [tier, tierWidth] of Object.entries(IMAGE_TIERS) as [ImageTier, number][]) {
    const width = Math.min(tierWidth, mw);
    const height = Math.round((width * mh) / mw);
    for (const format of ['webp', 'jpg'] as const) {
      const file = `${opts.id}-${tier}.${format}`;
      const pipeline = sharp(master.data).resize({ width, height, fit: 'fill' });
      const encoded = format === 'webp' ? pipeline.webp({ quality: 82 }) : pipeline.jpeg({ quality: 84, mozjpeg: true, progressive: true });
      jobs.push(encoded.toFile(join(dir, file)).then(() => ({ tier, format, width, height, src: `${prefix}/${opts.id}/${file}` })));
    }
  }
  return Promise.all(jobs);
}

export async function removeImageVariants(outDir: string, id: string): Promise<void> {
  if (!/^[\w-]+$/.test(id)) throw new Error(`Invalid photo id: ${id}`);
  await rm(join(outDir, id), { recursive: true, force: true });
}
