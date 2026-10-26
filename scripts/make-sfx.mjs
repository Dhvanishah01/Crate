// Synthesizes the turntable sound effects as 16-bit mono WAVs in public/assets/sfx.
// Run once: node scripts/make-sfx.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const RATE = 44100;
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

function wav(name, seconds, fn) {
  const n = Math.round(seconds * RATE);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, fn(i / RATE, i)));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  writeFileSync(`public/assets/sfx/${name}.wav`, buf);
}

// Sparse pops with fast decay, plus a faint hiss: the vinyl crackle texture.
function crackleTrack(seconds, popsPerSec, hiss) {
  const pops = Array.from({ length: Math.round(seconds * popsPerSec) }, () => ({
    t: ((rand() + 1) / 2) * seconds,
    a: 0.2 + Math.abs(rand()) * 0.8,
  }));
  let lp = 0;
  return (t) => {
    lp += (rand() - lp) * 0.15; // low-passed noise for the hiss
    let v = lp * hiss;
    for (const p of pops) {
      const dt = t - p.t;
      if (dt >= 0 && dt < 0.004) v += p.a * rand() * Math.exp(-dt * 1500);
    }
    return v;
  };
}

mkdirSync("public/assets/sfx", { recursive: true });

const needleCrackle = crackleTrack(0.6, 25, 0.05);
wav("needle", 0.6, (t) => {
  const thump = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 28) * 0.9;
  const contact = rand() * Math.exp(-t * 90) * 0.35;
  return thump + contact + needleCrackle(t) * 0.5 * Math.exp(-t * 3);
});

wav("click", 0.12, (t) => {
  const tick = Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-t * 160) * 0.5;
  const body = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 60) * 0.4;
  return tick + body + rand() * Math.exp(-t * 400) * 0.2;
});

const loop = crackleTrack(4, 9, 0.08);
wav("crackle", 4, (t) => {
  const edge = Math.min(1, t / 0.02, (4 - t) / 0.02); // tiny fade so the loop seam doesn't click
  return loop(t) * 0.8 * edge;
});

console.log("wrote needle.wav, click.wav, crackle.wav");
