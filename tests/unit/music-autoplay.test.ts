// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { initMusic } from '../../src/frontend/scripts/music';

/** Audio stand-in that refuses to play until `allowed`, like a browser's autoplay policy. */
class FakeAudio extends EventTarget {
  static last: FakeAudio;
  static allowed = false;
  paused = true;
  ended = false;
  src = '';
  preload = '';
  constructor() {
    super();
    FakeAudio.last = this;
  }
  play = vi.fn(() => {
    if (!FakeAudio.allowed) return Promise.reject(new Error('NotAllowedError'));
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
}

describe('background music', () => {
  it('starts by itself, retries on each gesture until it plays, and the record switches it off and on', () => {
    (window as unknown as { Audio: unknown }).Audio = FakeAudio;
    document.body.innerHTML = `<script type="application/json" id="music-data">[{"title":"A","src":"a.mp3"}]</script><button data-role="music-toggle"></button>`;
    const playing = () => document.documentElement.classList.contains('is-music-playing');
    initMusic(document);
    const audio = FakeAudio.last;
    expect(audio.play).toHaveBeenCalledTimes(1); // tried on load
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); // still blocked
    expect(playing()).toBe(false);
    FakeAudio.allowed = true;
    document.body.dispatchEvent(new Event('click', { bubbles: true }));
    expect(playing()).toBe(true);

    const disc = document.querySelector<HTMLButtonElement>('button')!;
    disc.click();
    expect(playing()).toBe(false);
    expect(disc.getAttribute('aria-pressed')).toBe('false');
    document.body.dispatchEvent(new Event('click', { bubbles: true })); // stays off
    expect(playing()).toBe(false);
    disc.click();
    expect(playing()).toBe(true);
  });
});
