"use client";

import AddRecord from "./AddRecord";
import { WALL_SIZE, useStore, type Wall } from "@/lib/store";

/** The wall's name and position, the arrows to the next wall, the owner's +, and the way back. */
export default function WallUI({ walls, owner }: { walls: Wall[]; owner: boolean }) {
  const front = useStore((s) => s.front);
  const zoomed = useStore((s) => s.zoomed);
  const setFront = useStore((s) => s.setFront);
  const n = walls.length;
  const current = walls[front];
  if (!n && !owner) return null;
  const options = walls.map((w) => ({ id: w.id, name: w.name, full: w.records.length >= WALL_SIZE }));

  return (
    <div className="wall-ui" aria-live="polite">
      <div className="wall-ui-name">
        {n > 1 && (
          <button type="button" aria-label="Previous wall" disabled={front === 0} onClick={() => setFront(front - 1)}>
            ‹
          </button>
        )}
        <div>
          <p className="wall-ui-meta">{n > 1 ? `Wall ${front + 1} of ${n}` : "Wall"}</p>
          <h2>{current?.name ?? "Your first wall"}</h2>
          <p className="wall-ui-meta">{current ? `${current.records.length} of ${WALL_SIZE} records` : "Add a record to start it"}</p>
        </div>
        {n > 1 && (
          <button type="button" aria-label="Next wall" disabled={front === n - 1} onClick={() => setFront(front + 1)}>
            ›
          </button>
        )}
      </div>
      {owner && <AddRecord walls={options} defaultWall={current?.id} />}
      {zoomed ? (
        <button type="button" className="wall-ui-close" onClick={() => useStore.getState().setZoomed(false)}>
          ← Back to the turntable
        </button>
      ) : (
        n > 0 && (
          <button type="button" className="wall-ui-close" onClick={() => useStore.getState().setZoomed(true)}>
            Walk up to the wall →
          </button>
        )
      )}
    </div>
  );
}
