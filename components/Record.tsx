import { useId, type Ref } from "react";
import type { Record as RecordT } from "@/lib/store";
import { CENTER, LABEL_R, RECORD_R, circle, u } from "@/lib/geometry";

type Props = {
  record: RecordT;
  recordRef: Ref<HTMLDivElement>;
  spinRef: Ref<HTMLDivElement>;
  shadowRef: Ref<HTMLDivElement>;
};

const TITLE_R = 96; // just outside the label, in the run-in area like reference 03

/** Five layers: vinyl, grooves and label spin together; glare and shadow never rotate. */
export default function Record({ record, recordRef, spinRef, shadowRef }: Props) {
  const id = useId();
  const box = circle(CENTER, RECORD_R);
  return (
    <>
      <div
        ref={shadowRef}
        className="invisible absolute rounded-full bg-black"
        style={{ ...box, filter: `blur(${u(9)})` }}
      />
      <div ref={recordRef} className="invisible absolute" style={box}>
        <div ref={spinRef} className="absolute inset-0 will-change-transform">
          <div className="vinyl absolute inset-0 rounded-full" style={{ "--tint": record.palette.vinyl } as React.CSSProperties} />
          <div className="grooves absolute inset-0 rounded-full" />
          <svg viewBox={`${-RECORD_R} ${-RECORD_R} ${RECORD_R * 2} ${RECORD_R * 2}`} className="absolute inset-0 size-full">
            <defs>
              <clipPath id={`${id}-label`}>
                <circle r={LABEL_R} />
              </clipPath>
              <radialGradient id={`${id}-paper`}>
                <stop offset="0.7" stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#000" stopOpacity="0.28" />
              </radialGradient>
              <filter id={`${id}-grain`}>
                <feTurbulence baseFrequency="0.9" numOctaves="2" seed="3" />
                <feColorMatrix type="saturate" values="0" />
                <feComposite in2="SourceGraphic" operator="in" />
              </filter>
              <path
                id={`${id}-arc`}
                d={`M ${-TITLE_R},0 a ${TITLE_R},${TITLE_R} 0 1,1 ${TITLE_R * 2},0 a ${TITLE_R},${TITLE_R} 0 1,1 ${-TITLE_R * 2},0`}
              />
            </defs>
            <image
              href={record.artworkUrl}
              x={-LABEL_R}
              y={-LABEL_R}
              width={LABEL_R * 2}
              height={LABEL_R * 2}
              clipPath={`url(#${id}-label)`}
              preserveAspectRatio="xMidYMid slice"
            />
            <circle r={LABEL_R} fill={`url(#${id}-paper)`} />
            <circle r={LABEL_R} fill="#fff" filter={`url(#${id}-grain)`} opacity="0.14" style={{ mixBlendMode: "multiply" }} />
            <circle r={LABEL_R - 0.5} fill="none" stroke="#000" strokeOpacity="0.35" />
            <text className="font-hand" fill="#fff" fillOpacity="0.88" fontSize="15" letterSpacing="2.5" textAnchor="middle">
              <textPath href={`#${id}-arc`} startOffset="25%">
                {record.title}
              </textPath>
            </text>
          </svg>
        </div>
        <div className="glare pointer-events-none absolute inset-0 rounded-full" />
        <div className="spindle absolute rounded-full" style={circle({ x: RECORD_R, y: RECORD_R }, 5)} />
      </div>
    </>
  );
}
