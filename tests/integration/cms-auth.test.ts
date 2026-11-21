import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createCms, type Cms } from '../../src/backend/cms';
import { createServer, resolveLanAuth } from '../../src/backend/server';

let root: string;
let cms: Cms;
let server: Server;
let base: string;
const basic = (u: string, p: string) => ({ authorization: `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}` });

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'wedding-auth-'));
  cms = await createCms({ dbPath: join(root, 'w.db'), distDir: join(root, 'dist'), mediaDir: join(root, 'media') });
  server = createServer({ cms, auth: { user: 'admin', password: 'cuoi-2027' } });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((r) => server.close(r));
  await cms.close();
  rmSync(root, { recursive: true, force: true });
});

describe('CMS password protection (LAN mode)', () => {
  it.each(['/', '/api/config'])('rejects %s without credentials with a Basic challenge', async (p) => {
    const res = await fetch(base + p);
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toMatch(/^Basic realm=/);
  });

  it('serves the public site (invite page + guests map) without a login', async () => {
    expect((await fetch(`${base}/site/index.html`)).status).toBe(200);
  });

  it('rejects a wrong password', async () => {
    expect((await fetch(`${base}/api/config`, { headers: basic('admin', 'sai') })).status).toBe(401);
    expect((await fetch(`${base}/api/config`, { method: 'PUT', headers: { ...basic('x', 'cuoi-2027'), 'content-type': 'application/json' }, body: '{"groomName":"Hack"}' })).status).toBe(401);
    expect(cms.db.getConfig().groomName).not.toBe('Hack');
  });

  it('allows the correct credentials', async () => {
    expect((await fetch(`${base}/api/config`, { headers: basic('admin', 'cuoi-2027') })).status).toBe(200);
    const put = await fetch(`${base}/api/config`, { method: 'PUT', headers: { ...basic('admin', 'cuoi-2027'), 'content-type': 'application/json' }, body: '{"groomName":"OK"}' });
    expect(put.status).toBe(200);
  });
});

describe('resolveLanAuth', () => {
  it('needs no password on loopback', () => {
    expect(resolveLanAuth('127.0.0.1', {})).toBeNull();
    expect(resolveLanAuth('localhost', {})).toBeNull();
  });
  it('uses CMS_PASSWORD when exposed on the network', () => {
    expect(resolveLanAuth('0.0.0.0', { CMS_PASSWORD: 'abc12345' })).toEqual({ user: 'admin', password: 'abc12345', generated: false });
  });
  it('generates a random password when none is set', () => {
    const a = resolveLanAuth('0.0.0.0', {})!;
    expect(a.generated).toBe(true);
    expect(a.password).toMatch(/^[a-z0-9]{10}$/);
    expect(resolveLanAuth('0.0.0.0', {})!.password).not.toBe(a.password);
  });
});
