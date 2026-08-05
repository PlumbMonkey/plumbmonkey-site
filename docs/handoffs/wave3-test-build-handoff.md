# Plumbmonkey Arcade Wave 3 — Playtest Handoff

## 1. Status

Playable test build complete. Arcade integration and production release are intentionally deferred.

## 2. Objective

Create isolated, keyboard-playable prototypes of all four Wave 3 games so they can be tested before appearing in the public arcade.

## 3. Completed Work

- Added a private Wave 3 test lobby.
- Added playable versions of Beam Me Up: Live!, Amp Rampage, House of the Hooded, and Ghost Circuit: Graveyard Shift.
- Added a shared 960 × 720 canvas shell, fixed-step-safe loop, keyboard input, pause, focus-loss pause, mute, generated sound effects, fullscreen, reduced-effects toggle, score, lives, levels, and local high scores.
- Used the four final namespaced high-score keys from the Wave 3 plan.
- Kept the existing eight-game list, cards, routes, and score keys unchanged.
- Verified a full Next.js production build.
- Opened and started every game in a browser smoke test with no console errors.
- Completed a second visual-production pass with reusable illustrated monster and hero renderers, richer lighting, CRT treatment, particles, fog, and environmental depth.
- Integrated the existing Plumbmonkey Victorian mansion artwork into House of the Hooded and Graveyard Shift.

## 4. Test Routes

- Lobby: `/arcade/wave-3-test/`
- Beam Me Up: Live!: `/arcade/wave-3-test/beam-me-up-live/`
- Amp Rampage: `/arcade/wave-3-test/amp-rampage/`
- House of the Hooded: `/arcade/wave-3-test/house-of-the-hooded/`
- Graveyard Shift: `/arcade/wave-3-test/graveyard-shift/`

## 5. Current Gameplay

### Beam Me Up: Live!

- Horizontal ship movement with improved sonic-laser visuals and frequency-sweep audio.
- Enemy groups enter from the left, right, and top before forming and diving.
- Three reserve hero ships can be kidnapped; a successful abduction removes one and launches a replacement hero.
- Multi-hit mothership, visible abduction countdown, rescue bonus, lives, waves, and persistent high score.
- Abduction craft now follows explicit approach, dive, beam, kidnapping, and escape states.
- Enemy count doubled; formations loop into position and improve dive frequency, aiming, and projectile speed by wave.
- Enemies enter single-file with staggered chaotic loops and opportunistic attacks during entry.
- The active hero can be carried to the top of the screen, retained for a late-wave dive bomb, and rescued by destroying the mothership. A rescued hero becomes a visible wingman and doubles fire.

### Amp Rampage

- Five sloped rig levels, ladders, jumping, animated blocky heroes, and neon-pick smash power.
- Alternating Spaceman and Plumbmonkey heroes.
- Frankenstein, Vampire, and Ghost boss rotation.
- Boss-thrown amplifiers, speakers, and stage lights gain fire or magical fields at higher levels.
- Smashing hazards weakens the boss and frees a hostage fan, who must be reached to advance.
- Boss projectiles now originate from the boss level and include guitars, basses, drum parts, microphones, speakers, lights, and amplifiers.
- Hero renderer supports separate walking limbs and airborne poses.
- Frankenstein now has a continuous stomping/flailing tantrum cycle; hostage fans alternate female and male designs with jumping dance animation.

### House of the Hooded

- Reworked into a seven-row tile-changing pyramid over a square blocky mansion base.
- Every roof block must be changed; bouncing Frankenstein, Witch, and Ghost enemies pursue the player’s logical grid position.
- Hooded movement has a subtle spectral float and layered full-body afterimages to soften the grid motion.

### Ghost Circuit: Graveyard Shift

- Side-scrolling run and jump controller with a wispy animated hero trail.
- Three complete visual chapters: graveyard approach, mansion basement, and concert stage.
- Ghosts, vampires, Frankenstein, witches, haunted power-ups, equipment cases, sonic attack, stage guardians, and cargo-based finish bonuses.
- Added visible route obstacles, pursuing monsters, collectible notes and instruments, plus super-jump, warp, and flight powers.
- The magic instrument enables the sonic attack required for guardian combat.
- Graveyard Shift now uses layered full-character spectral echoes in addition to the movement trail.

## 6. Files Created

- `public/arcade/wave-3-test/index.html`
- `public/arcade/wave-3-test/shared/wave3.css`
- `public/arcade/wave-3-test/shared/wave3.js`
- One `index.html` inside each of the four game folders.

## 7. Existing Files Modified

- None.

## 8. Storage Keys

- `plumbmonkey.arcade.wave3.ampRampage.highScore`
- `plumbmonkey.arcade.wave3.graveyardShift.highScore`
- `plumbmonkey.arcade.wave3.beamMeUpLive.highScore`
- `plumbmonkey.arcade.wave3.houseOfTheHooded.highScore`

## 9. Controls

- Movement: Arrow keys or WASD.
- Jump/fire/hop: Space where appropriate.
- Alternate attack: Left Ctrl or X where appropriate.
- Pause: P or Escape.
- UI: mute, reduced effects, and fullscreen buttons.

## 10. Validation

- `node --check public/arcade/wave-3-test/shared/wave3.js`
- `npm.cmd run build`
- Browser startup and input smoke test for all four routes.
- Canvas confirmed at 960 × 720 for every game.
- No console errors during the smoke test.
- Visual review completed for the Beam Me Up assault scene and the rebuilt mansion-climbing scene.

## 10A. Brand Assets Added

- `public/arcade/wave-3-test/assets/plumbmonkey.png`
- `public/arcade/wave-3-test/assets/spaceman.jpg`
- `public/arcade/wave-3-test/assets/haunted-house-cutout.png`

## 11. Known Limitations

- This remains a playtest build. Its upgraded programmatic canvas art is cohesive and reusable, but frame-by-frame character animation and the final music pass remain.
- Touch and controller mappings are deferred until keyboard balance is approved.
- The shared Wave 3 test shell is isolated from the older shared arcade scripts to avoid regression risk during playtesting.
- Detailed balance, long-session testing, multiple browsers, mobile layout testing, and accessibility audits remain.
- The reduced-effects toggle is wired into shared state; individual effects are currently restrained and need a larger final-art pass before the setting has more visible impact.

## 12. Production Safety

- `app/arcade/ArcadeRoom.tsx` was not changed.
- No Wave 3 card is present in the live eight-game arcade.
- No existing high-score namespace was changed.
- No deployment or production release was performed.

## 13. Last Known Good State

- Branch: `codex/wave3-test-build`
- Build: passing
- Date: 2026-07-30

## 14. Exact Next Step

Playtest each game and record feedback for movement feel, difficulty, clarity, and desired visual direction. After approval, tune the prototypes and complete the original art/audio pass before adding hidden arcade cards.

## 15. Beam Me Up — Linked-Ship Rescue Pass

- Replaced the formation's generic alien heads with animated green tentacled Swarm creatures.
- Reduced the mothership footprint and increased its approach, dive, lift, carry, and bomb speed; the speed now scales upward each level.
- Added a visible animated tractor-beam cone that locks onto the active hero, lifts it into the mothership, and docks it underneath.
- Destroying a mothership carrying a hero now triggers a visible return flight toward the replacement ship before linked mode activates.
- Linked mode renders two ships side by side and enables double fire.
- The first collision in linked mode destroys one ship and leaves the other fighting; a later unprotected collision costs a life.
- Production build and JavaScript syntax validation pass after this update.

## 16. Beam Me Up — Triple Formation / Assault Pass

- Swarm entrances now use synchronized mirrored loops with tighter single-file timing and smooth formation settling.
- Rows periodically peel off into chained single-file assault paths after the opening dance.
- Hero weapons are longer multicolored laser bolts; linked formations fire from every ship.
- Two successful abduction rescues can now build a three-ship hero formation.
- Linked formations lose one ship per collision and continue fighting until the final ship is hit.
- Once three ships are linked, newly arriving motherships switch to rapid gunship runs with heavier armor and three-way heavy laser barrages.
- Enemy lasers now use brighter gradient cores, colored glow, and longer silhouettes.
- Battle damage raises the fire level across the ground and progressively darkens/damages the haunted-house scene.
- JavaScript syntax validation and the full production build pass after this update.

## 17. Beam Me Up — Reserve-Safe Abduction Logic

- A mothership may only begin an abduction while at least one replacement life remains.
- If the player is down to the final active ship, an arriving or approaching abductor immediately converts to armored gunship mode instead of creating an unavoidable game over.
- Scheduled follow-the-leader assaults now trigger once per cycle and only after their row has fully settled into formation.
- Each assault follower uses the leader's shared dive-bomb path with a fixed time offset, eliminating repeated retriggers and mid-entry path jumps.
- Opening loops were softened to reduce visual snapping while retaining the synchronized dance.
- JavaScript syntax validation and the full production build pass after this correction.

## 18. Beam Me Up — Tentacle Flight Continuity

- Top-entry tentacle enemies now share a synchronized route direction rather than alternating across one another.
- Follow-the-leader attackers remain in formation while waiting for their individual offset.
- Assault paths are closed curves that begin and end at each ship's formation slot, removing the freeze and off-screen teleport artifacts.
- The dive curve bends toward the live hero position while preserving consistent follower spacing.
- Gunship arrivals now display an explicit warning and the red armored mothership treatment.
- Sustained squad assaults and gunship runs continuously raise environmental damage, making the ground-fire and house-darkening layers appear without requiring player collisions first.
- JavaScript syntax validation and the full production build pass after this update.

## 19. Beam Me Up — Gunship Weapons / Visible Destruction

- The mothership now permanently selects gunship mode after two abduction cycles, in addition to the reserve-life and triple-formation conditions.
- Gunship mode fires faster five-bolt heavy salvos with visible muzzle explosions.
- Mansion damage now includes structural cracks, animated roof/window flames, smoke, and a dark scorch layer.
- Tentacle assault strings use shared multi-zig-zag, looping paths rather than predominantly vertical dives.
- Followers retain fixed offsets along the same closed path and return smoothly to their original slots.
- JavaScript syntax validation and the full production build pass after this update.

## 20. Beam Me Up — Deterministic Abductor / Fixed Anchors

- Replaced proximity-dependent abductor transitions with timed approach, swoop, tractor-lock, lift, and dock phases.
- Added visible status calls for abductor approach, tractor lock, capture, lift, and replacement launch.
- Lift completion is time-controlled and snaps the captured ship into its dock before the replacement launches.
- Removed oscillating formation anchors from tentacle enemies.
- Entries and closed assault curves now start and end on the same fixed coordinates, eliminating handoff jumps between movement systems.
- JavaScript syntax validation and the full production build pass after this rewrite.

## 21. Beam Me Up — Opening Assault / Defender Weapons

- Slowed and smoothed the tentacle creature's arm motion with continuous Bézier limb curves to remove animation jitter.
- The first seven settled enemies begin a chained attack while the remaining opening rows are still spawning.
- Later combat alternates scheduled follow-the-leader groups with occasional single-ship attack runs.
- Hero fire is now a longer, faster 82-pixel Defender-style energy bolt.
- Standard enemies, motherships, linked heroes, and the final hero ship now produce large layered color/white explosion bursts.
- Explosion audio and environmental damage impacts were increased.
- JavaScript syntax validation and the full production build pass after this update.

## 22. Beam Me Up — Green Opening Fan-Out Fix

- Live browser testing confirmed no console error when firing at the green tentacle group.
- The apparent hit glitch was traced to every green enemy interpolating toward a different formation slot throughout its opening route.
- Green enemies now follow one shared, time-offset leader loop, then use a short synchronized fan-out into their individual slots.
- Both path joins use smoothstep/zero-velocity endpoints to prevent visible kinks when the player begins firing.
- Browser smoke testing confirmed the new single-file opening route renders without runtime warnings or errors.

## 23. Beam Me Up — Precision Hero Laser

- Hero laser bolts are now 116 pixels long with a 2-pixel collision core and narrow glow.
- Firing uses the one-frame `tap` input rather than held-key state, producing exactly one volley per Space or Ctrl press.
- Double and triple formations still fire one synchronized bolt per surviving ship on each press.
- Added support for both left and right Ctrl keys.
- JavaScript syntax validation and the full production build pass after this update.

## 24. Beam Me Up — Immediate Enemy Fire / Formation Drift

- Reduced the hero laser collision core from 2 pixels to 1.5 pixels (25% thinner).
- Enemy ships can begin firing as soon as they are visibly on-screen during entry.
- Diving attackers use a substantially higher firing rate than ships in formation.
- Settled enemy rows now move in slow synchronized side-to-side sweeps.
- Lateral movement fades in after arrival and remains part of each attack curve, preventing snapping during departure and return.
- JavaScript syntax validation and the full production build pass after this update.

## 25. Beam Me Up — Progressive Gunship Escalation

- Gunship combat now begins with an aimed three-bolt run rather than the maximum barrage.
- After two completed passes it escalates to four-bolt crossfire.
- After four completed passes it reaches the full five-bolt barrage.
- Flight speed, vertical sweep, weapon size, aim strength, firing cadence, muzzle burst, and environmental damage increase across successive passes.
- On-screen warnings announce the three-bolt, four-bolt, and maximum five-bolt stages.
- JavaScript syntax validation and the full production build pass after this update.

## 26. Beam Me Up — Survival Waves / 10K Bonus

- Hero laser collision core was reduced from 1.5 pixels to 0.75 pixels.
- Every third level is now a survival round with no formation or mothership.
- Survival enemies enter in tight single-file strings, execute fast oscillating dive-bomb paths, fire while passing, and exit below the screen.
- Level 3 starts with one string; later survival rounds add ships and overlap up to four attack strings.
- Survival route speed, lateral intensity, firing frequency, and aim improve with level.
- Beam Me Up awards one bonus hero ship at 10,000 points and no earlier score threshold.
- Corrected and caught a survival-enemy initializer typo with the dedicated JavaScript syntax check.
- JavaScript syntax validation and the full production build pass after the correction.

## 27. Amp Rampage — Abducted Fan / Boss Throws

- Replaced “hostage” terminology with “abducted fan” in the instructions, objective label, and rescue messaging.
- Added a 3.2-second opening sequence in which Frankenstein, the Vampire, or the Ghost takes the fan across the top platform before the boss drops to the throwing platform.
- Stage objects now appear in the boss's hands for a visible wind-up before release.
- Moving objects calculate vertical position from the actual slope of each ramp instead of travelling horizontally against it.
- Jumping cleanly over a same-platform object awards `100 + level × 25` points and plays a bright confirmation tone.
- Live browser testing confirmed the intro sequence, boss/fan placement, objective label, and gameplay transition render without console warnings or errors.
- JavaScript syntax validation and the full production build pass after this update.

## 28. Amp Rampage — Cage, Key, and Downhill Physics

- Moved the active boss from the second-highest platform to the top ramp.
- Corrected the ramp physics: object travel now uses the inverse of each platform's rise, so equipment always rolls downhill and reverses naturally after each drop.
- Boss throws now originate from the top platform with a longer visible hold/wind-up.
- Added a raised wooden/purple pedestal and barred cage around the abducted fan.
- Added a glowing labelled cage key on the platform immediately below.
- Rescue requires both defeating the boss and collecting the cage key; either objective can be completed first.
- Jump-dodge scoring now displays a persistent toast in addition to the confirmation sound.
- Live browser testing confirmed the boss, cage, fan, key, downhill equipment flow, and objective messaging render without console warnings or errors.
- JavaScript syntax validation and the full production build pass after this update.

## 29. Amp Rampage — Throw Poses / Knockout Transition

- Extended the boss object wind-up to 1.05 seconds.
- Held objects now travel through an overhead lift arc and accelerate toward the downhill release side.
- Frankenstein's arms use the same throw phase as the held object, producing a visible wind-up and forward release pose.
- Hero collisions now start a 1.55-second knockout sequence instead of instantly respawning.
- The knocked-out hero flashes, spins, receives upward knockback, falls, and displays “KNOCKED OUT — RETURNING TO BASE.”
- The life is deducted only after the animation finishes; a returning hero receives the normal invulnerability window and a “ready” confirmation.
- Live browser testing confirmed the throwing pose renders without console warnings or errors.
- JavaScript syntax validation and the full production build pass after this update.

## 30. Amp Rampage — Full Abduction Cinematic

- Extended the opening cinematic from 3.2 to 5.4 seconds.
- The current boss enters from off-screen carrying the abducted fan, marches across the top platform, and approaches the pedestal.
- The fan transitions from the boss's carried position into the cage with eased placement motion.
- The cage slam produces metal particles, a heavy descending impact sound, and a “CAGE DOOR SLAMMED!” message.
- The boss steps away, plays a descending three-note laugh, and displays “HA! HA! HA!” before gameplay begins.
- Boss throwing and player movement remain suspended until the entire cinematic completes.
- Live browser testing confirmed the carry, cage placement, laugh, and gameplay handoff render without console warnings or errors.
- JavaScript syntax validation and the full production build pass after this update.

## 31. Amp Rampage — Equipment Sprites / Electric Amps

- Replaced generic equipment boxes with distinct programmatic sprites for guitars, basses, drums, microphones, lights, amps, and speakers.
- Guitars and basses have separate body colors, necks, headstocks, and strings; drum pieces include shell/cymbal forms and sticks; microphones include heads and stands.
- Added a full humanoid Vampire sprite with cape, hairline, eyes, fangs, arms, and synchronized throw poses.
- Standard amps now include cabinet trim, grille, and control knobs.
- Some level-one amps and all later-level amps can become electrified, displaying animated cyan lightning around the cabinet.
- Electrified amps create a short-range shock field; powered heroes can smash them for 350 points.
- Shared knockout handling now covers both physical impacts and electrical shocks.
- Live browser testing confirmed the new microphone/light/equipment rendering without console warnings or errors.
- JavaScript syntax validation and the full production build pass after this update.

## 32. Amp Rampage — Climb and Jump Animation

- Reduced the ladder activation range from 35 pixels to a 16-pixel centered alignment window.
- Removed the wide ladder magnetism; the hero must be deliberately lined up before up/down input begins climbing.
- Added a hand-over-hand climbing cycle with alternating arms and feet for both Spaceman and Plumbmonkey.
- Added separate airborne poses: tucked legs, extended arms, and Spaceman boot-thruster accents.
- Climbing and jumping advance their own animation clocks independently from walking.
- Existing knockout rotation remains layered over the new pose system.
- JavaScript syntax validation and the full production build pass after this update.

## 33. Amp Rampage - Haunted Basement / Cage Door / Vertical Stairs

- Rebuilt the arena as the Victorian mansion basement with brickwork, overhead pipes, boilers, damp purple floor light, and a cellar wall plaque.
- Replaced the ladder artwork with narrow vertical stair towers using a central spine and alternating left/right treads.
- Updated Spaceman and Plumbmonkey climbing poses to use high-knee stair steps and opposing arm swings instead of overhead ladder-grabbing poses.
- Added a separate hinged cage gate that is visibly open while the boss carries in the fan, rotates shut during placement, and remains locked over the cage afterward.
- Kept the metal slam particles and impact sweep synchronized to the moment the gate closes.
- Reworked the three-note boss laugh into low square/saw vocal pulses while preserving the visible "HA! HA! HA!" beat.
- Live browser testing confirmed the open-gate carry-in, closed cage, basement art, vertical stairs, laugh beat, and clean browser console.
- JavaScript syntax validation and the full production build pass after this update.

## 34. Amp Rampage - Jump Sound

- Replaced the single basic jump beep with a quick rising triangle-wave lift sweep and a short square-wave accent.
- The Spaceman and Plumbmonkey use slightly different jump pitches.
- The sound triggers only when a grounded hero successfully begins a jump, preventing repeated airborne or stair-climbing playback.
- JavaScript syntax validation and the full production build pass after this update.

## 35. Amp Rampage - Platform-Edge Object Physics

- Removed the instant floor-to-floor snap when thrown equipment reaches a platform edge.
- Objects now preserve outward momentum, accelerate under gravity, and visibly rotate while falling.
- Landing on the next level creates a small particle impact, a low collision sound, and one damped rebound before the object settles.
- After the bounce, the object continues in the lower ramp's downhill direction at slightly reduced speed.
- Added subtle rocking while equipment travels along a ramp.
- Falling objects remain dangerous and retain the normal collision response.
- Live browser testing confirmed the tumble, rebound, lower-ramp continuation, and clean browser console.
- JavaScript syntax validation and a clean production build pass after temporarily pausing the local preview server.

## 36. Amp Rampage - Original 1980s Ominous Synth Track

- Added an original 32-step Web Audio loop specifically for Amp Rampage.
- The arrangement combines slow minor-key analog bass pulses, a quiet detuned arpeggio, filtered dissonant chord swells, and sparse square-wave warning tones.
- Music uses a dedicated low-volume mix bus so jump, impact, throw, cage, and boss sounds remain prominent.
- The sequence begins only after the player presses START, pauses with gameplay, and resets cleanly for each new game.
- SOUND OFF fades the music bus immediately; SOUND ON resumes it without restarting the game.
- No external audio file, copyrighted melody, or network request is used.
- Live browser testing confirmed start, mute, unmute, continued sequencing, and a clean browser console.
- JavaScript syntax validation and the full production build pass after this update.
