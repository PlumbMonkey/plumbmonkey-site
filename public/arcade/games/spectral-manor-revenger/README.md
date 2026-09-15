# Spectral Manor Revenger

A Defender-style Ghost Circuit arcade game for plumbmonkey.online. The Spaceman flies the Revenger
fighter against Plumbmonkey's invasion, which is abducting fans all around a wrapping planet.

## Controls

| Key | Action |
|---|---|
| ← → or A D | Thrust and turn (the ship keeps momentum) |
| ↑ ↓ or W S | Climb / dive |
| Space or Z | Fire. One press is one shot; holding does not repeat |
| X or Shift | Power Chord smart bomb (clears the screen) |
| C | Warp across the planet (sometimes faults) |
| P or Esc | Pause |

Touch and gamepad: FIRE / BOMB / WARP buttons (A / B / X). There is deliberately no auto-fire chip.

## Rules

- **Four sectors:** Concert Grounds, Graveyard Hills, Storm Coast and Neon City. Each has three waves and then a mothership: the Harvester, the Ossuary, the Storm Leviathan and the Prism Dreadnought. After all four, the run loops as a harder cycle.
- **Fans and abductors:**
  - Landers carry fans up; a fan that reaches the top is lost and its lander becomes a mutant.
  - Shoot the lander to free the fan. A fan dropped from high must be caught, then flown low to set it down.
- **The Rift:** if every fan is lost, the planet phases into the Rift and all landers mutate. The planet is restored at the start of the next sector.
- **Power-ups** are persistent and levelled:
  - Laser 1–4: single, then twin, then pierce, then wave beam.
  - Power Chord bombs, a Feedback shield that absorbs 2 hits, up to two Ghost Options, the Tractor and Warp charges.
  - Losing a ship costs one laser level, your options and the tractor.
  - Drops come from carriers, every 8-kill streak and every third rescue.
- **Hurry-up:** baiters hunt you if a wave drags on.

## Files (load order)

```
sectors.js   canvas, world wrap, seeded rules RNG, SECTORS data, stageInfo(), terrain
fx.js        sound, glow sprites, laser beam drawing, explosions, shake, flash (never touches rules)
ship.js      flight, one-press firing, beams, options, catching fans, fighter sprite
enemies.js   the Defender cast, fans, enemy fire, mines, pre-rendered enemy sprites
bosses.js    the four motherships: parts, weak points, patterns, hazards, art
render.js    backdrops, terrain, Rift overlay, pickups, HUD + radar, banners, draw()
game.js      state, flow, collisions, input, autopilot, fixed 60 Hz loop
```

The shared `../kit/hero-kit.js` draws the Spaceman pilot in the canopy.

## Test

`node scripts/test-revenger.cjs` (part of `npm test`) runs headless rules checks. It also includes a bot
soak that must clear all four sectors.
