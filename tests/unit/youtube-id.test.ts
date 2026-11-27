import { describe, expect, it } from 'vitest';
import { youtubeIdFrom } from '../../src/backend/music-routes';

describe('youtubeIdFrom', () => {
  it('reads the id from common YouTube link shapes', () => {
    const id = 'DBoaOnj6Ll4';
    expect(youtubeIdFrom(`https://www.youtube.com/watch?v=${id}&list=RDDBoaOnj6Ll4&start_radio=1`)).toBe(id);
    expect(youtubeIdFrom(`https://youtu.be/${id}?si=abc`)).toBe(id);
    expect(youtubeIdFrom(`https://m.youtube.com/watch?v=${id}`)).toBe(id);
    expect(youtubeIdFrom(`https://www.youtube.com/embed/${id}`)).toBe(id);
    expect(youtubeIdFrom(`https://www.youtube.com/shorts/${id}`)).toBe(id);
    expect(youtubeIdFrom(id)).toBe(id);
  });

  it('rejects anything that is not a YouTube video link', () => {
    expect(youtubeIdFrom('https://example.com/watch?v=DBoaOnj6Ll4')).toBeNull();
    expect(youtubeIdFrom('https://www.youtube.com/')).toBeNull();
    expect(youtubeIdFrom('not a link')).toBeNull();
  });
});
