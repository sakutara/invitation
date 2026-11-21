import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  RELATIONSHIP_GROUPS,
  RELATIONSHIP_KEYS,
  SEATING_ZONES,
  COLOR_TOKENS,
  FLUID_TEXT_TOKENS,
  CARD_SPEC,
  IMAGE_TIERS,
  FALLBACK_GUEST,
} from '../../src/shared/types';

const OKF_DIR = join(__dirname, '../../okf');
const read = (name: string) => readFileSync(join(OKF_DIR, name), 'utf8');

/** Parse a markdown pipe table that follows the given heading text. */
function tableAfter(md: string, headingIncludes: string): string[][] {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.startsWith('#') && l.includes(headingIncludes));
  expect(start, `heading "${headingIncludes}"`).toBeGreaterThanOrEqual(0);
  const rows: string[][] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('#')) break;
    if (!l.startsWith('|')) {
      if (rows.length) break;
      continue;
    }
    const cells = l.slice(1, -1).split('|').map((c) => c.trim().replace(/`/g, ''));
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    rows.push(cells);
  }
  return rows.slice(1); // drop header
}

describe('OKF bundle structure', () => {
  it('every OKF file has YAML frontmatter with type/title/description/resource', () => {
    const files = readdirSync(OKF_DIR).filter((f) => f.endsWith('.md'));
    expect(files.sort()).toEqual(
      ['design_tokens.md', 'domain_glossary.md', 'google_sheets_and_bulk_playbook.md', 'index.md', 'invitation_and_seating_rules.md'].sort(),
    );
    for (const f of files) {
      const md = read(f);
      const fm = md.match(/^---\n([\s\S]*?)\n---/);
      expect(fm, f).not.toBeNull();
      for (const key of ['type', 'title', 'description', 'resource']) {
        expect(fm![1], `${f} frontmatter ${key}`).toMatch(new RegExp(`^${key}:`, 'm'));
      }
    }
  });

  it('all [[wiki-links]] resolve to an existing OKF node', () => {
    const nodes = new Set(readdirSync(OKF_DIR).map((f) => f.replace(/\.md$/, '')));
    for (const f of readdirSync(OKF_DIR)) {
      for (const m of read(f).matchAll(/(?<!`)\[\[([a-z_]+)\]\](?!`)/g)) expect(nodes.has(m[1]), `${f} -> ${m[1]}`).toBe(true);
    }
  });
});

describe('types.ts matches okf/domain_glossary.md', () => {
  const rows = tableAfter(read('domain_glossary.md'), 'Canonical Relationship Groups');

  it('defines exactly the 7 relationship groups', () => {
    expect(rows).toHaveLength(7);
    expect(RELATIONSHIP_KEYS).toHaveLength(7);
  });

  it.each(rows.map((r) => [r[1], r]))('group %s matches glossary row', (key, r) => {
    const g = RELATIONSHIP_GROUPS[key as keyof typeof RELATIONSHIP_GROUPS];
    expect(g).toBeDefined();
    expect(String(g.code)).toBe(r[0]);
    expect(g.labelVi).toBe(r[2]);
    expect(g.displayVi).toBe(r[3]);
    expect(g.side).toBe(r[4].toLowerCase());
    expect(g.zoneId).toBe(r[5]);
    expect(g.accent).toBe(r[6]);
  });

  it('fallback guest follows the invitation copy default', () => {
    expect(FALLBACK_GUEST).toEqual({ salutation: 'bạn', name: 'bạn', relationship: 'other', count: 1 });
  });
});

describe('types.ts matches okf/invitation_and_seating_rules.md seating table', () => {
  const rows = tableAfter(read('invitation_and_seating_rules.md'), 'Reception Hall Seating Allocation Rule');
  it.each(rows.map((r) => [r[0], r]))('zone %s', (zoneId, r) => {
    const z = SEATING_ZONES.find((s) => s.id === zoneId);
    expect(z).toBeDefined();
    expect(z!.relationship).toBe(r[1]);
    expect(z!.nameVi).toBe(r[2]);
    expect(z!.tableRange).toBe(r[4]);
    expect(r[5]).toContain(z!.color);
  });
});

describe('types.ts matches okf/design_tokens.md', () => {
  const md = read('design_tokens.md');

  it('every --color-* token and hex/rgba value is mirrored', () => {
    const found = [...md.matchAll(/\(`(--color-[a-z-]+)`\)\**:\s*`([^`]+)`/g)];
    expect(found.length).toBe(Object.keys(COLOR_TOKENS).length);
    for (const [, name, value] of found) expect(COLOR_TOKENS[name], name).toBe(value);
  });

  it('fluid typography clamp() tokens are mirrored', () => {
    const found = [...md.matchAll(/`(--text-[a-z-]+)`:\s*`([^`]+)`/g)];
    expect(found.length).toBe(6);
    for (const [, name, value] of found) expect(FLUID_TEXT_TOKENS[name], name).toBe(value);
  });

  it('card spec is 1080x1620 JPEG at quality 0.92', () => {
    expect(CARD_SPEC).toMatchObject({ width: 1080, height: 1620, mime: 'image/jpeg', quality: 0.92 });
  });

  it('image tiers are 640/1024/1440/1920', () => {
    expect(IMAGE_TIERS).toEqual({ sm: 640, md: 1024, lg: 1440, fhd: 1920 });
  });
});
