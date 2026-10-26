"use client";

import { useActionState, useRef, useState } from "react";
import { addRecord, type FormState } from "@/app/actions";

type WallOption = { id: string; name: string; full: boolean };

const field = "rounded-lg border border-black/15 bg-white/70 px-3 py-2 text-[15px] outline-none focus:border-ink";

/** Owner-only + button: paste a YouTube link, pick a wall (or start one), and the server presses the record. */
export default function AddRecord({ walls, defaultWall }: { walls: WallOption[]; defaultWall?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const firstOpen = walls.find((w) => w.id === defaultWall && !w.full) ?? walls.find((w) => !w.full);
  const [wall, setWall] = useState(firstOpen?.id ?? "new");
  // controlled, so a failed check keeps the pasted link (React resets uncontrolled fields after every action)
  const [link, setLink] = useState("");
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const next = await addRecord(prev, form);
    if (next.added) {
      setLink("");
      setWall(next.wallId!); // a just-created wall becomes the target for the next add
    }
    return next;
  }, {} as FormState);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // default to the wall you're looking at, if it has room
          if (walls.some((w) => w.id === defaultWall && !w.full)) setWall(defaultWall!);
          dialog.current?.showModal();
        }}
        aria-label="Add a record"
        className="grid size-10 place-items-center rounded-full bg-ink text-[22px] leading-none text-[#f3efe7] shadow-[0_6px_16px_rgb(40_30_20/0.35)] transition-transform hover:scale-105"
      >
        +
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="add-title"
        className="m-auto w-[min(92vw,420px)] rounded-2xl bg-[#f8f5ef] p-6 text-ink shadow-2xl backdrop:bg-black/40"
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
      >
        <form action={action} className="flex flex-col gap-3">
          <h2 id="add-title" className="text-[17px] font-medium">
            Add a record
          </h2>

          <label htmlFor="add-link" className="text-[13px] text-ink-muted">
            YouTube link
          </label>
          <input
            id="add-link"
            name="link"
            required
            inputMode="url"
            placeholder="https://youtu.be/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className={field}
          />

          <label htmlFor="add-wall" className="text-[13px] text-ink-muted">
            Wall
          </label>
          <select id="add-wall" name="wall" value={wall} onChange={(e) => setWall(e.target.value)} className={field}>
            {walls.map((w) => (
              <option key={w.id} value={w.id} disabled={w.full}>
                {w.name}
                {w.full ? " (full)" : ""}
              </option>
            ))}
            <option value="new">New wall…</option>
          </select>
          {wall === "new" && (
            <input name="newWall" required maxLength={60} placeholder="Name it like an album, e.g. 2016 vibes" aria-label="New wall name" className={field} />
          )}

          <p aria-live="polite" className="min-h-5 text-[13px]">
            {pending ? (
              <span className="text-ink-muted">Checking the link…</span>
            ) : state.error ? (
              <span role="alert" className="text-[#b3261e]">
                {state.error}
              </span>
            ) : state.added ? (
              <span className="text-[#2f6b3a]">Added “{state.added}”.</span>
            ) : null}
          </p>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg px-3 py-2 text-[14px] text-ink-muted">
              Close
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-ink px-4 py-2 text-[14px] font-medium text-[#f3efe7] disabled:opacity-60">
              Add
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
