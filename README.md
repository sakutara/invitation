# Wedding Webapp

Local CMS (SQLite) → auto-built static site in `dist/` (`/` → `index.html`, `/thiep-moi/`, `/dang-ky/`;
the old `invite.html` / `rsvp.html` only redirect, keeping `?khach=…`).
Specs: `openspec/`, domain rules: `okf/`, plan: `PLAN.md`.

## Commands

```bash
npm install
npm run dev        # local CMS + Bulk Studio at http://127.0.0.1:4321 (auto-rebuilds dist/ on every change)
npm run build      # one-off build of data/wedding.db into dist/
npm test           # unit + integration (vitest)
npm run test:e2e   # Playwright, Mobile 390x844 + FullHD 1920x1080
npm run typecheck
```

Background music: upload tracks in the CMS (**Nhạc nền**). They are copied to `dist/assets/music/` and play in
order on the announcement and invitation pages (browsers that block autoplay start on the first tap).

Deploy by uploading `dist/` to any static host. `data/` (SQLite, original photos) stays on your machine.

## Google Sheets (RSVP + guest roster)

1. Create a spreadsheet, open **Extensions → Apps Script**, paste `src/gas/Code.gs`.
2. **Project Settings → Script Properties**: add `ADMIN_TOKEN` = a long random string.
3. **Deploy → New deployment → Web app** (Execute as: Me, Access: Anyone). Copy the `/exec` URL.
4. In the CMS, set `rsvpWebhookUrl` to that URL and `siteBaseUrl` to your public site URL.
5. Fill the `Invitation_List` sheet (created on first sync) with columns
   `Row_ID, Salutation, Guest_Name, Relationship, Count, Phone, Email`.

The RSVP form only uses the public upsert action. Roster sync / write-back require the admin token,
so guest phone numbers and emails are never exposed through the public URL.

## Environment variables (local CMS)

| Variable | Purpose |
| --- | --- |
| `SHEETS_ADMIN_TOKEN` | Same value as the Apps Script `ADMIN_TOKEN` (required for Bulk Studio sync) |
| `SHEETS_WEBHOOK_URL` | Optional override of `config.rsvpWebhookUrl` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Bulk email dispatch |
| `PORT`, `WEDDING_DB`, `WEDDING_DIST`, `WEDDING_MEDIA` | Paths/port overrides |

Bulk JPEG cards are written to `output/invitations-jpg/<Row_ID>_<Short_ID>_<slug>.jpg`.
