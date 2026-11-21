/**
 * Visual seating plan API: GET/PUT /api/seating-layout, POST /api/seating-layout/auto,
 * GET /api/seating-layout/preview.svg. Layout and zone names are stored in the CMS db;
 * zone tableRange / hallSide / row are derived from the tables assigned to each zone.
 */
import type { Cms } from './cms';
import { HANDLED, HttpError, route, validateZones, type Route } from './server';
import { autoLayout, deriveZones, layoutFromZones, validateLayout } from '../shared/seating-layout';
import { renderSeatingMapSvg } from '../shared/seating-mapper';
import type { SeatingLayout, SeatingZone } from '../shared/types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function strictLayout(raw: unknown): SeatingLayout {
  try {
    return validateLayout(raw);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
}

export function createSeatingRoutes({ cms }: { cms: Cms }): Route[] {
  const current = (): { layout: SeatingLayout; zones: SeatingZone[]; stored: SeatingLayout | null } => {
    const zones = cms.db.getSeatingZones();
    const stored = cms.db.getSeatingLayout();
    return { layout: stored ?? layoutFromZones(zones), zones, stored };
  };

  return [
    route('GET', '/api/seating-layout', () => {
      const { layout, zones, stored } = current();
      return { layout, zones, isDefault: stored === null };
    }),

    route('PUT', '/api/seating-layout', async ({ body }) => {
      const b = await body();
      if (!isObj(b)) throw new HttpError(400, 'Provide { layout, zones? }');
      const layout = strictLayout(b.layout);
      let zones = cms.db.getSeatingZones();
      if (b.zones !== undefined) {
        const incoming = new Map(validateZones(b.zones).map((z) => [z.id, z]));
        // Only the display name is editable here; everything else stays as stored.
        zones = zones.map((z) => (incoming.has(z.id) ? { ...z, nameVi: incoming.get(z.id)!.nameVi } : z));
      }
      zones = deriveZones(layout, zones);
      cms.db.setSeatingLayout(layout);
      cms.db.setSeatingZones(zones);
      return { layout, zones };
    }),

    route('POST', '/api/seating-layout/auto', async ({ body }) => {
      const b = await body();
      if (!isObj(b) || typeof b.count !== 'number' || !Number.isFinite(b.count)) {
        throw new HttpError(400, 'Provide { count: number, layout? }');
      }
      const prev = b.layout === undefined || b.layout === null ? null : strictLayout(b.layout);
      return autoLayout(b.count, prev);
    }),

    route('GET', '/api/seating-layout/preview.svg', ({ res }) => {
      const { layout, zones } = current();
      res
        .writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-cache' })
        .end(renderSeatingMapSvg(zones, { layout }));
      return HANDLED;
    }),
  ];
}
