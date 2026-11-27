/**
 * RSVP "send" animation: the reply card turns sideways and shrinks to the envelope's size, slides into it,
 * the flap closes and the envelope flies away. Resolves when the stage is empty; the caller then shows the
 * thank-you card (no envelope). Resolves at once without Web Animations or under prefers-reduced-motion.
 */
export interface SendLayout {
  /** How far the envelope (always the same size) slides from its resting place to the middle. */
  envY: number;
  /** Card turn (-90 for a portrait card, 0 if it is already landscape) and scale to fit the envelope. */
  rotate: number;
  scale: number;
  /** How far the card's centre moves while hovering above the envelope / resting inside it. */
  hoverY: number;
  insideY: number;
}

/** The hovering card + envelope are centred in the stage; only the card is resized, to fit the envelope. */
export function sendLayout(
  stage: { height: number },
  card: { top: number; width: number; height: number },
  env: { top: number; width: number; height: number },
): SendLayout {
  const long = Math.max(card.width, card.height);
  const short = Math.min(card.width, card.height);
  const scale = Math.min((env.width * 0.9) / long, (env.height * 0.86) / short);
  const lying = short * scale; // visible height once it lies sideways
  const groupTop = (stage.height - (lying + env.height)) / 2;
  const top = groupTop + lying;
  const centre = card.top + card.height / 2;
  return {
    envY: top - env.top,
    rotate: card.height > card.width ? -90 : 0,
    scale,
    hoverY: groupTop + lying / 2 - centre,
    insideY: top + env.height - lying / 2 - env.height * 0.07 - centre,
  };
}

const EASE = 'cubic-bezier(0.45, 0, 0.2, 1)';

export async function playSendAnimation(doc: Document = document): Promise<void> {
  const win = doc.defaultView;
  const stage = doc.querySelector<HTMLElement>('.rsvp__stage');
  const card = stage?.querySelector<HTMLElement>('.rsvp__panel');
  const parts = stage ? Array.from(stage.querySelectorAll<HTMLElement>('[data-envelope]')) : [];
  const flap = stage?.querySelector<HTMLElement>('.rsvp-env__flap');
  const back = stage?.querySelector<HTMLElement>('.rsvp-env__back');
  if (!win || !stage || !card || !flap || !back || typeof card.animate !== 'function' || win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  (doc.activeElement as HTMLElement | null)?.blur?.(); // close the on-screen keyboard
  card.style.animation = 'none';
  const l = sendLayout(
    { height: stage.clientHeight },
    { top: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight },
    { top: back.offsetTop, width: back.offsetWidth, height: back.offsetHeight },
  );
  const running: Animation[] = [];
  const run = (el: Element, frames: Keyframe[], duration: number) => {
    const a = el.animate(frames, { duration, easing: EASE, fill: 'forwards' });
    running.push(a);
    return a.finished;
  };
  const px = (n: number) => `${Math.round(n)}px`;
  const pose = (y: number, rotate: number, scale: number) => `translateY(${px(y)}) rotate(${rotate}deg) scale(${scale})`;
  const hover = pose(l.hoverY, l.rotate, l.scale);
  stage.classList.add('is-sending');

  // 1. the envelope slides to the middle (same size throughout) while the card lifts, turns sideways and shrinks.
  //    The flap shares the envelope's translation, so it stays hinged on its top edge.
  const slid = `translateY(${px(l.envY)})`;
  await Promise.all([
    ...parts.map((el) => {
      const turn = el === flap ? ' rotateX(180deg)' : '';
      return run(el, [{ transform: `translateY(0px)${turn}` }, { transform: `${slid}${turn}` }], 800);
    }),
    run(card, [{ transform: pose(0, 0, 1) }, { transform: hover }], 800),
  ]);
  // 2. a short beat, then it slides into the envelope
  await run(card, [{ transform: hover }, { transform: hover, offset: 0.2 }, { transform: pose(l.insideY, l.rotate, l.scale) }], 800);
  // 3. the flap closes over it
  const front = win.setTimeout(() => flap.classList.add('is-front'), 220);
  await run(flap, [{ transform: `${slid} rotateX(180deg)` }, { transform: `${slid} rotateX(0deg)` }], 450);
  win.clearTimeout(front);
  flap.classList.add('is-front');
  // 4. and the envelope flies away
  await run(
    stage,
    [
      { transform: 'none', opacity: 1 },
      { transform: 'translate(-4%, 5%) rotate(5deg) scale(0.96)', opacity: 1, offset: 0.22 },
      { transform: 'translate(75vw, -85vh) rotate(-24deg) scale(0.35)', opacity: 0 },
    ],
    850,
  );

  // Hand over to the thank-you card: envelope gone, card back at full size.
  stage.classList.remove('is-sending');
  stage.classList.add('is-sent');
  running.forEach((a) => a.cancel());
  win.requestAnimationFrame(() => card.animate([{ opacity: 0, transform: 'translateY(18px) scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: EASE }));
}
