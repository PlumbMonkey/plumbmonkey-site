/* ============================================================
   Spectral Manor — SHARED SPRITE KIT.

   The manor's monsters are drawn, not sprited: layered polygons with an ink
   outline, a second darker pass for shading, and glowing eyes. That technique
   was developed for House of the Hooded (wave3/hooded.js) and this file lifts
   it out so the other cabinets can use the same hands.

   WHY THIS EXISTS. Mess Hall and House of the Hooded both cast Frankenstein, a
   ghost and a witch — the same three characters from the same manor. Hooded
   drew them as layered artwork; Mess Hall drew them as stacked fillRect blocks
   with a text label. Same monster, two visual identities, one arcade. The art
   now lives here once and both games call it.

   COORDINATE SPACE. Every monster is drawn around an origin at roughly the hips,
   at Hooded's native scale — about 90px from hat to heel. Callers scale down:
   Mess Hall's monsters are 30x34 boxes, so it draws these at 0.52.

   THE `feet` AND `prop` OPTIONS exist because a game supplies its own limbs.
   Hooded's actors are whole figures that hop; Mess Hall animates legs, swinging
   arms and a dish carried overhead, so it asks for the torso and head only
   (feet:false) and keeps its own. Pass feet:false and you get a figure that
   ends at the waist, ready for someone else's legs.
   ============================================================ */
(function (root) {
  "use strict";

  function helpers(c) {
    return {
      c,
      path(points, fill, stroke = "#101322", width = 2.5) {
        c.beginPath();
        points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.closePath();
        c.fillStyle = fill;
        c.fill();
        if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
      },
      ellipse(x, y, rx, ry, fill) {
        c.fillStyle = fill;
        c.beginPath();
        c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        c.fill();
      },
      line(points, color, width = 2) {
        c.strokeStyle = color;
        c.lineWidth = width;
        c.beginPath();
        points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.stroke();
      },
      rect(x, y, w, h, fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); },
      /* Eyes read as lit rather than painted. Kept as a helper because the
         shadow has to be cleared afterwards or it bleeds into the next shape. */
      glow(color, blur, draw) {
        c.shadowColor = color;
        c.shadowBlur = blur;
        draw();
        c.shadowBlur = 0;
      },
      shade,
    };
  }

  /* Mix a hex colour toward white (amt > 0) or black (amt < 0).

     Mess Hall's monsters carry a fixed palette painted into their polygons.
     Swarm's carry one `color` per instance and used it as a single flat fill,
     which is why they read as silhouettes: no form, just a shape. This lets a
     Swarm creature derive its own highlight and shadow from whatever colour it
     was given, so the shading survives a palette change. */
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const target = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    const ch = (v) => Math.round(v + (target - v) * p);
    const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  const INK = "#0f0a1a";

  /* Each entry draws one character centred on the hips, facing the viewer.
     `o.t` is seconds, for idle motion; `o.feet` includes legs and boots;
     `o.prop` includes the character's held object (the witch's broom). */
  const MONSTERS = {
    /* Lifted verbatim from hooded.js — same green, same flat skull, same
       mismatched stomp. Mess Hall and Hooded now show one Frankenstein. */
    frank(h, o) {
      const stomp = (o.stomp || 0) * 5;
      h.path([[-20,-19],[-24,3],[-15,7],[-12,-9],[12,-9],[16,7],[25,3],[20,-19]], "#62764d");
      h.path([[-17,-22],[17,-22],[19,10],[-18,10]], "#3d493d");
      h.path([[-15,-23],[-5,-11],[-10,3],[0,7],[8,-9],[15,-23]], "#8a9768", null);
      if (o.feet !== false) {
        h.rect(-15, 8, 12, 14 - stomp, "#1c2430");
        h.rect(4, 8, 12, 14 + stomp, "#1c2430");
        h.rect(-19, 19 - stomp, 16, 7, "#0c1220");
        h.rect(4, 19 + stomp, 18, 7, "#0c1220");
      }
      h.path([[-14,-46],[14,-46],[15,-23],[7,-18],[-12,-22]], "#b0ce7b");
      h.path([[-16,-47],[15,-47],[15,-37],[6,-40],[1,-36],[-5,-40],[-15,-37]], "#172431", null);
      h.rect(-20, -29, 6, 5, "#abc0d0");
      h.rect(15, -29, 6, 5, "#abc0d0");
      h.line([[-10,-33],[-3,-31]], "#34442e", 3);
      h.line([[4,-31],[10,-33]], "#34442e", 3);
      h.glow("#ffedac", 4, () => {
        h.rect(-9, -29, 4, 3, "#ffedac");
        h.rect(5, -29, 4, 3, "#ffedac");
      });
      h.line([[-6,-24],[7,-24]], "#445139");
      h.line([[-9,-43],[-9,-36]], "#536342", 1);
    },

    ghost(h, o) {
      const sway = Math.sin(o.t * 5) * 4;
      h.path([[-15,-27],[-19,-11],[-20+sway,20],[-10,13],[-3+sway,25],[5,15],[18+sway,21],[16,-13],[12,-29],[0,-35]], "#d9c4df", "#f4d6e3", 2);
      h.path([[6,-26],[9,-5],[4,15],[18+sway,21],[16,-13],[12,-29]], "#a988b8", null);
      h.ellipse(-6, -16, 4, 6, "#48243f");
      h.ellipse(6, -16, 4, 6, "#48243f");
      h.ellipse(0, -3, 3, 5, "#6d3654");
      h.glow("#ffbac7", 5, () => {
        h.rect(-7, -17, 2, 3, "#ffbac7");
        h.rect(5, -17, 2, 3, "#ffbac7");
      });
    },

    witch(h, o) {
      const sway = Math.sin(o.t * 5) * 3;
      if (o.prop !== false) {
        h.line([[-31,16],[31,7]], "#171323", 7);
        h.line([[-31,16],[31,7]], "#b68b59", 3);
        h.path([[20,5],[35,0],[33,16],[21,13]], "#deb478", "#4d3553", 1.5);
        h.line([[25,7],[32,4]], "#78556a", 1);
        h.line([[25,10],[31,13]], "#78556a", 1);
      }
      h.path([[-11,-11],[-19+sway,15],[8,12],[14,-5]], "#795093", "#dcc0f1", 1.5);
      h.path([[-11,-6],[-22,6],[-15,9],[1,-1]], "#b18ac6", null);
      h.path([[-7,-32],[9,-32],[10,-22],[17,-18],[9,-16],[5,-10],[-8,-13]], "#bfce97");
      h.path([[-22,-32],[-10,-38],[-6,-59],[3,-52],[10,-35],[22,-29]], "#64437e", "#d6b6ec", 1.5);
      h.line([[-9,-37],[8,-35]], "#dfb773", 4);
      h.glow("#9dff9d", 4, () => h.rect(3, -26, 4, 3, "#172333"));
      h.line([[-8,-13],[-8,1],[3,5]], "#402d61", 4);
    },

    /* New, authored to sit beside the three above: same ink outline, same
       two-tone shading, same lit eyes. Mess Hall's vampire was a red rectangle
       with a triangle cape. */
    vampire(h, o) {
      const sway = Math.sin(o.t * 3.4) * 3;
      // High collar cape, swept behind the shoulders.
      h.path([[-16,-24],[-30+sway,6],[-18,14],[0,6],[18,14],[30+sway,6],[16,-24]], "#2b1030", "#160718", 2);
      h.path([[0,6],[18,14],[30+sway,6],[16,-24],[2,-20]], "#4a1a3f", null);
      // Body, waistcoat, sash.
      h.path([[-14,-24],[14,-24],[16,12],[-15,12]], "#1b1428");
      h.path([[-7,-22],[7,-22],[5,10],[-5,10]], "#7a1633", null);
      h.line([[-9,-2],[9,-4]], "#c8324f", 3);
      if (o.feet !== false) {
        h.rect(-13, 10, 11, 15, "#140f1e");
        h.rect(3, 10, 11, 15, "#140f1e");
        h.rect(-16, 22, 15, 6, "#090610");
        h.rect(2, 22, 15, 6, "#090610");
      }
      // Collar wings framing the head.
      h.path([[-15,-26],[-19,-44],[-6,-30]], "#3c1230", "#160718", 1.5);
      h.path([[15,-26],[19,-44],[6,-30]], "#3c1230", "#160718", 1.5);
      // Head, widow's peak, fangs.
      h.path([[-12,-44],[12,-44],[13,-28],[0,-22],[-13,-28]], "#e6d3d8");
      h.path([[-13,-45],[13,-45],[12,-38],[4,-41],[0,-35],[-4,-41],[-12,-38]], "#120a16", null);
      h.glow("#ff4d5e", 6, () => {
        h.rect(-8, -37, 4, 3, "#ff4d5e");
        h.rect(4, -37, 4, 3, "#ff4d5e");
      });
      h.path([[-4,-30],[-2,-25],[0,-30]], "#fdfaf5", null);
      h.path([[1,-30],[3,-25],[5,-30]], "#fdfaf5", null);
    },

    werewolf(h, o) {
      const breathe = Math.sin(o.t * 6) * 1.5;
      // Hunched, narrow-waisted silhouette — the shoulders ride high and the
      // body tapers, so it does not read as the same box as Frankenstein.
      h.path([[-21,-14],[-28,8],[-17,12],[-12,-4],[12,-4],[18,12],[28,6],[20,-16]], "#5d5148");
      h.path([[-19,-22],[-8,-27],[8,-27],[19,-21],[16,2],[12,13],[-13,13],[-17,1]], "#7a6a5d");
      // Chest fur, drawn as ragged spikes rather than a flat panel.
      h.path([[-11,-20],[-4,-4],[-8,4],[0,2],[4,10],[7,-2],[11,-18],[0,-13]], "#9a8878", null);
      // Shoulder ruff, breaking the outline at the top.
      h.line([[-19,-20],[-24,-27]], "#4a3f38", 3);
      h.line([[-12,-25],[-15,-33]], "#4a3f38", 3);
      h.line([[19,-19],[25,-26]], "#4a3f38", 3);
      h.line([[12,-25],[16,-33]], "#4a3f38", 3);
      if (o.feet !== false) {
        h.rect(-15, 10, 12, 13, "#4a3f38");
        h.rect(4, 10, 12, 13, "#4a3f38");
        h.path([[-19,21],[-1,21],[-3,28],[-21,28]], "#2b241f", null);
        h.path([[3,21],[21,21],[19,28],[1,28]], "#2b241f", null);
      }
      // Muzzle-forward head with ears.
      h.path([[-14,-40],[-6,-49],[-2,-38]], "#5d5148", "#241d19", 1.5);
      h.path([[14,-40],[6,-49],[2,-38]], "#5d5148", "#241d19", 1.5);
      h.path([[-15,-42],[15,-42],[16,-26],[4,-20],[-14,-24]], "#8a7768");
      h.path([[4,-34],[22,-30 + breathe],[22,-23 + breathe],[4,-21]], "#6b5b50", "#241d19", 1.5);
      h.ellipse(21, -27 + breathe, 3.5, 2.8, "#17110f");
      h.glow("#ffc93c", 6, () => {
        h.rect(-9, -34, 5, 3, "#ffc93c");
        h.rect(1, -34, 5, 3, "#ffc93c");
      });
      // Bared teeth along the jaw.
      h.line([[6,-22],[20,-24]], "#f4ece0", 2);
      h.path([[8,-22],[10,-17],[12,-22]], "#fdfaf5", null);
      h.path([[14,-23],[16,-18],[18,-23]], "#fdfaf5", null);
    },

    /* ========================================================================
       SWARM'S CAST — grunt, hunter, brute, horror, specter, archon, and the
       three fans they are dragging off.

       These are NOT ports; Swarm shares no characters with the Hooded/Mess Hall
       side of the manor. What carries over is the technique: an ink outline, a
       derived shadow and highlight instead of one flat fill, and lit eyes.

       Every silhouette and every animation input is the one the game already
       had — the brute still counter-swings its fists, the horror still pulses
       and wriggles four tentacles, the wraiths still ripple a three-scallop hem.
       `o.color` is the instance colour, `o.S` its size, `o.stride` and `o.phase`
       its existing motion. Nothing about how these creatures behave changed.
       ======================================================================== */

    grunt(h, o) {
      const S = o.S, col = o.color, stride = o.stride;
      const dark = h.shade(col, -0.45), lit = h.shade(col, 0.3);
      // Stubby waddling limbs, inked underneath so they read against the floor.
      h.line([[-4*S,12*S],[-5*S+stride,18*S]], INK, 5*S);
      h.line([[4*S,12*S],[5*S-stride,18*S]], INK, 5*S);
      h.line([[-4*S,12*S],[-5*S+stride,18*S]], col, 3*S);
      h.line([[4*S,12*S],[5*S-stride,18*S]], col, 3*S);
      h.line([[-10*S,0],[-13*S,6*S-stride]], col, 3*S);
      h.line([[10*S,0],[13*S,6*S+stride]], col, 3*S);
      // Horns behind the head.
      h.path([[-7*S,-9*S],[-10*S,-17*S],[-3*S,-11*S]], dark, INK, 1.5);
      h.path([[7*S,-9*S],[10*S,-17*S],[3*S,-11*S]], dark, INK, 1.5);
      // Body, with a belly catching the light.
      h.c.beginPath(); h.c.ellipse(0, 2, 11*S, 13*S, 0, 0, Math.PI*2);
      h.c.fillStyle = col; h.c.fill();
      h.c.strokeStyle = INK; h.c.lineWidth = 2; h.c.stroke();
      h.c.beginPath(); h.c.ellipse(-2*S, 5*S, 6*S, 7*S, 0, 0, Math.PI*2);
      h.c.fillStyle = lit; h.c.globalAlpha = 0.35; h.c.fill(); h.c.globalAlpha = 1;
      h.glow("#fff6b0", 6, () => {
        h.rect(-6*S, -6*S, 4*S, 4*S, "#fff6b0");
        h.rect(2*S, -6*S, 4*S, 4*S, "#fff6b0");
      });
      h.rect(-5*S, -5*S, 2*S, 2*S, INK);
      h.rect(3*S, -5*S, 2*S, 2*S, INK);
    },

    hunter(h, o) {
      const S = o.S, col = o.color, stride = o.stride;
      const dark = h.shade(col, -0.45), lit = h.shade(col, 0.28);
      h.line([[-3*S,8*S],[-4*S+stride,17*S]], INK, 5*S);
      h.line([[4*S,8*S],[5*S-stride,17*S]], INK, 5*S);
      h.line([[-3*S,8*S],[-4*S+stride,17*S]], col, 3*S);
      h.line([[4*S,8*S],[5*S-stride,17*S]], col, 3*S);
      // Ears first, so the head mass overlaps their base.
      h.path([[-5*S,-10*S],[-8*S,-18*S],[-1*S,-12*S]], dark, INK, 1.5);
      h.path([[5*S,-10*S],[8*S,-18*S],[1*S,-12*S]], dark, INK, 1.5);
      // The lunging wedge, unchanged in shape.
      h.path([[0,-13*S],[11*S,10*S],[-11*S,10*S]], col, INK, 2);
      // Lit flank on the leading edge, shadow on the trailing one.
      h.path([[0,-13*S],[11*S,10*S],[3*S,10*S]], lit, null);
      h.path([[0,-13*S],[-11*S,10*S],[-4*S,10*S]], dark, null);
      h.glow("#ffd27a", 7, () => {
        h.rect(-6*S, -6*S, 4*S, 4*S, "#ffd27a");
        h.rect(2*S, -6*S, 4*S, 4*S, "#ffd27a");
      });
      h.rect(-5*S, -5*S, 2*S, 2*S, INK);
      h.rect(3*S, -5*S, 2*S, 2*S, INK);
    },

    brute(h, o) {
      const S = o.S, col = o.color, stride = o.stride;
      const dark = h.shade(col, -0.5), lit = h.shade(col, 0.3);
      h.line([[-6*S,12*S],[-6*S+stride*0.6,19*S]], INK, 7*S);
      h.line([[6*S,12*S],[6*S-stride*0.6,19*S]], INK, 7*S);
      h.line([[-6*S,12*S],[-6*S+stride*0.6,19*S]], dark, 5*S);
      h.line([[6*S,12*S],[6*S-stride*0.6,19*S]], dark, 5*S);
      // Slab body, now a bevelled block rather than a flat rectangle.
      h.path([[-13*S,-12*S],[13*S,-12*S],[13*S,14*S],[-13*S,14*S]], col, INK, 2.5);
      h.path([[-13*S,-12*S],[13*S,-12*S],[8*S,-6*S],[-13*S,-6*S]], lit, null);
      h.path([[13*S,-12*S],[13*S,14*S],[6*S,14*S],[8*S,-6*S]], dark, null);
      // The crack across the chest.
      h.line([[-8*S,-2*S],[-2*S,3*S],[4*S,0]], "rgba(15,10,26,0.65)", 1.5);
      // Counter-swinging fists.
      [[-17*S, 2*S + stride], [17*S, 2*S - stride]].forEach(([fx, fy]) => {
        h.c.beginPath(); h.c.ellipse(fx, fy, 6*S, 6*S, 0, 0, Math.PI*2);
        h.c.fillStyle = col; h.c.fill();
        h.c.strokeStyle = INK; h.c.lineWidth = 2; h.c.stroke();
        h.ellipse(fx - 1.6*S, fy - 1.8*S, 2.4*S, 2.2*S, lit);
      });
      h.glow("#ffe9a8", 7, () => {
        h.rect(-6*S, -6*S, 4*S, 4*S, "#ffe9a8");
        h.rect(2*S, -6*S, 4*S, 4*S, "#ffe9a8");
      });
      h.rect(-5*S, -5*S, 2*S, 2*S, INK);
      h.rect(3*S, -5*S, 2*S, 2*S, INK);
    },

    horror(h, o) {
      const S = o.S, col = o.color, phase = o.phase;
      const dark = h.shade(col, -0.42), lit = h.shade(col, 0.32);
      const pulse = 1 + Math.sin(phase * 0.7) * 0.08;
      // Tentacles: an ink pass under a colour pass, so they keep an outline
      // even though they are strokes rather than filled shapes.
      for (const [w, colour] of [[5*S, INK], [2.5*S, col]]) {
        h.c.strokeStyle = colour; h.c.lineWidth = w; h.c.lineCap = "round";
        h.c.beginPath();
        for (let i = 0; i < 4; i++) {
          const bx = (i - 1.5) * 6 * S;
          const wig = Math.sin(phase + i * 1.4) * 4 * S;
          h.c.moveTo(bx, 9*S);
          h.c.quadraticCurveTo(bx + wig, 15*S, bx - wig, 20*S);
        }
        h.c.stroke();
      }
      h.c.beginPath();
      h.c.ellipse(0, 0, 12*S*pulse, 12*S/pulse, 0, 0, Math.PI*2);
      h.c.fillStyle = col; h.c.fill();
      h.c.strokeStyle = INK; h.c.lineWidth = 2.5; h.c.stroke();
      h.c.beginPath();
      h.c.ellipse(-3*S, -3*S, 6*S*pulse, 5*S/pulse, 0, 0, Math.PI*2);
      h.c.fillStyle = lit; h.c.globalAlpha = 0.4; h.c.fill(); h.c.globalAlpha = 1;
      h.c.beginPath();
      h.c.ellipse(5*S, 4*S, 5*S, 4*S, 0, 0, Math.PI*2);
      h.c.fillStyle = dark; h.c.globalAlpha = 0.45; h.c.fill(); h.c.globalAlpha = 1;
      // Three mismatched eyes, all lit.
      h.glow("#ffffff", 6, () => {
        h.rect(-7*S, -5*S, 4*S, 4*S, "#fff");
        h.rect(2*S, -6*S, 4*S, 4*S, "#fff");
        h.rect(-2*S, -1*S, 3*S, 3*S, "#fff");
      });
      h.rect(-6*S, -4*S, 2*S, 2*S, INK);
      h.rect(3*S, -5*S, 2*S, 2*S, INK);
      h.rect(-1.5*S, 0, 1.5*S, 1.5*S, INK);
    },

    /* specter and archon share a body; the archon is the crowned, ringed one. */
    wraith(h, o) {
      const S = o.S, col = o.color, phase = o.phase;
      const dark = h.shade(col, -0.5), lit = h.shade(col, 0.35);
      const isArchon = o.variant === "archon";

      // Robe: dome plus the same three-scallop rippling hem.
      const hem = 10 * S;
      h.c.beginPath();
      h.c.arc(0, -4*S, 11*S, Math.PI, 0);
      h.c.lineTo(11*S, hem);
      for (let i = 0; i < 3; i++) {
        const sx = 11*S - (i + 0.5) * (22*S / 3);
        h.c.quadraticCurveTo(sx + 3.5*S, hem + 5*S + Math.sin(phase + i) * 2.5, sx - 3.5*S, hem);
      }
      h.c.closePath();
      h.c.globalAlpha = 0.88;
      h.c.fillStyle = col; h.c.fill();
      h.c.globalAlpha = 1;
      h.c.strokeStyle = INK; h.c.lineWidth = 2; h.c.stroke();

      // Lit shoulder and a shadowed trailing fold, so the robe has a form.
      h.path([[-11*S,-4*S],[-4*S,-13*S],[2*S,-4*S],[-3*S,hem]], lit, null);
      h.path([[5*S,-11*S],[11*S,-4*S],[11*S,hem],[4*S,hem]], dark, null);

      // The hood's void.
      h.c.beginPath();
      h.c.ellipse(0, -5*S, 6.5*S, 6.5*S, 0, 0, Math.PI*2);
      h.c.fillStyle = "rgba(8,10,20,0.82)"; h.c.fill();

      if (isArchon) {
        // The crown of thorns the ring used to stand in for, plus the ring.
        for (let i = -2; i <= 2; i++) {
          h.path([[i*4*S-1.4*S,-10*S],[i*4*S,-16*S],[i*4*S+1.4*S,-10*S]], lit, INK, 1);
        }
        h.c.strokeStyle = "#f9a8d4"; h.c.lineWidth = 2; h.c.globalAlpha = 0.75;
        h.c.beginPath(); h.c.arc(0, -2*S, 17*S, 0, Math.PI*2); h.c.stroke();
        h.c.globalAlpha = 1;
      }

      const eye = isArchon ? "#fdf2f8" : "#67e8f9";
      h.glow(eye, 9, () => {
        h.rect(-4*S, -7*S, 3*S, 3*S, eye);
        h.rect(1.5*S, -7*S, 3*S, 3*S, eye);
      });
    },

    /* The fans. `o.variant` is child | female | male, and the pose flags are the
       game's own: moving, grabbed, panic. A rescue target has to read as a
       person in trouble at a glance, so the scream and the thrown-up arms stay
       exactly as they were — they are gameplay signal, not decoration. */
    fan(h, o) {
      const S = o.S, col = o.color;
      const dark = h.shade(col, -0.4), lit = h.shade(col, 0.28);
      const child = o.variant === "child";
      const bodyH = child ? 9 : 11;
      const legY = bodyH * S + 3;
      const alarmed = o.panic || o.grabbed;

      // Legs — running, kicking while carried, or planted.
      let legs;
      if (o.moving && !o.grabbed) {
        const st = Math.sin(o.phase) * 5 * S;
        legs = [[[-2.5*S, bodyH*S-2], [-2.5*S+st, legY+5*S]], [[2.5*S, bodyH*S-2], [2.5*S-st, legY+5*S]]];
      } else if (o.grabbed) {
        const kick = Math.sin(o.t * 20) * 3 * S;
        legs = [[[-2.5*S, bodyH*S-2], [-3*S+kick, legY+4*S]], [[2.5*S, bodyH*S-2], [3*S-kick, legY+4*S]]];
      } else {
        legs = [[[-2.5*S, bodyH*S-2], [-3*S, legY+5*S]], [[2.5*S, bodyH*S-2], [3*S, legY+5*S]]];
      }
      legs.forEach((l) => h.line(l, INK, 4.5*S));
      legs.forEach((l) => h.line(l, dark, 2.5*S));

      // Body.
      h.c.beginPath();
      h.c.ellipse(0, child ? 4 : 5, (child ? 7 : 8)*S, (child ? 9 : 11)*S, 0, 0, Math.PI*2);
      h.c.fillStyle = col; h.c.fill();
      h.c.strokeStyle = INK; h.c.lineWidth = 2; h.c.stroke();
      h.c.beginPath();
      h.c.ellipse(-2.5*S, child ? 3 : 4, 3.4*S, 6*S, 0, 0, Math.PI*2);
      h.c.fillStyle = lit; h.c.globalAlpha = 0.4; h.c.fill(); h.c.globalAlpha = 1;

      // Arms.
      let arms;
      if (alarmed) {
        arms = [[[-6*S,0],[-11*S,-12*S]], [[6*S,0],[11*S,-12*S]]];
      } else if (o.moving) {
        const sw = Math.sin(o.phase) * 4 * S;
        arms = [[[-6*S,1],[-9*S,8*S+sw]], [[6*S,1],[9*S,8*S-sw]]];
      } else {
        arms = [[[-6*S,1],[-8*S,9*S]], [[6*S,1],[8*S,9*S]]];
      }
      arms.forEach((a) => h.line(a, INK, 5*S));
      arms.forEach((a) => h.line(a, col, 3*S));

      // Head.
      h.c.beginPath();
      h.c.ellipse(0, -9*S, 7*S, 7*S, 0, 0, Math.PI*2);
      h.c.fillStyle = "#fde8e8"; h.c.fill();
      h.c.strokeStyle = INK; h.c.lineWidth = 2; h.c.stroke();
      h.ellipse(2.5*S, -8*S, 3*S, 4*S, "#e9c9c9");

      if (o.variant === "female") {
        h.path([[-8*S,-9*S],[-7*S,-16*S],[0,-18*S],[7*S,-16*S],[8*S,-9*S],[5*S,-13*S],[-5*S,-13*S]], o.hair || "#1e1b4b", INK, 1.5);
      } else if (o.variant === "male") {
        h.path([[-7*S,-12*S],[-5*S,-16*S],[5*S,-16*S],[7*S,-12*S],[3*S,-14*S],[-3*S,-14*S]], "#1e293b", INK, 1.5);
      }

      h.rect(-3.5*S, -10*S, 2.5*S, 2.5*S, INK);
      h.rect(1*S, -10*S, 2.5*S, 2.5*S, INK);

      if (alarmed) {
        h.c.beginPath();
        h.c.ellipse(0, -5*S, 2.5*S, 3*S, 0, 0, Math.PI*2);
        h.c.fillStyle = INK; h.c.fill();
        h.line([[6*S,-14*S],[11*S,-18*S]], "rgba(255,255,255,0.55)", 1);
        h.line([[7*S,-10*S],[12*S,-11*S]], "rgba(255,255,255,0.55)", 1);
      }
    },
  };

  /* Draw `name` at (x, y). `scale` shrinks the native ~90px figure to whatever
     the calling game's actor box is. Returns false for an unknown name so a
     caller can fall back to its own art rather than drawing nothing. */
  function draw(c, name, x, y, opts) {
    const monster = MONSTERS[name];
    if (!monster) return false;
    const o = Object.assign({ t: 0, scale: 1, feet: true, prop: true, stomp: 0 }, opts);
    c.save();
    c.translate(x, y);
    if (o.scale !== 1) c.scale(o.scale, o.scale);
    c.lineJoin = "round";
    c.lineCap = "round";
    monster(helpers(c), o);
    c.restore();
    return true;
  }


  /* ==========================================================================
     MINIATURES — the same cast, redrawn for ~22px.

     The full figures carry around forty shapes each and are authored for a 75px
     body. Scaled down to fit a 24px maze corridor they turn to mud: the bolts,
     fangs and hat band all collapse below a pixel and what is left is a coloured
     smudge with an outline. Measured against Soul Circuit's old flat shapes, the
     shrunk versions were genuinely WORSE — the flat art was at least designed
     for the size it was drawn at.

     So these are drawn at their final size. Native scale is the correct scale;
     do not pass a `scale` under about 0.8. Same characters, same palette, same
     lit eyes — just told with a tenth of the shapes, because at 22px a
     silhouette and two glowing eyes is all that survives anyway.
     ========================================================================== */
  const MINI = {
    vampire(h) {
      h.path([[-10,-2],[0,12],[10,-2],[7,-9],[-7,-9]], "#2b1030", INK, 1.5);   // cape
      h.path([[-6,-9],[6,-9],[5,7],[-5,7]], "#1b1428", INK, 1.5);              // body
      h.path([[-3,-8],[3,-8],[2,5],[-2,5]], "#7a1633", null);                  // sash
      h.path([[-6,-13],[6,-13],[6,-8],[-6,-8]], "#e6d3d8", INK, 1.5);          // face
      h.path([[-6,-14],[6,-14],[5,-11],[0,-9],[-5,-11]], "#120a16", null);     // widow's peak
      h.glow("#ff4d5e", 5, () => { h.rect(-4,-12,2.5,2,"#ff4d5e"); h.rect(1.5,-12,2.5,2,"#ff4d5e"); });
    },
    frank(h) {
      h.path([[-7,-7],[7,-7],[8,8],[-8,8]], "#3d493d", INK, 1.5);              // body
      h.rect(-7, 8, 5, 4, "#0c1220"); h.rect(2, 8, 5, 4, "#0c1220");           // boots
      h.path([[-6,-14],[6,-14],[6,-7],[-6,-7]], "#b0ce7b", INK, 1.5);          // head
      h.path([[-6,-15],[6,-15],[6,-12],[-6,-12]], "#172431", null);            // flat hair
      h.rect(-9,-11,2.5,3,"#abc0d0"); h.rect(6.5,-11,2.5,3,"#abc0d0");         // bolts
      h.glow("#ffedac", 5, () => { h.rect(-4,-11,2.5,2,"#ffedac"); h.rect(1.5,-11,2.5,2,"#ffedac"); });
      h.line([[-3,-8],[3,-8]], "#445139", 1);
    },
    werewolf(h) {
      h.path([[-8,-6],[8,-6],[7,9],[-7,9]], "#7a6a5d", INK, 1.5);              // body
      h.path([[-4,-5],[4,-5],[3,7],[-3,7]], "#c9b8a4", null);                  // chest fur
      h.path([[-7,-11],[-4,-16],[-1,-11]], "#5d5148", INK, 1);                 // ears
      h.path([[7,-11],[4,-16],[1,-11]], "#5d5148", INK, 1);
      h.path([[-7,-13],[7,-13],[7,-6],[-7,-6]], "#8a7768", INK, 1.5);          // head
      h.path([[3,-11],[11,-9],[11,-5],[3,-5]], "#6b5b50", INK, 1);             // muzzle
      h.ellipse(10,-7,1.6,1.3,"#17110f");
      h.glow("#ffc93c", 5, () => { h.rect(-4,-11,2.5,2,"#ffc93c"); h.rect(0,-11,2.5,2,"#ffc93c"); });
    },
    witch(h) {
      h.path([[-8,10],[-4,-6],[4,-6],[8,10]], "#795093", INK, 1.5);            // robe
      h.path([[-5,-13],[5,-13],[5,-6],[-5,-6]], "#bfce97", INK, 1.5);          // face
      h.path([[-9,-13],[0,-25],[9,-13]], "#64437e", INK, 1.5);                 // hat
      h.line([[-8,-13],[8,-13]], "#dfb773", 3);                                 // hat band
      h.glow("#9dff9d", 5, () => { h.rect(-3.5,-11,2.5,2,"#4ade80"); h.rect(1,-11,2.5,2,"#4ade80"); });
    },
    /* Luno's Flight's witch, seated on whatever she is riding. No legs — a
       broom, a crow or a skimmer goes under her, and the game draws that. Takes
       `color` (cloak) and `accent` (eyes) per instance, because that game marks
       its three witch classes by colour rather than by shape. */
    witchRider(h, o) {
      const cloak = o.color || "#7c3aed";
      const hat = o.hat || "#4c1d95";
      const accent = o.accent || "#4ade80";
      const dark = h.shade(cloak, -0.45), lit = h.shade(cloak, 0.25);
      // Cloak, hanging and flared by the ride rather than standing.
      h.path([[-8,-7],[8,-7],[13,15],[0,10],[-13,15]], cloak, INK, 1.5);
      h.path([[1,-7],[8,-7],[13,15],[3,11]], dark, null);
      h.path([[-6,-6],[-1,-6],[-3,8],[-8,10]], lit, null);
      // Hunched shoulders over the handle.
      h.path([[-9,-8],[9,-8],[7,-2],[-7,-2]], dark, INK, 1);
      // Face.
      h.path([[-6,-11],[6,-11],[5,-3],[-5,-3]], "#e9d5ff", INK, 1.5);
      // Pointed hat, brim first so the crown overlaps it.
      h.rect(-13, -13, 26, 3.5, hat);
      h.path([[0,-30],[-11,-12],[11,-12]], hat, INK, 1.5);
      h.line([[-9,-13],[9,-13]], h.shade(hat, 0.3), 2);
      h.glow(accent, 6, () => {
        h.rect(-4, -9, 2.8, 2.4, accent);
        h.rect(1.2, -9, 2.8, 2.4, accent);
      });
    },

    ghost(h, o) {
      const sway = Math.sin((o.t || 0) * 5) * 2;
      h.path([[-8,-6],[-8,8],[-4+sway,4],[0,9],[4+sway,4],[8,8],[8,-6],[0,-14]], "#d9c4df", "#f4d6e3", 1.5);
      h.path([[2,-10],[8,-6],[8,8],[4+sway,4]], "#a988b8", null);
      h.glow("#ffbac7", 5, () => { h.rect(-4,-8,2.5,3,"#48243f"); h.rect(1.5,-8,2.5,3,"#48243f"); });
    },
  };

  /* Draw a miniature. Same signature as draw(), but the figures are already the
     right size — pass scale only to nudge, never to shrink by half. */
  function drawMini(c, name, x, y, opts) {
    const mini = MINI[name];
    if (!mini) return false;
    const o = Object.assign({ t: 0, scale: 1 }, opts);
    c.save();
    c.translate(x, y);
    if (o.scale !== 1) c.scale(o.scale, o.scale);
    c.lineJoin = "round";
    c.lineCap = "round";
    mini(helpers(c), o);
    c.restore();
    return true;
  }

  const api = { helpers, draw, drawMini, monsters: MONSTERS, mini: MINI,
                names: Object.keys(MONSTERS), miniNames: Object.keys(MINI) };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SpriteKit = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
