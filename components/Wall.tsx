import Image from "next/image";
import type { CSSProperties } from "react";
import { WALL_SIZE, type Wall as WallT } from "@/lib/store";

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
                  className="sleeve-slot"
                  style={{ "--tilt": `${t.rotate}deg`, "--shift": `${t.shift}cqw` } as CSSProperties}
                >
                  <div className="sleeve" title={`${r.title} — ${r.artist}`}>
                    <Image src={r.artworkUrl} alt={`${r.title} by ${r.artist}`} width={300} height={300} unoptimized draggable={false} />
                    <span className="sleeve-wear" aria-hidden />
                  </div>
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
