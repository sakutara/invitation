---
type: policy
title: "invitation_and_seating_rules"
description: "Deterministic business rules for Vietnamese invitation copy formatting, phone normalization, hybrid URL encoding/shortening, and reception seating zone routing."
resource: "okf://wedding-webapp/invitation-and-seating-rules"
tags: [business-rules, url-codec, seating-map, greeting-copy, phone-normalization]
timestamp: 2026-11-14T18:52:00Z
---

# invitation_and_seating_rules

This policy defines the deterministic algorithms for formatting personalized Vietnamese wedding invitations, normalizing phone numbers, encoding/decoding guest URLs, and routing guests to reception seating zones. Linked to [[domain_glossary]] and [[design_tokens]].

## 1. Personalized Invitation Copy Rule

### Template
```text
Kính mời {name} đến chung vui cùng gia đình chúng tôi, sự hiện diện của {salutation} là niềm vinh hạnh cho gia đình.
```

### Normalization Rules
1. Trim leading/trailing whitespace and collapse repeated internal spaces in both `{name}` and `{salutation}`.
2. Preserve proper-noun capitalization inside `{name}` (e.g., `"vợ chồng chú Chín"` retains capital `"Chín"`).
3. Lowercase the leading character of `{salutation}` when inserted mid-sentence after `"sự hiện diện của "` (e.g., `"Chú Thím"` becomes `"chú thím"`, `"Anh Chị"` becomes `"anh chị"`).
4. **Fallback Default**: If guest parameters are missing or malformed, default to `name = "bạn"` and `salutation = "bạn"`. In that case the seating map is still shown but without a highlighted zone or table guidance.

### Golden Verification Case
- **Input**: `salutation = "chú thím"`, `name = "vợ chồng chú Chín"`
- **Expected Output**:
  `"Kính mời vợ chồng chú Chín đến chung vui cùng gia đình chúng tôi, sự hiện diện của chú thím là niềm vinh hạnh cho gia đình."`

## 2. Vietnamese Phone Number Normalization Rule

Used by both the client-side RSVP form validation (`dist/rsvp.html`) and the Google Apps Script unique-key upsert in [[google_sheets_and_bulk_playbook]]:
1. Strip all spaces, hyphens `-`, dots `.`, and parentheses `(`, `)`.
2. Replace a leading `+84` prefix with `0`.
3. If the string starts with `84` and is exactly 11 digits long, replace the leading `84` with `0`.
4. Validate against the regular expression `/^0[235789][0-9]{8}$/`.

## 3. Hybrid Guest URL Codec Rule (`?g=` and `?id=`)

Because `dist/invite.html` is deployed as a static file without a runtime database server, the system supports two complementary URL parameter formats:

### Mode A: Self-Contained Compact Token (`invite.html?g=<base64url>`)
- Serializes a 4-element JSON array: `[salutation, name, relationshipCompactCode, count]` where `relationshipCompactCode` is the integer `1..7` from [[domain_glossary]].
- Encodes the UTF-8 byte sequence using **Base64URL** (no `=` padding, `-` instead of `+`, `_` instead of `/`).
- Works immediately for ad-hoc guests even without rebuilding the static site.

### Mode B: Static Short ID Lookup (`invite.html?id=<shortId>`)
- Computes a deterministic 6-character lowercase hex digest (`^[0-9a-f]{6}$`) from the normalized phone number (or `salutation|name|relationshipKey` if phone is absent) using SHA-256 prefixing.
- During every static build, the local backend emits `dist/assets/data/guests-map.json` mapping `{ "<shortId>": "<compactToken>" }`.
- When a guest opens `invite.html?id=c9a2f1`, the client looks up `guests-map.json`, retrieves the corresponding `compactToken`, and decodes the 4 guest fields.

## 4. Reception Hall Seating Allocation Rule

Both `relationship` and `count` determine the highlighted zone and seat guidance on the interactive reception SVG map (`dist/invite.html`) and on the exported JPEG card:

| Zone ID | Relationship Key | Vietnamese Zone Name | Hall Side | Default Table Range | Highlight Color Token |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `ZONE_A1` | `groom_family` | Khu A1 - Gia đình & Họ hàng Chú Rể | Left (Near Stage) | `Bàn 01 - Bàn 03` | `accentSkyBlue` (`#38BDF8`) |
| `ZONE_B1` | `bride_family` | Khu B1 - Gia đình & Họ hàng Cô Dâu | Right (Near Stage) | `Bàn 04 - Bàn 06` | `accentLotusPink` (`#EC4899`) |
| `ZONE_A3` | `groom_parents_friends` | Khu A2 - Khách mời Bố Mẹ Chú Rể | Left (Middle Row) | `Bàn 07 - Bàn 10` | `accentSkyBlue` (`#38BDF8`) |
| `ZONE_B3` | `bride_parents_friends` | Khu B2 - Khách mời Bố Mẹ Cô Dâu | Right (Middle Row) | `Bàn 11 - Bàn 14` | `accentLotusPink` (`#EC4899`) |
| `ZONE_A2` | `groom_friends` | Khu A3 - Bạn bè & Đồng nghiệp Chú Rể | Left (Lower Row) | `Bàn 15 - Bàn 18` | `accentSkyBlue` (`#38BDF8`) |
| `ZONE_B2` | `bride_friends` | Khu B3 - Bạn bè & Đồng nghiệp Cô Dâu | Right (Lower Row) | `Bàn 19 - Bàn 22` | `accentLotusPink` (`#EC4899`) |
| `ZONE_C1` | `other` | Khu C1 - Khu vực Khách Quý Chung | Center | `Bàn 23 - Bàn 24` | `primaryBurgundy` (`#7A1C24`) |

### Seat Guidance Copy Template
```text
Ban tổ chức đã chuẩn bị {count} chỗ ngồi tại {zoneNameVi} ({tableRange}). Khi đến sảnh, {salutation} vui lòng di chuyển theo lối đi chính về phía {sideLabelVi}.
```
