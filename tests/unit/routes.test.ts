import { describe, it, expect } from 'vitest';
import { rebaseAssets } from '../../src/shared/routes';
import { renderInvitePage } from '../../src/frontend/templates/invite.template';
import { renderRsvpPage } from '../../src/frontend/templates/rsvp.template';
import { redirectPage } from '../../src/backend/static-builder';
import { DEFAULT_CONFIG } from '../../src/shared/default-config';
import { SEATING_ZONES, type PhotoRecord } from '../../src/shared/types';

const photo: PhotoRecord = {
  id: 'h', caption: '', placement: 'hero', sortOrder: 0, focalPoint: null,
  variants: (['sm', 'md', 'lg'] as const).flatMap((tier) => (['jpg', 'webp'] as const).map((format) => ({ tier, format, width: 640, height: 400, src: `assets/images/h/h-${tier}.${format}` }))),
};
const config = { ...DEFAULT_CONFIG, siteBaseUrl: 'https://cuoi.example.com', reception: { ...DEFAULT_CONFIG.reception, mapPreviewSrc: 'assets/maps/r.jpg', mapPreviewLargeSrc: 'assets/maps/r-lg.jpg' } };
const data = { config, photos: [photo], seatingZones: SEATING_ZONES, builtAt: '' };

describe('folder pages', () => {
  it.each([['thiep-moi', renderInvitePage], ['dang-ky', renderRsvpPage]] as const)('%s reaches every local file from one level down', (_name, render) => {
    const html = render(data);
    // no asset path (attribute, srcset entry or embedded JSON) is left relative to the folder itself
    expect(html.match(/(?<!\.\.\/|cuoi\.example\.com\/)assets\/(images|maps|css|js|data)/g)).toBeNull();
    expect(html).toContain('href="../assets/css/main.css"');
    expect(html).not.toMatch(/href="(index|rsvp|invite)\.html/);
  });
  it('keeps og:image absolute and leaves the source data untouched', () => {
    expect(renderInvitePage(data)).toContain('property="og:image" content="https://cuoi.example.com/assets/images/h/h-lg.jpg"');
    expect(rebaseAssets(data, '../').photos[0].variants[0].src).toBe('../assets/images/h/h-sm.jpg');
    expect(photo.variants[0].src).toBe('assets/images/h/h-sm.jpg');
    expect(config.reception.mapPreviewSrc).toBe('assets/maps/r.jpg');
  });
  it('redirects old addresses keeping the query and hash', () => {
    const html = redirectPage('thiep-moi/');
    expect(html).toContain('location.replace("thiep-moi/" + location.search + location.hash)');
    expect(html).toContain('url=thiep-moi/');
  });
});
