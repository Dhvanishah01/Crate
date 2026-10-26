// Pure helpers for turning a pasted YouTube link into a song. No network here, so they're testable.

const ID = /^[A-Za-z0-9_-]{11}$/;

/** Video ID from any common YouTube / YouTube Music link, or null. */
export function parseVideoId(link: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(link.trim()) ? link.trim() : `https://${link.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null | undefined = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, kind, rest] = url.pathname.split("/");
    id = kind === "watch" ? url.searchParams.get("v") : ["shorts", "embed", "live", "v"].includes(kind) ? rest : null;
  }
  return id && ID.test(id) ? id : null;
}

const NOISE = /\s*[([][^)\]]*(official|audio|video|lyric|visuali[sz]er|hd|4k|remaster|explicit|clean)[^)\]]*[)\]]/gi;

/** Best guess at artist and title from a YouTube title and channel name. */
export function guessSong(ytTitle: string, channel: string) {
  const title = ytTitle.replace(NOISE, "").trim();
  const dash = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dash) return { artist: dash[1].trim(), title: dash[2].trim() };
  return { artist: channel.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim(), title };
}

export type ItunesTrack = {
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100: string;
  trackTimeMillis?: number;
};

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, "").replace(/[^a-z0-9]/g, "");
const overlaps = (a: string, b: string) => !!a && !!b && (a.includes(b) || b.includes(a));

/** The iTunes result that is actually this song: the title must match; a matching artist wins. */
export function pickTrack(results: ItunesTrack[], want: { artist: string; title: string }) {
  const titled = results.filter((r) => overlaps(norm(r.trackName), norm(want.title)));
  return titled.find((r) => overlaps(norm(r.artistName), norm(want.artist))) ?? titled[0] ?? null;
}
