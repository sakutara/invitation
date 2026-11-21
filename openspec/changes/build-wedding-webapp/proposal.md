# Proposal

## Why

We need a complete Vietnamese Wedding Webapp that combines a local-only CMS and SQLite database for rich content, photo, and guest management with an automatic static HTML build pipeline (Formidable-style) for zero-cost, infinitely scalable public hosting. The system must handle fluid responsive design (`360px` to `1920px` FullHD), smooth parallax scrolling across three distinct pages (Announcement, RSVP, and Personalized Invitation), Google Sheets RSVP persistence with unique phone number enforcement, reception seating zone highlighting, and downloadable/shareable personalized JPEG invitation cards.

## What Changes

- Introduce a local-only CMS backend and SQLite datastore that automatically compiles all wedding copy, dynamic photo galleries, seating charts, and guest lookup maps into static HTML/CSS/JS bundles whenever backend data changes.
- Introduce an automated smart image processing pipeline (`sharp`) for focal-point cropping and multi-resolution WebP/JPEG generation, paired with a `1080x1620` JPEG invitation card renderer.
- Introduce two-way Google Sheets integration via Google Apps Script (`doPost`) enforcing phone number uniqueness on RSVP submissions and supporting bulk JPEG invitation generation and dispatch.
- Introduce a hybrid guest URL codec (`?g=<base64url>` self-contained token and `?id=<shortId>` static lookup), deterministic Vietnamese greeting copy generator, and reception seating zone mapper.
- Introduce three static frontend pages (`index.html` Announcement, `rsvp.html` No-Scroll Registration, and `invite.html` Personalized Invitation) styled in Navy (`#0F2042`) and Burgundy (`#7A1C24`) with Sky Blue, Lotus Pink, White, and Black accents, parallax section transitions, and client-side JPEG download/mobile sharing.

## Capabilities

### New Capabilities
- `cms-and-static-builder`: Local CMS backend, SQLite persistence for text, events, dynamic wedding photos, and seating zones, and automatic static HTML compilation on every backend mutation.
- `smart-image-and-card-pipeline`: Automated photo orientation normalization, smart focal-point cropping, responsive multi-size image generation, and `1080x1620` JPEG wedding invitation card rendering.
- `google-sheets-and-bulk-dispatch`: Google Sheets webhook upsert using normalized phone number as a unique key, guest roster synchronization, and bulk JPEG card generation and dispatch tooling.
- `guest-url-codec-and-seating`: Compact URL encoding/shortening of guest metadata (`salutation`, `name`, `relationship`, `count`), standard Vietnamese invitation sentence formatting, and reception seating zone routing.
- `wedding-frontend-pages`: Fluid responsive (`360px` to `1920px`) and parallax-enabled Announcement (`index.html`), single-viewport RSVP (`rsvp.html`), and Personalized Invitation (`invite.html`) pages with client-side JPEG save and Web Share API integration.

### Modified Capabilities

## Impact

- Creates `okf/` knowledge bundle (`index.md`, `domain_glossary.md`, `design_tokens.md`, `invitation_and_seating_rules.md`, `google_sheets_and_bulk_playbook.md`).
- Creates `src/shared/`, `src/backend/`, `src/frontend/`, `src/gas/Code.gs`, `tests/unit/`, `tests/integration/`, `tests/e2e/`, and static output directory `dist/`.
