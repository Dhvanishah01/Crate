"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import { DOUBLE_CLICK_MS } from "@/lib/choreography";
import { WALL_SIZE, useStore, type Record, type Wall as WallT } from "@/lib/store";

const PER_ROW = 5;

/** Small, stable per-record jitter so sleeves look hand-placed rather than gridded. */
function tilt(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return { rotate: ((h % 100) / 100) * 1.6, shift: (((h >> 8) % 100) / 100) * 0.6 };
}

/** One wall: five walnut ledges, up to five face-out sleeves on each. */
export default function Wall({ wall }: { wall: Pick<WallT, "records"> }) {
  const bySlot = new Map(wall.records.map((r) => [r.slot, r]));
  // records off the wall right now (on the platter or queued) leave their spot empty
  const out = useStore(useShallow((s) => [s.record?.id, ...s.queue.map((q) => q.id)]));
  const timer = useRef<number>(undefined);
  const choose = (record: Record, now: boolean) => useStore.getState().choose({ record, now });
  return (
    <div className="wall">
      {Array.from({ length: WALL_SIZE / PER_ROW }, (_, row) => (
        <div key={row} className="wall-row">
          <ul className="wall-sleeves">
            {Array.from({ length: PER_ROW }, (_, col) => {
              const r = bySlot.get(row * PER_ROW + col);
              if (!r) return <li key={col} className="sleeve-slot" aria-hidden />;
              const t = tilt(r.id);
              return (
                <li
                  key={col}
                  className={`sleeve-slot ${out.includes(r.id) ? "is-out" : ""}`}
                  style={{ "--tilt": `${t.rotate}deg`, "--shift": `${t.shift}cqw` } as CSSProperties}
                >
                  <button
                    type="button"
                    data-slot={r.id}
                    className="sleeve"
                    title={`${r.title} — ${r.artist}`}
                    aria-label={`${r.title} by ${r.artist}. Click to queue, double-click to play now.`}
                    onClick={(e) => {
                      window.clearTimeout(timer.current);
                      if (e.detail === 0) return choose(r, false); // keyboard
                      // wait to see if it's a double click; the drum's Draggable swallows the second click, so dblclick decides
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
              );
            })}
          </ul>
          <div className="ledge" aria-hidden />
        </div>
      ))}
    </div>
  );
}
