---
type: policy
title: "design_tokens"
description: "Visual design policy defining the Navy and Burgundy primary palette, secondary accent colors, fluid viewport typography (360px to 1920px), parallax motion rules, and JPEG card geometry."
resource: "okf://wedding-webapp/design-tokens"
tags: [design-system, colors, navy, burgundy, fluid-responsive, parallax, jpeg-card]
timestamp: 2026-11-14T18:52:00Z
---

# design_tokens

The `design_tokens` policy governs all visual styling, responsive fluid scaling, parallax scrolling mechanics, and rendered invitation card geometry across the wedding webapp. Linked to [[domain_glossary]] and [[invitation_and_seating_rules]].

## Color Palette Policy

The aesthetic follows a **Regal Vietnamese Wedding Invitation Card** theme. Dominant surfaces and typography MUST allocate **90% visual weight** to Primary Navy, Primary Burgundy, Warm Ivory/White, and Charcoal/Black, and **10% visual weight** to Secondary Sky Blue and Lotus Pink for guest group badges and seating zone highlights.

### Primary Colors
- **Navy (`--color-navy`)**: `#0F2042`
  - Deep Navy (`--color-navy-deep`): `#091326`
  - Navy Glass Overlay (`--color-navy-glass`): `rgba(15, 32, 66, 0.78)`
  - *Usage*: Primary structural backgrounds, double-line classic card borders, and formal headings on light card stock.
- **Burgundy (`--color-burgundy`)**: `#7A1C24`
  - Deep Burgundy (`--color-burgundy-deep`): `#561016`
  - Light Burgundy (`--color-burgundy-light`): `#9E2A35`
  - *Usage*: Primary CTA buttons (RSVP registration, Save JPEG Card), wax seal emblems, ceremonial dividers, and shared zone highlights.

### Secondary Colors
- **Sky Blue (`--color-sky-blue`)**: `#38BDF8`
  - Pastel Fill (`--color-sky-blue-pastel`): `#E0F2FE`
  - Deep Border/Text (`--color-sky-blue-ink`): `#075985`
  - *Usage*: Groom-side (`groom_family`, `groom_friends`, `groom_parents_friends`) group badges and seating zone highlights on the reception hall map.
- **Lotus Pink (`--color-lotus-pink`)**: `#EC4899`
  - Pastel Fill (`--color-lotus-pink-pastel`): `#FCE7F3`
  - Deep Border/Text (`--color-lotus-pink-ink`): `#9D174D`
  - *Usage*: Bride-side (`bride_family`, `bride_friends`, `bride_parents_friends`) group badges and seating zone highlights on the reception hall map.
- **White & Ivory Card Stock**:
  - Pure White (`--color-white`): `#FFFFFF`
  - Ivory Paper (`--color-ivory`): `#FDFBF7`
  - Warm Cream (`--color-cream`): `#F5EFE6`
- **Black & Charcoal Typography**:
  - Deep Black (`--color-black`): `#111827`
  - Charcoal Body (`--color-charcoal`): `#1F2937`
  - Muted Slate (`--color-muted`): `#4B5563`

## Fluid Responsive Viewport Policy (`360px` to `1920px` FullHD)

All pages MUST scale fluidly from small mobile screens (`360px` width) up to FullHD desktop monitors (`1920x1080`) using CSS `clamp()` functions without horizontal overflow (`scrollWidth <= innerWidth`).

### Fluid Typography Tokens
- `--font-display`: `'Cormorant Garamond', 'Playfair Display', Georgia, serif`
- `--font-script`: `'Great Vibes', 'Alex Brush', cursive`
- `--font-body`: `'Be Vietnam Pro', 'Plus Jakarta Sans', -apple-system, sans-serif`
- `--text-hero`: `clamp(2.25rem, 1.5rem + 3.2vw, 4.75rem)`
- `--text-section-title`: `clamp(1.75rem, 1.2rem + 2.2vw, 3.25rem)`
- `--text-card-heading`: `clamp(1.35rem, 1.1rem + 1.1vw, 2.15rem)`
- `--text-invite-quote`: `clamp(1.15rem, 1.0rem + 0.75vw, 1.65rem)`
- `--text-body-lg`: `clamp(1.05rem, 0.95rem + 0.45vw, 1.35rem)`
- `--text-body`: `clamp(0.95rem, 0.9rem + 0.25vw, 1.125rem)`

### Single-Viewport Lock for RSVP Page (`dist/rsvp.html`)
- `dist/rsvp.html` MUST enforce `height: 100dvh; max-height: 100dvh; overflow: hidden;` on the page container so the registration form never requires vertical scrolling on either `1920x1080` or `390x844` viewports.

## Parallax Transition Policy

Smooth parallax transitions between sections on `dist/index.html` and `dist/invite.html` MUST use `IntersectionObserver` + `requestAnimationFrame` updating GPU-accelerated `transform: translate3d(0, var(--parallax-y), 0)`:
- **Background Layer (`data-parallax-speed="0.25"`)**: Slow-moving wedding photography backdrop.
- **Midground Card Layer (`data-parallax-speed="0"`)**: Crisp Ivory invitation card frames moving at natural scroll speed.
- **Foreground Ornament Layer (`data-parallax-speed="-0.15"`)**: Subtle botanical/floral corner ornaments and wax seals.
- **Accessibility Fallback**: When `prefers-reduced-motion: reduce` is active, all parallax offsets MUST evaluate to `0px`.

## Exportable Invitation Card Specification (`1080x1620` JPEG)

Both the server-side batch generator (`sharp` SVG rasterizer) and the client-side Save/Share feature (`HTMLCanvasElement.toBlob('image/jpeg', 0.92)`) MUST produce a vertical JPEG card with:
- **Dimensions**: `1080px` width by `1620px` height (`2:3` aspect ratio).
- **Format & Quality**: `image/jpeg` at quality `0.92`.
- **Mandatory Visual Blocks**:
  1. Couple names, wedding date, and framed couple portrait.
  2. Personalized invitation sentence from [[invitation_and_seating_rules]].
  3. Ceremony & reception timestamps, venue hall name, and full address.
  4. Miniaturized reception seating chart with the guest's assigned zone highlighted in Sky Blue, Lotus Pink, or Burgundy, plus seat count.
  5. QR code encoding the guest's personalized invitation URL.
