"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { T } from "@/lib/choreography";
import { useStore } from "@/lib/store";
import layout from "@/lib/room-layout.json";

gsap.registerPlugin(useGSAP);

type Rect = { x: number; y: number; w: number; h: number };
export const at = (r: Rect): CSSProperties => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });

// shortcut: "night" is 7pm to 7am local time, not true sunset; use the visitor's location if that ever matters
const isNightNow = () => {
  const h = new Date().getHours();
  return h >= 19 || h < 7;
};

/**
 * Walking up to the wall scales the framed room (origin at its top left) until the record wall sits
 * left of centre, leaving the right side for the wall's name and the queue.
 */
function zoomTarget(frame: DOMRect, stage: DOMRect) {
  const narrow = window.innerWidth < 720;
  const wall = layout.wall;
  const w = wall.w * stage.width;
  const h = wall.h * stage.height;
  const scale = Math.min((window.innerWidth * (narrow ? 0.96 : 0.62)) / w, (window.innerHeight * 0.84) / h);
  const cx = stage.x + (wall.x + wall.w / 2) * stage.width;
  const cy = stage.y + (wall.y + wall.h / 2) * stage.height;
  const tx = window.innerWidth * (narrow ? 0.5 : 0.42);
  const ty = window.innerHeight * (narrow ? 0.42 : 0.5);
  // up next sits just right of the wall's ledges once you're up close
  const ledgesRight = (layout.ledges.x + layout.ledges.w - wall.x - wall.w / 2) * stage.width * scale + tx;
  const ledgesTop = (layout.ledges.y - wall.y - wall.h / 2) * stage.height * scale + ty;
  document.documentElement.style.setProperty("--zoom-ledges-right", `${Math.round(ledgesRight)}px`);
  document.documentElement.style.setProperty("--zoom-ledges-top", `${Math.round(ledgesTop)}px`);
  return { scale, x: tx - frame.x - scale * (cx - frame.x), y: ty - frame.y - scale * (cy - frame.y) };
}

/**
 * The listening room: a Blender render (golden hour and night) with the live sleeves on its ledges,
 * a clock showing the real time, and the brass lamp as the night switch. Clicking the wall walks you
 * up to it: the whole room scales toward the wall.
 */
export default function Room({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const nightLayer = useRef<HTMLDivElement>(null);
  const manual = useRef(false); // once the lamp is clicked, the clock no longer decides
  const [night, setNight] = useState(false);
  const [now, setNow] = useState<Date | null>(null); // client only, so server and client HTML agree
  const zoomed = useStore((s) => s.zoomed);

  useEffect(() => {
    const tick = () => {
      setNow(new Date());
      if (!manual.current) setNight(isNightNow());
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.toggleAttribute("data-night", night);
    html.style.setProperty("--scene-bg", night ? layout.bg.night : layout.bg.day); // the room's own wall colour
  }, [night]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-zoomed", zoomed);
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && useStore.getState().setZoomed(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  useGSAP(() => {
    gsap.to(nightLayer.current, { autoAlpha: night ? 1 : 0, ...T.nightFade });
  }, [night]);

  useGSAP(() => {
    const el = frame.current!;
    if (zoomed) {
      gsap.set(el, { x: 0, y: 0, scale: 1 }); // measure the room at rest
      gsap.to(el, { ...zoomTarget(el.getBoundingClientRect(), stage.current!.getBoundingClientRect()), transformOrigin: "0 0", ...T.zoomIn });
    } else gsap.to(el, { x: 0, y: 0, scale: 1, transformOrigin: "0 0", ...T.zoomOut });
  }, [zoomed]);

  const hours = now ? now.getHours() % 12 || 12 : null;
  const minutes = now ? String(now.getMinutes()).padStart(2, "0") : null;

  return (
    <div ref={frame} className="room-frame">
    <div
      ref={stage}
      className="room-stage"
      onClick={(e) => zoomed && e.target === e.currentTarget && useStore.getState().setZoomed(false)}
    >
      <Image src={layout.images.day} alt="" fill priority sizes="(max-width: 720px) 200vw, 160vw" className="room-photo" />
      <div ref={nightLayer} className="room-night">
        <Image src={layout.images.night} alt="" fill sizes="(max-width: 720px) 200vw, 160vw" className="room-photo" />
      </div>
      {/* a click on the room around the wall steps back */}
      <div className="room-backdrop" onClick={() => useStore.getState().setZoomed(false)} />

      <div className="room-clock" style={at(layout.clock)} aria-label={now ? `It's ${hours}:${minutes}` : undefined} role="timer">
        {now && (
          <span>
            {hours}
            <span className="room-clock-colon">:</span>
            {minutes}
          </span>
        )}
      </div>

      <button
        type="button"
        aria-pressed={night}
        aria-label={night ? "Turn the lamp off" : "Turn the lamp on"}
        title="Lamp"
        onClick={() => {
          manual.current = true;
          setNight((n) => !n);
        }}
        className="room-lamp"
        style={at(layout.lamp)}
      />

      {children}
    </div>
    </div>
  );
}
