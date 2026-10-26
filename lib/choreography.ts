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
};

export const DEG_PER_SEC = { 33: 200, 45: 270 } as const;
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

/** The record arrives lifted, then beat 4 (drop) lands it on the platter. */
export function dropOnPlatter({ record, shadow }: RecordEls) {
  return (
    gsap
      .timeline()
      // shortcut: slides in from the left in place of sleeve beats 1-3 until the shelf exists (Phase 3)
      .addLabel("travel")
      .fromTo(
        record,
        { xPercent: -60, yPercent: -8, scale: 1.04, autoAlpha: 0 },
        { xPercent: 0, yPercent: 0, scale: 1.02, autoAlpha: 1, ...T.travel },
      )
      .fromTo(
        shadow,
        { xPercent: -54, yPercent: 0, scale: 1.08, autoAlpha: 0 },
        { xPercent: 4, yPercent: 6, scale: 1.06, autoAlpha: 0.35, ...T.travel },
        "<",
      )
      .addLabel("drop")
      .to(record, { scale: 1, ...T.drop })
      .to(shadow, { xPercent: 1, yPercent: 1.5, scale: 1, autoAlpha: 0.6, ...T.drop, ease: "power2.out" }, "<")
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
  return gsap
    .timeline()
    .add(liftArm(els, true))
    .to(els.arm, { rotation: 0, ...T.armReturn })
    .add(liftArm(els, false))
    .call(onRest);
}
