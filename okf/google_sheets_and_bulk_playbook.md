---
type: playbook
title: "google_sheets_and_bulk_playbook"
description: "Operational playbook and technical protocol for Google Sheets unique-phone RSVP upserts, local backend guest synchronization, and bulk JPEG card generation/dispatch."
resource: "okf://wedding-webapp/google-sheets-and-bulk-playbook"
tags: [google-sheets, apps-script, rsvp, unique-phone, bulk-jpg, dispatch]
timestamp: 2026-11-14T18:52:00Z
---

# google_sheets_and_bulk_playbook

This playbook governs how the static RSVP page (`dist/rsvp.html`) persists guest registrations into Google Sheets using phone number as a unique key, and how the local backend processes the Google Sheet guest list to generate and dispatch personalized JPEG invitation cards at scale. Linked to [[domain_glossary]] and [[invitation_and_seating_rules]].

## 1. Google Spreadsheet Schema

A single Google Spreadsheet hosts two worksheets:

### Worksheet 1: `RSVP_Responses`
Stores submissions from `dist/rsvp.html`.
- **Column A (`Phone_Unique`)**: Normalized 10-digit Vietnamese phone number (`0xxxxxxxxx`), stored as plain text (prefixed with `'` in Apps Script) and enforced as the **Unique Primary Key**.
- **Column B (`Full_Name`)**: Guest's submitted full name.
- **Column C (`Relationship`)**: One of the 7 relationship labels from [[domain_glossary]].
- **Column D (`Attendees_Count`)**: Positive integer (`1..20`).
- **Column E (`Created_At`)**: ISO-8601 timestamp of initial submission.
- **Column F (`Updated_At`)**: ISO-8601 timestamp of most recent upsert.

### Worksheet 2: `Invitation_List`
Curated guest roster managed by the couple for bulk invitation generation.
- **Column A (`Row_ID`)**: Unique row identifier.
- **Column B (`Salutation`)**: Honorific phrase (e.g., `chú thím`).
- **Column C (`Guest_Name`)**: Addressed name phrase (e.g., `vợ chồng chú Chín`).
- **Column D (`Relationship`)**: Relationship group (e.g., `gia đình cô dâu`).
- **Column E (`Count`)**: Invited seat count (e.g., `2`).
- **Column F (`Phone`)**: Guest phone number for Zalo/SMS lookup.
- **Column G (`Email`)**: Guest email address for automated SMTP dispatch.
- **Column H (`Short_ID`)**: Populated by local backend (e.g., `c9a2f1`).
- **Column I (`Invite_URL`)**: Populated by local backend (`https://.../invite.html?id=c9a2f1`).
- **Column J (`Card_JPG_Status`)**: `PENDING` | `GENERATED` | `SENT`.

## 2. Google Apps Script Webhook Protocol (`doPost`)

1. **CORS-Safe Transport**: `dist/rsvp.html` sends an HTTP `POST` request with `Content-Type: text/plain;charset=utf-8` containing a JSON payload so browsers do not fail on preflight OPTIONS requests to `script.google.com`.
2. **Concurrency Lock**: The script acquires `LockService.getScriptLock().waitLock(10000)` before reading or mutating `RSVP_Responses`.
3. **Unique Phone Upsert**:
   - Normalizes incoming `phone` via the rule in [[invitation_and_seating_rules]].
   - Scans Column A (`Phone_Unique`). If a matching row exists, updates Columns `B`, `C`, `D`, and `F` in-place (`operation: "UPDATED"`).
   - If no match exists, appends a new row (`operation: "INSERTED"`).

## 3. Bulk Invitation Studio Workflow (Local Backend)

1. **Pull Roster**: Local backend calls the Apps Script endpoint (`action: "SYNC_INVITATION_LIST"`) to fetch all rows from `Invitation_List`.
2. **Encode & Rebuild Static Lookup**: Computes `shortId` and `compactToken` for each row, updates local SQLite `guests` table, and triggers the static builder to refresh `dist/assets/data/guests-map.json`.
3. **Batch Render JPEG Cards**: Renders a `1080x1620` JPEG file per guest (`output/invitations-jpg/<Row_ID>_<Short_ID>_<Slug>.jpg`) using the shared SVG template and `sharp`.
4. **Bulk Dispatch**:
   - **Automated Email Batch**: Sends personalized HTML emails with the guest's `.jpg` card attached for all rows with a valid `Email`.
   - **1-Click Zalo/Messenger Assist**: Provides one-click buttons in the local CMS UI to copy the rendered `.jpg` image (or greeting + short URL) to the system clipboard and open `https://zalo.me/<phoneNormalized>` so personal messaging accounts are never flagged or banned by anti-bot systems.
