# Spec Delta

## Purpose

Encodes, shortens, and decodes personalized guest metadata (`salutation`, `name`, `relationship`, `count`) in URL parameters, formats standard Vietnamese wedding invitation sentences, and maps guest groups and seat counts to reception hall seating zones.

## ADDED Requirements

### Requirement: Hybrid Guest URL Encoding and Decoding
The system SHALL encode and decode the 4 guest fields (`salutation`, `name`, `relationship`, `count`) using both a self-contained Base64URL token (`?g=<token>`) and a shortened 6-character hex identifier (`?id=<shortId>`) resolved via the static lookup map.

#### Scenario: Round-trip encoding and decoding of Vietnamese guest payload
- **GIVEN** a guest payload with salutation `"chú thím"`, name `"vợ chồng chú Chín"`, relationship `"gia đình cô dâu"`, and count `2`
- **WHEN** the payload is encoded into a `?g=` compact token and subsequently decoded
- **THEN** the decoded result SHALL match salutation `"chú thím"`, name `"vợ chồng chú Chín"`, relationship `"gia đình cô dâu"` (`bride_family`), and count `2` with all Vietnamese diacritics intact

#### Scenario: Resolving guest payload from a shortened URL identifier
- **GIVEN** `guests-map.json` contains an entry mapping short ID `"c9a2f1"` to the compact token for `"vợ chồng chú Chín"`
- **WHEN** a user opens `invite.html?id=c9a2f1`
- **THEN** the system SHALL resolve `"c9a2f1"` against `guests-map.json` and return the complete 4-field guest payload

#### Scenario: Graceful fallback on missing or corrupted URL parameter
- **GIVEN** a user opens `invite.html` with a malformed `?g=invalid` parameter
- **WHEN** the URL decoder parses the query string
- **THEN** the system SHALL return the fallback payload (`salutation: "quý khách"`, `name: "quý khách và gia đình"`, `relationship: "other"`, `count: 1`) without throwing a runtime error

### Requirement: Standard Vietnamese Invitation Copy Formatting
The system SHALL generate the personalized invitation sentence following the pattern `"Kính mời {name} đến chung vui cùng gia đình chúng tôi, sự hiện diện của {salutation} là niềm vinh hạnh cho gia đình."`

#### Scenario: Formatting the canonical golden invitation sentence
- **GIVEN** a guest with salutation `"chú thím"` and name `"vợ chồng chú Chín"`
- **WHEN** the invitation copy formatter runs
- **THEN** the system SHALL return `"Kính mời vợ chồng chú Chín đến chung vui cùng gia đình chúng tôi, sự hiện diện của chú thím là niềm vinh hạnh cho gia đình."`

### Requirement: Reception Seating Zone Routing
The system SHALL map a guest's `relationship` group and `count` to the corresponding seating zone on the reception hall floor plan and generate seat guidance text.

#### Scenario: Routing bride-family guests to their seating zone
- **GIVEN** a guest with relationship `"gia đình cô dâu"` and count `2`
- **WHEN** the seating mapper computes the seating assignment
- **THEN** the system SHALL assign zone `ZONE_B1` on the right side of the stage, apply the Lotus Pink highlight color (`#EC4899`), and output seat guidance specifying `2` reserved seats
