@AGENTS.md

# Project rules

- Read PRD.md before any task. It is the source of truth; the "Decisions" block at its top overrides the body.
- Open the images in /references before any visual work and compare your output to them.
- Top-down view only. Realism bar = references/03-realism.png.
- The record's glare overlay NEVER rotates. Only vinyl, grooves, and label spin. Same for knobs: only the pointer mark rotates.
- All GSAP timings live in lib/choreography.ts with named beats. No inline magic timings.
- Use useGSAP from @gsap/react for every animation in React. Clean up on unmount.
- One YouTube player instance for the whole app (lib/usePlayer.ts). Never remount it.
- The YouTube API key is server-side only. Never expose it to the client.
- No linear easing except the steady platter spin.
- Layout is in deck units (deck = 1000 x 640); convert with `u()` from lib/geometry.ts.
- After any visual change, run the app, take a Playwright screenshot (`npx playwright screenshot`), and check it against the references before saying it is done.
- Work one PRD phase at a time. Stop at the end of each phase for review.
- Test: `npm test` (node --test on lib/*.test.ts).
