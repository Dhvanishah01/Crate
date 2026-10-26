"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { T } from "@/lib/choreography";
import layout from "@/lib/room-layout.json";

gsap.registerPlugin(useGSAP);

type Rect = { x: number; y: number; w: number; h: number };
const at = (r: Rect): CSSProperties => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });

// shortcut: "night" is 7pm to 7am local time, not true sunset; use the visitor's location if that ever matters
const isNightNow = () => {
  const h = new Date().getHours();
  return h >= 19 || h < 7;
};

/**
 * The listening room: a Blender render (day and night) with the live record walls hung on its empty wall,
 * a clock showing the real time, and the bulb lamp as the night switch.
 */
export default function Room({ children }: { children: ReactNode }) {
  const nightLayer = useRef<HTMLDivElement>(null);
  const manual = useRef(false); // once the lamp is clicked, the clock no longer decides
  const [night, setNight] = useState(false);
  const [now, setNow] = useState<Date | null>(null); // client only, so server and client HTML agree

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
    document.documentElement.toggleAttribute("data-night", night);
  }, [night]);

  useGSAP(() => {
    gsap.to(nightLayer.current, { autoAlpha: night ? 1 : 0, ...T.nightFade });
  }, [night]);

  const hours = now ? now.getHours() % 12 || 12 : null;
  const minutes = now ? String(now.getMinutes()).padStart(2, "0") : null;
  const [w, h] = layout.aspect;

  return (
    <section aria-label="Listening room" className="room relative w-full" style={{ aspectRatio: `${w} / ${h}` }}>
      <Image src="/room/day-2000.webp" alt="" fill priority sizes="(max-width: 1400px) 100vw, 1400px" className="room-photo" />
      <div ref={nightLayer} className="room-night absolute inset-0">
        <Image src="/room/night-2000.webp" alt="" fill sizes="(max-width: 1400px) 100vw, 1400px" className="room-photo" />
      </div>

      <div className="room-clock absolute" style={at(layout.clock)} aria-label={now ? `It's ${hours}:${minutes}` : undefined} role="timer">
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
        className="room-lamp absolute"
        style={at(layout.bulb)}
      />

      <div className="room-shelves absolute" style={at(layout.shelves)}>
        {children}
      </div>
    </section>
  );
}
