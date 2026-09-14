/* Amp Rampage — STAGE DATA (no rules, no drawing).

   Donkey Kong × Donkey Kong Jr. × BurgerTime, rigged at the manor's basement
   gig. Plumbmonkey has grabbed a fan and climbed the rig; the Spaceman climbs
   after him. Four stage types, played in order and then looped harder:

     LOAD-IN   sloped trusses, rolling amps and drum barrels, mic-stand hammers
     CABLES    hanging cables and chains, snap-jack amps, falling cymbals, a key
     BUILD     walk the stage parts to drop them, stack four rigs, Feedback stuns
     RIVETS    pull eight rig bolts and the whole thing comes down

   World is 960x720 (wave3.js draws it through a +160px PAD into a 1280 view).
   Girders are line segments {x0, x1, y0, y1}: y0 at x0, y1 at x1, feet stand on
   the line. Ladders join girder `lo` to girder `hi` at x. */
(function (root) {
  "use strict";

  const LOADIN = {
    kind: "loadin", name: "LOAD-IN", sub: "Jump the gear. Grab a mic stand and smash it.",
    girders: [
      { x0: 0,   x1: 960, y0: 690, y1: 690 },   // 0 stage floor
      { x0: 0,   x1: 880, y0: 580, y1: 600 },   // 1 low end right
      { x0: 80,  x1: 960, y0: 480, y1: 460 },   // 2 low end left
      { x0: 0,   x1: 880, y0: 360, y1: 380 },   // 3 low end right
      { x0: 80,  x1: 960, y0: 260, y1: 240 },   // 4 low end left
      { x0: 0,   x1: 700, y0: 150, y1: 160 },   // 5 Plumbmonkey's truss
      { x0: 300, x1: 460, y0: 70,  y1: 70 }     // 6 the fan's riser
    ],
    ladders: [
      { x: 780, lo: 0, hi: 1 }, { x: 330, lo: 0, hi: 1, broken: true },
      { x: 200, lo: 1, hi: 2 }, { x: 560, lo: 1, hi: 2, broken: true },
      { x: 760, lo: 2, hi: 3 }, { x: 440, lo: 2, hi: 3 },
      { x: 180, lo: 3, hi: 4 },
      { x: 620, lo: 4, hi: 5 },
      { x: 440, lo: 5, hi: 6 }
    ],
    hammers: [{ x: 860, g: 1, lift: 62 }, { x: 90, g: 3, lift: 62 }],
    start: { x: 110, g: 0 },
    boss: { x: 110, g: 5 },
    fan: { x: 380, g: 6 },
    drum: { x: 40, g: 0 },                     // the burning amp stack at the bottom
    throwEvery: 150, rollSpeed: 1.6
  };

  const CABLES = {
    kind: "cables", name: "CABLE JUNGLE", sub: "Two cables climb fast. Knock the cymbals down.",
    platforms: [
      { x0: 0,   x1: 180, y: 640 },   // start
      { x0: 330, x1: 430, y: 610 },
      { x0: 520, x1: 660, y: 580 },
      { x0: 780, x1: 960, y: 560 },   // the key ledge
      { x0: 560, x1: 960, y: 120 },   // Plumbmonkey and the cage
      { x0: 0,   x1: 200, y: 200 }
    ],
    cables: [
      { x: 230, top: 180, bottom: 540 }, { x: 256, top: 180, bottom: 540 },
      { x: 430, top: 140, bottom: 520 },
      { x: 700, top: 200, bottom: 500 }, { x: 726, top: 200, bottom: 500 },
      { x: 850, top: 150, bottom: 470 }, { x: 876, top: 150, bottom: 470 }
    ],
    cymbals: [{ cable: 2, y: 250 }, { cable: 3, y: 300 }, { cable: 6, y: 230 }],
    bats: [{ y: 390, x0: 300, x1: 820 }, { y: 250, x0: 120, x1: 640 }],
    key: { x: 910, p: 3 },
    cage: { x: 890, p: 4 },
    start: { x: 60, p: 0 },
    boss: { x: 640, p: 4 },
    pit: 700,
    jackEvery: 170
  };

  const BUILD = {
    kind: "build", name: "STAGE BUILD", sub: "Walk each part to drop it. Stack four rigs.",
    floors: [200, 330, 460, 590],
    tray: 700,
    x0: 30, x1: 930,
    ladders: [
      { x: 60,  lo: 3, hi: 0 }, { x: 240, lo: 2, hi: 0 }, { x: 420, lo: 3, hi: 1 },
      { x: 540, lo: 1, hi: 0 }, { x: 720, lo: 3, hi: 0 }, { x: 900, lo: 3, hi: 1 }
    ],
    stacks: [150, 330, 630, 810],            // column centres; each part is 112 wide
    layers: ["cab", "drum", "head", "lights"], // bottom of the rig first
    start: { x: 480, f: 3 },
    foes: [{ type: "frank", x: 60, f: 0 }, { type: "ghost", x: 900, f: 1 }, { type: "witch", x: 540, f: 0 }],
    feedback: 5,
    boss: { x: 480, y: 130 }
  };

  const RIVETS = {
    kind: "rivets", name: "RIVETS", sub: "Pull all eight bolts. Bring the rig down.",
    girders: [
      { x0: 0,   x1: 960, y0: 690, y1: 690 },
      { x0: 60,  x1: 900, y0: 580, y1: 580 },
      { x0: 100, x1: 860, y0: 470, y1: 470 },
      { x0: 140, x1: 820, y0: 360, y1: 360 },
      { x0: 180, x1: 780, y0: 250, y1: 250 },
      { x0: 300, x1: 660, y0: 140, y1: 140 }
    ],
    rivets: [[1, 100], [1, 860], [2, 140], [2, 820], [3, 180], [3, 780], [4, 220], [4, 740]],
    ladders: [
      { x: 140, lo: 0, hi: 1 }, { x: 480, lo: 0, hi: 1 }, { x: 820, lo: 0, hi: 1 },
      { x: 220, lo: 1, hi: 2 }, { x: 740, lo: 1, hi: 2 },
      { x: 260, lo: 2, hi: 3 }, { x: 480, lo: 2, hi: 3 }, { x: 700, lo: 2, hi: 3 },
      { x: 300, lo: 3, hi: 4 }, { x: 660, lo: 3, hi: 4 },
      { x: 480, lo: 4, hi: 5, broken: true }
    ],
    hammers: [{ x: 360, g: 1, lift: 58 }, { x: 600, g: 3, lift: 58 }],
    start: { x: 60, g: 0 },
    boss: { x: 440, g: 5 },
    fan: { x: 620, g: 5 },
    fires: [{ x: 700, g: 2 }, { x: 320, g: 3 }]
  };

  const STAGES = [LOADIN, CABLES, BUILD, RIVETS];
  // Stage n (1-based) → the stage type and how many times the set has looped.
  const stageInfo = n => ({ def: STAGES[(n - 1) % STAGES.length], cycle: Math.floor((n - 1) / STAGES.length), index: (n - 1) % STAGES.length });

  const exported = { STAGES, LOADIN, CABLES, BUILD, RIVETS, stageInfo };
  if (typeof module !== "undefined" && module.exports) module.exports = exported;
  else root.AmpData = exported;
})(typeof window !== "undefined" ? window : globalThis);
