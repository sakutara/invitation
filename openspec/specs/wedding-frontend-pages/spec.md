# Wedding Frontend Pages Specification

## Purpose

Delivers the three static wedding pages (`index.html` Announcement, `rsvp.html` Registration, and `invite.html` Personalized Invitation) with fluid responsive scaling (`360px` to `1920px` FullHD), smooth parallax transitions, Navy and Burgundy wedding card styling, and client-side JPEG invitation saving and mobile sharing.

## Requirements

### Requirement: Fluid Responsive Layout and Navy-Burgundy Card Theme
The system SHALL style all three pages in a wedding invitation card theme using Primary Navy (`#0F2042`) and Primary Burgundy (`#7A1C24`) with Secondary Sky Blue (`#38BDF8`), Lotus Pink (`#EC4899`), White (`#FDFBF7`), and Black (`#111827`), scaling fluidly without horizontal overflow from `360px` mobile screens to `1920x1080` FullHD monitors.

#### Scenario: Rendering across Mobile and FullHD viewports without horizontal scroll
- **GIVEN** any of the three static pages (`index.html`, `rsvp.html`, `invite.html`)
- **WHEN** the page is rendered at `360x640`, `390x844`, `768x1024`, and `1920x1080` resolutions
- **THEN** the document `scrollWidth` SHALL be less than or equal to the viewport `innerWidth` and CSS root variables SHALL match the Navy and Burgundy palette tokens

### Requirement: Parallax Section Transitions on Announcement and Invitation Pages
The system SHALL apply smooth multi-layer parallax scrolling between sections on the Announcement page (`index.html`) and Personalized Invitation page (`invite.html`), while automatically disabling motion when `prefers-reduced-motion: reduce` is active.

#### Scenario: Scrolling through parallax sections on the Announcement page
- **GIVEN** a user opens `index.html` on a standard browser without reduced-motion preference
- **WHEN** the user scrolls vertically between the Hero, Family Story, Schedule, and Dynamic Photo Gallery sections
- **THEN** the background and ornament layers SHALL translate smoothly via GPU-accelerated `translate3d` transforms relative to scroll progress

### Requirement: Announcement Landing Page (`index.html`)
The system SHALL render the Announcement page (`index.html`) as the primary home page displaying wedding news, family details, ceremony/reception date, time, and location, a dynamic photo gallery adapting to the number of backend photos, and a call-to-action link to the RSVP Registration page (`rsvp.html`).

#### Scenario: Navigating from the Announcement page to the RSVP page
- **GIVEN** a guest views `index.html`
- **WHEN** the guest clicks the primary Burgundy RSVP call-to-action button
- **THEN** the browser SHALL navigate to `rsvp.html`

### Requirement: Single-Viewport No-Scroll RSVP Page (`rsvp.html`)
The system SHALL render the RSVP page (`rsvp.html`) over a wedding photo background within a single `100dvh` viewport requiring no vertical scrolling, collecting Full Name, Phone Number, Relationship (7 options), and Attendee Count, displaying a thank-you message on submission, and redirecting back to `index.html`.

#### Scenario: Submitting the RSVP form and returning to the Announcement page
- **GIVEN** a guest opens `rsvp.html` on either a `390x844` mobile screen or `1920x1080` desktop screen
- **WHEN** the guest views the page and submits valid Full Name, Phone Number, Relationship, and Attendee Count
- **THEN** the page `scrollHeight` SHALL not exceed `innerHeight`, the system SHALL submit the payload with phone as unique key, display a thank-you confirmation, and navigate back to `index.html`

### Requirement: Personalized Invitation Page with Maps and Seating Highlight (`invite.html`)
The system SHALL render `invite.html` with shared wedding event details alongside personalized invitation copy, both Google Maps and a static direction map image, and an interactive reception seating chart that highlights the guest's assigned zone based on `relationship` and `count`.

#### Scenario: Displaying personalized invitation and highlighted seating for a guest URL
- **GIVEN** a guest opens `invite.html` with encoded parameters for `"chú thím"`, `"vợ chồng chú Chín"`, `"gia đình cô dâu"`, and `2`
- **WHEN** the page finishes loading
- **THEN** the page SHALL display `"Kính mời vợ chồng chú Chín đến chung vui cùng gia đình chúng tôi, sự hiện diện của chú thím là niềm vinh hạnh cho gia đình."`, show both the static map image and Google Maps link, and highlight `ZONE_B1` with `2` reserved seats on the seating chart

### Requirement: Client-Side JPEG Card Download and Mobile Native Share
The system SHALL allow guests on `invite.html` to export their personalized invitation into a concise `1080x1620` JPEG image and either download it as a `.jpg` file or share it directly through the mobile operating system share sheet (`navigator.share`).

#### Scenario: Downloading or sharing the summarized JPEG invitation card
- **GIVEN** a guest is viewing their personalized invitation on `invite.html`
- **WHEN** the guest clicks the Save JPG button or the Share button on a mobile device
- **THEN** the browser SHALL generate a `1080x1620` `.jpg` image containing the complete invitation summary and either trigger a `.jpg` file download or invoke `navigator.share` with the JPEG file attached
