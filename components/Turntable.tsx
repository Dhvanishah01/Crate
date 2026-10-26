"use client";

import { useEffect, useRef, type CSSProperties, type Ref } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { useGSAP } from "@gsap/react";
import Record from "./Record";
import Tonearm from "./Tonearm";
import Knob from "./Knob";
import { SEED, useStore, type SleevePick, type Record as RecordT } from "@/lib/store";
import { player, usePlayer } from "@/lib/usePlayer";
import { sfx } from "@/lib/sfx";
import {
  ARM_DELAY_AFTER_SPIN,
  RPM,
  T,
  armHome,
  createSpin,
  degPerSec,
  dropOnPlatter,
  flySleeve,
  liftArm,
  pickUpRecord,
  swingTo,
} from "@/lib/choreography";
import { CENTER, DECK, PIVOT, PLATTER_R, armAngleAt, circle, u } from "@/lib/geometry";

gsap.registerPlugin(ScrollToPlugin, useGSAP);

const POWER = { x: 92, y: 578 };
const LEVER = { x: 772, y: 150 };
const REST = { x: 690, y: 506 };
const STAGE = 330; // during a swap the sleeves wait this far left and right of the spindle
const SLEEVE = 500; // a full-size sleeve, a little bigger than the record

/** Where a record's sleeve sits on the facing wall, or null if that wall isn't in view. */
function slotRect(id: string) {
  const el = document.querySelector<HTMLElement>(`[data-slot="${CSS.escape(id)}"]`);
  return el && el.closest(".drum-face")?.getAttribute("aria-hidden") !== "true" ? el.getBoundingClientRect() : null;
}

/** A full-size sleeve beside the platter during a swap; its art is set imperatively mid-animation. */
function StageSleeve({ sleeveRef, artRef, x }: { sleeveRef: Ref<HTMLDivElement>; artRef: Ref<HTMLImageElement>; x: number }) {
  return (
    <div
      ref={sleeveRef}
      aria-hidden
      className="stage-sleeve invisible absolute"
      style={{ left: u(x - SLEEVE / 2), top: u(CENTER.y - SLEEVE / 2), width: u(SLEEVE), height: u(SLEEVE) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- src changes per swap, outside React */}
      <img ref={artRef} alt="" />
      <span className="sleeve-wear" />
    </div>
  );
}

const queueEl = (id: string) => document.querySelector<HTMLElement>(`[data-queue="${CSS.escape(id)}"]`);

export default function Turntable() {
  const scope = useRef<HTMLDivElement>(null);
  const recordRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const armRef = useRef<HTMLDivElement>(null);
  const armLayerRef = useRef<HTMLDivElement>(null);
  const powerThumbRef = useRef<HTMLSpanElement>(null);
  const leverRef = useRef<HTMLSpanElement>(null);
  const leftSleeve = useRef<HTMLDivElement>(null);
  const rightSleeve = useRef<HTMLDivElement>(null);
  const leftArt = useRef<HTMLImageElement>(null);
  const rightArt = useRef<HTMLImageElement>(null);
  const spin = useRef<ReturnType<typeof createSpin> | null>(null);
  const onPlatter = useRef(false);

  const power = useStore((s) => s.player.power);
  const status = useStore((s) => s.player.status);
  const speed = useStore((s) => s.player.speed);
  const volume = useStore((s) => s.player.volume);
  const setPlayer = useStore((s) => s.setPlayer);
  const queue = useStore((s) => s.queue);
  const pick = useStore((s) => s.pick);
  // what the label and title show: the record on the platter, else the first on the walls
  const record = useStore((s) => s.record ?? s.library[0] ?? SEED);
  const needleUp = status !== "playing";

  const arm = () => ({ arm: armRef.current!, layer: armLayerRef.current! });
  const disc = () => ({ record: recordRef.current!, shadow: shadowRef.current! });
  const progress = () => player.time() / player.duration();
  const px = (units: number) => (scope.current!.offsetWidth * units) / DECK.w;

  const { contextSafe } = useGSAP(
    () => {
      spin.current = createSpin(spinRef.current!);
      return () => spin.current?.kill();
    },
    { scope },
  );

  // Audio starts on the needle drop, never before.
  const needleDown = () => {
    sfx.needle();
    sfx.crackle(true);
    player.setRate(useStore.getState().player.speed / RPM.min); // a new video starts at 1x
    player.play();
    player.fadeTo(1, T.audioIn);
    setPlayer({ status: "playing" });
  };

  /** Spin up if needed, swing to where the song is, drop the needle. */
  const startPlayback = () => {
    const s = spin.current!;
    const spinning = s.s.vel > 0;
    return gsap
      .timeline()
      .add(s.to(degPerSec(useStore.getState().player.speed), T.spinUp), 0)
      .add(swingTo(arm(), armAngleAt(progress())), spinning ? 0 : ARM_DELAY_AFTER_SPIN)
      .add(liftArm(arm(), false))
      .call(needleDown);
   };

  /** Arm back to rest and platter to a stop. With an end status it finishes there; a swap carries on. */
  const stop = (fade: gsap.TweenVars, end?: "idle" | "paused") => {
    setPlayer({ status: "transition" });
    sfx.crackle(false);
    player.fadeTo(0, fade).then(() => player.pause());
    const tl = gsap.timeline().add(armHome(arm(), sfx.click)).add(spin.current!.to(0, T.spinDown), 0);
    if (end) tl.call(() => setPlayer({ status: end }));
    return tl;
  };

  /** Swap, going out: the record lifts, slides left into its sleeve, and the sleeve flies back to its wall. */
  const putAway = (r: RecordT) => {
    leftArt.current!.src = r.artworkUrl;
    return gsap
      .timeline()
      .fromTo(leftSleeve.current, { x: -px(160), autoAlpha: 0 }, { x: 0, autoAlpha: 1, ...T.sleeveIn })
      .add(pickUpRecord(disc(), -px(STAGE)), "<")
      .call(() => {
        const from = leftSleeve.current!.getBoundingClientRect();
        const to = slotRect(r.id);
        const slot = document.querySelector(`[data-slot="${CSS.escape(r.id)}"]`);
        gsap.set(leftSleeve.current, { autoAlpha: 0 });
        gsap.set(slot, { autoAlpha: 0 }); // stays hidden until its sleeve lands, even once the wall marks it back in
        flySleeve(r.artworkUrl, from, to, T.sleeveHome).then(() => gsap.set(slot, { clearProps: "opacity,visibility" }));
      });
  };

  /** Swap, coming in: the sleeve arrives on the right, the record slides out onto the platter and drops. */
  const bringIn = (r: RecordT, from: DOMRect | null) => {
    useStore.getState().setRecord(r);
    player.cue(r.videoId);
    onPlatter.current = true;
    rightArt.current!.src = r.artworkUrl;
    gsap.set(rightSleeve.current, { x: 0, y: 0 });
    const tl = gsap.timeline();
    if (from) tl.add(flySleeve(r.artworkUrl, from, rightSleeve.current!.getBoundingClientRect(), T.sleeveIn)).set(rightSleeve.current, { autoAlpha: 1 });
    else tl.fromTo(rightSleeve.current, { y: -px(60), autoAlpha: 0 }, { y: 0, autoAlpha: 1, ...T.sleeveIn });
    return tl
      .add(dropOnPlatter(disc(), px(STAGE)))
      .to(rightSleeve.current, { x: px(140), autoAlpha: 0, ...T.sleeveAway }, "drop");
  };

  /** Walls sit above the deck and are taller than most screens: scroll the deck into view first. */
  const scrollToDeck = () => {
    const box = scope.current!.getBoundingClientRect();
    if (box.top >= 0 && box.bottom <= window.innerHeight) return gsap.timeline();
    const y = window.scrollY + box.top - Math.max(0, (window.innerHeight - box.height) / 2);
    return gsap.to(window, { scrollTo: { y, autoKill: true }, ...T.scrollToDeck });
  };

  /** Put r on the turntable and play it, swapping out whatever is there. from() finds its sleeve, after any scroll. */
  const playNow = async (r: RecordT, from: () => DOMRect | null) => {
    const old = onPlatter.current ? useStore.getState().record : null;
    setPlayer({ power: true, status: "transition" });
    await contextSafe(scrollToDeck)();
    if (old) {
      await contextSafe(stop)(T.pauseFade);
      await contextSafe(putAway)(old);
    }
    await contextSafe(bringIn)(r, from());
    await contextSafe(startPlayback)();
  };

  /** Single click on a wall: queue it, unless nothing is on the go, then play it. Double click: play now. */
  const handlePick = ({ record: r, now }: SleevePick) => {
    const from = () => slotRect(r.id);
    const s = useStore.getState();
    if (s.record?.id === r.id && onPlatter.current) return; // already on the turntable
    const busy = s.player.status !== "idle";
    if (now && s.player.status !== "transition") {
      s.unqueue(r.id);
      return playNow(r, from);
    }
    if (!busy) return playNow(r, from);
    if (s.queue.some((q) => q.id === r.id)) return;
    s.enqueue(r, now); // a double click mid-swap jumps the queue
    const start = from(); // before the wall marks it out
    requestAnimationFrame(() => {
      const el = queueEl(r.id);
      if (!el || !start) return;
      gsap.set(el, { autoAlpha: 0 });
      contextSafe(() => flySleeve(r.artworkUrl, start, el.getBoundingClientRect(), T.queueFly).then(() => gsap.set(el, { autoAlpha: 1 })))();
    });
  };

  useEffect(() => {
    if (!pick) return;
    useStore.getState().choose(null);
    handlePick(pick);
  });

  const powerOn = () => {
    player.unlock(); // this tap unlocks audio on iOS
    if (onPlatter.current) {
      setPlayer({ power: true, status: "transition" });
      startPlayback();
    } else playNow(record, () => slotRect(record.id));
  };

  const togglePower = () => {
    const { power, status } = useStore.getState().player;
    if (status === "transition") return;
    if (power) {
      setPlayer({ power: false });
      stop(T.powerFade, "idle");
    } else powerOn();
  };

  /** Lift lever: raises the needle (pause) or lowers it (play). */
  const toggleNeedle = () => {
    const { power, status } = useStore.getState().player;
    if (!power || status === "transition" || !onPlatter.current) return;
    if (status === "playing") stop(T.pauseFade, "paused");
    else {
      setPlayer({ status: "transition" });
      startPlayback();
    }
   };

  // Song over: the next queued record swaps in, or the turntable stops.
  usePlayer(record.videoId, () =>
    contextSafe(() => {
      const [next] = useStore.getState().queue;
      if (!next) {
        player.seek(0);
        return stop(T.powerFade, "idle");
      }
      playNow(next, () => {
        const rect = queueEl(next.id)?.getBoundingClientRect() ?? null; // measured after the scroll, then it leaves the queue
        useStore.getState().unqueue(next.id);
        return rect;
      });
    })(),
  );

  // Tonearm tracks inward with song progress.
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => {
      gsap.to(armRef.current, { rotation: armAngleAt(progress()), ...T.track, overwrite: "auto" });
      useStore.getState().setPlayer({ positionSec: player.time() });
    }, 250);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    player.setVolume(volume);
    sfx.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    player.setRate(speed / RPM.min);
    if (spin.current?.s.vel) spin.current.to(degPerSec(speed), T.speedShift);
  }, [speed]);

  // Spacebar: play/pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || (e.target as HTMLElement).closest("input, textarea, [role=slider]")) return;
      e.preventDefault();
      contextSafe(useStore.getState().player.power ? toggleNeedle : togglePower)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useGSAP(() => {
    gsap.to(powerThumbRef.current, { xPercent: power ? 100 : 0, ...T.control });
  }, [power]);
  useGSAP(() => {
    gsap.to(leverRef.current, { yPercent: needleUp ? 0 : 150, ...T.control });
  }, [needleUp]);

  const hint =
    status === "playing"
      ? "Click a record to queue it · double-click to play it now"
      : power
        ? "Space to drop the needle"
        : "Pick a record from the wall, or flip the power switch";

  return (
    <section className="flex w-full flex-col items-center gap-10">
      <div className="deck-wrap relative" style={{ width: "min(92vw, 980px, calc((100svh - 240px) * 1.34375))" }}>
      <div ref={scope} className="deck relative w-full" style={{ aspectRatio: "860 / 640" }}>
        <div className="deck-shadow absolute" />
        <div className="deck-edge absolute inset-0" />
        <div className="deck-body absolute inset-0">
          <div className="deck-seam absolute" style={{ left: u(600) }} />
        </div>

        <div className="platter absolute rounded-full" style={circle(CENTER, PLATTER_R)}>
          <div className="mat absolute rounded-full" style={circle({ x: PLATTER_R, y: PLATTER_R }, 246)} />
        </div>
        <Record record={record} recordRef={recordRef} spinRef={spinRef} shadowRef={shadowRef} />
        <StageSleeve sleeveRef={leftSleeve} artRef={leftArt} x={CENTER.x - STAGE} />
        <StageSleeve sleeveRef={rightSleeve} artRef={rightArt} x={CENTER.x + STAGE} />

        <div className="pivot-base absolute rounded-full" style={circle(PIVOT, 50)} />
        <div className="arm-rest absolute" style={{ left: u(REST.x - 16), top: u(REST.y), width: u(32), height: u(22) }} />
        <Tonearm armRef={armRef} layerRef={armLayerRef} />

        <button
          type="button"
          onClick={() => contextSafe(togglePower)()}
          aria-pressed={power}
          aria-label="Power"
          className="deck-focus absolute"
          style={{ left: u(POWER.x - 36), top: u(POWER.y - 14), width: u(72), height: u(28) }}
        >
          <span className="switch-slot absolute inset-0" />
          <span ref={powerThumbRef} className="switch-thumb absolute" />
          <span className="deck-label absolute left-0" style={{ top: u(36) }}>
            Power
          </span>
        </button>
        <span
          className={`led absolute rounded-full ${power ? "led-on" : ""}`}
          style={circle({ x: POWER.x + 56, y: POWER.y }, 5)}
        />

        <button
          type="button"
          onClick={() => contextSafe(toggleNeedle)()}
          aria-pressed={!needleUp}
          aria-label={needleUp ? "Lower the needle" : "Lift the needle"}
          className="deck-focus absolute"
          style={{ left: u(LEVER.x - 14), top: u(LEVER.y - 34), width: u(28), height: u(68) }}
        >
          <span className="lever-slot absolute" />
          <span ref={leverRef} className="lever-handle absolute" />
          <span className="deck-label absolute left-1/2 -translate-x-1/2" style={{ top: u(76) }}>
            Lift
          </span>
        </button>

        <Knob
          label="Volume"
          valueText={`${volume}%`}
          value={volume / 100}
          onChange={(v) => setPlayer({ volume: Math.round(v * 100) })}
          x={796}
          y={330}
          r={34}
        />
        <Knob
          label="Speed"
          valueText={`${Math.round(speed)} RPM`}
          value={(speed - RPM.min) / (RPM.max - RPM.min)}
          onChange={(v) => setPlayer({ speed: RPM.min + v * (RPM.max - RPM.min) })}
          x={796}
          y={460}
          r={30}
        />
      </div>

      {queue.length > 0 && (
        <ol className="queue" aria-label="Up next">
          {queue.map((r, i) => (
            <li
              key={r.id}
              data-queue={r.id}
              className="queue-item"
              style={{ "--i": i, "--r": `${i % 2 ? 1.4 : -1.2}deg` } as CSSProperties}
            >
              <Image src={r.artworkUrl} alt={`Up next: ${r.title} by ${r.artist}`} width={200} height={200} unoptimized />
              <span className="sleeve-wear" aria-hidden />
            </li>
          ))}
        </ol>
      )}
      </div>

      <div className="text-center">
        <p className="text-[15px] font-medium tracking-tight text-ink">{record.title}</p>
        <p className="text-[13px] text-ink-muted">{record.artist}</p>
        <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-ink-muted" aria-live="polite">
          {status === "transition" ? " " : hint}
        </p>
      </div>
    </section>
  );
}
