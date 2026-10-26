"use client";

import { useActionState, useRef, useState } from "react";
import { addRecord, type FormState } from "@/app/actions";

type WallOption = { id: string; name: string; full: boolean };

const field = "add-field";

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
        className="wall-ui-walk wall-ui-add"
      >
        +
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="add-title"
        className="add-dialog"
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
      >
        <form action={action} className="add-form">
          <p className="wall-ui-meta">Owner</p>
          <h2 id="add-title">Add a record</h2>

          <label htmlFor="add-link" className="wall-ui-meta">
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

          <label htmlFor="add-wall" className="wall-ui-meta">
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

          <p aria-live="polite" className="add-status">
            {pending ? (
              <span className="add-muted">Checking the link…</span>
            ) : state.error ? (
              <span role="alert" className="add-error">
                {state.error}
              </span>
            ) : state.added ? (
              <span className="add-ok">Added “{state.added}”.</span>
            ) : null}
          </p>

          <div className="add-actions">
            <button type="button" onClick={() => dialog.current?.close()} className="wall-ui-walk add-quiet">
              Close
            </button>
            <button type="submit" disabled={pending} className="wall-ui-walk add-primary">
              Add
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
