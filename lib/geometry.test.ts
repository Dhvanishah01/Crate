import { test } from "node:test";
import assert from "node:assert/strict";
import { ARM_L, CENTER, GROOVE, PIVOT, armAngleAt, armAngleFor } from "./geometry.ts";

test("stylus lands on the requested groove radius", () => {
  for (const r of [GROOVE.out, 170, GROOVE.in]) {
    const a = ((armAngleFor(r) + 90) * Math.PI) / 180;
    const x = PIVOT.x + ARM_L * Math.cos(a);
    const y = PIVOT.y + ARM_L * Math.sin(a);
    assert.ok(Math.abs(Math.hypot(x - CENTER.x, y - CENTER.y) - r) < 1e-6);
  }
});

test("arm tracks inward as the song plays and clamps at the ends", () => {
  assert.ok(armAngleAt(0) < armAngleAt(0.5) && armAngleAt(0.5) < armAngleAt(1));
  assert.equal(armAngleAt(-1), armAngleAt(0));
  assert.equal(armAngleAt(2), armAngleAt(1));
  assert.equal(armAngleAt(NaN), armAngleAt(0));
});
