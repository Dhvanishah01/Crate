// Server only: Supabase through its REST API. Reads use the public key (RLS allows select);
// writes use the service role key, which never leaves the server.
import { cacheLife, cacheTag } from "next/cache";
import type { Record } from "./store";

export const WALL_SIZE = 25;
export type ShelvedRecord = Record & { slot: number };
export type Wall = { id: string; name: string; records: ShelvedRecord[] };
export type NewRecord = Omit<Record, "id" | "addedAt">;

type Row = {
  id: string;
  slot: number;
  video_id: string;
  title: string;
  artist: string;
  album: string;
  artwork_url: string;
  duration_ms: number;
  palette: Record["palette"];
  added_at: string;
};

async function rest<T>(path: string, write: boolean, init?: RequestInit): Promise<T> {
  const key = write ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY;
  if (!process.env.SUPABASE_URL || !key) throw new Error("Supabase env vars are missing");
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

const toRecord = (r: Row): ShelvedRecord => ({
  id: r.id,
  slot: r.slot,
  videoId: r.video_id,
  title: r.title,
  artist: r.artist,
  album: r.album,
  artworkUrl: r.artwork_url,
  durationMs: r.duration_ms,
  palette: r.palette,
  addedAt: Date.parse(r.added_at),
});

export async function getWalls(): Promise<Wall[]> {
  "use cache";
  cacheLife("minutes"); // short, so rows edited in the Supabase dashboard show up soon
  cacheTag("walls");
  const walls = await rest<{ id: string; name: string; records: Row[] }[]>(
    "walls?select=id,name,records(*)&order=position.asc,created_at.asc&records.order=slot.asc",
    false,
  );
  return walls.map((w) => ({ id: w.id, name: w.name, records: w.records.map(toRecord) }));
}

export async function createWall(name: string) {
  const existing = await rest<{ id: string }[]>("walls?select=id", true);
  const [wall] = await rest<{ id: string }[]>("walls", true, {
    method: "POST",
    body: JSON.stringify({ name, position: existing.length }),
  });
  return wall.id;
}

/** What's already on a wall, or null if the wall doesn't exist. wallId must be a validated UUID. */
export async function wallContents(wallId: string) {
  const [wall] = await rest<{ records: { slot: number; video_id: string }[] }[]>(
    `walls?select=records(slot,video_id)&id=eq.${wallId}`,
    true,
  );
  return wall?.records ?? null;
}

export async function insertRecord(wallId: string, slot: number, r: NewRecord) {
  await rest("records", true, {
    method: "POST",
    body: JSON.stringify({
      wall_id: wallId,
      slot,
      video_id: r.videoId,
      title: r.title,
      artist: r.artist,
      album: r.album,
      artwork_url: r.artworkUrl,
      duration_ms: r.durationMs,
      palette: r.palette,
    }),
  });
}
