---
type: index
title: "Wedding Webapp OKF Knowledge Bundle Index"
description: "Entrypoint index for the Open Knowledge Format (OKF) knowledge bundle governing domain rules, design tokens, and architecture of the Vietnamese Wedding Webapp."
resource: "okf://wedding-webapp/index"
tags: [okf, index, wedding, sdd, tdd, knowledge-graph]
timestamp: 2026-11-14T18:52:00Z
---

# Wedding Webapp OKF Knowledge Bundle Index

This directory constitutes a standard **Open Knowledge Format (OKF)** bundle. Each Markdown file uses structured YAML frontmatter and explicit wiki-style cross-links (`[[concept_name]]`) so AI coding agents (Claude, Haiku, Antigravity) and human developers can deterministically traverse domain rules, visual tokens, and technical constraints without hallucination.

## Knowledge Graph Nodes

1. **[[domain_glossary]]** (`type: glossary`):
   - Defines the 3 core pages (`Announcement`, `RSVP`, `Personalized Invitation`), the 7 canonical guest relationship groups, Vietnamese honorific salutations, and core entity schemas.
2. **[[design_tokens]]** (`type: policy`):
   - Defines the primary color palette (Navy `#0F2042`, Burgundy `#7A1C24`), secondary/accent colors (Sky Blue `#38BDF8`, Lotus Pink `#EC4899`, White/Ivory `#FDFBF7`, Black/Charcoal `#111827`), fluid viewport scaling (`360px` to `1920px`), 3-layer parallax physics, and the `1080x1620` JPEG card export dimensions.
3. **[[invitation_and_seating_rules]]** (`type: policy`):
   - Defines deterministic Vietnamese invitation copy generation, Vietnamese phone number normalization (`0xxxxxxxxx`), hybrid URL encoding (`?g=<base64url>` and `?id=<shortId>`), and reception hall seating zone routing.
4. **[[google_sheets_and_bulk_playbook]]** (`type: playbook`):
   - Defines the Google Apps Script (`doPost`) upsert protocol using normalized phone numbers as a unique key, two-way synchronization with the local backend, and bulk JPEG card rendering/dispatch workflows.

## Integration with OpenSpec

All normative system contracts in `openspec/specs/` and `openspec/changes/build-wedding-webapp/` derive their domain invariants directly from this OKF bundle:
- `cms-and-static-builder` references [[domain_glossary]] and [[design_tokens]].
- `smart-image-and-card-pipeline` references [[design_tokens]] and [[invitation_and_seating_rules]].
- `google-sheets-and-bulk-dispatch` references [[google_sheets_and_bulk_playbook]] and [[invitation_and_seating_rules]].
- `guest-url-codec-and-seating` references [[domain_glossary]] and [[invitation_and_seating_rules]].
- `wedding-frontend-pages` references [[design_tokens]], [[domain_glossary]], and [[invitation_and_seating_rules]].
