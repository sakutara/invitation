/**
 * Background music from the CMS playlist (#music-data): plays the tracks in order and loops the list.
 * A track is either an uploaded audio file (`src`) or a YouTube video (`youtubeId`, played through YouTube's
 * embedded player, hidden on the page). Starts as soon as the page opens; when the browser blocks sound before
 * any interaction, it starts on the first tap / click / key press instead. Every [data-role="music-toggle"]
 * (the record in the envelope, the floating button) pauses / resumes; a pause chosen by the guest is remembered
 * for the visit. <html> gets .is-music-playing while sound plays (the records spin, the waves pulse).
 */
export interface Track {
  title: string;
  src: string;
  youtubeId?: string;
}

const MUTED_KEY = 'wedding-music-muted';

export function nextIndex(i: number, length: number): number {
  return length ? (i + 1) % length : 0;
}

/** What a playback engine reports back to the player. */
interface Callbacks {
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onError: () => void;
}

/** One way of playing a track: an <audio> element for files, the YouTube player for videos. */
interface Engine {
  load(track: Track): void;
  play(): void;
  pause(): void;
  readonly playing: boolean;
}

function audioEngine(win: Window, cb: Callbacks): Engine {
  const audio = new (win as unknown as { Audio: typeof Audio }).Audio();
  audio.preload = 'auto';
  audio.addEventListener('play', cb.onPlay);
  audio.addEventListener('pause', cb.onPause);
  audio.addEventListener('ended', cb.onEnded);
  audio.addEventListener('error', cb.onError);
  return {
    load: (t) => {
      audio.src = t.src;
    },
    play: () => {
      void audio.play().catch(() => {});
    },
    pause: () => audio.pause(),
    get playing() {
      return !audio.paused && !audio.ended;
    },
  };
}

/** Minimal typing of the parts of the YouTube IFrame API used here (https://developers.google.com/youtube/iframe_api_reference). */
interface YTPlayer {
  cueVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      width: string;
      height: string;
      videoId: string;
      playerVars: Record<string, number>;
      events: { onReady: () => void; onStateChange: (e: { data: number }) => void; onError: () => void };
    },
  ) => YTPlayer;
}
type YTWindow = Window & { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

// YT.PlayerState values
const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_BUFFERING = 3;

let ytApi: Promise<YTNamespace> | null = null;
/** Loads the YouTube IFrame API once and resolves with its YT namespace. */
function loadYouTubeApi(doc: Document): Promise<YTNamespace> {
  const win = (doc.defaultView ?? window) as YTWindow;
  if (win.YT?.Player) return Promise.resolve(win.YT);
  if (!ytApi) {
    ytApi = new Promise<YTNamespace>((resolve) => {
      const prev = win.onYouTubeIframeAPIReady;
      win.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(win.YT as YTNamespace);
      };
      const s = doc.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      doc.head.appendChild(s);
    });
  }
  return ytApi;
}

function youtubeEngine(doc: Document, cb: Callbacks): Engine {
  // Hidden host for the player: the video is played for its sound only.
  const host = doc.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;right:0;bottom:0';
  const mount = doc.createElement('div');
  host.appendChild(mount);

  let player: YTPlayer | null = null;
  let ready = false;
  let creating = false;
  let wantPlay = false;
  let pendingId = '';
  let state = -1;

  const create = () => {
    creating = true;
    doc.body.appendChild(host);
    void loadYouTubeApi(doc).then((YT) => {
      player = new YT.Player(mount, {
        width: '1',
        height: '1',
        videoId: pendingId,
        playerVars: { playsinline: 1, controls: 0, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            ready = true;
            player?.cueVideoById(pendingId);
            if (wantPlay) player?.playVideo();
          },
          onStateChange: ({ data }) => {
            state = data;
            if (data === YT_PLAYING) cb.onPlay();
            else if (data === YT_PAUSED) cb.onPause();
            else if (data === YT_ENDED) cb.onEnded();
          },
          onError: () => cb.onError(),
        },
      });
    });
  };

  return {
    load: (t) => {
      pendingId = t.youtubeId ?? '';
      if (ready && player) player.cueVideoById(pendingId);
      else if (!creating) create();
    },
    play: () => {
      wantPlay = true;
      if (ready) player?.playVideo();
    },
    pause: () => {
      wantPlay = false;
      if (ready) player?.pauseVideo();
    },
    get playing() {
      return state === YT_PLAYING || state === YT_BUFFERING;
    },
  };
}

export function initMusic(doc: Document = document): { toggle: () => void } | null {
  const raw = doc.getElementById('music-data')?.textContent;
  let tracks: Track[] = [];
  try {
    tracks = raw
      ? (JSON.parse(raw) as Track[]).filter((t) => t && (typeof t.src === 'string' || typeof t.youtubeId === 'string'))
      : [];
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
  let index = 0;
  let wanted = store?.getItem(MUTED_KEY) !== '1';
  let failures = 0;
  const toggles = Array.from(doc.querySelectorAll<HTMLElement>('[data-role="music-toggle"]'));

  const render = () => {
    const playing = current.playing;
    doc.documentElement.classList.toggle('is-music-playing', playing);
    for (const t of toggles) {
      t.setAttribute('aria-pressed', String(playing));
      t.title = playing ? `Đang phát: ${tracks[index].title} — chạm để tắt nhạc` : 'Bật nhạc';
    }
  };

  const next = () => load(nextIndex(index, tracks.length));
  const cb: Callbacks = {
    onPlay: () => {
      failures = 0;
      render();
    },
    onPause: render,
    onEnded: () => {
      next();
      play();
    },
    onError: () => {
      // Skip a broken track, but stop after one full round of failures.
      if (++failures >= tracks.length) return render();
      next();
      if (wanted) play();
    },
  };
  const audio = audioEngine(win, cb);
  const yt = youtubeEngine(doc, cb);
  let current: Engine = audio;

  const load = (i: number) => {
    index = i;
    const t = tracks[i];
    const engine = t.youtubeId ? yt : audio;
    if (engine !== current) current.pause();
    current = engine;
    engine.load(t);
  };
  const play = () => current.play();

  const toggle = () => {
    if (!current.playing) {
      wanted = true;
      store?.removeItem(MUTED_KEY);
      play();
    } else {
      wanted = false;
      store?.setItem(MUTED_KEY, '1');
      current.pause();
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
      if (wanted && !current.playing) play();
    };
    const cleanup = () => events.forEach((n) => doc.removeEventListener(n, handler, true));
    events.forEach((n) => doc.addEventListener(n, handler, true));
    return { cleanup };
  })();

  // Pause while the tab is hidden; resume on return if it was playing.
  let resume = false;
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) {
      resume = current.playing;
      current.pause();
    } else if (resume && wanted) play();
  });

  load(0);
  render();
  if (wanted) play();
  return { toggle };
}
