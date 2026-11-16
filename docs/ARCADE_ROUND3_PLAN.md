# Spectral Manor Arcade — round 3 build plan

Written 2026-11-15 after a review of all twelve cabinets. This is the work order for the next chat.
Read `docs/ARCADE_NEXT_HANDOFF.md` §2 (house rules) and its "Standing preferences" list first; everything
here assumes them. This file says **what to build, in what order, where the code is, and what done looks like**.

Gregg's request, in his words: more levels "especially for infestation, cruise, and graveyard shift";
for Amp Rampage "the ladder climbing animation isn't good, and its a bit to easy, at least the first
level is. the boss should be able to have more weapons and things to hurl."

**Build order:** 1 Amp Rampage → 2 Graveyard Shift World 3 → 3 Infestation grounds → 4 Cruise tracks.
Do one game at a time: build, test, look at it in the browser, report, and let Gregg commit before the next.
Gregg has NOT yet confirmed the specific ideas below (names, weapons, bosses). They are proposals from the
review. Show him the list for the game you are starting and ask once before building anything large.

---

## 0. How to work in this repo

- **Repo:** `D:\DEV Projects 2026 V2\projects\plumbmonkey-site`. Games are in `public/arcade/games/`.
  Shared: `kit/hero-kit.js` (Spaceman + Plumbmonkey), `wave3/sprite-kit.js` (monsters), `leaderboard.js`,
  `arcade-controls.js`.
- **Tests:** `npm test` runs everything (about 1–2 minutes). One game: `node scripts/test-<game>.cjs`.
  Every change needs tests, and the bot/autopilot must still clear every level.
- **Preview:** start the `arcade-test` server from `.claude/launch.json` (Python, port 5191, rooted at
  `public/`). Pages are at `http://localhost:5191/arcade/games/<slug>/index.html`.
  - The pane caches scripts hard. Add `?cb=<n>` to the page URL, and if a changed script still looks stale
    run `fetch(scriptUrl, { cache: 'reload' })` in the page and reload.
  - `requestAnimationFrame` only runs after a screenshot fronts the pane. To step a standalone game by
    hand: `ArcadeVR.schedule = () => {}` then call `update()` in a loop and `draw()`.
  - Wave-3 cabinets (Amp, Graveyard, Beam, Hooded) keep their own rAF reference, so their loop keeps
    running; use `AmpGame.current` / `GraveyardGame.current` (`state`, `jump(n)`, `draw()`) to inspect.
  - **If a bot run ends in game over, the initials prompt opens. Never submit it** (it posts to the live
    leaderboard). Reload the page. Keep `lives` topped up in bot loops to avoid it.
- **Versions:** when a script changes, bump its `?v=` in that game's `index.html`.
- **Commits:** Gregg commits straight to `main`, and a push to `main` deploys the site. Commit only when he
  asks. `gh` is not signed in on this machine, so deploy runs can't be checked from here.
- **Editing tip:** multi-file exact-string replacements via a small Python script (written to the scratchpad
  with the Write tool, then run) worked well. Bash heredocs containing backticks and quotes did not.
- **Style reminders:** fixed 60 Hz rules; nothing moves under a title; GAME OVER beat before initials;
  telegraphs grow from their source; no long thin full-width lines; gradients fade inside their fill;
  rules use the seeded RNG, effects use `Math.random`; the Spaceman is the only hero; Plumbmonkey is only
  ever the boss; **inspired by the classics, never a copy** (no barrels rolling down girders, no flagpoles).

---

## 1. Amp Rampage (do first)

**Files:** `wave3/amp-data.js` (layouts), `amp-world.js` (movement, `CLIMB = 1.5`, `ladderFor`, climb state
at lines ~109–118), `amp-stages.js` (per-stage rules; Load-in is `setupLoadin`/`stepLoadin`, constants
`KICK_WIND 42, ORB 20, WOBBLE 60`), `amp.js` (state, bonus clock, autopilot), `amp-art.js` (drawing;
`drawHero` ~line 418 picks the pose), `kit/hero-kit.js` (`spacemanRig` `case "climb"` ~line 132, Plumbmonkey
poses ~line 300+). Test: `scripts/test-amp.cjs`.

### 1a. Ladder climb animation
What is wrong today (checked on screen):
- The Spaceman is drawn in side profile on a ladder that faces the camera, so he marches in place beside it.
- Both arms point straight up together (`arms` angles 2.55–3.1) and cover his face; they barely alternate.
- Hands are not tied to rungs. There is no step-on or pull-up; he pops between `climb` and `walk`.

Build:
- A **back-view climb pose** in the Hero Kit: seen from behind (long dark hair down the back, navy vest
  back, white suit, boots). It is a new drawing path, not just new angles in `spacemanRig`, because the rig
  is a profile rig. Keep the same call: `HeroKit.spaceman(c, x, feetY, { pose: 'climb', phase, … })`.
- **Hands grip rungs:** find the ladder rung spacing in `amp-art.js` and drive the pose from `p.y` so each
  hand stays at a fixed rung height in world space until the other hand has taken the next rung. Opposite
  knee rises with each reach; a small hip sway.
- **Ends:** a short pull-up over the top and step-off at the bottom (a few frames of art driven by distance
  from `L.yTop` / `L.yBot`; no rule change needed). Draw ladder rails a little above the deck so there is
  something to pull on.
- Phase must come from distance climbed (`p.climb`), never the clock.
- The kit is shared: check Graveyard Shift's vines and anything else using `pose: 'climb'` still looks right,
  and bump `hero-kit.js?v=` on every page that loads it only if the change is not purely additive.

### 1b. Stage 1 (Load-in) is too easy
Measured: Plumbmonkey stomps every 170 frames (2.8 s) and arms one stack; each stack gives about 2 s of
warning (42 + 20 + 60 frames); a fire ghost comes only on every 5th stack; the bonus clock allows 100 s and
the bot finishes in 38 s with 0 deaths.

Proposed tuning (cycle 0; later cycles already tighten):
- `kickEvery` 170 → about 130, and from truss 3 upward arm **two** stacks per stomp.
- `WOBBLE` 60 → 45.
- One fire ghost roaming from the start (it already has ladder AI in `stepFires`).
- Bonus clock about 70 s (`bonus` / `BONUS_TICK` in `amp.js`).
- Re-run the bot: target is "clears with 0–2 deaths", not "can't clear".

### 1c. More for Plumbmonkey to hurl
History that matters: on 2026-09-15 Gregg had the **barrels removed** as too close to Donkey Kong, and
called the old throw animation clunky. So nothing may roll down trusses or drop down ladders like a barrel.
Proposed arsenal:
- **Cymbals:** flung flat along one truss at head-or-shin height, bounce once off the end. Jump them (or duck
  if a duck is added). Fast and straight.
- **Drumsticks:** lobbed in threes on arcs, each with a shadow that grows on the deck where it will land.
- **Mic on its lead:** whipped in a sweeping arc across the top two trusses; the arc is drawn as it winds up.
- **Feedback scream:** a pulse that travels down one ladder and knocks a climber off it (pairs with 1a).
- **Roadies:** he commands a Frankenstein to walk a truss (the `command` pose exists).
- Escalation: loop 1 = stomp + cymbals; loop 2 adds drumsticks; loop 3 adds the mic whip. Scream and roadies
  suit **Rivets**, where he currently only taunts.
- Redraw the throw as a three-beat side-arm fling (wind-up, release, follow-through) in `plumbmonkey`'s rig.
- Each weapon: telegraph from his hands, a test, and an autopilot rule so the bot still clears two loops.
- The mic-stand hammer should smash cymbals and drumsticks for points.

**Done when:** the climb reads as climbing in a screenshot strip of 6 phases; stage 1 bot result is in the
target band; each new weapon has a test; `node scripts/test-amp.cjs` passes with the bot clearing 8 stages.

**Built 2026-11-15 (uncommitted at time of writing), all as proposed and confirmed by Gregg:**
- 1a: `HeroKit.spaceman` `pose: 'climb'` now draws a back view (`climbBack` in `hero-kit.js`); Amp passes the
  ladder's rung spacing so hands and feet lock to rungs, one rung per reach, in diagonal pairs (left hand and
  right foot). Rails stand 26 px above the top deck for the pull-up. The old profile rig stays behind
  `view: 'side'`. Plumbmonkey's three-beat side-arm throw is a new pose, `fling` (Graveyard Shift's boss
  still uses `throw`), with a `held` hook that draws the gear in his hand.
- 1b: `kickEvery` 130, two stacks per stomp from truss 3 up, `WOBBLE` 45, a fire ghost from the start, and a
  70 s Load-in clock (`LOADIN_TICK` 84). Bot: 0 deaths in about 28 s across 10 seeds. With inputs 8 frames
  late it averages about 1 death; with 14 frames, about 4.
- 1c: cymbals (loop 1), drumsticks (loop 2), mic whip aimed where you stood (loop 3) on Load-in; feedback
  scream down a ladder and Frankenstein roadies on Rivets. The hammer smashes cymbals (300), sticks (200) and
  roadies (500). The autopilot also learned to stay off a ladder a toppling stack is about to send a cabinet
  down. Loop 4 Load-in (stage 13) was a 0-of-10 bot trap before this and now clears 10 of 10.
- Soak extended to stage 9. Stage 7 (Stage Build) still costs the bot about 3 deaths a run, unchanged.

---

## 2. Graveyard Shift — World 3

**Files:** `wave3/graveyard-levels.js` (ASCII chunks + legend; `WORLD_1`, `WORLD_2`, `FINALE`; the header
says to add `WORLD_3` before `FINALE` in `LEVELS`), `graveyard-world.js`, `graveyard-foes.js` (foes, movers,
bosses), `graveyard.js` (player, camera, phases, autopilot + `ROUTES`), `graveyard-paint.js` (`THEMES`),
`graveyard-art.js`. Test: `scripts/test-graveyard.cjs` (bot must clear every level).

Today: six levels (1-1, 1-2, 1-3 with the Gatekeeper, 2-1, 2-2, and the Music Room labelled 2-3).
Built pieces that are barely used (counted from the level data):

| Piece (legend letter) | Used |
|---|---|
| Cloud ghost `c` | never |
| Up-and-down platform `v` | never |
| Gargoyle `t`, fire bars `f`/`F` | only 1-3 |
| Swinging chandeliers `m` | only 2-1 |
| Potion witch `w` | 3 in the whole game |

**World 3 · The Upper Floors** (proposal):
- **3-1 The Library:** moving bookshelves as platforms (first use of `v`, plus `h`), ghost-block bridges
  between shelves, witches on balconies, a dumbwaiter link to a bonus reading room.
- **3-2 The Clock Tower:** a vertical climb like the Foyer; pendulums reuse the chandelier swing, gears reuse
  the fire bar; crumbling floors.
- **3-3 The Rooftops:** outside in the storm; cloud ghosts `c`, gargoyles, crumbling slates; a new boss at
  the attic door (suggest THE CLOCKMAKER or THE LIBRARIAN; ask Gregg).
- Relabel the Music Room from `2-3` to the finale (check HUD text, tests and any `id` lookups).
- Needs: one or two new `THEMES`, one boss in `graveyard-foes.js`, a `ROUTES` entry per level for the bot.
- Rules that must hold: ghost blocks re-form with push-out (no crush deaths); a puzzle needing the Guitar has
  a refill box `*`; one checkpoint per level; the level clock and lantern tally work on new levels.

**Done when:** `LEVELS` has 9 entries with the Music Room last, the bot clears all 9, and the test covers the
new boss and the first use of `c` and `v`.

**Built 2026-11-15 (uncommitted at time of writing):** Gregg okayed going ahead; the boss is THE CLOCKMAKER.
The hero is "Ace the space wizard" to Gregg, but the game names him only where it's relevant.
- 3-1 THE LIBRARY (theme `library`): bookshelf lift (`v`) up a tall bookcase, a sliding shelf (`h`) over a
  pit, a ghost-block bridge, witches, a `dumbwaiter` link to a READING room (one-way exit past the stacks).
- 3-2 THE CLOCK TOWER (`clocktower`): one 30x46 room; pendulums are `m` drawn as brass bobs, gears are `f`/`F`
  drawn as cog arms, crumbling ledges, a gargoyle; door exit (`doorText`).
- 3-3 THE ROOFTOPS (`rooftops`, storm with cosmetic lightning): cloud ghost `c` (now leaves when a boss
  arena locks), gargoyles, crumbling slates, `*` box in the arena, THE CLOCKMAKER (`clockmaker` in
  `graveyard-foes.js`, constants `CM`): an aimed pendulum (arc telegraphed through the wind-up, swings twice
  when angry), cuckoo bolts (notes shoot them down), notes hurt only while his chest clock is open, stomps
  any time. The Music Room is now 3-4.
- Autopilot: `ROUTES` for 3-1 and 3-2, and a waypoint can be `ride` (reached while riding a mover).
  Bot: all 9 levels clear with 0 deaths.

---

## 3. Infestation — two new grounds

**Files:** `spectral-manor-infestation/grounds.js` (`GROUNDS` data, `buildField`, one `paint<Ground>` per
backdrop), `bosses.js` (`createBoss`, `updateBoss`, weak point before body), `sprites.js`, `game.js`
(`FIRST_EXTRA_LIFE 25000`, `EXTRA_LIFE_EVERY 50000`, `MAX_LIVES 5`; loop adds 15% per cycle).
Test: `scripts/test-infestation.cjs` (its soak expects 16 levels; that becomes 24).

Today: Graveyard (graves), Pumpkin Patch (vines, bursting jack-o'-lanterns), Drowned Bog (water, lilies),
Conservatory (flytraps, puffballs; deliberately the hardest). Each ground is 3 levels + a boss, with seeded
fields, so a ground is: a `GROUNDS` entry, a field feature in `buildField`, a backdrop, a boss.

Proposals (avoid "Hedge Maze" and "Catacombs": Soul Circuit uses those names):
- **The Topiary:** hedge walls form lanes that funnel the Hauntipede; gates open and close on a timer with a
  visible tell. Boss: a hedge beast that regrows walls.
- **The Root Cellar:** dark; the lantern lights a circle, glowing toadstools are the only other light.
  Boss: hunts by sound, so firing draws it.
- **Alternative, The Orchard:** shots that clip a branch drop apples on whatever is below.
- Decide with Gregg where they sit in the order. The Conservatory was tuned on 2026-09-15 to be the hardest
  ground; either it stays last or the new last ground takes that role.
- Gregg found this game far too easy before the September tuning. Run the unassisted bot probe on every new
  level and boss and report deaths and time, as that round did.

**Done when:** six grounds, the soak sees 24 levels, both new bosses have tests, and nothing softlocks.

---

## 4. Cruise — two new tracks (largest job)

**Files:** `spectral-manor-cruise/tracks.js` (`TRACKS` themes, `LAYOUTS` road functions built with
`b.road(enter, hold, leave, curve, hill)` and `b.close(len)`, `buildTrack` scenery `SETS`, hazards, sky),
`game.js` (series flow, `LAPS = 3`, rivals armed from race 2, place points), `cars.js`, `render.js`.
Test: `scripts/test-cruise.cjs` ("clean wins, sloppy loses" bots; `pace` per track is bot-tuned).

Today: Midnight Highway (ramps), Hollow Woods (fog banks, logs), Boneyard Canyon (crests, lava, three jumps),
Neon Necropolis (rain, tunnels, puddles). The series loops with faster rivals.

Proposals:
- **Drowned Causeway:** a coast road; waves wash across lanes on a rhythm (visible well ahead), a lighthouse
  beam sweeps the road. New scenery set, sky and one hazard.
- **Manor Drive (finale):** point-to-point up the hill to the manor: switchbacks, gates, lightning, ending at
  the front door instead of a lap line. Point-to-point is new: the lap counter, minimap, `LAPS * track.length`
  finish check, rival logic and the test all assume laps. Scope this before starting; a three-lap hill circuit
  is the fallback.
- **Cheap variety:** mirrored layouts (negate `curve`) for the second pass through the series.
- **Structure:** a championship table across the series.
- Standing rule for this game: **no off-screen attacks**; rivals drop visible hazards. Billboards rotate the
  other cabinets' stills (`BILLBOARD_GAMES`); new tracks should use them too.

**Done when:** six valid tracks, the bots still show "clean wins, sloppy loses" on each, and the series loop
test passes.

---

## 5. Backlog (not this round unless Gregg asks)

- **Revenger** (sector variety shipped 2026-11-15, commit `9f2db61`): still open are capping extra ships (the
  bot ends a cycle with 6–9), longer waves and wave types (waves last 10–20 s), an optional mothership raid so
  good players see the on-foot run (the Rift never triggers for the bot), four new sectors for cycle 2, and
  per-sector runner interiors. Unexplained: the bot dies more in the Dreadnought fight with towers present
  (30 vs 19 deaths in 24 fights), almost all at high altitude away from the towers.
- **House of the Hooded:** thinnest cabinet (one 28-tile board, three enemies, levels only speed up). New
  board shapes, multi-hit tiles, a boss board.
- **Swarm:** fourth arena and a true third boss (the third is the first two together).
- **Luno's Flight:** the four platform layouts are nearly the same; give Bell Tower and Blood Moon their own.
- **Mess Hall:** a second boss for the Banquet Hall. **Beam Me Up:** hazards for Blood Moon and the Void.
  **Crystal Dimension:** a hazard for the Prism Core.
- **READMEs:** Mess Hall and Swarm describe the pre-rebuild games; four others are one line.

---

## 6. Kick-off prompt for the new chat

> Read `docs/ARCADE_ROUND3_PLAN.md` and §2 plus "Standing preferences" in `docs/ARCADE_NEXT_HANDOFF.md` in
> the plumbmonkey-site repo. Start with section 1, Amp Rampage: show me the proposed weapon list and stage-1
> tuning for a quick yes or changes, then build 1a–1c with tests, check it in the browser, and stop for me to
> review before moving to Graveyard Shift.
