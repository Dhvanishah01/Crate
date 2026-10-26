"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { WALL_SIZE, createWall, insertRecord, wallContents } from "@/lib/db";
import { OWNER_COOKIE, isOwner, ownerToken, passcodeMatches } from "@/lib/owner";
import { resolveLink } from "@/lib/resolve";

export type FormState = { error?: string; added?: string; wallId?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function unlock(_: FormState, form: FormData): Promise<FormState> {
  if (!passcodeMatches(String(form.get("passcode") ?? ""))) {
    await new Promise((r) => setTimeout(r, 1000)); // slows down guessing
    return { error: "That passcode isn't right." };
  }
  (await cookies()).set(OWNER_COOKIE, ownerToken()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}

export async function addRecord(_: FormState, form: FormData): Promise<FormState> {
  if (!(await isOwner())) return { error: "Only the owner can add records." };
  const link = String(form.get("link") ?? "").trim();
  const wall = String(form.get("wall") ?? "");
  const newName = String(form.get("newWall") ?? "").trim();

  let wallId: string | null = null;
  if (wall === "new") {
    if (!newName || newName.length > 60) return { error: "Give the new wall a name (up to 60 characters)." };
  } else {
    if (!UUID.test(wall)) return { error: "Pick a wall for this record." };
    const onWall = await wallContents(wall);
    if (!onWall) return { error: "That wall no longer exists. Pick another." };
    if (onWall.length >= WALL_SIZE) return { error: "That wall is full (25 records). Pick another or start a new wall." };
    wallId = wall;
  }

  const found = await resolveLink(link).catch(() => ({ error: "Couldn't check that link right now. Try again." }));
  if ("error" in found) return found;

  wallId ??= await createWall(newName);
  const onWall = (await wallContents(wallId)) ?? [];
  if (onWall.some((r) => r.video_id === found.record.videoId))
    return { error: `“${found.record.title}” is already on this wall.` };
  const taken = new Set(onWall.map((r) => r.slot));
  const slot = Array.from({ length: WALL_SIZE }, (_, i) => i).find((i) => !taken.has(i));
  if (slot === undefined) return { error: "That wall is full (25 records). Pick another or start a new wall." };

  await insertRecord(wallId, slot, found.record);
  updateTag("walls");
  return { added: `${found.record.title} — ${found.record.artist}`, wallId };
}
