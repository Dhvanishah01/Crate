"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
};
type YTEvent = { target: YTPlayer; data: number };
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: object) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const ENDED = 0;
const PLAYING = 1;

// One player for the whole app, mounted outside React so re-renders can never remount it.
let yt: YTPlayer | null = null;
let ready: Promise<YTPlayer> | null = null;
let unlocked = false;
let unlocking = false;
let wantPlaying = false;
let volume = 80;
const fade = { f: 0 };
const listeners = new Set<(state: number) => void>();

// Audio taper: YouTube volume is linear amplitude, so a squared curve makes the whole knob travel audible.
const apply = () => yt?.setVolume(Math.round(((volume * volume) / 100) * fade.f));

function load(videoId: string) {
  ready ??= new Promise((resolve) => {
    const host = document.createElement("div");
    // Hidden by decision (PRD Decisions): the turntable is the only UI.
    host.style.cssText =
      "position:fixed;left:0;bottom:0;width:200px;height:200px;opacity:0;pointer-events:none;z-index:-1";
    host.setAttribute("aria-hidden", "true");
    const mount = document.createElement("div");
    host.append(mount);
    document.body.append(host);

    window.onYouTubeIframeAPIReady = () => {
      new window.YT!.Player(mount, {
        videoId,
        width: 200,
        height: 200,
        playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (e: YTEvent) => {
            yt = e.target;
            apply();
            resolve(e.target);
          },
          onStateChange: (e: YTEvent) => {
            if (e.data === PLAYING && unlocking) {
              unlocking = false;
              if (!wantPlaying) e.target.pauseVideo();
            }
            listeners.forEach((l) => l(e.data));
          },
        },
      });
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.append(script);
  });
  return ready;
}

export const player = {
  /** Call inside a tap: a silent play there lets later programmatic plays through (iOS autoplay). */
  unlock() {
    if (unlocked || !yt) return;
    unlocked = unlocking = true;
    yt.playVideo();
  },
  play() {
    wantPlaying = true;
    yt?.playVideo();
  },
  pause() {
    wantPlaying = false;
    yt?.pauseVideo();
  },
  seek: (s: number) => yt?.seekTo(s, true),
  setRate: (r: number) => yt?.setPlaybackRate(r),
  time: () => yt?.getCurrentTime() ?? 0,
  duration: () => yt?.getDuration() ?? 0,
  setVolume(v: number) {
    volume = v;
    apply();
  },
  fadeTo: (to: number, beat: gsap.TweenVars) =>
    gsap.to(fade, { f: to, ...beat, overwrite: true, onUpdate: apply }),
};

export function usePlayer(videoId: string, onEnded: () => void) {
  const ended = useRef(onEnded);
  useEffect(() => {
    ended.current = onEnded;
  });
  useEffect(() => {
    load(videoId);
    const l = (state: number) => state === ENDED && ended.current();
    listeners.add(l);
    return () => void listeners.delete(l);
  }, [videoId]);
}
