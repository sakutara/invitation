/** Local backend <-> Google Apps Script client and Invitation_List roster synchronization. */
import type { WeddingDb } from './db';
import { computeShortId, encodeGuestToken, resolveRelationship } from '../shared/guest-codec';
import { normalizeVnPhone, isValidVnPhone } from '../shared/phone-normalizer';
import type { GuestRecord, RsvpSubmission } from '../shared/types';

export const INVITATION_HEADERS = ['Row_ID', 'Salutation', 'Guest_Name', 'Relationship', 'Count', 'Phone', 'Email', 'Short_ID', 'Invite_URL', 'Card_JPG_Status'] as const;

export interface InvitationRow {
  rowId: string;
  salutation: string;
  guestName: string;
  relationship: string;
  count: number | string;
  phone?: string;
  email?: string;
  shortId?: string;
  inviteUrl?: string;
  status?: string;
}

export interface LinkUpdate {
  rowId: string;
  shortId: string;
  inviteUrl: string;
  status: 'PENDING' | 'GENERATED' | 'SENT';
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class SheetsClient {
  private webhookUrl: string;
  private adminToken?: string;
  private fetchImpl: FetchLike;

  constructor(opts: { webhookUrl: string; adminToken?: string; fetchImpl?: FetchLike }) {
    this.webhookUrl = opts.webhookUrl;
    this.adminToken = opts.adminToken;
    this.fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  }

  private async post<T>(payload: Record<string, unknown>): Promise<T> {
    if (!this.webhookUrl) throw new Error('Google Apps Script webhook URL is not configured');
    const res = await this.fetchImpl(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);
    const data = (await res.json()) as { ok: boolean; error?: string } & T;
    if (!data.ok) throw new Error(`Apps Script error: ${data.error ?? 'unknown'}`);
    return data;
  }

  async fetchInvitationList(): Promise<InvitationRow[]> {
    return (await this.post<{ rows: InvitationRow[] }>({ action: 'SYNC_INVITATION_LIST', adminToken: this.adminToken })).rows;
  }

  async updateInvitationLinks(rows: LinkUpdate[]): Promise<{ updated: number; missing: string[] }> {
    return this.post({ action: 'UPDATE_INVITATION_LINKS', adminToken: this.adminToken, rows });
  }

  async submitRsvp(sub: RsvpSubmission): Promise<{ operation: 'INSERTED' | 'UPDATED'; phone: string }> {
    return this.post({ ...sub });
  }
}

export interface SyncResult {
  guests: GuestRecord[];
  skipped: { rowId: string; reason: string }[];
}

export async function rowToGuest(row: InvitationRow): Promise<GuestRecord> {
  const relationship = resolveRelationship(row.relationship);
  if (!relationship) throw new Error(`Unknown relationship "${row.relationship}"`);
  const count = Number(row.count);
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error(`Invalid count "${row.count}"`);
  if (!String(row.salutation ?? '').trim() || !String(row.guestName ?? '').trim()) throw new Error('Missing salutation or guest name');
  const phone = row.phone && isValidVnPhone(row.phone) ? normalizeVnPhone(row.phone) : undefined;
  const email = row.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim()) ? row.email.trim() : undefined;
  const base = { salutation: row.salutation.trim(), name: row.guestName.trim(), relationship, count };
  return {
    rowId: String(row.rowId),
    shortId: await computeShortId({ ...base, phone }),
    token: encodeGuestToken(base),
    ...base,
    phone,
    email,
    status: row.status === 'SENT' || row.status === 'GENERATED' ? row.status : 'PENDING',
  };
}

/** Pulls Invitation_List, validates rows, computes shortId/token and upserts them into SQLite (triggers rebuild). */
export async function syncInvitationList(db: WeddingDb, client: SheetsClient): Promise<SyncResult> {
  const rows = await client.fetchInvitationList();
  const guests: GuestRecord[] = [];
  const skipped: SyncResult['skipped'] = [];
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!String(row.rowId ?? '').trim()) continue;
    try {
      const g = await rowToGuest(row);
      const clash = seen.get(g.shortId);
      if (clash) throw new Error(`Duplicate guest (same phone/name as row ${clash})`);
      seen.set(g.shortId, g.rowId);
      guests.push(g);
    } catch (e) {
      skipped.push({ rowId: String(row.rowId), reason: (e as Error).message });
    }
  }
  db.upsertGuests(guests);
  // Re-read so every guest carries its DB-derived invite slug.
  const synced = new Set(guests.map((g) => g.rowId));
  return { guests: db.listGuests().filter((g) => synced.has(g.rowId)), skipped };
}
