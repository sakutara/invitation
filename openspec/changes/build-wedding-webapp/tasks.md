# Tasks

## 1. Project Scaffolding and OKF Bundle Verification

- [x] 1.1 Initialize `package.json`, `tsconfig.json`, `vitest.config.ts`, and `playwright.config.ts` and verify `npm test` executes cleanly.
- [x] 1.2 Implement shared TypeScript domain interfaces in `src/shared/types.ts` aligned with `okf/domain_glossary.md` and `okf/design_tokens.md` and verify `tests/unit/okf-bundle.test.ts` passes.

## 2. Guest URL Codec, Greeting Formatter, and Seating Mapper (TDD)

- [x] 2.1 Write unit tests in `tests/unit/phone-normalizer.test.ts` and implement `src/shared/phone-normalizer.ts` so all Vietnamese phone normalization scenarios pass.
- [x] 2.2 Write unit tests in `tests/unit/guest-codec.test.ts` and implement `src/shared/guest-codec.ts` supporting both `?g=<base64url>` and `?id=<shortId>` resolution for the golden case (`"chú thím"`, `"vợ chồng chú Chín"`, `"gia đình cô dâu"`, `2`).
- [x] 2.3 Write unit tests in `tests/unit/invitation-seating.test.ts` and implement `src/shared/invitation-formatter.ts` and `src/shared/seating-mapper.ts`, verifying exact greeting output and reception seating zone routing.

## 3. Smart Image Pipeline and JPEG Card Renderer (TDD)

- [x] 3.1 Write integration tests in `tests/integration/image-processor.test.ts` and implement `src/backend/image-processor.ts` using `sharp` for EXIF rotation, focal-point cropping, and multi-size (`640w`, `1024w`, `1440w`, `1920w`) WebP/JPEG generation.
- [x] 3.2 Write tests in `tests/integration/card-renderer.test.ts` and implement `src/shared/card-svg-template.ts` and `src/backend/bulk-card-generator.ts` to render `1080x1620` JPEG invitation cards and verify valid JPEG output bytes and dimensions.

## 4. Local CMS Backend, SQLite Store, and Auto-Static Builder (TDD)

- [x] 4.1 Write integration tests in `tests/integration/static-builder.test.ts` and implement `src/backend/db.ts` and `src/backend/static-builder.ts`, verifying that any database update automatically rebuilds `dist/index.html`, `dist/rsvp.html`, `dist/invite.html`, `dist/assets/data/wedding-data.json`, and `dist/assets/data/guests-map.json`.
- [x] 4.2 Write API integration tests in `tests/integration/cms-api.test.ts` and implement `src/backend/server.ts` with local CMS endpoints (`GET/PUT /api/config`, `POST/PUT/DELETE /api/photos`, `PUT /api/seating-zones`, `POST /api/build`).

## 5. Google Sheets Unique-Phone RSVP and Bulk Invitation Studio (TDD)

- [x] 5.1 Write unit tests in `tests/unit/sheets-sync.test.ts` and implement `src/gas/Code.gs` and `src/backend/sheets-sync.ts`, verifying unique-phone RSVP upserts (`INSERTED` vs `UPDATED`) and guest roster synchronization.
- [x] 5.2 Add bulk invitation endpoints and 1-Click Zalo/Messenger/Email dispatch helpers to `src/backend/server.ts` and verify batch `.jpg` card export in `tests/integration/bulk-dispatch.test.ts`.

## 6. Static Frontend Pages, Fluid Layout, Parallax, and Client JPEG Share (TDD)

- [x] 6.1 Implement the CSS design system in `src/frontend/styles/main.css` (Navy `#0F2042`, Burgundy `#7A1C24`, Sky Blue `#38BDF8`, Lotus Pink `#EC4899`, Ivory `#FDFBF7`, Black `#111827`, fluid `clamp()` tokens) and `src/frontend/scripts/parallax.ts`, verifying unit tests in `tests/unit/parallax.test.ts`.
- [x] 6.2 Implement the Announcement page template (`src/frontend/templates/index.template.ts`) with parallax sections, dynamic photo gallery grid, and RSVP CTA.
- [x] 6.3 Implement the single-viewport No-Scroll RSVP page (`src/frontend/templates/rsvp.template.ts`, `src/frontend/scripts/rsvp.ts`) with 4-field validation, unique-phone webhook submission, thank-you view, and auto-return to `index.html`.
- [x] 6.4 Implement the Personalized Invitation page (`src/frontend/templates/invite.template.ts`, `src/frontend/scripts/invite.ts`) with URL decoding, custom greeting, Google Maps + static map image, highlighted SVG seating chart, and `1080x1620` JPEG download/Web Share API integration.
- [x] 6.5 Run the Playwright end-to-end verification suite in `tests/e2e/wedding-webapp.spec.ts` across Mobile (`390x844`) and FullHD (`1920x1080`) viewports and verify all E2E tests pass.
