"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { T } from "@/lib/choreography";
import { useStore } from "@/lib/store";

gsap.registerPlugin(useGSAP);

/**
 * Up next: a fanned stack of sleeves, each tucked under the one before. It sits beside the turntable,
 * and glides over beside the wall when you walk up to it.
 */
export default function Queue() {
  const list = useRef<HTMLOListElement>(null);
  const queue = useStore((s) => s.queue);
  const zoomed = useStore((s) => s.zoomed);

  // walking up or back, the stack fades out and reappears at its new spot rather than stretching across
  useGSAP(() => {
    gsap.fromTo(
      list.current,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, ...T.queueMove, delay: (zoomed ? T.zoomIn : T.zoomOut).duration * 0.7 },
    );
  }, [zoomed]);

  return (
    <ol
      ref={list}
      className={`queue ${zoomed ? "is-zoomed" : ""}`}
      style={{ "--n": queue.length } as CSSProperties}
      aria-label="Up next"
      hidden={!queue.length}
    >
      {queue.map((r, i) => (
        <li key={r.id} data-queue={r.id} className="queue-item" style={{ "--i": i, "--r": `${i % 2 ? 1.4 : -1.2}deg` } as CSSProperties}>
          {/* one click plays a waiting record now; the rest of the line keeps its order */}
          <button
            type="button"
            aria-label={`Up next: ${r.title} by ${r.artist}. Click to play now.`}
            onClick={() => useStore.getState().choose({ record: r, now: true, fromQueue: true })}
          >
            <Image src={r.artworkUrl} alt="" width={200} height={200} unoptimized />
            <span className="sleeve-wear" aria-hidden />
          </button>
        </li>
      ))}
    </ol>
  );
}
