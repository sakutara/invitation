/** Demo preview for phones on the same Wi-Fi: serves ONLY the static site (never the CMS). RSVP posts go to a mock. */
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildE2eSite, E2E_DIST, E2E_WEBHOOK } from './e2e-fixture';
import { serveStatic } from '../src/backend/server';

const port = Number(process.argv[2] ?? 4180);
const { shortId } = await buildE2eSite();
const rsvp = join(E2E_DIST, 'rsvp.html');
await writeFile(rsvp, (await readFile(rsvp, 'utf8')).replaceAll(E2E_WEBHOOK, '/__mock-rsvp'));

http
  .createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    if (path === '/__mock-rsvp') {
      for await (const _ of req) { /* drain */ }
      return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, operation: 'INSERTED' }));
    }
    if (!(await serveStatic(E2E_DIST, path, res))) res.writeHead(404).end('Not found');
  })
  .listen(port, '0.0.0.0', () => console.log(`READY shortId=${shortId}`));
