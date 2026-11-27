import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createCms, type Cms } from '../../src/backend/cms';
import { createServer } from '../../src/backend/server';
import { createMusicRoutes, titleFromFileName } from '../../src/backend/music-routes';

let root: string;
let cms: Cms;
let server: Server;
let base: string;

const api = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const FAKE_MP3 = Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00fake-audio-bytes-0123456789').toString('base64');

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'wedding-music-api-'));
  cms = await createCms({ dbPath: join(root, 'data/wedding.db'), distDir: join(root, 'dist'), mediaDir: join(root, 'data/media'), debounceMs: 5 });
  server = createServer({ cms, extraRoutes: createMusicRoutes({ cms }) });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((r) => server.close(r));
  await cms.close();
  rmSync(root, { recursive: true, force: true });
});

describe('playlist API', () => {
  it('derives a title from the file name', () => {
    expect(titleFromFileName('01 - Bài_hát cưới.mp3')).toBe('01 - Bài hát cưới');
  });

  it('uploads, renames, reorders and deletes tracks, and publishes them with the site', async () => {
    expect((await api('GET', '/api/playlist')).body).toEqual([]);
    const a = await api('POST', '/api/playlist', { fileName: 'Beautiful in white.mp3', dataBase64: FAKE_MP3 });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ title: 'Beautiful in white', src: expect.stringMatching(/^assets\/music\/track-[0-9a-f]{8}\.mp3$/) });
    const b = await api('POST', '/api/playlist', { fileName: 'Perfect.m4a', dataBase64: FAKE_MP3, title: 'Perfect' });
    expect((await api('GET', '/api/playlist')).body.map((t: { title: string }) => t.title)).toEqual(['Beautiful in white', 'Perfect']);

    expect((await api('POST', '/api/playlist', { fileName: 'virus.exe', dataBase64: FAKE_MP3 })).status).toBe(400);

    await api('PUT', `/api/playlist/${a.body.id}`, { title: 'Bài mở đầu' });
    const ordered = await api('PUT', '/api/playlist/order', { ids: [b.body.id, a.body.id] });
    expect(ordered.body.map((t: { title: string }) => t.title)).toEqual(['Perfect', 'Bài mở đầu']);

    await cms.whenIdle();
    const dist = cms.builder.distDir;
    expect(existsSync(join(dist, a.body.src))).toBe(true);
    const index = readFileSync(join(dist, 'index.html'), 'utf8');
    expect(index).toContain('id="music-data"');
    expect(readFileSync(join(dist, 'thiep-moi/index.html'), 'utf8')).toContain(`../${b.body.src}`);

    // Safari needs byte ranges for audio
    const ranged = await fetch(`${base}/site/${a.body.src}`, { headers: { range: 'bytes=0-3' } });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get('content-type')).toBe('audio/mpeg');
    expect(Buffer.from(await ranged.arrayBuffer()).toString()).toBe('ID3\x03');

    expect((await api('DELETE', `/api/playlist/${a.body.id}`)).status).toBe(204);
    await cms.whenIdle();
    expect(existsSync(join(dist, a.body.src))).toBe(false);
    expect((await api('GET', '/api/playlist')).body).toHaveLength(1);
  });
});
