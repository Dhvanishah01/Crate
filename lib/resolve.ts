// Server only: checks a pasted link and builds the record. No API key needed:
// YouTube oEmbed says whether the video exists and may be embedded; iTunes gives square art and clean names.
import sharp from "sharp";
import type { NewRecord } from "./store";
import { guessSong, parseVideoId, pickTrack, type ItunesTrack } from "./link";

const TIMEOUT = 8000;
const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/** Vinyl tint from the cover's dominant color. */
async function paletteOf(artworkUrl: string): Promise<NewRecord["palette"]> {
  const art = await fetch(artworkUrl, { signal: AbortSignal.timeout(TIMEOUT) });
  const { dominant: c } = await sharp(Buffer.from(await art.arrayBuffer())).stats();
  return {
    vinyl: `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`,
    muted: `#${hex(c.r * 0.7)}${hex(c.g * 0.7)}${hex(c.b * 0.7)}`,
    label: "#f3e6cf",
  };
}

export async function resolveLink(link: string): Promise<{ record: NewRecord } | { error: string }> {
  const videoId = parseVideoId(link);
  if (!videoId)
    return { error: "That isn't a YouTube video link. Paste one like youtube.com/watch?v=… or youtu.be/…" };

  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  const oembed = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, {
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (oembed.status === 401 || oembed.status === 403)
    return {
      error: "This video's owner doesn't allow it to play on other sites. Try the official audio or a “Topic” upload.",
    };
  if (!oembed.ok) return { error: "That video can't be found. It may be private or deleted. Try another link." };
  const yt: { title: string; author_name: string } = await oembed.json();

  const want = guessSong(yt.title, yt.author_name);
  const search = await fetch(
    `https://itunes.apple.com/search?entity=song&limit=10&term=${encodeURIComponent(`${want.artist} ${want.title}`)}`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  )
    .then((r) => (r.ok ? r.json() : { results: [] }))
    .catch(() => ({ results: [] }));
  const track = pickTrack(search.results as ItunesTrack[], want);

  // shortcut: without an iTunes match the label uses the YouTube thumbnail (4:3, center-cropped)
  const artworkUrl = track?.artworkUrl100.replace("100x100bb", "600x600bb") ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return {
    record: {
      videoId,
      title: track?.trackName ?? want.title,
      artist: track?.artistName ?? want.artist,
      album: track?.collectionName ?? "",
      artworkUrl,
      durationMs: track?.trackTimeMillis ?? 0,
      palette: await paletteOf(artworkUrl),
    },
  };
}
