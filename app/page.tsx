import { Suspense } from "react";
import Room from "@/components/Room";
import Turntable from "@/components/Turntable";
import Walls from "@/components/Walls";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 overflow-x-clip px-4 pt-6 pb-10">
      <h1 className="text-[13px] font-medium uppercase tracking-[0.3em] text-ink-muted">Crate</h1>
      <div className="w-full max-w-[1400px] overflow-hidden rounded-2xl shadow-[0_30px_80px_-30px_rgb(40_26_14/0.45)]">
        <Room>
          <Suspense fallback={null}>
            <Walls />
          </Suspense>
        </Room>
      </div>
      <Turntable />
    </main>
  );
}
