/** Compiles the SQLite snapshot into the deployable static site under dist/. */
import { mkdir, writeFile, readFile, readdir, rm, cp, stat, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { buildGuestsMap, type GuestsMap } from '../shared/guest-codec';
import type { WeddingData } from '../shared/types';
import { renderIndexPage } from '../frontend/templates/index.template';
import { renderRsvpPage } from '../frontend/templates/rsvp.template';
import { renderInvitePage } from '../frontend/templates/invite.template';
import { buildIcs } from '../shared/wedding-calendar';

export const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const FRONTEND = join(PROJECT_ROOT, 'src/frontend');
const SCRIPT_ENTRIES = ['index', 'rsvp', 'invite'];

export interface BuildReport {
  durationMs: number;
  files: string[];
}

export type PublicWeddingData = Omit<WeddingData, 'guests'> & { builtAt: string };

let tmpCounter = 0;
/** Write via temp file + rename so readers (preview server, deploy sync) never observe a partial file. */
async function writeAtomic(path: string, content: string): Promise<void> {
  const tmp = `${path}.${process.pid}.${++tmpCounter}.tmp`;
  await writeFile(tmp, content);
  await rename(tmp, path);
}

let scriptCache: { key: string; outputs: Map<string, string> } | null = null;

async function sourceStamp(dir: string): Promise<string> {
  let latest = 0;
  const walk = async (d: string) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else latest = Math.max(latest, (await stat(p)).mtimeMs);
    }
  };
  await walk(dir);
  return String(latest);
}

/** Bundles src/frontend/scripts/<page>.ts (+ shared modules) once per source change. */
async function bundleScripts(): Promise<Map<string, string>> {
  const entries = SCRIPT_ENTRIES.map((n) => join(FRONTEND, 'scripts', `${n}.ts`)).filter(existsSync);
  const key = (await sourceStamp(join(PROJECT_ROOT, 'src/frontend'))) + (await sourceStamp(join(PROJECT_ROOT, 'src/shared')));
  if (scriptCache?.key === key) return scriptCache.outputs;
  const outputs = new Map<string, string>();
  if (entries.length) {
    const res = await esbuild.build({
      entryPoints: entries,
      bundle: true,
      format: 'esm',
      target: ['es2020', 'safari15', 'ios15', 'chrome90', 'firefox90'],
      minify: true,
      write: false,
      outdir: '/out',
      logLevel: 'silent',
    });
    for (const f of res.outputFiles) outputs.set(f.path.replace(/^\/out\//, ''), f.text);
  }
  scriptCache = { key, outputs };
  return outputs;
}

export function buildGuestsMapSync(guests: WeddingData['guests']): GuestsMap {
  return buildGuestsMap(guests);
}

export class StaticBuilder {
  readonly distDir: string;
  readonly mediaDir: string;

  constructor(opts: { distDir: string; mediaDir: string }) {
    this.distDir = opts.distDir;
    this.mediaDir = opts.mediaDir;
  }

  async build(data: WeddingData): Promise<BuildReport> {
    const t0 = performance.now();
    const dist = this.distDir;
    await Promise.all(['assets/data', 'assets/css', 'assets/js', 'assets/images'].map((d) => mkdir(join(dist, d), { recursive: true })));

    const publicData: PublicWeddingData = {
      config: data.config,
      photos: data.photos,
      seatingZones: data.seatingZones,
      seatingLayout: data.seatingLayout ?? null,
      builtAt: new Date().toISOString(),
    };
    const files: Record<string, string> = {
      'index.html': renderIndexPage(publicData),
      'rsvp.html': renderRsvpPage(publicData),
      'invite.html': renderInvitePage(publicData),
      'assets/data/wedding-data.json': JSON.stringify(publicData, null, 2),
      'assets/data/guests-map.json': JSON.stringify(buildGuestsMapSync(data.guests)),
      'assets/data/wedding.ics': buildIcs(data.config),
    };

    const css = join(FRONTEND, 'styles/main.css');
    if (existsSync(css)) files['assets/css/main.css'] = await readFile(css, 'utf8');
    for (const [name, code] of await bundleScripts()) files[`assets/js/${name}`] = code;

    await Promise.all(Object.entries(files).map(([rel, content]) => writeAtomic(join(dist, rel), content)));
    await this.syncImages(data);
    await this.syncMaps();
    return { durationMs: performance.now() - t0, files: Object.keys(files) };
  }

  /** Mirrors <mediaDir>/_maps/*.jpg (generated event map previews) into dist/assets/maps/. */
  private async syncMaps() {
    const src = join(this.mediaDir, '_maps');
    const dest = join(this.distDir, 'assets/maps');
    await mkdir(dest, { recursive: true });
    const wanted = existsSync(src)
      ? (await readdir(src, { withFileTypes: true })).filter((e) => e.isFile() && e.name.endsWith('.jpg')).map((e) => e.name)
      : [];
    const names = new Set(wanted);
    for (const e of await readdir(dest, { withFileTypes: true })) {
      if (!names.has(e.name)) await rm(join(dest, e.name), { recursive: true, force: true });
    }
    await Promise.all(wanted.map((name) => cp(join(src, name), join(dest, name)).catch(() => {})));
  }

  private async syncImages(data: WeddingData) {
    const imagesDir = join(this.distDir, 'assets/images');
    const wanted = new Set(data.photos.map((p) => p.id));
    for (const e of await readdir(imagesDir, { withFileTypes: true })) {
      if (e.isDirectory() && !wanted.has(e.name)) await rm(join(imagesDir, e.name), { recursive: true, force: true });
    }
    await Promise.all(
      [...wanted].map(async (id) => {
        const src = join(this.mediaDir, id);
        const dest = join(imagesDir, id);
        if (existsSync(src) && !existsSync(dest)) await cp(src, dest, { recursive: true });
      }),
    );
  }
}
