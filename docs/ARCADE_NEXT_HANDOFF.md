# Spectral Manor Arcade — handoff for the next round

Written 2026-09-14, at the end of the session that rebuilt **Infestation** and **Beam Me Up: Live!**.
Start the new chat by reading this file. It covers where the arcade stands, the house rules every
rebuild follows, the new shared **Hero Kit** (the Spaceman is the hero, Plumbmonkey is the final boss),
and a design brief for each of the three games left: **Graveyard Shift**, **Amp Rampage** and **Revenger**.

---

## 1. Where things are

**Repo:** `D:\DEV Projects 2026 V2\projects\plumbmonkey-site` (Next.js static export; push to `main` deploys via GitHub Actions).
**Games:** `public/arcade/games/<slug>/`. Shared scripts sit in `public/arcade/games/`: `leaderboard.js`, `arcade-controls.js`, `arcade-audio.js`, `vr-mode.js` and `touch-controls.js`.
**Wave-3 cabinets** (Amp Rampage, House of the Hooded, Graveyard Shift, Beam Me Up) share one host, `public/arcade/games/wave3/wave3.js`, plus `wave3.css` and `sprite-kit.js`.

> **Before starting: commit.** The Beam Me Up rebuild is still uncommitted: `wave3/beam-data.js`, `wave3/beam.js`, `wave3/beam-art.js`, `scripts/test-beam.cjs`, plus edits to `wave3/wave3.js`, `spectral-manor-beam-me-up/index.html` and `package.json`.

### Status of all twelve games

| Game | Status | Structure |
|---|---|---|
| Mess Hall | Rebuilt 2026-09-13: 4 rooms, Head Chef, own cast | multi-file folder |
| Swarm | Rebuilt 2026-09-13: 3 arenas, 2 bosses | multi-file folder |
| Luno's Flight | Rebuilt 2026-09-13: 4 skies, 4 bosses | multi-file folder |
| Soul Circuit | Rebuilt 2026-09-13: generated mazes, 4 bosses | multi-file folder |
| Crystal Dimension | Rebuilt 2026-09-13: 4 sectors, 4 bosses | multi-file folder |
| Cruise | Rebuilt 2026-09-13: 4 tracks | multi-file folder |
| Infestation | Rebuilt 2026-09-14: 4 seeded grounds, 4 bosses | `grounds.js`, `sprites.js`, `bosses.js`, `game.js` |
| Beam Me Up: Live! | Rebuilt 2026-09-14: 4 venues × (2 waves, challenge stage, boss), capture/rescue | `wave3/beam-data.js`, `beam.js`, `beam-art.js` |
| House of the Hooded | Untouched this round (a future idea: new board shapes and multi-hit tiles) | `wave3/hooded.js` |
| Graveyard Shift | Rebuilt 2026-09-14: Mario-style, 2 worlds × 3 levels, ghost blocks, portals, Gatekeeper + Plumbmonkey guitar finale | `wave3/graveyard-levels.js`, `graveyard-world.js`, `graveyard-foes.js`, `graveyard.js`, `graveyard-paint.js`, `graveyard-art.js` + `kit/hero-kit.js` |
| **Amp Rampage** | **NEXT**: rebuild as Donkey Kong / DK Jr / BurgerTime | inline in `wave3/wave3.js` |
| **Revenger** | **NEXT**: rebuild as Defender, plus a runner level | `spectral-manor-revenger/game.js` (2,056 lines, one file) |

---

## 2. House rules for every rebuild (all learned the hard way)

1. **Fixed 60 Hz rules.** Use an accumulator loop (`while (acc >= STEP) update()`). Rules that run per `requestAnimationFrame` go 2× speed at 120 Hz.
2. **Nothing moves under a title.** Level and wave banners freeze the action. Mid-play flashes like EXTRA LIFE don't.
3. **GAME OVER beat.** Never open the initials prompt on the death frame, because held WASD keys type into it. Play a GAME OVER banner for about 150 frames first, then call `Arcade.submitFlow`. Wave-3 modules call the host's `lose()`/`end()` only after that beat.
4. **One shot, one hit.** Mark a projectile dead on its first hit, and never splice arrays inside nested `forEach`.
5. **Weak points before bodies.** Resolve the weak point before the body. Shots advance a fixed number of pixels from a fixed start line, so they land on the same y values every time: a weak point's hitbox must reach down past any blocking body box, or the body swallows every shot. The Beam Queen's core and Deep One's eye were unhittable until fixed.
6. **Pause and blur.** P or Esc pauses, and losing window focus pauses.
7. **Attract mode.** The hub shows every cabinet at `index.html?attract=1`, and `startGame` is started automatically. Give each game an autopilot, and keep it silent (no audio).
8. **Tests.** Every game gets a headless rules test in `scripts/test-<game>.cjs`, added to `npm test` in `package.json`. Keep rules separate from drawing so they can be tested: wave-3 modules export `createState`/`step` through `module.exports`, and standalone games load into `vm` with a stub canvas (see `scripts/test-infestation.cjs`).
   - Include a **soak test** where the autopilot plays every level, and assert that each one clears and that positions stay finite.
   - Test gotchas:
     - An empty field counts as cleared on the very first step.
     - Formation enemies snap back to their slot, so park test enemies in a state the rules don't move.
     - Arrays created inside `vm` need a JSON comparison, not `deepEqual`.
     - A synthetic bullet needs every velocity field the game reads, or it becomes NaN.
9. **Controls.**
   - On-screen and gamepad buttons come from `ArcadeControls.init(keys, {...})` in each `index.html`, and from `CONTROL_LAYOUTS` in `leaderboard.js`.
   - When you add a button, update both and bump the `?v=` query strings.
   - `arcade-controls.js` has an opt-in ⟳ auto-fire chip, which Revenger must NOT offer (see §6).
10. **Slugs.**
    - Slug lists must agree across `leaderboard.js`, `app/arcade/ArcadeRoom.tsx` and `workers/plumbmonkey-api/src/index.js` (checked by `check-arcade-games.mjs`).
    - Don't rename slugs, and keep existing high-score localStorage keys.
11. **Wave-3 view.**
    - The world is 960×720, drawn through a +160px offset (`PAD`) into a 1280×720 canvas.
    - Full-width art spans `-PAD .. W+PAD`, and offscreen spawns start at the view edge.
    - The host owns score, lives, HUD, music, toasts and the leaderboard flow.
12. **Art style.** Ink outline, a darker shading pass, and eyes lit with `shadowBlur`.
    - Pre-render sprites to canvases per animation frame; bosses can be drawn live.
    - Long thin strokes across the playfield read as rendering artifacts, so use soft gradients.
    - `sprite-kit.js` has two sizes: `draw()` is for figures around 90px tall and turns to mud below about 40px; `drawMini()` is for 22–30px.
13. **Previewing.**
    - Use the `arcade-test` preview server (Python, rooted at `public/`), not `plumbmonkey-static`, which serves a stale `out/` build and breaks relative script paths.
    - In Claude's Browser pane, `requestAnimationFrame` only runs once a screenshot brings the pane to the front.
    - Add a small inspection hook for visual checks (Beam has `BeamGame.current.jump(level)`).
14. **Bot balance pass.** Run an unassisted bot over every level. Anything the bot can't clear, or that takes minutes, gets fixed or tuned before finishing.

---

## 3. The Hero Kit (build this first: all three games use it)

**Direction change:** the **Spaceman** is the arcade's primary hero, and **Plumbmonkey**, the purple monkey, is the **final boss who commands all the monsters**. Amp Rampage currently lets you *play* as Plumbmonkey on even levels, which ends now.

Today the Spaceman is drawn four separate ways:
- `drawRigHero` in `wave3/wave3.js`, with both the spaceman and monkey skins
- Mess Hall's `cast.js`
- Swarm's `hero.js`
- Beam's ship pilot

The kit gives him one identity. Migrating those other games is optional, later.

### Proposed file
`public/arcade/games/kit/hero-kit.js` (new shared folder), loaded as a classic script that sets `window.HeroKit`, exactly like `sprite-kit.js` sets `SpriteKit`.

```js
HeroKit.spaceman(ctx, x, feetY, { pose, phase, face, scale, weapon, flash, alpha })
HeroKit.plumbmonkey(ctx, x, feetY, { pose, phase, face, scale, flash, rage })
HeroKit.frames(name, pose, size)   // → cached canvases for fast blits
```

- **Anchor:** feet (bottom centre), so ground contact is exact.
- **Face:** `-1` or `1`. Mirror the body only, and offset the eyes/visor about 2px so a flip is visible.
- **Phase:** advance it from **distance travelled**, never wall-clock time, so feet don't skate.
- **Two authored sizes, as with `sprite-kit.js`:**
  - FULL: Spaceman about 64px tall, Plumbmonkey about 110px as a boss.
  - MINI: about 28px, for Revenger's cockpit and map icons.
  - Never shrink FULL below 0.8×.

### Spaceman (reference image supplied by Gregg)
- **Build:** athletic adult with long, dark, swept-back shoulder-length hair.
- **Face:** tan skin and a stern expression, with gold aviator sunglasses (brown lenses).
- **Suit:** a white quilted one-piece flight suit with a high white neck ring (helmet seal) and a zip front.
  - Over it, a **navy vest with a cosmic print** (planets, nebula, orange and gold), with two straps hanging below the chest.
  - Navy and white striped cuffs.
- **Boots:** white knee-high, with a navy stripe band and black soles.
- **Palette:**

| Part | Hex |
|---|---|
| Suit | `#eef0f2` |
| Suit shade | `#c3c8cf` |
| Navy | `#1e3558` |
| Vest print | `#d98a3a`, `#e9b86a`, `#3f6aa8` |
| Hair | `#2a211c` |
| Skin | `#c28a66` |
| Lens | `#5a3826` |
| Frame | `#c9a24a` |
| Sole | `#161616` |
| Ink | `#120b1e` |

### Plumbmonkey (reference image supplied by Gregg)
- **Build:** chibi proportions: head about ⅓ of height, long arms, short legs.
- **Head:**
  - Purple fur, with a lighter face and muzzle and an open "o" mouth.
  - Long flowing lavender hair to mid-back.
  - Black wraparound sunglasses.
- **Clothes:**
  - A black leather biker jacket (asymmetric zip, lapels, silver hardware) over a black tee.
  - Black belt with a silver buckle, and dark slim jeans.
  - Black canvas high-top sneakers with white soles and laces.
- **Palette:**

| Part | Hex |
|---|---|
| Fur | `#7a4ca0` |
| Face | `#9d73c2` |
| Fur shade | `#553278` |
| Hair | `#8e62c6` |
| Hair light | `#b996e0` |
| Leather | `#18161c` |
| Leather highlight | `#3a3740` |
| Metal | `#b8b8c0` |
| Denim | `#1f2a33` |
| Sneaker sole | `#e8e4dc` |
| Lens | `#0b0b0e` |

### Poses needed (union of the three games)

| Character | Pose | Frames | Used by |
|---|---|---|---|
| Spaceman | idle (breathing) | 2–4 | all |
| | run cycle | 8 | Graveyard, Amp, Revenger runner |
| | jump (rise) / fall / land squash | 1 / 1 / 1 | Graveyard, Amp, runner |
| | climb ladder / cable (alternating reach) | 4 | Amp, Graveyard vines |
| | hang + swing (one and two hands, DK Jr) | 4 | Amp |
| | shoot blaster (standing / running / air) | 2 each | runner, Graveyard |
| | play guitar (strum loop, big power-chord pose) | 4 + 1 | Graveyard finale, Amp |
| | smash (overhead swing with a neon pick or mic stand, DK hammer) | 4 | Amp |
| | hurt / death spin / victory | 2 / 4 / 2 | all |
| | slide / duck | 1 | runner |
| | pilot portrait (MINI, in the canopy) | 2 | Revenger ship |
| Plumbmonkey | idle headbang (hair swing) | 4 | all |
| | chest-pound / taunt (DK), "rock horns" | 4 | Amp, finale |
| | throw (amp or drum barrel overhead → release) | 4 | Amp |
| | command (points, monsters answer) | 2 | Revenger, Graveyard |
| | stomp / guitar-smash shockwave | 4 | Amp, finale |
| | hit flash / dizzy / defeat fall | 1 / 2 / 4 | all |

The existing monster cast in `wave3/sprite-kit.js` (`frank`, `ghost`, `witch`, `vampire`, `werewolf`, plus Swarm's `grunt`/`hunter`/`brute`/`horror`/`wraith`) stays as **Plumbmonkey's army**.

### Art path: pick one at the start of the new chat
- **A. Procedural (recommended default).** Draw the kit in canvas code in the house style, like every rebuilt game so far. No asset pipeline, crisp at any scale, and poses come from parameters.
- **B. Gregg supplies lo-fi sprite sheets.** The kit then becomes a sheet loader with the same API. Sheet spec:
  - Transparent PNG, one sheet per character, animations in rows, left to right.
  - Spaceman frames 64×64, drawn at 2× (128×128) and scaled down in code. Plumbmonkey frames 128×128 (256×256 at 2×).
  - Feet on the same baseline in every frame, 4px from the bottom. Character faces **right**; code mirrors him.
  - Row order follows the pose table above, with frame counts as listed.
  - Name files `kit/sprites/spaceman.png` and `kit/sprites/plumbmonkey.png`, each with a small JSON listing row/frame counts.
  - Use the palettes above, with a dark outline (`#120b1e`) about 2px at the 2× size.
- A hybrid works too: Gregg's sheets for Plumbmonkey's big boss poses, procedural for everything else.

Put the two reference images in `docs/arcade-art/` (`spaceman-ref.jpg`, `plumbmonkey-ref.png`) so the next chat can look at them.

---

## 4. Graveyard Shift: a Mario-style climb to the Music Room

> **BUILT 2026-09-14** (uncommitted). Decisions: procedural Hero Kit (`public/arcade/games/kit/hero-kit.js`, Graveyard's poses only so far), Mario power tiers (Spaceman 1 hit → Amp → Guitar), Music Room always the last level (`FINALE` in `graveyard-levels.js`; add `WORLD_3` before it).
> - **Files** (load order in the cabinet): `graveyard-levels.js` (ASCII chunks + legend), `graveyard-world.js` (tiles, ghost vapour/re-form with push-out, crumbles, refill boxes, links), `graveyard-foes.js` (foes, movers, Gatekeeper, Plumbmonkey + the jam), `graveyard.js` (player, tiers, notes, exits, camera, phases, look-ahead autopilot + `ROUTES`), `graveyard-paint.js` (themes, tiles, foes), `graveyard-art.js` (render + host glue; `GraveyardGame.current.jump(n)` for visual checks).
> - **Deviations from the brief below:** without the Guitar, SONIC is a short whistle that still blasts ghost blocks (so no softlocks); `*` is a refill music box; power-ups hop off the box toward the player; the Other Side's ghosts are permanent spirit stone and its `L` echo blocks are solid only while the matching gallery block is vapour; Down (S/↓, touch ENTER) enters graves and paintings; the bell rope scores by grab height; Plumbmonkey is only hurt in his taunt window, and each emptied bar makes him dizzy so you can take the pedestal guitar and hit 3/4, 3/4, then 5/6 beats.
> - **Tests:** `scripts/test-graveyard.cjs` covers everything in the acceptance list, and the autopilot clears all six levels with 0 deaths in about 9 s.
> - **Not yet:** candelabra fire bars and gargoyles exist only in 1-3; the cloud ghost (`c`) and `v` platforms are coded but not placed; there is no timer. The original brief follows for reference.

### Today
`wave3/graveyard.js` (394 lines) keeps rules and rendering separate: `createState(level)`, `step(s, dt, input)` returning events, and `create(api)`. It is tested by `scripts/test-graveyard.cjs` (79 lines).
- **Levels:** three hand-built chapters (Graveyard Approach, Mansion Basement, Concert Stage), each a flat `WORLD=3400` run on `GROUND=600` with a few blocks, platforms and six enemies, then a guardian. The game ends after chapter 3.
- **Keep:** coyote time, jump buffering, one-way platforms, checkpoint flags, three health points, the guitar pickup, and Sonic fire in the facing direction.

### What Gregg asked for
- A **Super Mario Bros.-style** course that is **challenging**.
- Instead of smashing blocks, **blast ghosts into vapour with music notes; they slowly re-form**.
- Work toward the mansion; some levels are inside. The mansion is **multidimensional**, so you move through its different floors.
- **Ultimate goal:** reach the **Music Room at the top of the house** and **play the guitar to vanquish the final boss**.
- **Build 2 worlds × 3 levels now, and make it easy to add more later.**

### Design
- **World 1 · The Grounds** (outside, heading for the mansion)
  - **1-1 Cemetery Gate:** a teaching level with ghost blocks, notes, the first guitar and simple gaps.
  - **1-2 The Crypts:** an underground run; open graves act as Mario's pipes (warp into bonus crypts); crumbling tomb floors.
  - **1-3 Mansion Steps:** a fortress-style level with candelabra fire-bars and falling gargoyles (Thwomp role). Boss: **The Gatekeeper** (a Frankenstein doorman) at the front door.
- **World 2 · The Mansion** (inside; each level is a floor, and the dimension shifts)
  - **2-1 Grand Foyer:** vertical sections up the double staircase; chandeliers swing as platforms.
  - **2-2 Portrait Gallery:** paintings are **dimension portals**. Stepping through flips you into a mirrored "other side" layout where ghost blocks are solid and floors are gone; you ping-pong between the two to progress.
  - **2-3 The Music Room (top floor):** the finale. **Plumbmonkey** fights with his monsters. Pick up the legendary guitar and **play it** (a timed strum and power-chord pose from the Hero Kit) to vanquish him.
  - Future worlds get inserted *between* World 2's early floors and the Music Room, so the Music Room is always the last level. Confirm this with Gregg.
- **Ghost blocks (the core mechanic)**
  - Ghosts floating in block formations are **solid platforms** while formed.
  - A **music note** projectile (or a head-bump from below) blasts one into **vapour**: score, a sparkle, and a soul-note coin. It becomes pass-through, then **slowly re-forms** (about 5–7 s, shown by a wisp that grows back and flickers before it is solid).
  - This is both the "block smash" and a timing tool: vaporise a wall to pass, or wait for a bridge to re-form. If it re-forms on top of the player, push the player out rather than killing them.
- **Mario equivalents**

| Mario | Here |
|---|---|
| Coins | Soul notes (100 = extra life) |
| Question blocks | Haunted music boxes (Guitar, Amp, Encore) |
| Mushroom (grow, 2 hits) | **Amp** |
| Fire flower | **Guitar**: bouncing music notes |
| Star | **Encore**: invincibility with a music sting |
| Goomba | Skull crawler |
| Koopa | Armoured Frankenstein (stun, then kick him) |
| Piranha | Cursed urn flower |
| Hammer Bros | Potion-lobbing witches |
| Lakitu | Cloud ghost dropping pumpkins |
| Fire bar | Candelabra bar |
| Thwomp | Gargoyle |
| Pipe | Grave / dumbwaiter |
| Flagpole | Bell rope (height = score) |
| Checkpoint | Mid-level lantern |

- **Challenge**
  - Every level has one checkpoint.
  - Worlds get harder: moving and crumbling platforms, vapour-timing puzzles, enemy combos. Always fair: telegraphs, coyote time and jump buffering stay.
- **Tech**
  - Keep the `createState` / `step` / events / `create(api)` split.
  - Move levels into **tile maps** in a data file (`wave3/graveyard-levels.js`): ASCII rows plus a legend (`#` ground, `G` ghost block, `?` music box, `^` spikes, `=` crumble, `P` portal, `C` checkpoint, enemy letters). About 48px tiles, 15 rows, 150–250 columns per level.
  - Add a camera with look-ahead, and vertical scrolling for the Foyer.
  - Draw the Spaceman from the Hero Kit, and use a real Plumbmonkey boss.
- **Acceptance**
  - A bot or test clears all 6 levels.
  - Tests cover the ghost vapour/re-form cycle (no crush death), portal layer swap, checkpoint respawn, both bosses, the guitar finale and the GAME OVER beat.

---

## 5. Amp Rampage: Donkey Kong × DK Jr × BurgerTime, haunted

### Today
The whole game is inline in `wave3/wave3.js`:
- `ampRampage(){…}` (around lines 676–1016)
- art helpers `drawRigHero`, `drawRigBoss`, `drawRigTruss`, `drawRigLights`, `drawRigLadder`, `drawStageItem`, `drawFan`, `drawFanCage` and `drawBasement` (around lines 218–600)

How it plays:
- **Layout:** 5 sloped truss floors (`floors=[650,520,390,260,130]`, alternating slope) joined by ladders. A boss at the top throws stage gear.
- **Items:** neon picks are banked, then spent with E for smash mode. A cage key sits on the rig, and a fan is caged at the top.
- **Levels:** `next()` just calls `reset()` with harder numbers, so every level is the same rig.
- **Lights and cast:** lights pulse off the music sequencer (`beat`/`beatAccent`). The player alternates Spaceman and Plumbmonkey skins, and bosses use `SpriteKit` figures.
- **Tests:** none.
- **Rules still worth keeping** (memory 2026-09-12):
  - An automatic pickup placed on the only walkable path is a trap, so picks are banked.
  - Every pickup respawns, so no level becomes unwinnable.
  - The boss swipe is telegraphed and has real collision.

### What Gregg asked for
**Much better graphics, cleaner animation, more levels**, drawing on **Donkey Kong, Donkey Kong Jr. and BurgerTime** in the haunted theme: **monsters, musical instruments and gear, climbing, swinging, and the collapse at the top.**

### Design
Plumbmonkey is the villain at the top of the rig (Donkey Kong's role) and has kidnapped a fan (Pauline's role); the Spaceman climbs. Four stage types cycle, harder each loop:

1. **LOAD-IN** (DK 25m)
   - Sloped trusses. Plumbmonkey rolls **amps and drum barrels** down; some drop down ladders.
   - A burning amp spawns **fire ghosts**.
   - The **mic-stand/neon-pick hammer** smashes rolling gear, and jumping gear scores points.
2. **CABLE JUNGLE** (DK Jr.)
   - Climb and **swing on hanging cables and chains**. Two cables together climb faster; slide down one hand.
   - **Snap-jack** amps crawl the cables, and **bats** swoop.
   - Knock **cymbals and drumsticks** down onto monsters below. Carry keys up to unlock the fan's cage.
3. **STAGE BUILD** (BurgerTime)
   - Walk across stacked **stage parts** (speaker cab, amp head, drum shell, cymbal) spread over platforms. Walking the full length of a piece drops it a floor, and pieces cascade.
   - Assemble a complete **rig stack** in each bay at the bottom.
   - Chased by **Frankenstein, ghost and witch** (the Mr. Hot Dog / Egg / Pickle roles). Crush them with falling parts, or ride a part down for a bonus.
   - The **Feedback** blast stuns them, with limited charges (the pepper role).
4. **RIVETS / COLLAPSE** (DK 100m)
   - Pull **8 rig bolts** by walking over them. The whole rig **collapses**, Plumbmonkey falls, the fan is freed, and the loop repeats harder.

**Graphics and animation**
- Hero Kit Spaceman and Plumbmonkey with the full pose set.
- Pre-rendered gear sprites (amps with a speaker grille, glowing tubes, road cases, drum barrels with a kick-drum logo).
- Venue parallax, stage lights still driven by the sequencer.
- A readable collision silhouette; animation phases driven by distance, not the clock.

**Tech**
- Move it out of `wave3.js` like Beam: `wave3/amp-data.js` (stage layouts), `wave3/amp.js` (pure rules + `module.exports`), `wave3/amp-art.js` (kit + gear art + `create(api)`).
- `wave3.js` keeps only `ampRampage(){ return AmpGame.create({...}) }`.
- Remove the inline `drawRig*` helpers from `wave3.js` once nothing else uses them. `drawFan`/`drawFanCage` may move into amp-art.
- Keep the slug and the `plumbmonkey.arcade.wave3.ampRampage.highScore` key.
- Add `scripts/test-amp.cjs`.

**Acceptance**
- The bot clears one full loop of all 4 stage types.
- Tests cover barrel rolling and ladder drops, hammer smash, cable swing and climb speed, BurgerTime cascade drops and crushes, rivet collapse, and the GAME OVER beat.

---

## 6. Revenger: Defender, levelled up, with an interdimensional runner

### Today
`spectral-manor-revenger/game.js`: 2,056 lines in one file, with no test.
- **World:** a wrapping world 4 screens wide (`WORLD_W = W*4`) with a camera and radar. Concert fans stand on the ground.
- **Enemies:** `ghost`, `sphere`, `capsule`, `cylinder` and `pyramid` (pyramids charge and fire beams). About 55% of them hunt fans. Waves are `4 + wave*2` random enemies.
- **Power-ups:** `DUAL`, `HEAVY` or `SPREAD`, random and timed.
- **Firing:** **holding Space/Z auto-fires** (`if (keys.Space || keys.KeyZ) fire()` with 7, 13 or 11-frame cooldowns).
- **Extras:** combo multiplier, hit-pause, a full-screen death blast, and a `deathPending` restart lockout (keep it).
- **Controls:** `CONTROL_LAYOUTS` has `pad:'dpad', actions:[['FIRE','Space']]`, and the auto-fire chip in `arcade-controls.js` is offered.

### What Gregg asked for
- Better overall look and gameplay.
- **Better laser blasts and dramatic explosions.**
- **No auto-fire: one button press per shot.**
- Better power-ups and new levels.
- If **all fans are abducted**, an **interdimensional** version of Defender's mutant planet: **dock the hero ship in a mothership** and play a **runner** level, a running firefight to rescue the fans.
- The Spaceman is the hero.

### Design
**Firing**
- Fire happens on the key's **rising edge** only (keydown with `!e.repeat`, consumed once per step).
- Touch FIRE sends one shot per tap. Gamepad buttons fire on the press edge.
- **Remove the auto-fire chip for Revenger.** Check whether `arcade-controls.js` needs an `autoFire:false` option.
- Keep a short minimum gap (about 4 frames) between shots so a tap is never swallowed.

**Lasers** (Defender-style)
- Long streaking beams that grow from the nose, with a colour-cycling tail and additive glow core.
- A hit spark and a short beam **afterimage**. Pre-rendered glow sprites keep it fast.

**Explosions**
- Multi-stage: white flash → expanding shockwave ring → spinning debris shards with gravity → smoke puffs → embers.
- Hit-pause scaled to enemy size, camera shake, and a brief screen flash on big kills. A slow-mo beat when a mothership dies.

**Power-ups** (persistent and levelled, not random timed swaps)

| Power-up | Effect |
|---|---|
| **Laser level 1–3** | twin, then pierce, then wave beam |
| **Power Chord** smart bomb | stock of 3, clears the screen |
| **Feedback shield** | absorbs 2 hits |
| **Ghost Option** | a wingman drone that copies your shots |
| **Tractor** | auto-catches falling fans |
| **Warp** | Defender's hyperspace, with a risk |

Drop sources: kill streaks, rescues, and a special carrier enemy.

**Levels**
- **Named sectors, 4 waves each:** Concert Grounds, Graveyard Hills, Storm Coast, Neon City.
- Each sector has its own backdrop, terrain line and enemy mix, and ends with a **mothership boss**.
- **Defender roles:**
  - lander → abductor
  - mutant → *mutated fan*
  - baiter → a *hurry-up hunter* if you dawdle
  - bomber → mine layer
  - pod → swarmers that split

**All fans abducted → THE RIFT**
1. The planet **phases into the Interdimensional Rift**: an inverted, fractured-colour world where every surviving enemy mutates and turns aggressive.
2. A giant **Mothership** hangs in the Rift. The player flies into its lit docking bay (a short guided docking sequence).
3. **RUNNER:** the Spaceman on foot, side-scrolling through the mothership.
   - Run, jump, slide and shoot (one press per shot).
   - Break **fan stasis pods**, fight mutants and Plumbmonkey's monsters, and reach the core against a timer.
4. **Success:** rescued fans are restored to the planet, the Rift closes, and ship play resumes. **Failure:** you lose a life, and the Rift persists until the sector ends. Confirm this with Gregg.

**Final boss:** **Plumbmonkey** commands the invasion. After the last sector he appears in the mothership core in a runner boss fight, or piloting a command ship.

**Tech**
- Split the single file: `sectors.js`, `fx.js` (lasers, explosions, glow cache), `ship.js`, `enemies.js`, `runner.js`, `render.js`, `game.js`.
- Check whether the loop is fixed-step; if it isn't, make it fixed 60 Hz.
- Keep the slug and `spectralArcade.revenger.best`.
- Add `scripts/test-revenger.cjs`.

**Acceptance**
- One press gives exactly one shot. Holding the button fires once, and no auto-fire chip is shown.
- Tests cover explosions not affecting rules, power-up levelling, all-fans-lost → Rift → docking → runner → restore, the sector bosses, and the GAME OVER beat.
- The bot clears the sectors.

---

## 7. Open questions for Gregg (ask early in the new chat)
1. **Art path:** procedural Hero Kit (A), his lo-fi sprite sheets (B), or hybrid? If B, the spec is in §3.
2. **Graveyard finale:** is the Music Room level 2-3 now, with future worlds inserted before it later?
3. **Revenger runner failure:** lose a life and stay in the Rift until the sector ends, or something harsher?
4. **Migration:** should the other games' Spaceman (Mess Hall, Swarm, Beam pilot) move to the Hero Kit later?
5. **Build order:** suggested **Hero Kit → Revenger → Amp Rampage → Graveyard Shift** (the kit first because all three depend on it).

---

## 8. Kick-off prompt for the new chat

> Read `docs/ARCADE_NEXT_HANDOFF.md` in the plumbmonkey-site repo. Commit the uncommitted Beam Me Up work first if it's still pending. Then start with §3, the Hero Kit (Spaceman hero, Plumbmonkey final boss), following the house rules in §2, and ask me the open questions in §7 before building the three games. The reference images are in `docs/arcade-art/`.
