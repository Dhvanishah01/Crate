"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { T } from "@/lib/choreography";
import { u } from "@/lib/geometry";

gsap.registerPlugin(useGSAP);

type Props = {
  label: string;
  valueText: string;
  value: number; // 0..1
  onChange: (v: number) => void;
  x: number;
  y: number;
  r: number;
};

const DRAG_PX = 160; // drag distance for the full range
const clamp = (v: number) => Math.min(1, Math.max(0, v));
// The mark sweeps the right half, 12 o'clock to 6 o'clock, so it always moves the way the cursor drags.
const angle = (v: number) => v * 180;

/** Drag right or down to turn up, left or up to turn down (the user's choice). Only the pointer mark rotates; the brushed cap's light stays put. */
export default function Knob({ label, valueText, value, onChange, x, y, r }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; v: number; moved: boolean } | null>(null);

  useGSAP(() => {
    gsap.set(ref.current, { rotation: angle(value) });
  });
  useGSAP(() => {
    gsap.to(ref.current, { rotation: angle(value), ...T.control });
  }, [value]);

  const step = (dir: number) => onChange(clamp(value + dir * 0.05));

  return (
    <div className="absolute" style={{ left: u(x - r), top: u(y - r), width: u(2 * r), height: u(2 * r) }}>
      <div className="knob-base absolute inset-0 rounded-full" />
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={valueText}
        onKeyDown={(e) => {
          const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
          if (dir) {
            e.preventDefault();
            step(dir);
          }
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, v: value, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const delta = e.clientX - d.x + (e.clientY - d.y);
          if (Math.abs(delta) > 3) d.moved = true;
          if (d.moved) onChange(clamp(d.v + delta / DRAG_PX));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        className="deck-focus absolute inset-0 cursor-grab touch-none active:cursor-grabbing rounded-full"
      >
        <span className="knob-mark absolute" />
      </div>
      <span className="deck-label absolute left-1/2 -translate-x-1/2" style={{ top: u(2 * r + 10) }}>
        {label}
      </span>
    </div>
  );
}
