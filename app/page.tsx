import { Suspense } from "react";
import Turntable from "@/components/Turntable";
import Walls from "@/components/Walls";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <h1 className="text-[13px] font-medium uppercase tracking-[0.3em] text-ink-muted">Crate</h1>
      <Suspense fallback={null}>
        <Walls />
      </Suspense>
      <Turntable />
    </main>
  );
}
