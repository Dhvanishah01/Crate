"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Record from "./Record";
import Tonearm from "./Tonearm";
import Knob from "./Knob";
import { SEED, useStore } from "@/lib/store";
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
  liftArm,
  swingTo,
} from "@/lib/choreography";
import { CENTER, PIVOT, PLATTER_R, armAngleAt, circle, u } from "@/lib/geometry";

gsap.registerPlugin(useGSAP);

const POWER = { x: 92, y: 578 };
const LEVER = { x: 772, y: 150 };
const REST = { x: 690, y: 506 };

export default function Turntable() {
  const scope = useRef<HTMLDivElement>(null);
  const recordRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const armRef = useRef<HTMLDivElement>(null);
  const armLayerRef = useRef<HTMLDivElement>(null);
  const powerThumbRef = useRef<HTMLSpanElement>(null);
  const leverRef = useRef<HTMLSpanElement>(null);
  const spin = useRef<ReturnType<typeof createSpin> | null>(null);
  const onPlatter = useRef(false);

  const power = useStore((s) => s.player.power);
  const status = useStore((s) => s.player.status);
  const speed = useStore((s) => s.player.speed);
  const volume = useStore((s) => s.player.volume);
  const setPlayer = useStore((s) => s.setPlayer);
  const record = SEED;
  const needleUp = status !== "playing";

  const arm = () => ({ arm: armRef.current!, layer: armLayerRef.current! });
  const progress = () => player.time() / player.duration();

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

  const powerOn = () => {
    player.unlock(); // this tap unlocks audio on iOS
    setPlayer({ power: true, status: "transition" });
    const tl = gsap.timeline();
    if (!onPlatter.current) {
      onPlatter.current = true;
      tl.add(dropOnPlatter({ record: recordRef.current!, shadow: shadowRef.current! }));
    }
    tl.add(startPlayback());
   };

  /** Arm back to rest and platter to a stop. Used by pause, power off and the song ending. */
  const stop = (fade: gsap.TweenVars, end: "idle" | "paused" = "idle") => {
    setPlayer({ status: "transition" });
    sfx.crackle(false);
    player.fadeTo(0, fade).then(() => player.pause());
    gsap
      .timeline()
      .add(armHome(arm(), sfx.click))
      .add(spin.current!.to(0, T.spinDown), 0)
      .call(() => setPlayer({ status: end }));
   };

  const togglePower = () => {
    const { power, status } = useStore.getState().player;
    if (status === "transition") return;
    if (power) {
      setPlayer({ power: false });
      stop(T.powerFade);
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

  usePlayer(record.videoId, () =>
    contextSafe(() => {
      player.seek(0);
      stop(T.powerFade);
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
    status === "playing" ? "Space to lift the needle" : power ? "Space to drop the needle" : "Flip the power switch to play";

  return (
    <section className="flex w-full flex-col items-center gap-10">
      <div
        ref={scope}
        className="deck relative"
        style={{ width: "min(92vw, 980px, calc((100svh - 240px) * 1.34375))", aspectRatio: "860 / 640" }}
      >
        <div className="deck-shadow absolute" />
        <div className="deck-edge absolute inset-0" />
        <div className="deck-body absolute inset-0">
          <div className="deck-seam absolute" style={{ left: u(600) }} />
        </div>

        <div className="platter absolute rounded-full" style={circle(CENTER, PLATTER_R)}>
          <div className="mat absolute rounded-full" style={circle({ x: PLATTER_R, y: PLATTER_R }, 246)} />
        </div>
        <Record record={record} recordRef={recordRef} spinRef={spinRef} shadowRef={shadowRef} />

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
