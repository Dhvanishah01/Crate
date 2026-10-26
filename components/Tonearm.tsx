import type { Ref } from "react";
import { ARM_L, PIVOT, u } from "@/lib/geometry";

type Props = { armRef: Ref<HTMLDivElement>; layerRef: Ref<HTMLDivElement>; onToggle: () => void };

const TOP = -90; // counterweight reaches this far behind the pivot
const H = ARM_L + 10 - TOP;
const HEAD = ARM_L - 72; // headshell top

/** The static layer carries the shadow so it never turns with the arm; the inner div rotates about the pivot. */
export default function Tonearm({ armRef, layerRef, onToggle }: Props) {
  return (
    <div ref={layerRef} className="tonearm-layer pointer-events-none absolute inset-0">
      <div ref={armRef} className="absolute" style={{ left: u(PIVOT.x), top: u(PIVOT.y), width: 0, height: 0 }}>
        <svg
          viewBox={`-40 ${TOP} 80 ${H}`}
          className="tonearm-hit absolute"
          style={{ left: u(-40), top: u(TOP), width: u(80), height: u(H) }}
          // clicking the arm itself lifts or lowers the needle, like the Lift lever (which is the keyboard way)
          onClick={onToggle}
          aria-hidden
        >
          <defs>
            <linearGradient id="chrome" x1="0" x2="1">
              <stop offset="0" stopColor="#5f6266" />
              <stop offset="0.3" stopColor="#eef0f2" />
              <stop offset="0.48" stopColor="#a9adb2" />
              <stop offset="0.62" stopColor="#ffffff" />
              <stop offset="1" stopColor="#6d7075" />
            </linearGradient>
            <radialGradient id="gimbal" cx="0.35" cy="0.3">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.6" stopColor="#a4a8ad" />
              <stop offset="1" stopColor="#4f5257" />
            </radialGradient>
          </defs>
          {/* counterweight */}
          <rect x="-6" y="-40" width="12" height="40" fill="url(#chrome)" />
          <rect x="-21" y="-86" width="42" height="50" rx="7" fill="url(#chrome)" />
          <rect x="-21" y="-70" width="42" height="2" fill="#000" opacity="0.35" />
          <rect x="-21" y="-54" width="42" height="2" fill="#000" opacity="0.35" />
          {/* tube */}
          <rect x="-5" y="0" width="10" height={HEAD + 8} rx="5" fill="url(#chrome)" />
          <circle r="19" fill="url(#gimbal)" />
          <circle r="8" fill="#1b1c1e" />
          {/* headshell */}
          <path d={`M 14 ${HEAD + 12} L 36 ${HEAD + 4}`} stroke="#0e0e0f" strokeWidth="7" strokeLinecap="round" />
          <rect x="-15" y={HEAD} width="30" height="64" rx="4" fill="#121213" />
          <rect x="-11" y={HEAD + 8} width="22" height="28" rx="2" fill="#dfe1e3" />
          <circle cx="-5" cy={HEAD + 16} r="3" fill="#55585c" />
          <circle cx="5" cy={HEAD + 28} r="3" fill="#55585c" />
          <rect x="-9" y={ARM_L - 12} width="18" height="12" rx="2" fill="#070708" />
          <circle cx="0" cy={ARM_L} r="1.5" fill="#c9ccd0" />
        </svg>
      </div>
    </div>
  );
}
