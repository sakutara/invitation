# Spec Delta

## Purpose

Provides a local-only content management backend and SQLite datastore for managing all wedding text, event schedules, dynamic photo galleries, and reception seating zones, while automatically compiling the entire site into deployable static HTML/CSS/JS files whenever backend state changes.

## ADDED Requirements

### Requirement: Editable Wedding Content Persistence
The system SHALL persist all primary wedding text, couple names, parent names, ceremony details, reception details, and map URLs in a local SQLite database editable through the local CMS API.

#### Scenario: Updating primary wedding text and event details
- **GIVEN** the local CMS backend is running with an initialized SQLite database
- **WHEN** the administrator submits updated couple names, event timestamps, or venue addresses to `PUT /api/config`
- **THEN** the system SHALL persist the changes in SQLite and return HTTP 200 with the updated configuration object

### Requirement: Dynamic Wedding Photo Gallery Management
The system SHALL allow adding, captioning, reordering, assigning section placements, and deleting an arbitrary number of wedding photos in the local backend.

#### Scenario: Adding multiple wedding photos to the gallery
- **GIVEN** the gallery currently contains 4 wedding photos
- **WHEN** the administrator uploads 6 additional wedding photos via `POST /api/photos`
- **THEN** the system SHALL store all 10 photo records in SQLite in their assigned sort order and include all 10 photos in subsequent static builds

#### Scenario: Deleting a wedding photo
- **GIVEN** a photo with ID `photo-01` exists in the backend
- **WHEN** the administrator requests `DELETE /api/photos/photo-01`
- **THEN** the system SHALL remove `photo-01` from SQLite and delete its generated image files from the static output directory

### Requirement: Automatic Static Site Compilation on Mutation
The system SHALL automatically compile all backend data, optimized images, and guest lookup maps into static HTML, CSS, JS, and JSON files under `dist/` whenever any database mutation occurs.

#### Scenario: Automatic rebuild triggered after content update
- **GIVEN** the static site has been built once in `dist/`
- **WHEN** a mutation occurs on wedding configuration, gallery photos, seating zones, or guest records
- **THEN** the system SHALL automatically regenerate `dist/index.html`, `dist/rsvp.html`, `dist/invite.html`, `dist/assets/data/wedding-data.json`, and `dist/assets/data/guests-map.json` within 500 milliseconds without manual CLI intervention
