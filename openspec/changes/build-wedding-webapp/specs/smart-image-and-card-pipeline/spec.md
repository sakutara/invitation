# Spec Delta

## Purpose

Automates wedding photo orientation normalization, smart focal-point cropping, and multi-resolution responsive image generation (`640w` to `1920w`), and renders personalized `1080x1620` JPEG wedding invitation cards for both batch backend export and client-side saving.

## ADDED Requirements

### Requirement: Smart Cropping and Responsive Multi-Size Image Generation
The system SHALL normalize EXIF orientation, apply attention-aware or focal-point cropping, and generate WebP and JPEG variants at `640px`, `1024px`, `1440px`, and `1920px` widths for every uploaded wedding photo.

#### Scenario: Processing a high-resolution wedding photograph
- **GIVEN** an uploaded wedding image with dimensions `3000x2000` pixels
- **WHEN** the image pipeline processes the file
- **THEN** the system SHALL output 4 width tiers (`sm: 640px`, `md: 1024px`, `lg: 1440px`, `fhd: 1920px`) in both `.webp` and `.jpg` formats while preserving the subject focal region

#### Scenario: Preserving full geometry for static direction maps
- **GIVEN** an image uploaded with placement `static_map`
- **WHEN** the image pipeline optimizes the file
- **THEN** the system SHALL compress and resize the image without cropping out any edge details of the map

### Requirement: Personalized JPEG Invitation Card Rendering
The system SHALL render a summarized `1080x1620` pixel JPEG wedding invitation card containing the couple names, wedding date, personalized greeting copy, event schedule, venue address, highlighted seating zone chart, seat count, and QR code.

#### Scenario: Rendering a personalized JPEG card for a bride-family guest
- **GIVEN** guest metadata with salutation `"chú thím"`, name `"vợ chồng chú Chín"`, relationship `"gia đình cô dâu"`, and count `2`
- **WHEN** the card renderer generates the invitation image
- **THEN** the output SHALL be a valid JPEG file of `1080x1620` pixels containing the exact Vietnamese invitation sentence, highlighting `ZONE_B1` in Lotus Pink (`#EC4899`), and indicating `2` reserved seats
