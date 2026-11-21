---
type: glossary
title: "domain_glossary"
description: "Canonical domain glossary for Vietnamese wedding pages, the 7 guest relationship groups, honorific salutations, and guest payload schemas."
resource: "okf://wedding-webapp/domain-glossary"
tags: [wedding, glossary, relationships, salutations, entities]
timestamp: 2026-11-14T18:52:00Z
---

# domain_glossary

The `domain_glossary` defines the canonical entities, Vietnamese wedding terminology, and enumerated relationship groups shared across the local CMS backend, static frontend pages, and Google Sheets integration.

## Core Pages

| Page ID | Output File | Vietnamese Title | Primary Purpose |
| :--- | :--- | :--- | :--- |
| `announcement` | `dist/index.html` | Trang Báo Hỉ | Main public landing page announcing the wedding, showcasing the dynamic wedding photo gallery, displaying ceremony/reception schedules, and linking to the RSVP page. |
| `rsvp` | `dist/rsvp.html` | Trang Đăng Ký | Single-viewport (`100dvh`, no vertical scroll) registration form over a wedding photo background that collects 4 guest fields and upserts to Google Sheets by unique phone number. |
| `invitation` | `dist/invite.html` | Trang Mời Cưới | Personalized wedding invitation page driven by encoded/shortened URL parameters, rendering custom greeting copy, static + Google Maps directions, highlighted seating zone map, and JPEG card export/share. |

## Canonical Relationship Groups (7 Groups)

Every guest registration in `dist/rsvp.html` and every personalized invitation in `dist/invite.html` MUST map to one of these 7 relationship groups. See [[invitation_and_seating_rules]] for how each group maps to a seating zone and [[design_tokens]] for badge color assignments.

| Compact Code | Enum Key | Vietnamese Label (Lowercase) | Display Label (Vietnamese) | Side | Default Seating Zone | Accent Token |
| :---: | :--- | :--- | :--- | :---: | :---: | :--- |
| `1` | `groom_family` | `gia đình chú rể` | Gia đình chú rể | Groom | `ZONE_A1` | `accentSkyBlue` |
| `2` | `bride_family` | `gia đình cô dâu` | Gia đình cô dâu | Bride | `ZONE_B1` | `accentLotusPink` |
| `3` | `groom_friends` | `bạn bè chú rể` | Bạn bè chú rể | Groom | `ZONE_A2` | `accentSkyBlue` |
| `4` | `bride_friends` | `bạn bè cô dâu` | Bạn bè cô dâu | Bride | `ZONE_B2` | `accentLotusPink` |
| `5` | `groom_parents_friends` | `bạn bè gia đình chú rể` | Bạn bè gia đình chú rể | Groom | `ZONE_A3` | `accentSkyBlue` |
| `6` | `bride_parents_friends` | `bạn bè gia đình cô dâu` | Bạn bè gia đình cô dâu | Bride | `ZONE_B3` | `accentLotusPink` |
| `7` | `other` | `khác...` | Khác... | Shared | `ZONE_C1` | `primaryBurgundy` |

## Vietnamese Honorific Salutations (`salutation` vs `name`)

Vietnamese wedding invitations distinguish between:
- **`salutation`**: The pronoun/honorific phrase addressing the guest(s) (e.g., `"chú thím"`, `"cô chú"`, `"anh chị"`, `"anh"`, `"chị"`, `"bạn"`, `"em"`, `"hai bác"`).
- **`name`**: The addressed title + given name (without family surname) used after *"Kính mời"* (e.g., `"vợ chồng chú Chín"`, `"vợ chồng anh Tuấn"`, `"bạn Nam và người thương"`).

### Canonical Golden Example
- **`salutation`**: `"chú thím"`
- **`name`**: `"vợ chồng chú Chín"`
- **`relationship`**: `"gia đình cô dâu"` (`bride_family`, compact code `2`)
- **`count`**: `2`

## Core Data Contracts

### `GuestInvitePayload`
- `salutation` (`string`): Honorific used in the second clause of the invitation sentence.
- `name` (`string`): Addressed guest phrase used in the opening clause of the invitation sentence.
- `relationship` (`RelationshipKey | string`): Either the English enum key (`bride_family`) or the Vietnamese label (`gia đình cô dâu`).
- `count` (`number`): Integer between `1` and `20` indicating the number of reserved seats.

### `RsvpSubmission`
- `fullName` (`string`): Full name of the guest submitting the RSVP form.
- `phone` (`string`): Phone number input, normalized to `0xxxxxxxxx` as the unique key in [[google_sheets_and_bulk_playbook]].
- `relationship` (`string`): One of the 7 canonical relationship groups.
- `attendees` (`number`): Integer `>= 1` indicating how many people will attend.
