/** Playwright webServer: build the fixture site then serve dist-e2e/ statically. */
import http from 'node:http';
import { buildE2eSite, E2E_DIST } from './e2e-fixture';
import { serveStatic } from '../src/backend/server';

const port = Number(process.argv[2] ?? 4173);
await buildE2eSite();
http
  .createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    if (!(await serveStatic(E2E_DIST, path, res))) res.writeHead(404).end('Not found');
  })
  .listen(port, '127.0.0.1', () => console.log(`e2e static server on http://127.0.0.1:${port}`));
