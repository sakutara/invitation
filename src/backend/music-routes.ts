/**
 * Background-music playlist API. Audio files live in <mediaDir>/_music/<id>.<ext>; the static builder copies
 * them to dist/assets/music/ and the public pages play the tracks in order (scripts/music.ts).
 */
import { randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { Cms } from './cms';
import { HttpError, route, status, type Route } from './server';
import type { MusicTrack } from '../shared/types';

export const AUDIO_EXTS = ['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wav', '.webm', '.flac'];
const MAX_AUDIO = 40 * 1024 * 1024;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Track title from an uploaded file name: "01 - Bài hát_cưới.mp3" -> "01 - Bài hát cưới". */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Bài hát';
}

export function createMusicRoutes({ cms }: { cms: Cms }): Route[] {
  const dir = join(cms.mediaDir, '_music');
  const fileOf = (t: MusicTrack) => t.src.split('/').pop()!;

  return [
    route('GET', '/api/playlist', () => cms.db.getPlaylist()),
    route('POST', '/api/playlist', async ({ body }) => {
      const b = await body();
      if (!isObj(b) || typeof b.dataBase64 !== 'string' || !b.dataBase64 || typeof b.fileName !== 'string') {
        throw new HttpError(400, 'Provide { fileName, dataBase64, title? }');
      }
      const ext = extname(b.fileName).toLowerCase();
      if (!AUDIO_EXTS.includes(ext)) throw new HttpError(400, `Định dạng không hỗ trợ (${AUDIO_EXTS.join(', ')})`);
      const data = Buffer.from(b.dataBase64.replace(/^data:[^,]+,/, ''), 'base64');
      if (!data.length) throw new HttpError(400, 'Tệp rỗng');
      if (data.length > MAX_AUDIO) throw new HttpError(413, 'Tệp nhạc quá lớn (tối đa 40MB)');
      const id = `track-${randomBytes(4).toString('hex')}`;
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${id}${ext}`), data);
      const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim() : titleFromFileName(b.fileName);
      const track: MusicTrack = { id, title, src: `assets/music/${id}${ext}`, sortOrder: Number.MAX_SAFE_INTEGER };
      const list = cms.db.setPlaylist([...cms.db.getPlaylist(), track]);
      return status(201, list.find((t) => t.id === id));
    }),
    route('PUT', '/api/playlist/order', async ({ body }) => {
      const b = await body();
      if (!isObj(b) || !Array.isArray(b.ids) || !b.ids.every((x) => typeof x === 'string')) throw new HttpError(400, 'Provide { ids: string[] }');
      const ids = b.ids as string[];
      const cur = cms.db.getPlaylist();
      const ordered = [...ids.map((id) => cur.find((t) => t.id === id)).filter((t): t is MusicTrack => !!t), ...cur.filter((t) => !ids.includes(t.id))];
      return cms.db.setPlaylist(ordered);
    }),
    route('PUT', '/api/playlist/:id', async ({ params, body }) => {
      const b = await body();
      if (!isObj(b) || typeof b.title !== 'string' || !b.title.trim()) throw new HttpError(400, 'Provide { title }');
      const cur = cms.db.getPlaylist();
      if (!cur.some((t) => t.id === params.id)) throw new HttpError(404, 'Track not found');
      return cms.db.setPlaylist(cur.map((t) => (t.id === params.id ? { ...t, title: (b.title as string).trim() } : t))).find((t) => t.id === params.id);
    }),
    route('DELETE', '/api/playlist/:id', async ({ params }) => {
      const cur = cms.db.getPlaylist();
      const hit = cur.find((t) => t.id === params.id);
      if (!hit) throw new HttpError(404, 'Track not found');
      cms.db.setPlaylist(cur.filter((t) => t.id !== params.id));
      await rm(join(dir, fileOf(hit)), { force: true });
      return status(204);
    }),
  ];
}
