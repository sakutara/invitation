# Google Sheets and Bulk Dispatch Specification

## Purpose

Manages RSVP submissions into a Google Spreadsheet with normalized Vietnamese phone numbers enforced as unique keys, and synchronizes the Google Sheet guest roster with the local backend for bulk JPEG invitation generation and dispatch.

## Requirements

### Requirement: RSVP Upsert by Unique Normalized Phone Number
The system SHALL normalize submitted phone numbers to standard 10-digit Vietnamese format (`0xxxxxxxxx`) and upsert RSVP records in the Google Spreadsheet so that duplicate phone numbers update the existing row rather than inserting a duplicate row.

#### Scenario: First-time RSVP submission with a new phone number
- **GIVEN** the Google Spreadsheet `RSVP_Responses` does not contain phone number `0905123456`
- **WHEN** a guest submits fullName `"Nguyễn Văn An"`, phone `"+84 905 123 456"`, relationship `"bạn bè chú rể"`, and attendees `2`
- **THEN** the system SHALL normalize the phone to `"0905123456"` and append a new row with operation status `"INSERTED"`

#### Scenario: Repeat RSVP submission with an existing phone number
- **GIVEN** the Google Spreadsheet `RSVP_Responses` already contains a row with `Phone_Unique` equal to `"0905123456"` and attendees `1`
- **WHEN** the guest submits updated fullName `"Vợ chồng Nguyễn Văn An"`, phone `"0905-123-456"`, relationship `"bạn bè chú rể"`, and attendees `2`
- **THEN** the system SHALL update the existing row for `"0905123456"` in-place to attendees `2` and return operation status `"UPDATED"` without increasing the total row count

### Requirement: Guest Roster Synchronization and Bulk JPEG Generation
The system SHALL synchronize the `Invitation_List` worksheet from Google Sheets into the local backend, generate short IDs and personalized `1080x1620` JPEG invitation files in bulk for all listed guests, and write the generated invitation URLs back to the spreadsheet.

#### Scenario: Running bulk invitation processing for a spreadsheet guest roster
- **GIVEN** the `Invitation_List` worksheet contains 50 guest rows with salutation, name, relationship, and count
- **WHEN** the administrator triggers bulk processing in the local backend
- **THEN** the system SHALL generate 50 personalized `.jpg` cards on disk, update `dist/assets/data/guests-map.json` with all 50 short IDs, and populate the `Short_ID` and `Invite_URL` columns in Google Sheets
