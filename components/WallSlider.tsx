"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { useGSAP } from "@gsap/react";
import { at } from "./Room";
import { DOUBLE_CLICK_MS, T, WALL_THROW } from "@/lib/choreography";
import { useStore, type Record, type Wall } from "@/lib/store";
import layout from "@/lib/room-layout.json";

gsap.registerPlugin(Draggable, InertiaPlugin, useGSAP);

const L = layout.ledges;
/** A slot's spot inside the ledges area, as fractions of it. */
const slotStyle = (i: number): CSSProperties => {
  const s = layout.slots[i];
  return at({ x: (s.x - L.x) / L.w, y: (s.y - L.y) / L.h, w: s.w / L.w, h: s.h / L.h });
};

/** Small, stable per-record tilt so sleeves look hand-placed. */
function tilt(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `${((h % 100) / 100) * 0.9}deg`;
}

/**
 * The record walls, hung on the room's rendered ledges. One wall shows at a time; drag sideways (or use
 * the arrows) and its sleeves slide along the ledges while the next wall's slide in.
 */
export default function WallSlider({ walls }: { walls: Wall[] }) {
  const view = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<Draggable | null>(null);
  const timer = useRef<number>(undefined);
  const front = useStore((s) => s.front);
  const zoomed = useStore((s) => s.zoomed);
  const out = useStore(useShallow((s) => [s.record?.id, ...s.queue.map((q) => q.id)]));
  const n = walls.length;

  useEffect(() => useStore.getState().setLibrary(walls.flatMap((w) => w.records)), [walls]);

  useGSAP(
    () => {
      const width = () => view.current!.offsetWidth;
      const settle = () =>
        useStore.getState().setFront(Math.min(n - 1, Math.max(0, Math.round(-Number(gsap.getProperty(track.current, "x")) / width()))));
      [drag.current] = Draggable.create(track.current, {
        type: "x",
        trigger: view.current,
        inertia: true,
        dragClickables: true, // sleeves are buttons; drags can still start on them
        minimumMovement: 6,
        edgeResistance: 0.85,
        bounds: { minX: -width() * Math.max(0, n - 1), maxX: 0 },
        snap: (x) => Math.round(x / width()) * width(),
        ...WALL_THROW,
        onDragEnd: settle,
        onThrowComplete: settle,
        onClick() {
          if (!useStore.getState().zoomed) useStore.getState().setZoomed(true); // from across the room, a click walks up to the wall
        },
      });
      // the room scales with the window, so the distance between walls does too
      const resize = () => {
        drag.current?.applyBounds({ minX: -width() * Math.max(0, n - 1), maxX: 0 });
        gsap.set(track.current, { x: -useStore.getState().front * width() });
      };
      window.addEventListener("resize", resize);
      return () => {
        window.removeEventListener("resize", resize);
        drag.current?.kill();
      };
    },
    { scope: view, dependencies: [n], revertOnUpdate: true },
  );

  // arrows (or a drag settling) choose the wall; slide there unless a drag is already carrying it
  useGSAP(() => {
    if (drag.current?.isDragging || drag.current?.isThrowing) return;
    gsap.to(track.current, { x: -front * view.current!.offsetWidth, ...T.wallSlide });
  }, [front]);

  const choose = (record: Record, now: boolean) => useStore.getState().choose({ record, now });

  return (
    <div ref={view} className={`wall-view ${zoomed ? "is-zoomed" : ""}`} style={at(L)} role="region" aria-label={zoomed ? "Record wall" : "Record wall. Click to walk up to it."}>
      <div ref={track} className="wall-track">
        {walls.map((wall, wi) => (
          <ul key={wall.id} className="wall-page" style={{ left: `${wi * 100}%` }} data-front={wi === front} aria-hidden={wi !== front}>
            {wall.records.map((r) => (
              <li key={r.id} className={`wall-sleeve ${out.includes(r.id) ? "is-out" : ""}`} style={{ ...slotStyle(r.slot), "--tilt": tilt(r.id) } as CSSProperties}>
                <button
                  type="button"
                  data-slot={r.id}
                  className="sleeve"
                  tabIndex={zoomed && wi === front ? 0 : -1}
                  title={`${r.title} — ${r.artist}`}
                  aria-label={`${r.title} by ${r.artist}. Click to queue, double-click to play now.`}
                  onClick={(e) => {
                    window.clearTimeout(timer.current);
                    if (e.detail === 0) return choose(r, false); // keyboard
                    // wait to see if it's a double click; Draggable swallows the second click, so dblclick decides
                    if (e.detail === 1) timer.current = window.setTimeout(() => choose(r, false), DOUBLE_CLICK_MS);
                  }}
                  onDoubleClick={() => {
                    window.clearTimeout(timer.current);
                    choose(r, true);
                  }}
                >
                  <Image src={r.artworkUrl} alt="" width={300} height={300} unoptimized draggable={false} />
                  <span className="sleeve-wear" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
