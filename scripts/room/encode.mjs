// Turns the Blender renders into web images (public/room) and hands the layout to the app (lib/room-layout.json).
// Filenames carry a content hash so a re-render never shows a cached old image.
// Usage: node scripts/room/encode.mjs [render_dir]   (default .cache/room/render)
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const dir = process.argv[2] ?? ".cache/room/render";
mkdirSync("public/room", { recursive: true });
for (const f of readdirSync("public/room")) rmSync(`public/room/${f}`);

const images = {};
for (const mode of ["day", "night"]) {
  // one full-size image per mode: next/image serves smaller versions, and the wall zoom needs the full size
  const buf = await sharp(`${dir}/${mode}.png`).webp({ quality: 82 }).toBuffer();
  const name = `${mode}-${createHash("sha256").update(buf).digest("hex").slice(0, 8)}.webp`;
  writeFileSync(`public/room/${name}`, buf);
  images[mode] = `/room/${name}`;
  console.log(images[mode], Math.round(buf.length / 1024), "KB");
}
const layout = JSON.parse(readFileSync(`${dir}/layout.json`, "utf8"));
writeFileSync("lib/room-layout.json", JSON.stringify({ ...layout, images }, null, 1) + "\n");
