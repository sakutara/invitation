/**
 * Shared domain contracts. Canonical source: okf/domain_glossary.md,
 * okf/design_tokens.md and okf/invitation_and_seating_rules.md.
 * tests/unit/okf-bundle.test.ts keeps these in sync with the OKF bundle.
 */

export type RelationshipKey =
  | 'groom_family'
  | 'bride_family'
  | 'groom_friends'
  | 'bride_friends'
  | 'groom_parents_friends'
  | 'bride_parents_friends'
  | 'other';

export type RelationshipCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Side = 'groom' | 'bride' | 'shared';
export type AccentToken = 'accentSkyBlue' | 'accentLotusPink' | 'primaryBurgundy';
export type ZoneId = 'ZONE_A1' | 'ZONE_A2' | 'ZONE_A3' | 'ZONE_B1' | 'ZONE_B2' | 'ZONE_B3' | 'ZONE_C1';

export interface RelationshipGroup {
  key: RelationshipKey;
  code: RelationshipCode;
  labelVi: string;
  displayVi: string;
  side: Side;
  zoneId: ZoneId;
  accent: AccentToken;
}

export const RELATIONSHIP_GROUPS: Record<RelationshipKey, RelationshipGroup> = {
  groom_family: { key: 'groom_family', code: 1, labelVi: 'gia đình chú rể', displayVi: 'Gia đình chú rể', side: 'groom', zoneId: 'ZONE_A1', accent: 'accentSkyBlue' },
  bride_family: { key: 'bride_family', code: 2, labelVi: 'gia đình cô dâu', displayVi: 'Gia đình cô dâu', side: 'bride', zoneId: 'ZONE_B1', accent: 'accentLotusPink' },
  groom_friends: { key: 'groom_friends', code: 3, labelVi: 'bạn bè chú rể', displayVi: 'Bạn bè chú rể', side: 'groom', zoneId: 'ZONE_A2', accent: 'accentSkyBlue' },
  bride_friends: { key: 'bride_friends', code: 4, labelVi: 'bạn bè cô dâu', displayVi: 'Bạn bè cô dâu', side: 'bride', zoneId: 'ZONE_B2', accent: 'accentLotusPink' },
  groom_parents_friends: { key: 'groom_parents_friends', code: 5, labelVi: 'bạn bè gia đình chú rể', displayVi: 'Bạn bè gia đình chú rể', side: 'groom', zoneId: 'ZONE_A3', accent: 'accentSkyBlue' },
  bride_parents_friends: { key: 'bride_parents_friends', code: 6, labelVi: 'bạn bè gia đình cô dâu', displayVi: 'Bạn bè gia đình cô dâu', side: 'bride', zoneId: 'ZONE_B3', accent: 'accentLotusPink' },
  other: { key: 'other', code: 7, labelVi: 'khác...', displayVi: 'Khác...', side: 'shared', zoneId: 'ZONE_C1', accent: 'primaryBurgundy' },
};

export const RELATIONSHIP_KEYS = Object.keys(RELATIONSHIP_GROUPS) as RelationshipKey[];

export type HallSide = 'left' | 'right' | 'center';

export interface SeatingZone {
  id: ZoneId;
  relationship: RelationshipKey;
  nameVi: string;
  hallSide: HallSide;
  row: 'near_stage' | 'middle' | 'lower' | 'center';
  tableRange: string;
  color: string;
}

/** Default reception floor plan (okf/invitation_and_seating_rules.md §4). Editable in the CMS. */
export const SEATING_ZONES: SeatingZone[] = [
  { id: 'ZONE_A1', relationship: 'groom_family', nameVi: 'Khu A1 - Gia đình & Họ hàng Chú Rể', hallSide: 'left', row: 'near_stage', tableRange: 'Bàn 01 - Bàn 03', color: '#38BDF8' },
  { id: 'ZONE_B1', relationship: 'bride_family', nameVi: 'Khu B1 - Gia đình & Họ hàng Cô Dâu', hallSide: 'right', row: 'near_stage', tableRange: 'Bàn 04 - Bàn 06', color: '#EC4899' },
  { id: 'ZONE_A3', relationship: 'groom_parents_friends', nameVi: 'Khu A2 - Khách mời Bố Mẹ Chú Rể', hallSide: 'left', row: 'middle', tableRange: 'Bàn 07 - Bàn 10', color: '#38BDF8' },
  { id: 'ZONE_B3', relationship: 'bride_parents_friends', nameVi: 'Khu B2 - Khách mời Bố Mẹ Cô Dâu', hallSide: 'right', row: 'middle', tableRange: 'Bàn 11 - Bàn 14', color: '#EC4899' },
  { id: 'ZONE_A2', relationship: 'groom_friends', nameVi: 'Khu A3 - Bạn bè & Đồng nghiệp Chú Rể', hallSide: 'left', row: 'lower', tableRange: 'Bàn 15 - Bàn 18', color: '#38BDF8' },
  { id: 'ZONE_B2', relationship: 'bride_friends', nameVi: 'Khu B3 - Bạn bè & Đồng nghiệp Cô Dâu', hallSide: 'right', row: 'lower', tableRange: 'Bàn 19 - Bàn 22', color: '#EC4899' },
  { id: 'ZONE_C1', relationship: 'other', nameVi: 'Khu C1 - Khu vực Khách Quý Chung', hallSide: 'center', row: 'center', tableRange: 'Bàn 23 - Bàn 24', color: '#7A1C24' },
];

export const COLOR_TOKENS: Record<string, string> = {
  '--color-navy': '#0F2042',
  '--color-navy-deep': '#091326',
  '--color-navy-glass': 'rgba(15, 32, 66, 0.78)',
  '--color-burgundy': '#7A1C24',
  '--color-burgundy-deep': '#561016',
  '--color-burgundy-light': '#9E2A35',
  '--color-sky-blue': '#38BDF8',
  '--color-sky-blue-pastel': '#E0F2FE',
  '--color-sky-blue-ink': '#075985',
  '--color-lotus-pink': '#EC4899',
  '--color-lotus-pink-pastel': '#FCE7F3',
  '--color-lotus-pink-ink': '#9D174D',
  '--color-white': '#FFFFFF',
  '--color-ivory': '#FDFBF7',
  '--color-cream': '#F5EFE6',
  '--color-black': '#111827',
  '--color-charcoal': '#1F2937',
  '--color-muted': '#4B5563',
};

export const FONT_TOKENS: Record<string, string> = {
  '--font-display': "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
  '--font-script': "'Great Vibes', 'Alex Brush', cursive",
  '--font-body': "'Be Vietnam Pro', 'Plus Jakarta Sans', -apple-system, sans-serif",
};

export const FLUID_TEXT_TOKENS: Record<string, string> = {
  '--text-hero': 'clamp(2.25rem, 1.5rem + 3.2vw, 4.75rem)',
  '--text-section-title': 'clamp(1.75rem, 1.2rem + 2.2vw, 3.25rem)',
  '--text-card-heading': 'clamp(1.35rem, 1.1rem + 1.1vw, 2.15rem)',
  '--text-invite-quote': 'clamp(1.15rem, 1.0rem + 0.75vw, 1.65rem)',
  '--text-body-lg': 'clamp(1.05rem, 0.95rem + 0.45vw, 1.35rem)',
  '--text-body': 'clamp(0.95rem, 0.9rem + 0.25vw, 1.125rem)',
};

export const ACCENT_COLORS: Record<AccentToken, string> = {
  accentSkyBlue: '#38BDF8',
  accentLotusPink: '#EC4899',
  primaryBurgundy: '#7A1C24',
};

export const PARALLAX_SPEEDS = { background: 0.25, midground: 0, foreground: -0.15 } as const;

export const CARD_SPEC = { width: 1080, height: 1620, mime: 'image/jpeg', quality: 0.92 } as const;

export const IMAGE_TIERS = { sm: 640, md: 1024, lg: 1440, fhd: 1920 } as const;
export type ImageTier = keyof typeof IMAGE_TIERS;

export interface GuestInvitePayload {
  salutation: string;
  name: string;
  relationship: RelationshipKey;
  count: number;
}

export const FALLBACK_GUEST: GuestInvitePayload = {
  salutation: 'bạn',
  name: 'bạn',
  relationship: 'other',
  count: 1,
};

export interface RsvpSubmission {
  fullName: string;
  phone: string;
  relationship: string;
  attendees: number;
}

export interface EventDetails {
  title: string;
  /** ISO-8601 local datetime, e.g. 2027-01-16T11:00:00+07:00 */
  datetime: string;
  venueName: string;
  hallName?: string;
  address: string;
  /** Google Maps link for THIS event (ceremony and reception can be at different places). Falls back to config.googleMapsUrl. */
  mapsUrl?: string;
  /** Path relative to dist/ of the auto-generated map preview image (written by the server, not edited by hand). */
  mapPreviewSrc?: string;
  /** Larger map image (same zoom, wider area) shown in the map popup. Server-owned like mapPreviewSrc. */
  mapPreviewLargeSrc?: string;
}

export interface WeddingConfig {
  groomName: string;
  brideName: string;
  groomParents: { father: string; mother: string; address: string };
  brideParents: { father: string; mother: string; address: string };
  headline: string;
  story: string;
  ceremony: EventDetails;
  reception: EventDetails;
  googleMapsUrl: string;
  googleMapsEmbedUrl?: string;
  /** Public base URL of the deployed static site, used for invite URLs + QR codes. */
  siteBaseUrl: string;
  /** Google Apps Script Web App URL receiving RSVP submissions. */
  rsvpWebhookUrl: string;
  /** Google Form receiving RSVP submissions (preferred over the webhook when formId is set). */
  rsvpForm: RsvpFormConfig;
  /** Wording of the scroll-driven envelope invitation (invite.html). Missing keys fall back to DEFAULT_INVITATION. */
  invitation?: Partial<InvitationContent>;
}

/** Editable texts of the envelope invitation page. Empty strings fall back to the defaults / derived values. */
export interface InvitationContent {
  /** Small caps line above the names on the closed envelope. */
  coverEyebrow: string;
  /** Hint under the wax seal telling guests to scroll. */
  openHint: string;
  /** Script title in the arch of the card that slides out of the envelope. */
  archTitle: string;
  /** Same title on the announcement page (index.html). */
  announceArchTitle: string;
  /** Monogram on the wax seal and closing card; empty = initials of the given names. */
  monogram: string;
  momentLine: string;
  scriptHeadline: string;
  joinLine: string;
  /** Uppercase lines under the guest name on the invitation card. */
  inviteLine: string;
  /** Script line on the invitation card; {khach} = the guest's salutation ("Quý vị" by default). */
  presenceLine: string;
  /** Script line at the bottom of the ceremony card. */
  ceremonyWelcome: string;
  /** City / place shown under the invitation; empty = last part of the reception address. */
  place: string;
  calendarTitle: string;
  countdownTitle: string;
  countdownDoneText: string;
  rsvpTitle: string;
  rsvpNote: string;
  closingTitle: string;
  closingNote: string;
  contact: string;
}

export interface RsvpFormConfig {
  formId: string;
  /** Google Form entry IDs (the number in `entry.<id>`). */
  entryFullName: string;
  entryPhone: string;
  entryRelationship: string;
  entryAttendees: string;
}

export type PhotoPlacement = 'hero' | 'story' | 'gallery' | 'rsvp_background' | 'invite_portrait' | 'static_map';

export interface ImageVariant {
  tier: ImageTier;
  format: 'webp' | 'jpg';
  width: number;
  height: number;
  /** Path relative to dist/ (e.g. assets/images/photo-01/photo-01-sm.webp) */
  src: string;
}

export interface PhotoRecord {
  id: string;
  caption: string;
  placement: PhotoPlacement;
  sortOrder: number;
  focalPoint?: { x: number; y: number } | null;
  /** Manual crop rectangle, normalized 0..1 relative to the EXIF-rotated original. Takes precedence over focalPoint. */
  crop?: CropRect | null;
  variants: ImageVariant[];
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One banquet table on the visual floor plan. Coordinates live in a SEATING_CANVAS-sized space. */
export interface SeatingTable {
  id: string;
  /** Display number (1-based, unique). */
  number: number;
  /** Center position in canvas units. */
  x: number;
  y: number;
  /** Area (zone) this table belongs to, or null when unassigned. */
  zoneId: ZoneId | null;
}

export interface SeatingLayout {
  version: 1;
  tables: SeatingTable[];
}

/** Floor plan canvas: stage across the top, main aisle down the middle. */
export const SEATING_CANVAS = { width: 1000, height: 700, stage: { x: 300, y: 20, w: 400, h: 70 }, aisle: { x: 470, w: 60, top: 100 } } as const;

export interface GuestRecord {
  rowId: string;
  shortId: string;
  /** URL slug for invite.html?khach=<slug>; derived from name + relationship by WeddingDb.listGuests(). */
  slug?: string;
  token: string;
  salutation: string;
  name: string;
  relationship: RelationshipKey;
  count: number;
  phone?: string;
  email?: string;
  status?: 'PENDING' | 'GENERATED' | 'SENT';
}

export interface WeddingData {
  config: WeddingConfig;
  photos: PhotoRecord[];
  seatingZones: SeatingZone[];
  /** Visual floor plan; null = legacy zone-only rendering. */
  seatingLayout?: SeatingLayout | null;
  guests: GuestRecord[];
}
