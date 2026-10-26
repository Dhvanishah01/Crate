// Downloads the CC0 Poly Haven models and textures the room render uses into .cache/room (gitignored).
// Usage: node scripts/room/fetch-assets.mjs
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT = ".cache/room";
const MODELS = ["potted_plant_01", "potted_plant_02", "potted_plant_04", "lightbulb_01", "mid_century_lounge_chair", "modern_wooden_cabinet", "ceramic_vase_02"];
const TEXTURES = { beige_wall_001: "2k", old_wooden_floor_02: "2k", walnut_veneer: "2k", concrete_floor: "1k" };

async function get(url, path, md5) {
  if (existsSync(path) && createHash("md5").update(readFileSync(path)).digest("hex") === md5) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (md5 && createHash("md5").update(buf).digest("hex") !== md5) throw new Error(`checksum mismatch: ${url}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
}

const files = async (id) => (await fetch(`https://api.polyhaven.com/files/${id}`)).json();

for (const id of MODELS) {
  const { gltf } = (await files(id)).gltf["1k"];
  const dir = join(OUT, "models", id);
  await get(gltf.url, join(dir, `${id}.gltf`), gltf.md5);
  for (const [rel, f] of Object.entries(gltf.include)) await get(f.url, join(dir, rel), f.md5);
  console.log("model", id);
}
for (const [id, res] of Object.entries(TEXTURES)) {
  const f = await files(id);
  for (const map of ["Diffuse", "nor_gl", "Rough"]) {
    const jpg = f[map][res].jpg;
    await get(jpg.url, join(OUT, "textures", id, `${map}.jpg`), jpg.md5);
  }
  console.log("texture", id);
}
