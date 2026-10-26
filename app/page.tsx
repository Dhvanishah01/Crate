import { Suspense } from "react";
import Queue from "@/components/Queue";
import Room from "@/components/Room";
import Turntable from "@/components/Turntable";
import { WallPanel, WallSleeves } from "@/components/Walls";

// One screen: the room behind, its record wall at the back, the turntable in front of you.
export default function Home() {
  return (
    <main className="scene">
      <h1 className="scene-mark">Crate</h1>
      <Room>
        <Suspense fallback={null}>
          <WallSleeves />
        </Suspense>
      </Room>
      <Suspense fallback={null}>
        <WallPanel />
      </Suspense>
      <Turntable />
      <Queue />
    </main>
  );
}
