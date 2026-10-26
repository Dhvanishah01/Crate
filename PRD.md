# Decisions (2026-10-25, override the PRD body below)

- **No visible YouTube player.** Audio plays through a hidden IFrame player; the turntable is the only UI. Accepted policy risk for a personal portfolio piece.
- **Background:** light cream (`#f3efe7`) with subtle film grain, not mustard.
- **Turntable:** matte black body, hyperrealistic. Silver platter rim and chrome tonearm (reference 03).
- **Shelf:** sleeves face-out.
- **Queue:** auto-starts when the first sleeve is added and nothing is playing.
- **Phase 1 song:** Becky G, "Shower" (YouTube `oF8efZmoGZE`, iTunes trackId 868199261).
- **Reference 03** is saved as `references/03-realism.png`.

## Decisions (2026-10-25, round 2: walls)

- **No song search (Phase 2 skipped).** Records are added by pasting a YouTube link. The server checks the video exists and allows embedding (oEmbed), then finds square art and metadata on iTunes. Unusable links get a clear "try another link" message.
- **Walls replace the bottom shelf.** A wall is a named set of dark walnut ledges (reference: face-out sleeves on wood ledges) holding up to 25 records, 5 per row, well spaced. The owner names each wall like an album ("2016 vibes").
- **Walls sit above the turntable** on a revolving drum. One wall faces you at a time; drag to turn the drum and the next wall swings into view, then settles.
- **Only the owner sees +.** It sits at the bottom right of the wall. The owner unlocks it on a separate passcode page; the passcode lives server-side only. Visitors never see add controls.
- **Adding:** the + box takes a link and the target wall, with "New wall…" to create and name one. Full walls can't be picked.
- **Storage: Supabase.** Every visitor sees the same walls. All writes go through server routes; no secret keys in the client.
- **Playing from a wall:** single click queues the sleeve on the right of the player (tucked under earlier ones); double click swaps it in now. Swap: the current record lifts, slides left into its sleeve, and that sleeve returns to its wall; the next record slides out of its sleeve on the right and drops onto the platter. The turntable stops when the queue is empty.
- **Later, not now:** visitor recommendations (a separate "Recommended to me" wall with name + note) and an owner page to promote or delete them.

---

Vinyl Player PRD




Vinyl Player PRD
  ​Oct 25, 2026    · ​@Dhvani


Overview
Working name: Crate (placeholder, rename freely)

A web app that turns any song into a physical-feeling vinyl record. You search for a song,
its album art is pressed onto the center label of a record, the record drops onto a
turntable, spins, and plays the full track. Every record you add gets its own cardboard
sleeve and lives on a shelf. Pick records off the shelf to fan them into a queue beside the
player, and the turntable swaps them one by one with real tonearm motion and sound.

The feeling: slow, tactile, and satisfying. Every interaction should feel like handling a real
object. Animation quality is the product.


Goals
     Full-length playback of any song the user searches for
     Album art auto-composited onto a realistic record label and a sleeve, for every song
     A persistent shelf library that survives reloads
     A visual queue that auto-advances with a physical record-swap transition
     60fps animation on a modern laptop; works at phone width
     Deployable on Vercel, embeddable on dhvans.com as a portfolio piece


Non-goals (v1)
     Spotify playback (Spotify Development Mode now requires Premium and caps apps at
     25 manually added users, so it is out)
     User accounts, social sharing, or multi-device sync
     Downloading or caching audio files
     Native mobile apps


Visual references and art direction
The three references each own one layer of the design: image 1 sets the composition,
image 2 sets the controls and sleeve, image 3 sets the material realism. Save them in the
repo as /references/01-layout.png , /references/02-controls.png ,
 /references/03-realism.jpg so Claude Code can open them directly.




                                                                                         Page 1 of 16
Vinyl Player PRD




  Ref                          What to take from it                What NOT to take

  01 Layout (green             Top-down view. Turntable is a       Flat illustrated rendering style
  turntable on mustard)        rounded rectangle centered on
                               a solid warm background.
                               Platter on the left half, tonearm
                               resting on the right half. Two-
                               tone deck split down the
                               middle. Soft drop shadow and a
                               visible plinth edge for depth.
                               Subtle grain texture.

  02 Controls (pink            Control set: on/off toggle          The Dribbble branding, the
  suitcase player)             switch, two knobs (volume,          suitcase lid, the flat vector
                               speed 33/45), a tonearm lift        style
                               lever. A sleeve tucked behind
                               the player with the record half
                               out. Sleeve shows cover art, not
                               text.

  03 Realism (pink vinyl,      Photoreal material: translucent     Nothing. This is the quality bar
  silver arm)                  colored vinyl with visible          for every surface
                               grooves, chrome tonearm with
                               real reflections, brushed metal
                               platter rim, a printed label.
                               Light and glare that feel
                               physical.



Art direction rules
     Viewpoint: strict top-down, like image 1. No 3D camera tilt in v1.
     Background: one solid warm color per session (default mustard #F5C15C ), with subtle
     film grain. Optionally shift the background toward the playing record's dominant color.
     Turntable body: realistic matte finish (cream, sage, or graphite variants), rounded
     corners, visible plinth edge, soft contact shadow.
     Vinyl: tinted from the album art's dominant color, slightly translucent like image 3.
     Black vinyl as a fallback.
     Label: album art cropped to a circle, center hole, faint paper texture, song title curved
     along the label edge in a handwritten-style font (image 3 shows this).
     Tonearm: chrome tube, black headshell, counterweight on the pivot. Separate asset
     layer so it can rotate from its pivot.




                                                                                              Page 2 of 16
Vinyl Player PRD




     Sleeve: square cardboard with the album art printed on it, slight wear on edges, a
     subtle cardboard texture overlay, a thin open edge where the record slides out.
     Shelf: wooden shelf with sleeves standing spine-out or face-out, slight random tilt per
     sleeve so it feels hand-placed.
     Type: one serif or grotesk for UI, one handwritten font for label titles. No emoji, no
     gradients on UI chrome.


The realism trick
The record spins but the light does not. Build the disc in layers and rotate only the bottom
three:

 1. Vinyl base color (rotates)
 2. Groove texture, fine concentric rings (rotates)
 3. Label with album art and curved title (rotates)
 4. Specular highlight / glare overlay (static, never rotates)
 5. Platter shadow and rim (static)

This single rule is what makes image 3 look real. Treat it as a hard requirement.


Screen layout and user flows
One screen, three zones. Nothing navigates away; everything happens as objects moving
between zones.


  Zone             Position (desktop)                 Contents

  Search           Top center, floating               Search input with live song suggestions
  bar                                                 (art thumbnail, title, artist)

  Turntable        Center                             Platter, record, tonearm, power switch,
                                                      volume knob, speed knob, lift lever. Now-
                                                      playing title + artist under it

  Queue            Right of turntable                 Fanned stack of sleeves, newest at the
                                                      bottom

  Shelf            Bottom, full width, horizontally   Every saved record as a sleeve
                   scrollable


On phone width: turntable on top, queue becomes a horizontal fan under it, shelf below
that.




                                                                                          Page 3 of 16
Vinyl Player PRD




Flow 1: Add a song
 1. User types in the search bar. Suggestions appear as they type (debounced 300ms).
 2. User picks a suggestion.
 3. App resolves a playable YouTube video for that song (see Music source).
 4. A new record is "pressed": album art is composited onto the label, vinyl is tinted from
     the art's dominant color.
 5. The new record drops onto the turntable, tonearm swings in, record spins, full song
     plays.
 6. A "Save to shelf" button appears next to the now-playing title.


Flow 2: Save to shelf
 1. User taps "Save to shelf" (the song can keep playing).
 2. A sleeve with the album art slides up from below the turntable.
 3. On stop (or immediately if the user chooses), the record lifts off the platter, slides into
     the sleeve, and the sleeve travels down into the next open slot on the shelf.
 4. Record is persisted to local storage.


Flow 3: Play from the shelf
 1. User clicks a sleeve on the shelf.
 2. Sleeve lifts out of the shelf and travels to the turntable.
 3. Record slides out of the sleeve; the empty sleeve sets down beside the turntable (or
     returns to the shelf).
 4. Record drops onto the platter, tonearm swings in, needle drops, song plays.
 5. Record spins continuously until the song ends.


Flow 4: Queue
 1. While something is playing, user clicks more sleeves on the shelf.
 2. Each clicked sleeve flies to the queue zone on the right.
 3. Each new sleeve tucks under the previous one, offset downward (and slightly rotated)
    so its top edge, art, and title remain visible. Think of a fanned hand of cards.
 4. When the current song ends: volume fades out, tonearm lifts and returns to rest,
     platter slows to a stop, record goes back into its sleeve and returns to the shelf.
 5. The top queued sleeve moves to the turntable, its record slides out and drops on,
     tonearm swings back in, volume fades up, next song plays.
 6. The remaining queue sleeves slide up one slot.




                                                                                           Page 4 of 16
Vinyl Player PRD




 7. Queue items can be removed (hover or long press reveals a remove control) and
     reordered by drag.


Controls

  Control                     Behavior

  Power switch                Off: platter spins down, arm returns, audio pauses.
                              On: resumes

  Volume knob                 Drag to rotate; maps to player volume 0 to 100

  Speed knob (33 / 45)        Visual only in v1: changes spin speed. Optional:
                              map 45 to 1.25x playback rate

  Lift lever                  Raises/lowers the needle; acts as pause/play

  Tonearm drag (stretch)      Drag the arm across the record to scrub through
                              the song

  Spacebar                    Play/pause. Arrow keys skip in queue




Animation choreography
Every transition is a GSAP timeline with named beats, so timings can be tuned in one
place ( /lib/choreography.ts ). Timings below are starting targets to tune by feel, not
fixed values. Moves between zones (shelf to turntable, shelf to queue) use GSAP Flip so
elements animate from their real DOM position.


Play from sleeve (about 2.4s)

  Beat             Duration     Easing           What moves

  1. Lift          0.25s        power2.out       Sleeve scales to 1.04, shadow grows, slight tilt

  2. Travel        0.6s         power3.inOut     Sleeve flies (Flip) to a staging spot left of the
                                                 turntable

  3. Slide out     0.5s         power2.out       Record slides out of the sleeve's open edge,
                                                 sleeve stays put

  4. Drop          0.35s        back.out(1.2)    Record moves over the platter, scales 1.02 to
                                                 1.0, lands with a tiny settle

  5. Spin up       0.8s         power1.in        Platter rotation ramps from 0 to 33 1/3 RPM
                                                 (200 deg/s)



                                                                                              Page 5 of 16
Vinyl Player PRD




  Beat              Duration      Easing           What moves

  6. Arm swing      0.6s          power2.inOut     Tonearm rotates from rest to the lead-in
                                                   groove

  7. Needle         0.15s         power1.out       Arm lowers (scale + shadow shrink), needle-
  drop                                             drop SFX, audio fades in over 0.6s


Beats 5 and 6 overlap. Audio starts on beat 7, not before.


While playing
     Record + label rotate continuously at 200 deg/s using a GSAP ticker or CSS animation
     driven by a single rotation value. Never restart the rotation on re-render.
     Tonearm slowly tracks inward from the lead-in to the run-out groove, mapped to
      currentTime / duration . Update every 250ms with a smooth tween.
     Optional: faint crackle loop at 3 to 5% volume layered under the music.


Swap to next in queue (about 3.5s)

  Beat                     Duration   What moves

  1. Fade out              1.2s       Audio volume ramps to 0

  2. Arm lift + return     0.7s       Arm raises, swings back to rest, click SFX

  3. Spin down             1.0s       Platter decelerates to 0 (power2.out)

  4. Re-sleeve             0.8s       Record lifts, slides into its sleeve, sleeve returns to
                                      its shelf slot

  5. Next up               2.4s       Top queue sleeve runs the full "Play from sleeve"
                                      sequence

  6. Queue shift           0.4s       Remaining queue sleeves slide up one slot (stagger
                                      0.05s)


Beats 3 and 4 overlap; beat 6 runs during beat 5.


Add to queue (about 0.7s)
     Clicked sleeve lifts (0.2s), then Flips to the queue (0.5s, power3.inOut).
     It lands tucked under the last sleeve, offset 56px down and rotated a random -2 to +2
     degrees, so the previous sleeve's art and title stay visible.
     The shelf slot it left closes up with a 0.3s slide.



                                                                                                Page 6 of 16
Vinyl Player PRD




Press a new record (about 1.2s)
     Blank black disc appears on the platter with a soft flash.
     Vinyl color tween from black to the album's dominant color (0.6s).
     Label art scales in from 0.6 to 1.0 with a light stamp settle (0.4s, back.out).
     Then runs beats 5 to 7 of "Play from sleeve".


Motion rules
     Respect prefers-reduced-motion : replace travel with crossfades, keep the spin.
     No linear easing anywhere except the steady spin.
     Every object casts a shadow that grows when lifted and tightens when it lands.
     One transition at a time: lock input during swaps, but allow queueing clicks.


Music source and data architecture
Decision: Apple's iTunes Search API for search and album art, the YouTube Data API v3 to
find one playable video per song, and the YouTube IFrame Player API to play the full track.
Only one API key is needed (YouTube), and it is free.




data flow · 3 layers, 1 API key

Typing hits only the free iTunes API; YouTube quota is spent once per new song, then the
cache answers.




                                                                                       Page 7 of 16
Vinyl Player PRD




Why this combo

  Need             Source                         Key           Why
                                                  needed

  Live search      iTunes Search API              No            Free, public, fast, clean
  suggestions      ( itunes.apple.com/search?                   song metadata. Costs
                   entity=song )                                nothing per keystroke

  Square album     iTunes artworkUrl100 ,         No            YouTube thumbnails are
  art              rewritten to 600x600bb (try                  16:9 video frames, not
                    1200x1200bb first)                          square covers

  Find the full    YouTube Data API v3            Yes           Official, free. Costs 100
  song             search.list                    (Google       of 10,000 daily quota
                                                  Cloud API     units, so about 100 new
                                                  key)          songs per day. Run it
                                                                once per song, only
                                                                when the user picks a
                                                                result

  Verify the       YouTube videos.list            Same key      1 unit. Compare video
  match            (contentDetails)                             duration to iTunes
                                                                trackTimeMillis

  Full playback    YouTube IFrame Player API      No            Full track, ENDED event
  + events                                                      for the queue,
                                                                 setVolume() for fades,
                                                                 getCurrentTime() for
                                                                the tonearm


Why not YouTube Music or Spotify: YouTube Music has no official API (the popular
 ytmusicapi is unofficial, Python-only, and breaks when YouTube changes). Spotify
playback is locked behind Premium and a 25-user cap.

No MCP or CLI is needed at runtime. The app calls these APIs directly. MCPs are for your
Claude Code dev setup only (see Tech stack).


Resolve logic ( /app/api/resolve/route.ts )
 1. Input: iTunes trackId , trackName , artistName , trackTimeMillis .
 2. Check cache (Upstash Redis via Vercel Marketplace, keyed by trackId ). Hit: return
    the cached videoId . No quota spent.
 3. Miss: search.list with q="{artist} {track} official audio" , type=video ,
      videoEmbeddable=true , videoCategoryId=10 , maxResults=5 .




                                                                                     Page 8 of 16
Vinyl Player PRD




 4. videos.list on those 5 IDs. Score each: title contains track name (+), channel is "
     {artist} - Topic" or official (+), duration within 10s of iTunes duration (+), title contains
     "live", "cover", "remix", "sped up" (-), unless the user's pick has those words.
 5. Return the best videoId and cache it permanently.
 6. If nothing scores well, return the top 3 and let the user pick ("Which version?").

The YouTube API key lives only in a Vercel environment variable ( YOUTUBE_API_KEY ) and
is used only server-side. Never ship it to the browser.


Paste-a-link support (stretch, Phase 4)
     YouTube or YouTube Music URL: parse the video ID directly (no search quota), get the
     title via YouTube oEmbed, then search iTunes by title for square art.
     Spotify URL: Spotify oEmbed (no key) returns title and artwork, then run the normal
     resolve step to find the YouTube video.


Album art color
     Extract a palette with node-vibrant (server-side in /api/palette , to avoid canvas
     CORS issues with Apple's image CDN).
     Vibrant swatch tints the vinyl; Muted swatch can drive the background; LightVibrant
     for label text if needed.


Tech stack and tools

App

  Layer            Choice                               Notes

  Framework        Next.js (App Router) + TypeScript    API routes keep the YouTube key server-
                                                        side; deploys to Vercel with zero config

  Styling          Tailwind CSS + CSS variables for
                   theme colors

  Animation        GSAP + @gsap/react ( useGSAP ),      All GSAP plugins are free. Flip for zone
                   Flip, Draggable, InertiaPlugin,      moves, Draggable for knobs, tonearm,
                   CustomEase                           and queue reorder

  Playback         YouTube IFrame Player API,           One player instance for the whole app,
                   wrapped in a usePlayer hook          never remounted




                                                                                             Page 9 of 16
Vinyl Player PRD




  Layer            Choice                                Notes

  SFX              Howler.js                             Needle drop, arm click, crackle loop,
                                                         sleeve slide

  State            Zustand (with persist                 Library, queue, now-playing, player
                   middleware to localStorage)           status

  Color            node-vibrant                          Palette from album art

  Cache            Upstash Redis (Vercel                 trackId to videoId cache, protects
                   Marketplace, free tier)               the 100-searches-per-day quota

  Hosting          Vercel                                Env vars: YOUTUBE_API_KEY ,
                                                         UPSTASH_REDIS_REST_URL ,
                                                         UPSTASH_REDIS_REST_TOKEN



Assets (the realism comes from here, not from CSS)
The turntable body, platter rim, tonearm, and shelf should be photoreal image assets with
transparent backgrounds, not drawn in CSS. Options, easiest first:

 1. Image generation (Figma's generate image, or any image model): generate a top-down
     turntable on a plain background, then cut out each part. Fastest route to image 3's look.
 2. Spline: model a simple turntable in 3D, render a top-down still per part. Consistent
     lighting across parts.
 3. Blender: most control, most time.

Asset list (each a separate transparent PNG or WebP at 2x): turntable body, platter + rim,
tonearm (pivot point documented), counterweight, headshell, power switch (on and off),
volume knob, speed knob, lift lever, sleeve texture overlay, shelf plank, groove texture,
glare overlay, film grain overlay.

Generated per song in code: label (album art + curved title via SVG textPath ), vinyl tint,
sleeve face (album art + cardboard overlay + edge wear).


Claude Code setup

  Tool                 Type                      What it does for this project

  frontend-            Anthropic skill /         Steers Claude away from generic, templated UI
  design               plugin

  Context7             MCP                       Pulls current GSAP, Next.js, and YouTube API
                                                 docs into context so code isn't outdated




                                                                                               Page 10 of 16
Vinyl Player PRD




  Tool               Type                   What it does for this project

  Playwright         MCP                    Lets Claude open the app, screenshot it, and
                                            check animations against the references

  Figma              MCP                    If you design the layout in Figma first, Claude
                                            builds from the actual frames

  Vercel             CLI ( vercel )         Preview deploys from the terminal; vercel env
                                            pull for local env vars

  GitHub             CLI ( gh )             Repo + PRs; Vercel auto-deploys on push



Accounts you need to set up
     Google Cloud project with YouTube Data API v3 enabled, plus an API key restricted to
     that API
     Vercel project linked to the GitHub repo
     Upstash Redis added through the Vercel Marketplace
     Nothing for iTunes (no key)


Data model and file layout

Types

   type Record = {
        id: string;                // iTunes trackId as string
        title: string;
        artist: string;
        album: string;
        artworkUrl: string;        // 600x600 or larger
        durationMs: number;        // from iTunes
        videoId: string;           // resolved YouTube video
        palette: { vinyl: string; muted: string; label: string };
        addedAt: number;
   };


   type PlayerState = {
        nowPlaying: string | null;   // Record id
        status: 'idle' | 'loading' | 'transition' | 'playing' | 'paused';
        positionSec: number;
        volume: number;               // 0 to 100
        power: boolean;
        speed: 33 | 45;



                                                                                        Page 11 of 16
Vinyl Player PRD




   };


   type Store = {
     library: Record[];              // shelf order
        queue: string[];             // Record ids, top of fan first
        player: PlayerState;
   };


Persist library and queue to localStorage. Never persist status .


File layout

   /app
        page.tsx                 # the single screen
        /api/search/route.ts     # proxies iTunes search
        /api/resolve/route.ts    # YouTube search + match + cache
        /api/palette/route.ts    # node-vibrant on artwork
   /components
        Turntable.tsx            # body, platter, controls
        Record.tsx               # layered disc: vinyl, grooves, label, glare
        Tonearm.tsx
        Sleeve.tsx               # used on shelf, in queue, and in transit
        Shelf.tsx
        Queue.tsx
        SearchBar.tsx
     Knob.tsx                    # reusable draggable knob
   /lib
        choreography.ts          # every GSAP timeline, named beats
        usePlayer.ts             # YouTube IFrame wrapper + fades
        sfx.ts                   # Howler sounds
        store.ts                 # Zustand store
        match.ts                 # video scoring logic
   /public/assets                # turntable parts, textures, sfx
   /references                   # the three reference images
   CLAUDE.md                     # project rules for Claude Code
   PRD.md                        # this document




Build phases
Build the hero moment first. If one record spinning on one turntable doesn't feel right,
nothing after it will. Each phase ends with a Vercel preview deploy.


Phase 0: Assets and setup
     Next.js + Tailwind + GSAP + Zustand scaffolded, deployed to Vercel


                                                                                     Page 12 of 16
Vinyl Player PRD




      CLAUDE.md written (rules from the Kickoff section)
     References saved in /references
     Turntable part assets generated, cut out, and placed in /public/assets


Phase 1: The hero moment (one hardcoded song)
     Turntable renders top-down on the mustard background, matching reference 01's
     composition
     Layered record with a hardcoded album art label; glare overlay stays static while the
     disc spins
     Tonearm swings in and drops; song plays through the YouTube player
     Tonearm tracks inward with song progress
     Power switch, volume knob, and lift lever all work
     Needle-drop and arm SFX
     Done when: a side-by-side screenshot with reference 03 holds up, and it runs at 60fps


Phase 2: Search and press
     Search bar with iTunes suggestions
      /api/resolve finds and caches the right YouTube video
     "Press a new record" animation with palette-tinted vinyl and curved label title
     Done when: 10 test songs across genres all resolve to the correct full-length track


Phase 3: Shelf
     Save to shelf with the re-sleeve animation
     Shelf renders all saved sleeves, persists across reloads
     Play from shelf runs the full "Play from sleeve" sequence


Phase 4: Queue
     Click sleeves to fan them into the queue, tucked under with visible tops
     Auto-advance on song end with the full swap sequence
     Remove and drag-reorder queue items
     Paste a YouTube or Spotify link (stretch)


Phase 5: Polish
     Phone-width layout
     Reduced-motion mode



                                                                                       Page 13 of 16
Vinyl Player PRD




     Background tint follows the playing record
     Empty states (empty shelf, empty queue, no search results)
     Embed on dhvans.com


Risks and open questions

  Risk                    Likelihood    Impact                  Mitigation

  Hiding the YouTube      Certain, if   Medium for a            Keep the player visible but
  video and playing       hidden        portfolio piece, high   small and styled, e.g. a
  audio only goes                       if it ever goes         200x200 "liner notes" card
  against YouTube's                     commercial              beside the turntable. Decide
  API developer                                                 before Phase 1
  policies (they
  expect a visible
  player)

  Daily search quota      Medium if     New songs can't be      Cache every resolved song;
  runs out (about 100     shared        added until             repeats cost nothing.
  new songs per day)      publicly      midnight PT             Request a quota extension
                                                                later if it takes off

  Wrong video match       Medium        Song sounds wrong,      Duration check against
  (live version, cover,                 duration mismatch       iTunes, Topic-channel
  lyric video with                      breaks the tonearm      preference, "Which version?"
  intro)                                                        fallback

  Some videos block       Low to        Song won't play         videoEmbeddable=true
  embedding or are        medium                                filter; on player error, try the
  region-locked                                                 next-best match
                                                                automatically

  Mobile browsers         Certain on    First song needs a      Require one tap to "power
  block autoplay          iOS           tap                     on" the turntable; that tap
                                                                unlocks audio

  Realism looks           Medium        Core value of the       Photoreal assets + static
  cheap                                 product drops           glare layer; compare to
                                                                reference 03 at every phase

  iTunes art missing      Low           No square label art     Fall back to the YouTube
  for niche songs                                               thumbnail, center-cropped to
                                                                a square




                                                                                           Page 14 of 16
Vinyl Player PRD




Open questions
     Visible player: styled liner-notes card, or accept the policy risk for a personal demo?
     Turntable finish: cream, sage, or graphite as the default?
     Should the shelf show sleeves face-out (art visible) or spine-out (more fit on screen)?
     Should the queue auto-start when the first sleeve is added and nothing is playing?
     Product name


Kickoff for Claude Code
Export this doc as Markdown, save it as PRD.md in the repo root, save the three images in
 /references , then use the two blocks below.


CLAUDE.md (paste into the repo root)

   # Project rules

   - Read PRD.md before any task. It is the source of truth.
   - Open the images in /references before any visual work and compare your
   output to them.
   - Top-down view only. Realism bar = references/03-realism.jpg.
   - The record's glare overlay NEVER rotates. Only vinyl, grooves, and label
   spin.
   - All GSAP timelines live in /lib/choreography.ts with named beats. No inline
   magic timings.
   - Use useGSAP from @gsap/react for every animation in React. Clean up on
   unmount.
   - One YouTube player instance for the whole app. Never remount it.
   - The YouTube API key is server-side only. Never expose it to the client.
   - No linear easing except the steady platter spin.
   - After any visual change, run the app, take a Playwright screenshot, and
   check it against the references before saying it is done.
   - Work one PRD phase at a time. Stop at the end of each phase for review.




                                                                                        Page 15 of 16
Vinyl Player PRD




First prompt (Phase 0 + 1)

   Read PRD.md and CLAUDE.md, and look at the three images in /references.


   We're building Phase 0 and Phase 1 only.

   1. Scaffold Next.js (App Router, TypeScript), Tailwind, GSAP with
   @gsap/react, Zustand, and Howler. Use Context7 for current GSAP and Next.js
   docs.
   2. Build the turntable screen from reference 01's composition: top-down,
   centered on a mustard background with film grain. Use placeholder shapes
   where real assets are missing and list exactly which assets you need from me.
   3. Build Record.tsx as the five-layer stack described in the PRD. The glare
   layer must stay static while the disc spins.
   4. Wire one hardcoded song (I'll give you a YouTube video ID) through a
   usePlayer hook using the YouTube IFrame Player API.
   5. Build the "Play from sleeve" beats 4 to 7 (drop, spin up, arm swing,
   needle drop) in /lib/choreography.ts.
   6. Make the tonearm track song progress, and wire the power switch, volume
   knob, and lift lever.
   7. Screenshot the result with Playwright and compare it to reference 03. Tell
   me what's still off.

   Ask me before choosing anything the PRD leaves open.




Sources
     YouTube Data API quota costs
     YouTube search.list cost and limits (OutlierKit, Jun 2026)
     Spotify February 2026 Dev Mode migration guide
     Spotify Dev Mode user cap coverage
     iTunes Search API: free, no key, artwork upscaling




                                                                              Page 16 of 16
