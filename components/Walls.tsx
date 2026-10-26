import Image from "next/image";
import AddRecord from "./AddRecord";
import { WALL_SIZE, getWalls } from "@/lib/db";
import { isOwner } from "@/lib/owner";

// shortcut: plain stacked grids for step 1; walnut ledges and the revolving drum replace this in step 2
export default async function Walls() {
  const [walls, owner] = await Promise.all([getWalls(), isOwner()]);
  if (!walls.length && !owner) return null;
  const options = walls.map((w) => ({ id: w.id, name: w.name, full: w.records.length >= WALL_SIZE }));

  return (
    <section aria-label="Record walls" className="flex w-full max-w-[980px] flex-col gap-10">
      {walls.map((wall) => (
        <div key={wall.id} className="flex flex-col gap-4">
          <h2 className="text-[13px] font-medium uppercase tracking-[0.2em] text-ink-muted">
            {wall.name} <span className="font-normal opacity-60">· {wall.records.length}/{WALL_SIZE}</span>
          </h2>
          <ul className="grid grid-cols-5 gap-4">
            {wall.records.map((r) => (
              <li key={r.id} className="flex flex-col gap-1.5">
                <Image
                  src={r.artworkUrl}
                  alt=""
                  width={300}
                  height={300}
                  unoptimized
                  className="aspect-square w-full rounded-[2px] object-cover shadow-[0_6px_14px_rgb(40_30_20/0.3)]"
                />
                <span className="truncate text-[12px] font-medium text-ink">{r.title}</span>
                <span className="-mt-1 truncate text-[11px] text-ink-muted">{r.artist}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!walls.length && <p className="text-[13px] text-ink-muted">No walls yet. Add your first record to start one.</p>}
      {owner && (
        <div className="flex justify-end">
          <AddRecord walls={options} defaultWall={walls.at(-1)?.id} />
        </div>
      )}
    </section>
  );
}
