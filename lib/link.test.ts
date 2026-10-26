import { test } from "node:test";
import assert from "node:assert/strict";
import { guessSong, parseVideoId, pickTrack } from "./link.ts";

test("finds the video ID in every common link shape", () => {
  const id = "oF8efZmoGZE";
  for (const link of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&list=RD${id}&t=42s`,
    `youtube.com/watch?v=${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}&si=abc`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
    `  https://youtu.be/${id}  `,
  ])
    assert.equal(parseVideoId(link), id, link);
});

test("rejects links that are not a single YouTube video", () => {
  for (const link of [
    "",
    "not a link",
    "https://vimeo.com/123456789",
    "https://www.youtube.com/@beckyg",
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/watch?v=short",
    "https://evil.com/watch?v=oF8efZmoGZE",
    "https://youtube.com.evil.com/watch?v=oF8efZmoGZE",
  ])
    assert.equal(parseVideoId(link), null, link);
});

test("guesses artist and title from YouTube naming", () => {
  assert.deepEqual(guessSong("Becky G - Shower (Official Video)", "BeckyGVEVO"), { artist: "Becky G", title: "Shower" });
  assert.deepEqual(guessSong("Shower", "Becky G - Topic"), { artist: "Becky G", title: "Shower" });
  assert.deepEqual(guessSong("Lauryn Hill – Doo Wop (That Thing) [Audio]", "x"), {
    artist: "Lauryn Hill",
    title: "Doo Wop (That Thing)",
  });
});

test("picks the iTunes track that is really the song", () => {
  const t = (trackName: string, artistName: string) => ({ trackName, artistName, artworkUrl100: "" });
  const want = { artist: "Becky G", title: "Shower" };
  assert.equal(pickTrack([t("Shower", "Cover Band"), t("Shower", "Becky G")], want)?.artistName, "Becky G");
  assert.equal(pickTrack([t("Shower (Remix)", "Someone")], want)?.artistName, "Someone");
  assert.equal(pickTrack([t("Mayores", "Becky G")], want), null);
});
