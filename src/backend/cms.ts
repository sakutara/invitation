/** Wires the SQLite store to the static builder: every mutation triggers a debounced rebuild of dist/. */
import { WeddingDb } from './db';
import { StaticBuilder, type BuildReport } from './static-builder';

export interface CmsOptions {
  dbPath: string;
  distDir: string;
  mediaDir: string;
  debounceMs?: number;
  onBuild?: (r: BuildReport) => void;
  onBuildError?: (e: unknown) => void;
}

export interface Cms {
  db: WeddingDb;
  builder: StaticBuilder;
  mediaDir: string;
  /** Force an immediate rebuild (POST /api/build). */
  rebuild(): Promise<BuildReport>;
  /** Resolves once no rebuild is pending or running. */
  whenIdle(): Promise<void>;
  buildCount(): number;
  lastBuild(): BuildReport | null;
  close(): Promise<void>;
}

export async function createCms(opts: CmsOptions): Promise<Cms> {
  const debounceMs = opts.debounceMs ?? 100;
  const db = new WeddingDb(opts.dbPath);
  const builder = new StaticBuilder({ distDir: opts.distDir, mediaDir: opts.mediaDir });
  let timer: NodeJS.Timeout | null = null;
  let running: Promise<BuildReport> | null = null;
  let dirty = false;
  let count = 0;
  let last: BuildReport | null = null;
  let idleWaiters: (() => void)[] = [];

  const settleIdle = () => {
    if (!timer && !running) {
      const w = idleWaiters;
      idleWaiters = [];
      w.forEach((fn) => fn());
    }
  };

  const runBuild = (): Promise<BuildReport> => {
    if (running) {
      dirty = true;
      return running;
    }
    running = builder
      .build(db.snapshot())
      .then((r) => {
        count++;
        last = r;
        opts.onBuild?.(r);
        return r;
      })
      .catch((e) => {
        opts.onBuildError?.(e);
        throw e;
      })
      .finally(() => {
        running = null;
        if (dirty) {
          dirty = false;
          runBuild().catch(() => {});
        } else settleIdle();
      });
    return running;
  };

  db.onMutation = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      runBuild().catch(() => {});
    }, debounceMs);
  };

  await runBuild();

  return {
    db,
    builder,
    mediaDir: opts.mediaDir,
    rebuild: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return running ? running.then(() => runBuild()) : runBuild();
    },
    whenIdle: () => (timer || running ? new Promise<void>((r) => idleWaiters.push(r)) : Promise.resolve()),
    buildCount: () => count,
    lastBuild: () => last,
    close: async () => {
      if (timer || running) await new Promise<void>((r) => idleWaiters.push(r));
      db.close();
    },
  };
}
