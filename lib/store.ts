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
  nowPlaying: string | null; // Record id
  status: "idle" | "loading" | "transition" | "playing" | "paused";
  positionSec: number;
  volume: number; // 0 to 100
  power: boolean;
  speed: number; // RPM, 33 1/3 to 45; the song plays faster with it, like real vinyl
};

// shortcut: one hardcoded record for Phase 1; search + palette extraction replace it in Phase 2
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

// Library, queue and persistence arrive with the shelf (Phase 3).
type Store = { player: PlayerState; setPlayer: (p: Partial<PlayerState>) => void };

export const useStore = create<Store>()((set) => ({
  player: { nowPlaying: SEED.id, status: "idle", positionSec: 0, volume: 80, power: false, speed: 100 / 3 },
  setPlayer: (p) => set((s) => ({ player: { ...s.player, ...p } })),
}));
