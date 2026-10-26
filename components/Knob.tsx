"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { useGSAP } from "@gsap/react";
import { T } from "@/lib/choreography";
import { u } from "@/lib/geometry";

gsap.registerPlugin(Draggable, useGSAP);

type Props = {
  label: string;
  valueText: string;
  value: number; // 0..1
  onChange: (v: number) => void;
  x: number;
  y: number;
  r: number;
  sweep?: number; // degrees either side of 12 o'clock
  detents?: number[]; // snap values, 0..1
};

/** Draggable knob. Only the pointer mark rotates; the brushed cap's light stays put. */
export default function Knob({ label, valueText, value, onChange, x, y, r, sweep = 135, detents }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Draggable | null>(null);
  const change = useRef(onChange);
  const current = useRef(value);
  useEffect(() => {
    change.current = onChange;
    current.current = value;
  });
  const angle = (v: number) => -sweep + v * sweep * 2;
  const valueAt = (rot: number) => (rot + sweep) / (sweep * 2);

  useGSAP(
    () => {
      gsap.set(ref.current, { rotation: angle(value) });
      drag.current = Draggable.create(ref.current, {
        type: "rotation",
        bounds: { minRotation: -sweep, maxRotation: sweep },
        liveSnap: detents?.map(angle),
        onDrag() {
          change.current(valueAt(this.rotation));
        },
        onClick() {
          // a tap on a detent knob flips to the next detent
          if (detents) change.current(detents[(detents.indexOf(current.current) + 1) % detents.length]);
        },
      })[0];
      return () => drag.current?.kill();
    },
    { scope: ref },
  );

  useGSAP(() => {
    if (!drag.current?.isDragging) gsap.to(ref.current, { rotation: angle(value), ...T.control });
  }, [value]);

  const step = (dir: number) => {
    if (detents) {
      const i = detents.indexOf(value) + dir;
      if (i >= 0 && i < detents.length) onChange(detents[i]);
    } else onChange(Math.min(1, Math.max(0, value + dir * 0.05)));
  };

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
        className="deck-focus absolute inset-0 cursor-grab rounded-full active:cursor-grabbing"
      >
        <span className="knob-mark absolute" />
      </div>
      <span className="deck-label absolute left-1/2 -translate-x-1/2" style={{ top: u(2 * r + 10) }}>
        {label}
      </span>
    </div>
  );
}
