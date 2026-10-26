"use client";

import { useActionState } from "react";
import { unlock, type FormState } from "@/app/actions";

export default function OwnerForm() {
  const [state, action, pending] = useActionState(unlock, {} as FormState);
  return (
    <form action={action} className="flex w-full max-w-xs flex-col gap-3">
      <label htmlFor="passcode" className="text-[13px] text-ink-muted">
        Passcode
      </label>
      <input
        id="passcode"
        name="passcode"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        className="rounded-lg border border-black/15 bg-white/70 px-3 py-2 text-[15px] outline-none focus:border-ink"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-ink px-3 py-2 text-[14px] font-medium text-[#f3efe7] disabled:opacity-60"
      >
        {pending ? "Checking…" : "Unlock"}
      </button>
      <p role="alert" className="min-h-5 text-[13px] text-[#b3261e]">
        {state.error}
      </p>
    </form>
  );
}
