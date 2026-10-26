// Turns the Blender renders into web images (public/room) and hands the layout to the app (lib/room-layout.json).
// Filenames carry a content hash so a re-render never shows a cached old image.
// Usage: node scripts/room/encode.mjs [render_dir]   (default .cache/room/render)
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const dir = process.argv[2] ?? ".cache/room/render";
mkdirSync("public/room", { recursive: true });
for (const f of readdirSync("public/room")) rmSync(`public/room/${f}`);

// the page around the room takes the room's own wall colour, sampled from plain plaster left of the print.
// At night that plaster glows deep orange, so the surround is toned down: same warmth, darker, quieter.
async function wallColour(png, mode) {
  const img = sharp(png);
  const { width, height } = await img.metadata();
  const patch = await img
    .extract({ left: Math.round(width * 0.17), top: Math.round(height * 0.12), width: Math.round(width * 0.06), height: Math.round(height * 0.1) })
    .toBuffer();
  const { channels } = await sharp(patch).stats(); // stats() reads the input, so crop to a buffer first
  let rgb = channels.slice(0, 3).map((c) => c.mean);
  if (mode === "night") {
    const grey = (rgb[0] + rgb[1] + rgb[2]) / 3;
    rgb = rgb.map((c) => (0.55 * grey + 0.45 * c) * 0.6);
  }
  return "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}

const images = {};
const bg = {};
for (const mode of ["day", "night"]) {
  bg[mode] = await wallColour(`${dir}/${mode}.png`, mode);
  // one full-size image per mode: next/image serves smaller versions, and the wall zoom needs the full size
  const buf = await sharp(`${dir}/${mode}.png`).webp({ quality: 82 }).toBuffer();
  const name = `${mode}-${createHash("sha256").update(buf).digest("hex").slice(0, 8)}.webp`;
  writeFileSync(`public/room/${name}`, buf);
  images[mode] = `/room/${name}`;
  console.log(images[mode], Math.round(buf.length / 1024), "KB");
}
const layout = JSON.parse(readFileSync(`${dir}/layout.json`, "utf8"));
writeFileSync("lib/room-layout.json", JSON.stringify({ ...layout, images, bg }, null, 1) + "\n");
console.log("page background", bg);
