"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { useGSAP } from "@gsap/react";
import Wall from "./Wall";
import AddRecord from "./AddRecord";
import { DRUM_THROW, T } from "@/lib/choreography";
import { WALL_SIZE, useStore, type Wall as WallT } from "@/lib/store";

gsap.registerPlugin(Draggable, InertiaPlugin, useGSAP);

const DRAG_PER_WALL = 0.6; // drag this fraction of the drum's width to turn one wall

/** Drum radius in cqw (wall width = 100) so n walls just clear each other around the circle. */
const radiusFor = (n: number) => (n < 2 ? 0 : n === 2 ? 30 : 50 / Math.tan(Math.PI / n) + 6);

/** Walls stand around a revolving drum. One faces you; drag (or arrow keys) to turn to the next. */
export default function WallDrum({ walls, owner }: { walls: WallT[]; owner: boolean }) {
  const drum = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const proxy = useRef<HTMLDivElement>(null);
  const sync = useRef<() => void>(() => {});
  const [front, setFront] = useState(0);
  const n = walls.length;
  const step = 360 / Math.max(n, 1);
  const wrap = (i: number) => ((i % n) + n) % n;

  useEffect(() => useStore.getState().setLibrary(walls.flatMap((w) => w.records)), [walls]);

  const { contextSafe } = useGSAP(
    () => {
      if (n < 2) return;
      const px = () => drum.current!.offsetWidth * DRAG_PER_WALL;
      const faces = gsap.utils.toArray<HTMLElement>(".drum-face", ring.current);
      const update = () => {
        const x = Number(gsap.getProperty(proxy.current, "x"));
        const rot = (x / px()) * step;
        gsap.set(ring.current, { rotationY: rot });
        faces.forEach((f, i) => {
          const off = Math.abs(gsap.utils.wrap(-180, 180, i * step + rot));
          // solid until well past the side, then gone, so only the wall facing you shows at rest
          gsap.set(f, { autoAlpha: gsap.utils.clamp(0, 1, (step * 0.95 - off) / (step * 0.35)) });
        });
        setFront(wrap(Math.round(-x / px())));
      };
      sync.current = update;
      update();
      const [d] = Draggable.create(proxy.current, {
        type: "x",
        trigger: drum.current,
        inertia: true,
        minimumMovement: 6,
        dragClickables: true, // sleeves are buttons; drags can still start on them
        cursor: "grab",
        activeCursor: "grabbing",
        snap: (x) => Math.round(x / px()) * px(),
        ...DRUM_THROW,
        onDrag: update,
        onThrowUpdate: update,
      });
      return () => d.kill();
    },
    { scope: drum, dependencies: [n], revertOnUpdate: true },
  );

  const turn = (dir: number) => {
    if (n < 2) return;
    const px = drum.current!.offsetWidth * DRAG_PER_WALL;
    const x = Number(gsap.getProperty(proxy.current, "x"));
    gsap.to(proxy.current, {
      x: (Math.round(x / px) - dir) * px,
      ...T.drumTurn,
      onUpdate: () => sync.current(),
    });
  };

  const current = walls[front];
  if (!n && !owner) return null;
  const options = walls.map((w) => ({ id: w.id, name: w.name, full: w.records.length >= WALL_SIZE }));

  return (
    <section aria-label="Record walls" className="walls">
      <header className="walls-plaque" aria-live="polite">
        <h2 className="walls-name">{current?.name ?? "Your first wall"}</h2>
        <p className="walls-meta">
          {current ? `${current.records.length} of ${WALL_SIZE} records` : "Add a record to start it"}
          {n > 1 && ` · wall ${front + 1} of ${n}`}
        </p>
        {n > 1 && (
          <div className="walls-dots" aria-hidden>
            {walls.map((w, i) => (
              <span key={w.id} className={i === front ? "is-front" : ""} />
            ))}
          </div>
        )}
      </header>

      <div
        ref={drum}
        role="region"
        aria-roledescription="carousel"
        aria-label={n > 1 ? "Drag sideways or use the arrow keys to turn to another wall" : "Record wall"}
        tabIndex={n > 1 ? 0 : -1}
        onKeyDown={(e) => {
          const dir = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
          if (dir) {
            e.preventDefault();
            contextSafe(turn)(dir);
          }
        }}
        className="drum deck-focus relative w-full select-none"
      >
        <div ref={proxy} className="hidden" />
        <div className="drum-depth" style={{ "--r": `${radiusFor(n)}cqw` } as CSSProperties}>
          <div ref={ring} className="drum-ring">
            {(n ? walls : [{ id: "empty", name: "", records: [] }]).map((w, i) => (
              <div
                key={w.id}
                className={`drum-face ${i === front ? "" : "pointer-events-none"}`}
                style={{ "--a": `${i * step}deg` } as CSSProperties}
                aria-hidden={i !== front}
              >
                <Wall wall={w} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {owner && (
        <div className="walls-add">
          <AddRecord walls={options} defaultWall={current?.id} />
        </div>
      )}
    </section>
  );
}
