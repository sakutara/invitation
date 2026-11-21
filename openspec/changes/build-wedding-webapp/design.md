# Design

## Context

See `proposal.md` for motivation. The system must operate in two distinct environments:
1. **Authoring & Bulk Processing Environment (Local Machine only)**: A Node.js/TypeScript backend backed by SQLite (`data/wedding.db`) where the couple edits text, uploads wedding photos, configures seating zones, syncs Google Sheets, and exports bulk JPEG invitations.
2. **Public Guest Environment (Static Hosting)**: Purely static HTML/CSS/JS files emitted into `dist/` that require zero backend server at runtime while still supporting personalized URLs, interactive seating charts, client-side JPEG export, and Google Sheets RSVP persistence.

Domain terminology, design tokens, and business rules are canonically documented in the Open Knowledge Format (OKF) bundle under `okf/` (`[[domain_glossary]]`, `[[design_tokens]]`, `[[invitation_and_seating_rules]]`, `[[google_sheets_and_bulk_playbook]]`).

## Goals / Non-Goals

**Goals:**
- Sub-500ms automatic static site compilation (`dist/`) triggered whenever local SQLite state changes.
- Zero runtime database dependency for deployed static pages (`index.html`, `rsvp.html`, `invite.html`).
- Deterministic parity between server-side bulk JPEG cards and client-side downloaded/shared JPEG cards.
- Strict TDD execution where every capability is verified by automated unit, integration, and Playwright E2E tests.

**Non-Goals:**
- Public cloud hosting of the Node.js/SQLite CMS backend (strictly local-only).
- Unofficial third-party bot scraping or automated headless login to personal Zalo/Messenger accounts (to prevent account bans; solved via 1-Click Clipboard + Deep-Link Assist and automated SMTP email).

## Decisions

### 1. Declarative Auto-Static Builder on SQLite Mutation
- **Decision**: Wrap all SQLite write operations in `src/backend/db.ts` with a debounced (`100ms`) mutation hook that automatically triggers `StaticBuilder.build(distDir)`.
- **Rationale**: Mirrors the Formidable-style automatic static compilation requested by the user so `dist/` is always deploy-ready immediately after any CMS edit.
- **Alternatives Considered**: Manual CLI build step only — rejected because the user explicitly requested automatic compilation on every backend change.

### 2. Hybrid Guest URL Codec (`?g=<base64url>` + `?id=<shortId>`)
- **Decision**: Support both a self-contained Base64URL-encoded 4-tuple `[salutation, name, relationshipCode, count]` (`?g=`) and a 6-character SHA-256 hex prefix (`?id=`) resolved against `dist/assets/data/guests-map.json`.
- **Rationale**: Pure UTF-8 compression of Vietnamese strings requires ~35–55 characters without a lookup table. Pre-Synced guests from Google Sheets get ultra-short 6-character URLs (`?id=c9a2f1`), while ad-hoc guests invited after deployment still work seamlessly via `?g=`.

### 3. Google Apps Script (`doPost`) Webhook for Unique-Phone RSVP
- **Decision**: Submit RSVP payloads as `text/plain;charset=utf-8` JSON to a Google Apps Script Web App bound to the Google Spreadsheet, using `LockService` and normalized 10-digit Vietnamese phone numbers (`0xxxxxxxxx`) to upsert rows in-place.
- **Rationale**: Native Google Forms cannot enforce unique phone numbers or update existing rows upon resubmission, and direct browser calls to Google Forms suffer from CORS restrictions.

### 4. Shared SVG Master Template for `1080x1620` JPEG Cards
- **Decision**: Implement a pure TypeScript SVG builder (`src/shared/card-svg-template.ts`) consumed by `sharp` on the local backend (for batch rendering hundreds of `.jpg` files in seconds) and by `<canvas>` + `toBlob('image/jpeg', 0.92)` on the client browser (for instant download and `navigator.share`).
- **Rationale**: Guarantees 100% visual consistency between batch-generated cards and guest-downloaded cards without requiring Puppeteer for batch rendering.

## Risks / Trade-offs

- **[Risk] High-saturation secondary colors (Sky Blue `#38BDF8`, Lotus Pink `#EC4899`) clashing with Primary Navy (`#0F2042`) and Burgundy (`#7A1C24`)** → **Mitigation**: Enforce the 90/10 visual ratio in `okf/design_tokens.md` where Navy, Burgundy, Ivory, and Charcoal form 90% of the card surfaces, while Sky Blue and Lotus Pink are used exclusively as groom-side and bride-side group badges and seating zone highlights.
- **[Risk] iOS Safari / In-App Browser (Zalo WebView) Web Share API limitations** → **Mitigation**: Feature-detect `navigator.canShare({ files })`; when unsupported, automatically fall back to direct `<a download="Thiep-Moi-....jpg">` file download.
