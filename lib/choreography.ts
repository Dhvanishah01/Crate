import gsap from "gsap";

// Every timing in the app. Starting targets from the PRD; tune by feel here, nowhere else.
export const T = {
  travel: { duration: 0.6, ease: "power3.inOut" },
  drop: { duration: 0.35, ease: "back.out(1.2)" },
  spinUp: { duration: 0.8, ease: "power1.in" },
  armLift: { duration: 0.2, ease: "power2.out" },
  armSwing: { duration: 0.6, ease: "power2.inOut" },
  needleDrop: { duration: 0.15, ease: "power1.out" },
  audioIn: { duration: 0.6, ease: "sine.inOut" },
  pauseFade: { duration: 0.35, ease: "sine.inOut" },
  powerFade: { duration: 0.5, ease: "sine.inOut" },
  armReturn: { duration: 0.7, ease: "power2.inOut" },
  spinDown: { duration: 1.0, ease: "power2.out" },
  speedShift: { duration: 0.5, ease: "power2.inOut" },
  track: { duration: 0.25, ease: "sine.inOut" },
  control: { duration: 0.18, ease: "power2.out" },
  recordLift: { duration: 0.3, ease: "power2.out" }, // swap: record floats up off the platter
  sleeveIn: { duration: 0.55, ease: "power3.out" }, // a sleeve arrives beside the deck
  sleeveHome: { duration: 0.9, ease: "power3.inOut" }, // a sleeve flies back to its wall slot
  sleeveAway: { duration: 0.45, ease: "power2.in" }, // the emptied sleeve slides off
  queueFly: { duration: 0.7, ease: "power3.inOut" }, // wall to the queue beside the deck
  scrollToDeck: { duration: 0.7, ease: "power2.inOut" }, // bring the turntable into view before a swap
  nightFade: { duration: 1.4, ease: "sine.inOut" }, // the room crossfades between its day and night renders
  zoomIn: { duration: 1.1, ease: "power3.inOut" }, // walking up to the record wall
  zoomOut: { duration: 0.9, ease: "power3.inOut" }, // stepping back to the turntable
  wallSlide: { duration: 0.75, ease: "power3.out" }, // arrows: the sleeves slide along to the next wall
  queueMove: { duration: 0.35, ease: "power2.out" }, // up next fades back in at its new spot after a zoom
};

/** Sleeves thrown along the ledges after a drag: inertia, then they settle on a wall. */
export const WALL_THROW = { minDuration: 0.4, maxDuration: 1.2 };

/** A second click within this window makes it a double click (play now) instead of a queue. */
export const DOUBLE_CLICK_MS = 250;

/** Power off: queued sleeves leave for their walls this far apart (s). */
export const QUEUE_RETURN_STAGGER = 0.12;

export const RPM = { min: 100 / 3, max: 45 };
export const degPerSec = (rpm: number) => rpm * 6;
export const ARM_DELAY_AFTER_SPIN = 0.2; // beats 5 and 6 overlap

/** Steady spin from one rotation value on the GSAP ticker, so re-renders never restart it. */
export function createSpin(el: Element) {
  const s = { vel: 0, angle: 0 };
  const setRotation = gsap.quickSetter(el, "rotation", "deg");
  const tick = (_t: number, dt: number) => {
    if (!s.vel) return;
    s.angle = (s.angle + (s.vel * dt) / 1000) % 360;
    setRotation(s.angle);
  };
  gsap.ticker.add(tick);
  return {
    s,
    to: (vel: number, beat: gsap.TweenVars) =>
      s.vel === vel ? gsap.timeline() : gsap.to(s, { vel, ...beat, overwrite: true }),
    kill: () => gsap.ticker.remove(tick),
  };
}

type RecordEls = { record: Element; shadow: Element };
type ArmEls = { arm: Element; layer: Element };

/** The record slides out of a sleeve fromX px away (lifted), then beat 4 (drop) lands it on the platter. */
export function dropOnPlatter({ record, shadow }: RecordEls, fromX: number) {
  return gsap
    .timeline()
    .addLabel("travel")
    .fromTo(record, { x: fromX, scale: 1.04, autoAlpha: 1 }, { x: 0, scale: 1.02, ...T.travel })
    .fromTo(
      shadow,
      { x: fromX, xPercent: 4, yPercent: 6, scale: 1.08, autoAlpha: 0.35 },
      { x: 0, scale: 1.06, ...T.travel },
      "<",
    )
    .addLabel("drop")
    .to(record, { scale: 1, ...T.drop })
    .to(shadow, { xPercent: 1, yPercent: 1.5, scale: 1, autoAlpha: 0.6, ...T.drop, ease: "power2.out" }, "<");
}

/** Swap, going out: the record floats up and slides toX px, under the sleeve waiting there. */
export function pickUpRecord({ record, shadow }: RecordEls, toX: number) {
  return gsap
    .timeline()
    .to(record, { scale: 1.04, ...T.recordLift })
    .to(shadow, { xPercent: 4, yPercent: 6, scale: 1.08, autoAlpha: 0.35, ...T.recordLift }, "<")
    .to([record, shadow], { x: toX, ...T.travel })
    .set([record, shadow], { autoAlpha: 0 });
}

/**
 * A sleeve flying between two places on the page (wall, queue, beside the deck), as a fixed-position
 * stand-in so it can cross layout boundaries. With no target it drifts up and fades.
 */
export function flySleeve(src: string, from: DOMRect, to: DOMRect | null, beat: gsap.TweenVars) {
  const el = document.createElement("div");
  el.className = "flyer";
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  el.append(img);
  const end = to ?? new DOMRect(from.x + from.width * 0.2, from.y - 260, from.width * 0.6, from.height * 0.6);
  Object.assign(el.style, { left: `${end.x}px`, top: `${end.y}px`, width: `${end.width}px`, height: `${end.height}px` });
  document.body.append(el);
  return gsap.fromTo(
    el,
    { x: from.x - end.x, y: from.y - end.y, scale: from.width / end.width },
    { x: 0, y: 0, scale: 1, autoAlpha: to ? 1 : 0, ...beat, onComplete: () => el.remove() },
  );
}

/** Raise or lower the arm: shadow grows when lifted, tightens when it lands. */
export function liftArm({ arm, layer }: ArmEls, up: boolean) {
  const beat = up ? T.armLift : T.needleDrop;
  return gsap
    .timeline()
    .to(layer, { "--lift": up ? 1 : 0, ...beat })
    .to(arm, { scale: up ? 1.015 : 1, ...beat }, 0);
}

/** Lift and swing to an angle. Leaves the arm raised; follow with liftArm(els, false). */
export function swingTo(els: ArmEls, angle: number) {
  const tl = gsap.timeline().add(liftArm(els, true));
  if (Math.abs(Number(gsap.getProperty(els.arm, "rotation")) - angle) > 0.5)
    tl.to(els.arm, { rotation: angle, ...T.armSwing });
  return tl;
}

export function armHome(els: ArmEls, onRest: () => void) {
  if (Math.abs(Number(gsap.getProperty(els.arm, "rotation"))) < 0.5) return gsap.timeline(); // already resting
  return gsap
    .timeline()
    .add(liftArm(els, true))
    .to(els.arm, { rotation: 0, ...T.armReturn })
    .add(liftArm(els, false))
    .call(onRest);
}
