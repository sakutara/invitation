/** One-off build: `npm run build` compiles data/wedding.db into dist/ without starting the CMS server. */
import { join } from 'node:path';
import { createCms } from '../src/backend/cms';
import { PROJECT_ROOT } from '../src/backend/static-builder';

const cms = await createCms({
  dbPath: process.env.WEDDING_DB ?? join(PROJECT_ROOT, 'data/wedding.db'),
  distDir: process.env.WEDDING_DIST ?? join(PROJECT_ROOT, 'dist'),
  mediaDir: process.env.WEDDING_MEDIA ?? join(PROJECT_ROOT, 'data/media'),
});
console.log(`dist/ built in ${cms.lastBuild()!.durationMs.toFixed(0)}ms`);
await cms.close();
