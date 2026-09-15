/* Beam Me Up: Live! — venue and flight-path data.
   Four venues, each two formation waves, a survival round and a boss; the
   stage number from the host (`level`) picks the venue, and after the Void the
   set list loops as the next CYCLE. Paths are control points in WORLD space
   (960x720) for a flight starting on the LEFT; beam.js mirrors them for the
   right-hand stream and turns them into Catmull-Rom polylines. */
(function (root) {
  "use strict";

  const VENUES = [
    {
      id: "lawn", name: "THE MANOR LAWN", sub: "Opening night. The abductors are circling",
      accent: "#67e8f9", sky: ["#1d0b36", "#0c0619", "#04030a"], glow: "233,213,255", ground: "#120a22",
      rows: ["abductor", "witch", "witch", "bat", "bat"], hazard: null,
      boss: { type: "queen", name: "THE ABDUCTOR QUEEN", sub: "Shoot her core while the dome is open, and stay out of the beam" }
    },
    {
      id: "tower", name: "THE STORM TOWER", sub: "Gargoyles take two hits. Watch the ground for lightning",
      accent: "#a5b4fc", sky: ["#141b2e", "#0a0f1c", "#03050a"], glow: "203,213,225", ground: "#0b1018",
      rows: ["abductor", "gargoyle", "witch", "bat", "bat"], hazard: "lightning",
      boss: { type: "colossus", name: "THE GARGOYLE COLOSSUS", sub: "It is solid stone while perched. Hit it once it wakes" }
    },
    {
      id: "moon", name: "THE BLOOD MOON", sub: "Wraiths split in two when hit",
      accent: "#fb7185", sky: ["#2e0714", "#15040b", "#050106"], glow: "253,164,175", ground: "#16060c",
      rows: ["abductor", "witch", "wraith", "bat", "bat"], hazard: null,
      boss: { type: "coven", name: "THE COVEN", sub: "Only the witch holding the hex can be hurt" }
    },
    {
      id: "void", name: "THE VOID", sub: "Drones shield their neighbours. Shoot them first",
      accent: "#c084fc", sky: ["#0c0424", "#05021a", "#010008"], glow: "167,139,250", ground: "#07031a",
      rows: ["abductor", "witch", "gargoyle", "drone", "bat"], hazard: null,
      boss: { type: "deep", name: "THE DEEP ONE", sub: "Dodge the tentacles, then shoot the open eye" }
    }
  ];

  // Formation entries: 'top' streams dive in from above and loop; 'bottom'
  // streams sweep up from a lower corner.
  const ENTRY = {
    top: [[410, -50], [420, 110], [540, 290], [700, 380], [770, 290], [680, 200], [560, 240]],
    bottom: [[-70, 640], [150, 560], [330, 430], [400, 300], [330, 190], [210, 210], [240, 310]]
  };

  // Survival rounds: two flight patterns per venue, alternating by group. The
  // flyers loop them and shoot back until the clock runs out.
  const SURVIVAL = [
    [ // lawn: a figure-S across, and a swirl down the middle
      [[-60, 150], [300, 190], [520, 420], [380, 560], [230, 420], [520, 250], [1030, 300]],
      [[480, -50], [470, 190], [290, 370], [480, 520], [670, 370], [480, 190], [490, -60]]
    ],
    [ // tower: zig-zag descent, then a tight double loop
      [[-60, 90], [800, 150], [160, 250], [800, 350], [160, 450], [1030, 520]],
      [[1020, 420], [620, 460], [520, 330], [640, 230], [720, 330], [380, 380], [300, 260], [420, 180], [-60, 120]]
    ],
    [ // moon: a wide orbit around the moon, and a heart shape
      [[-60, 380], [200, 160], [480, 90], [760, 160], [880, 380], [700, 560], [480, 600], [260, 540], [180, 360], [360, 220], [1030, 200]],
      [[480, -50], [480, 250], [300, 120], [150, 260], [480, 560], [810, 260], [660, 120], [480, 250], [480, -60]]
    ],
    [ // void: figure eight, and a spiral inward
      [[-60, 320], [240, 180], [480, 320], [720, 460], [900, 320], [720, 180], [480, 320], [240, 460], [-60, 330]],
      [[1020, 100], [480, 60], [120, 300], [480, 560], [800, 320], [480, 180], [300, 320], [480, 420], [600, 320], [480, 260], [480, -60]]
    ]
  ];

  const exports = { VENUES, ENTRY, SURVIVAL };
  if (typeof module !== "undefined" && module.exports) module.exports = exports;
  else root.BeamData = exports;
})(typeof window !== "undefined" ? window : globalThis);
