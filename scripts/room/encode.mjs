// Turns the Blender renders into web images (public/room) and hands the layout to the app (lib/room-layout.json).
// Usage: node scripts/room/encode.mjs [render_dir]   (default .cache/room/render)
import { copyFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const dir = process.argv[2] ?? ".cache/room/render";
mkdirSync("public/room", { recursive: true });
for (const mode of ["day", "night"])
  for (const width of [1200, 2000]) {
    const out = `public/room/${mode}-${width}.webp`;
    const info = await sharp(`${dir}/${mode}.png`).resize({ width }).webp({ quality: 80 }).toFile(out);
    console.log(out, Math.round(info.size / 1024), "KB");
  }
copyFileSync(`${dir}/layout.json`, "lib/room-layout.json");
