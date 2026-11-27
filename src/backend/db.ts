/** Local-only SQLite store (node:sqlite). Every write emits a mutation event used by the auto static builder. */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { assignGuestSlugs } from '../shared/guest-codec';
import { DEFAULT_CONFIG } from '../shared/default-config';
import { SEATING_ZONES, type CropRect, type GuestRecord, type MusicTrack, type SeatingLayout, type PhotoRecord, type SeatingZone, type WeddingConfig, type WeddingData } from '../shared/types';

export type MutationTable = 'config' | 'photos' | 'seating_zones' | 'seating_layout' | 'guests' | 'playlist';

export interface WeddingDbOptions {
  onMutation?: (table: MutationTable) => void;
}

type Row = Record<string, unknown>;

export class WeddingDb {
  private db: DatabaseSync;
  onMutation?: (table: MutationTable) => void;

  constructor(path: string, opts: WeddingDbOptions = {}) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.onMutation = opts.onMutation;
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY, caption TEXT NOT NULL DEFAULT '', placement TEXT NOT NULL DEFAULT 'gallery',
        sort_order INTEGER NOT NULL DEFAULT 0, focal_point TEXT, variants TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS guests (
        row_id TEXT PRIMARY KEY, short_id TEXT NOT NULL, token TEXT NOT NULL, salutation TEXT NOT NULL, name TEXT NOT NULL,
        relationship TEXT NOT NULL, count INTEGER NOT NULL, phone TEXT, email TEXT, status TEXT NOT NULL DEFAULT 'PENDING'
      );
    `);
    this.db.prepare('INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)').run('config', JSON.stringify(DEFAULT_CONFIG));
    this.db.prepare('INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)').run('seating_zones', JSON.stringify(SEATING_ZONES));
    this.db.prepare('INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)').run('seating_layout', 'null');
    this.db.prepare('INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)').run('playlist', '[]');
    const cols = (this.db.prepare('PRAGMA table_info(photos)').all() as Row[]).map((c) => String(c.name));
    if (!cols.includes('crop')) this.db.exec('ALTER TABLE photos ADD COLUMN crop TEXT');
  }

  private emit(table: MutationTable) {
    this.onMutation?.(table);
  }

  private getKv<T>(key: string): T {
    const row = this.db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as Row | undefined;
    return JSON.parse(String(row!.value)) as T;
  }

  private setKv(key: string, value: unknown) {
    this.db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
  }

  getConfig(): WeddingConfig {
    return { ...DEFAULT_CONFIG, ...this.getKv<WeddingConfig>('config') };
  }

  setConfig(patch: Partial<WeddingConfig>): WeddingConfig {
    const next = { ...this.getConfig(), ...patch };
    this.setKv('config', next);
    this.emit('config');
    return next;
  }

  getSeatingZones(): SeatingZone[] {
    return this.getKv<SeatingZone[]>('seating_zones');
  }

  setSeatingZones(zones: SeatingZone[]): SeatingZone[] {
    this.setKv('seating_zones', zones);
    this.emit('seating_zones');
    return zones;
  }

  getSeatingLayout(): SeatingLayout | null {
    return this.getKv<SeatingLayout | null>('seating_layout');
  }

  setSeatingLayout(layout: SeatingLayout | null): SeatingLayout | null {
    this.setKv('seating_layout', layout);
    this.emit('seating_layout');
    return layout;
  }

  /** Background music, in play order. */
  getPlaylist(): MusicTrack[] {
    return [...this.getKv<MusicTrack[]>('playlist')].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  setPlaylist(tracks: MusicTrack[]): MusicTrack[] {
    const next = tracks.map((t, i) => ({ ...t, sortOrder: i }));
    this.setKv('playlist', next);
    this.emit('playlist');
    return next;
  }

  private toPhoto(r: Row): PhotoRecord {
    return {
      id: String(r.id),
      caption: String(r.caption),
      placement: r.placement as PhotoRecord['placement'],
      sortOrder: Number(r.sort_order),
      focalPoint: r.focal_point ? JSON.parse(String(r.focal_point)) : null,
      crop: r.crop ? (JSON.parse(String(r.crop)) as CropRect) : null,
      variants: JSON.parse(String(r.variants)),
    };
  }

  listPhotos(): PhotoRecord[] {
    return (this.db.prepare('SELECT * FROM photos ORDER BY sort_order ASC, rowid ASC').all() as Row[]).map((r) => this.toPhoto(r));
  }

  getPhoto(id: string): PhotoRecord | null {
    const r = this.db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as Row | undefined;
    return r ? this.toPhoto(r) : null;
  }

  addPhoto(p: PhotoRecord): PhotoRecord {
    this.db
      .prepare('INSERT INTO photos (id, caption, placement, sort_order, focal_point, crop, variants) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(p.id, p.caption, p.placement, p.sortOrder, p.focalPoint ? JSON.stringify(p.focalPoint) : null, p.crop ? JSON.stringify(p.crop) : null, JSON.stringify(p.variants));
    this.emit('photos');
    return p;
  }

  updatePhoto(id: string, patch: Partial<Omit<PhotoRecord, 'id'>>): PhotoRecord | null {
    const cur = this.getPhoto(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, id };
    this.db
      .prepare('UPDATE photos SET caption = ?, placement = ?, sort_order = ?, focal_point = ?, crop = ?, variants = ? WHERE id = ?')
      .run(next.caption, next.placement, next.sortOrder, next.focalPoint ? JSON.stringify(next.focalPoint) : null, next.crop ? JSON.stringify(next.crop) : null, JSON.stringify(next.variants), id);
    this.emit('photos');
    return next;
  }

  deletePhoto(id: string): boolean {
    const res = this.db.prepare('DELETE FROM photos WHERE id = ?').run(id);
    if (Number(res.changes) > 0) {
      this.emit('photos');
      return true;
    }
    return false;
  }

  nextPhotoSortOrder(): number {
    const r = this.db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM photos').get() as Row;
    return Number(r.n);
  }

  listGuests(): GuestRecord[] {
    const rows = (this.db.prepare('SELECT * FROM guests ORDER BY rowid ASC').all() as Row[]).map((r) => ({
      rowId: String(r.row_id),
      shortId: String(r.short_id),
      token: String(r.token),
      salutation: String(r.salutation),
      name: String(r.name),
      relationship: r.relationship as GuestRecord['relationship'],
      count: Number(r.count),
      phone: r.phone ? String(r.phone) : undefined,
      email: r.email ? String(r.email) : undefined,
      status: r.status as GuestRecord['status'],
    }));
    const slugs = assignGuestSlugs(rows);
    return rows.map((g) => ({ ...g, slug: slugs.get(g.rowId) }));
  }

  upsertGuests(guests: GuestRecord[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO guests (row_id, short_id, token, salutation, name, relationship, count, phone, email, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(row_id) DO UPDATE SET short_id = excluded.short_id, token = excluded.token, salutation = excluded.salutation,
        name = excluded.name, relationship = excluded.relationship, count = excluded.count, phone = excluded.phone, email = excluded.email,
        status = CASE WHEN guests.token = excluded.token THEN guests.status ELSE excluded.status END`);
    this.db.exec('BEGIN');
    try {
      for (const g of guests) {
        stmt.run(g.rowId, g.shortId, g.token, g.salutation, g.name, g.relationship, g.count, g.phone ?? null, g.email ?? null, g.status ?? 'PENDING');
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    this.emit('guests');
  }

  setGuestStatus(rowId: string, status: NonNullable<GuestRecord['status']>): void {
    this.db.prepare('UPDATE guests SET status = ? WHERE row_id = ?').run(status, rowId);
  }

  snapshot(): WeddingData {
    return { config: this.getConfig(), photos: this.listPhotos(), playlist: this.getPlaylist(), seatingZones: this.getSeatingZones(), seatingLayout: this.getSeatingLayout(), guests: this.listGuests() };
  }

  close() {
    this.db.close();
  }
}
