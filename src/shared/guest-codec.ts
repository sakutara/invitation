/**
 * Hybrid guest URL codec (okf/invitation_and_seating_rules.md §3).
 * Isomorphic: runs in Node (backend/static builder) and in the browser (invite.html).
 */
import { FALLBACK_GUEST, RELATIONSHIP_GROUPS, RELATIONSHIP_KEYS, type GuestInvitePayload, type RelationshipKey } from './types';
import { normalizeVnPhone } from './phone-normalizer';
import { slugify } from './slug';

export interface GuestInput {
  salutation: string;
  name: string;
  relationship: string | number;
  count: number;
  phone?: string;
}

export type GuestsMap = Record<string, string>;

const MAX_COUNT = 20;

function fold(s: string): string {
  return s.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveRelationship(input: string | number | null | undefined): RelationshipKey | null {
  if (input == null) return null;
  const raw = String(input);
  if (/^\s*\d+\s*$/.test(raw)) {
    const code = Number(raw);
    return RELATIONSHIP_KEYS.find((k) => RELATIONSHIP_GROUPS[k].code === code) ?? null;
  }
  const v = fold(raw);
  if ((RELATIONSHIP_KEYS as string[]).includes(v)) return v as RelationshipKey;
  for (const k of RELATIONSHIP_KEYS) {
    const label = RELATIONSHIP_GROUPS[k].labelVi;
    if (v === label || v === label.replace(/\.+$/, '')) return k;
  }
  return null;
}

function isValidCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_COUNT;
}

function cleanText(s: string): string {
  return String(s ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

function utf8ToBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(token: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('not base64url');
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function encodeGuestToken(input: GuestInput): string {
  const key = resolveRelationship(input.relationship);
  if (!key) throw new Error(`Unknown relationship: ${input.relationship}`);
  if (!isValidCount(input.count)) throw new Error(`Invalid count: ${input.count}`);
  const tuple = [cleanText(input.salutation), cleanText(input.name), RELATIONSHIP_GROUPS[key].code, input.count];
  return utf8ToBase64Url(JSON.stringify(tuple));
}

export function decodeGuestToken(token: string | null | undefined): GuestInvitePayload | null {
  if (!token) return null;
  try {
    const arr = JSON.parse(base64UrlToUtf8(token));
    if (!Array.isArray(arr) || arr.length !== 4) return null;
    const [salutation, name, code, count] = arr;
    if (typeof salutation !== 'string' || typeof name !== 'string' || !salutation.trim() || !name.trim()) return null;
    if (typeof code !== 'number') return null;
    const relationship = resolveRelationship(code);
    if (!relationship || !isValidCount(count)) return null;
    return { salutation: cleanText(salutation), name: cleanText(name), relationship, count };
  } catch {
    return null;
  }
}

/** Deterministic 6-char hex id: SHA-256 of normalized phone, else `salutation|name|relationshipKey`. */
export async function computeShortId(input: GuestInput): Promise<string> {
  const phone = input.phone ? normalizeVnPhone(input.phone) : '';
  const key = resolveRelationship(input.relationship) ?? 'other';
  const source = phone || `${fold(input.salutation)}|${fold(input.name)}|${key}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest).slice(0, 3), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Readable URL slug describing the guest, e.g. "chu-chin-gia-dinh-co-dau" (name + relationship group). */
export function guestSlugBase(g: { name: string; relationship: string | number }): string {
  const key = resolveRelationship(g.relationship) ?? 'other';
  return `${slugify(g.name)}-${slugify(RELATIONSHIP_GROUPS[key].labelVi)}`;
}

/** Unique slug per guest (rowId -> slug). Duplicates get -2, -3… in roster order. */
export function assignGuestSlugs(guests: { rowId: string; name: string; relationship: string | number }[]): Map<string, string> {
  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const g of guests) {
    const base = guestSlugBase(g);
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    out.set(g.rowId, slug);
  }
  return out;
}

/** slug -> compact token, built from the DB roster. */
export function buildGuestsMap(guests: (GuestInput & { rowId: string })[]): GuestsMap {
  const slugs = assignGuestSlugs(guests);
  const map: GuestsMap = {};
  for (const g of guests) {
    try {
      map[slugs.get(g.rowId)!] = encodeGuestToken(g);
    } catch {
      /* skip invalid rows */
    }
  }
  return map;
}

export const GUEST_PARAM = 'khach';

/** Resolves ?khach=<slug> against a loaded guests-map. Returns null when there is no (known) guest. */
export function resolveGuestFromQuery(search: string, guestsMap: GuestsMap = {}): GuestInvitePayload | null {
  try {
    const slug = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(GUEST_PARAM)?.trim().toLowerCase();
    if (slug && Object.prototype.hasOwnProperty.call(guestsMap, slug)) return decodeGuestToken(guestsMap[slug]);
  } catch {
    /* fall through */
  }
  return null;
}

/** Browser helper: fetches the DB-built guests-map.json only when ?khach= is present. */
export async function resolveGuestFromLocation(
  search: string,
  fetchMap: (url: string) => Promise<GuestsMap>,
  mapUrl = 'assets/data/guests-map.json',
): Promise<GuestInvitePayload | null> {
  if (!new URLSearchParams(search).get(GUEST_PARAM)) return null;
  try {
    return resolveGuestFromQuery(search, await fetchMap(mapUrl));
  } catch {
    return null;
  }
}

export function buildInviteUrl(baseUrl: string, ref: { slug: string }): string {
  return `${baseUrl.replace(/\/+$/, '')}/invite.html?${GUEST_PARAM}=${encodeURIComponent(ref.slug)}`;
}
