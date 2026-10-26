import { create } from "zustand";

export type Record = {
  id: string; // iTunes trackId as string
  title: string;
  artist: string;
  album: string;
  artworkUrl: string; // 600x600 or larger
  durationMs: number; // from iTunes
  videoId: string; // resolved YouTube video
  palette: { vinyl: string; muted: string; label: string };
  addedAt: number;
};

export const WALL_SIZE = 25; // 5 ledges of 5
export type ShelvedRecord = Record & { slot: number };
export type Wall = { id: string; name: string; records: ShelvedRecord[] };
export type NewRecord = Omit<Record, "id" | "addedAt">;

export type PlayerState = {
  status: "idle" | "loading" | "transition" | "playing" | "paused";
  positionSec: number;
  volume: number; // 0 to 100
  power: boolean;
  speed: number; // RPM, 33 1/3 to 45; the song plays faster with it, like real vinyl
};

// Fallback record while the walls are empty.
export const SEED: Record = {
  id: "868199261",
  title: "Shower",
  artist: "Becky G",
  album: "Shower - Single",
  artworkUrl: "/assets/shower.jpg",
  durationMs: 206167,
  videoId: "oF8efZmoGZE",
  palette: { vinyl: "#c7352c", muted: "#8a3a33", label: "#f3e6cf" },
  addedAt: 0,
};

/** A sleeve clicked on a wall: the turntable decides whether to queue it or play it now. */
export type SleevePick = { record: Record; now: boolean };

type Store = {
  player: PlayerState;
  setPlayer: (p: Partial<PlayerState>) => void;
  library: Record[]; // every record on the walls, in wall order
  setLibrary: (records: Record[]) => void;
  record: Record | null; // on the platter
  setRecord: (r: Record | null) => void;
  queue: Record[]; // up next, top first
  enqueue: (r: Record, front?: boolean) => void;
  unqueue: (id: string) => void;
  pick: SleevePick | null;
  choose: (p: SleevePick | null) => void;
};

// shortcut: queue and now-playing live in memory only; persist them when reloads should keep the queue
export const useStore = create<Store>()((set) => ({
  player: { status: "idle", positionSec: 0, volume: 80, power: false, speed: 100 / 3 },
  setPlayer: (p) => set((s) => ({ player: { ...s.player, ...p } })),
  library: [],
  setLibrary: (library) => set({ library }),
  record: null,
  setRecord: (record) => set({ record }),
  queue: [],
  enqueue: (r, front) => set((s) => ({ queue: front ? [r, ...s.queue] : [...s.queue, r] })),
  unqueue: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
  pick: null,
  choose: (pick) => set({ pick }),
}));
