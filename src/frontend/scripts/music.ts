/**
 * Background music from the CMS playlist (#music-data): plays the tracks in order and loops the list.
 * Starts as soon as the page opens; when the browser blocks sound before any interaction, it starts on the
 * first tap / click / key press instead. Every [data-role="music-toggle"] (the record in the envelope, the
 * floating button) pauses / resumes; a pause chosen by the guest is remembered for the visit.
 * <html> gets .is-music-playing while sound plays (the records spin, the waves pulse).
 */
export interface Track {
  title: string;
  src: string;
}

const MUTED_KEY = 'wedding-music-muted';

export function nextIndex(i: number, length: number): number {
  return length ? (i + 1) % length : 0;
}

export function initMusic(doc: Document = document): { audio: HTMLAudioElement; toggle: () => void } | null {
  const raw = doc.getElementById('music-data')?.textContent;
  let tracks: Track[] = [];
  try {
    tracks = raw ? (JSON.parse(raw) as Track[]).filter((t) => t && typeof t.src === 'string') : [];
  } catch {
    tracks = [];
  }
  if (!tracks.length) return null;

  const win = doc.defaultView ?? window;
  const store = (() => {
    try {
      return win.sessionStorage;
    } catch {
      return null;
    }
  })();
  const audio = new win.Audio();
  audio.preload = 'auto';
  let index = 0;
  let wanted = store?.getItem(MUTED_KEY) !== '1';
  let failures = 0;
  const toggles = Array.from(doc.querySelectorAll<HTMLElement>('[data-role="music-toggle"]'));

  const render = () => {
    const playing = !audio.paused && !audio.ended;
    doc.documentElement.classList.toggle('is-music-playing', playing);
    for (const t of toggles) {
      t.setAttribute('aria-pressed', String(playing));
      t.title = playing ? `Đang phát: ${tracks[index].title} — chạm để tắt nhạc` : 'Bật nhạc';
    }
  };
  const load = (i: number) => {
    index = i;
    audio.src = tracks[i].src;
  };
  const play = () => audio.play().then(() => { failures = 0; }, () => {});

  audio.addEventListener('play', render);
  audio.addEventListener('pause', render);
  audio.addEventListener('ended', () => {
    load(nextIndex(index, tracks.length));
    void play();
  });
  audio.addEventListener('error', () => {
    // Skip a broken file, but stop after one full round of failures.
    if (++failures >= tracks.length) return render();
    load(nextIndex(index, tracks.length));
    if (wanted) void play();
  });

  const toggle = () => {
    if (audio.paused) {
      wanted = true;
      store?.removeItem(MUTED_KEY);
      void play();
    } else {
      wanted = false;
      store?.setItem(MUTED_KEY, '1');
      audio.pause();
    }
  };
  for (const t of toggles) {
    t.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      unlock.cleanup();
      toggle();
    });
  }

  // Autoplay with sound needs a user gesture in most browsers: retry on the first one.
  const unlock = (() => {
    const events = ['pointerdown', 'touchend', 'keydown', 'click'];
    const handler = (e: Event) => {
      if (toggles.some((t) => t.contains(e.target as Node))) return;
      cleanup();
      if (wanted && audio.paused) void play();
    };
    const cleanup = () => events.forEach((n) => doc.removeEventListener(n, handler, true));
    events.forEach((n) => doc.addEventListener(n, handler, true));
    return { cleanup };
  })();

  // Pause while the tab is hidden; resume on return if it was playing.
  let resume = false;
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) {
      resume = !audio.paused;
      audio.pause();
    } else if (resume && wanted) void play();
  });

  load(0);
  render();
  if (wanted) void play();
  return { audio, toggle };
}
