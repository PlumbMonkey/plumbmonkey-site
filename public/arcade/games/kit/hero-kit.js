/* ============================================================
   Spectral Manor — HERO KIT.

   One identity for the arcade's hero and its final boss:
     · the SPACEMAN — white quilted flight suit, navy cosmic-print vest,
       long swept-back hair, gold aviators, knee-high white boots;
     · PLUMBMONKEY — purple chibi monkey, lavender mane, black wraparound
       shades, leather biker jacket, jeans and canvas high-tops. He commands
       the monsters in wave3/sprite-kit.js.
   Reference art: docs/arcade-art/spaceman-ref.jpg and plumbmonkey-ref.png.

   Drawn the house way (ink outline, a darker shading pass, lit accents) in
   canvas code, so poses come from parameters and stay crisp at any scale.

   ANCHOR is the FEET (bottom centre), so ground contact is exact.
   FACE is -1 or 1; the body mirrors, and the face and shades sit forward of
   centre so a flip always reads.
   PHASE is radians and should be advanced from DISTANCE travelled by the
   caller, never wall-clock, or the feet skate.
   SIZE: the Spaceman is ~64px tall and Plumbmonkey ~110px at scale 1. Do not
   draw either below 0.8x.

     HeroKit.spaceman(ctx, x, feetY, { pose, phase, face, scale, alpha, amp, guitar })
     HeroKit.plumbmonkey(ctx, x, feetY, { pose, phase, face, scale, alpha, rage })
     HeroKit.guitar(ctx, x, y, angle, scale)
     HeroKit.frames(name, pose, count, opts) -> cached canvases (anchor .ox/.oy)
   ============================================================ */
(function (root) {
  "use strict";
  const INK = "#120b1e";
  const SP = { suit: "#eef0f2", shade: "#c3c8cf", navy: "#1e3558", print: ["#d98a3a", "#e9b86a", "#3f6aa8"],
    hair: "#2a211c", skin: "#c28a66", skinShade: "#9c6a4c", lens: "#5a3826", frame: "#c9a24a", sole: "#161616" };
  const PM = { fur: "#7a4ca0", face: "#9d73c2", furShade: "#553278", hair: "#8e62c6", hairLight: "#b996e0",
    leather: "#18161c", leatherHi: "#3a3740", metal: "#b8b8c0", denim: "#1f2a33", sole: "#e8e4dc", lens: "#0b0b0e", tee: "#0d0c10" };

  // ---------- drawing helpers ----------
  function poly(c, pts, fill, stroke = INK, lw = 2) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }
  function ell(c, x, y, rx, ry, fill, stroke, lw = 2, rot = 0) {
    c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }
  function stroke(c, pts, color, w) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = color; c.lineWidth = w; c.stroke();
  }
  // An inked limb: a wide ink pass, then the fill pass on top.
  function limb(c, pts, w, fill) { stroke(c, pts, INK, w + 3); stroke(c, pts, fill, w); }
  // Angle 0 points straight down; positive swings toward +x (forward).
  const bone = (x, y, len, a) => [x + Math.sin(a) * len, y + Math.cos(a) * len];
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- the guitar (pickups, the strum pose, the finale) ----------
  function guitar(c, x, y, angle = 0, scale = 1) {
    c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale, scale);
    c.lineJoin = "round"; c.lineCap = "round";
    // neck and headstock first so the body overlaps them
    poly(c, [[-2, -34], [2, -34], [2, -6], [-2, -6]], "#e5bc80", INK, 1.6);
    poly(c, [[-3.5, -42], [3.5, -41], [3, -34], [-3, -34]], "#2b1f36", INK, 1.6);
    for (let i = 0; i < 3; i++) { ell(c, -4.5, -40 + i * 2.6, 1.1, 1, "#e9e3d0", null); ell(c, 4.5, -40 + i * 2.6, 1.1, 1, "#e9e3d0", null); }
    // offset double-cut body
    poly(c, [[-9, -8], [-4, -10], [0, -6], [5, -12], [10, -8], [9, 2], [12, 10], [6, 16], [-6, 16], [-12, 9], [-9, 2]], "#c8374f", INK, 2);
    poly(c, [[2, -6], [5, -12], [10, -8], [9, 2], [12, 10], [6, 16], [3, 16]], "#8e2138", null);
    ell(c, 0, 6, 3.5, 5.5, "#1b1420", null);
    stroke(c, [[-5, 1], [5, 1]], "#d9d9e0", 1.4);
    stroke(c, [[-4, 10], [4, 10]], "#d9d9e0", 1.4);
    stroke(c, [[0, -33], [0, 12]], "rgba(255,240,210,0.7)", 0.8);
    c.restore();
  }

  // ============================================================
  // SPACEMAN
  // ============================================================
  /* Every pose resolves to the same rig: two legs (thigh, shin angles), two
     arms (upper, forearm), a hip drop and a body lean. */
  function spacemanRig(pose, ph) {
    const r = { legs: [[0.08, 0.08], [-0.08, -0.08]], arms: [[0.15, 0.3], [-0.12, 0.05]], drop: 0, lean: 0, sx: 1, sy: 1, guitar: null };
    const s = Math.sin(ph), co = Math.cos(ph);
    const runLegs = () => {
      const leg = p => { const t = Math.sin(p) * 0.72; return [t, t - (0.2 + 0.85 * Math.max(0, Math.cos(p)))]; };
      r.legs = [leg(ph), leg(ph + Math.PI)];
      r.drop = -Math.abs(co) * 2 + 1;
      r.lean = 0.1;
    };
    switch (pose) {
      case "idle":
        r.drop = s * 0.7;
        r.arms = [[0.12 + s * 0.03, 0.3], [-0.1 - s * 0.03, 0.05]];
        break;
      case "run":
        runLegs();
        r.arms = [[-s * 0.85, -s * 0.85 + 1.1], [s * 0.85, s * 0.85 + 1.1]];
        break;
      case "jump":
        r.legs = [[1.0, -0.05], [-0.25, -1.0]];
        r.arms = [[2.5, 2.7], [-0.9, -0.5]];
        r.lean = 0.05;
        break;
      case "fall":
        r.legs = [[0.35, 0.15], [-0.25, -0.7]];
        r.arms = [[1.5, 1.9], [-1.3, -0.9]];
        break;
      case "land":
        r.legs = [[0.75, -0.55], [-0.35, -1.2]];
        r.drop = 6; r.sx = 1.08; r.sy = 0.92;
        r.arms = [[0.7, 1.2], [-0.5, 0.1]];
        break;
      case "shoot": case "runShoot": case "airShoot":
        if (pose === "runShoot") runLegs();
        if (pose === "airShoot") r.legs = [[0.9, 0.0], [-0.3, -0.9]];
        r.arms = [[1.57, 1.57], [pose === "runShoot" ? s * 0.8 : -0.4, 0.3]];
        break;
      case "strum":
        r.legs = [[0.38, 0.3], [-0.38, -0.3]];
        r.drop = 2 + Math.abs(s) * 1.5;
        r.arms = [[0.55, 1.05 + s * 0.45], [1.05, 2.25]];
        r.guitar = { x: 3, dy: -8, a: 1.2 };
        break;
      case "chord":
        r.legs = [[0.62, 0.25], [-0.5, -0.45]];
        r.lean = -0.18; r.drop = 3;
        r.arms = [[2.9, 3.05], [1.3, 2.35]];
        r.guitar = { x: 4, dy: -10, a: 0.55 };
        break;
      case "climb": {              // ladder: alternating reach, the knee comes up with the opposite hand
        const k1 = Math.max(0, s), k2 = Math.max(0, -s);
        r.arms = [[2.55 + k2 * 0.5, 2.9 + k2 * 0.2], [2.55 + k1 * 0.5, 2.9 + k1 * 0.2]];
        r.legs = [[0.2 + k1 * 0.85, 0.1 - k1 * 0.5], [0.2 + k2 * 0.85, 0.1 - k2 * 0.5]];
        break;
      }
      case "hang":                 // one hand on a cable, swinging a little
        r.arms = [[3.05, 3.12], [0.35 + s * 0.2, 0.7]];
        r.legs = [[0.18 + s * 0.12, 0.05], [-0.12 - s * 0.12, -0.22]];
        r.lean = s * 0.07;
        break;
      case "hang2":                // both hands: the fast climb
        r.arms = [[2.9 + s * 0.12, 3.1], [3.05 - s * 0.12, 3.15]];
        r.legs = [[0.55 + s * 0.2, -0.25], [0.3 - s * 0.2, -0.5]];
        break;
      case "smash": {              // mic-stand hammer, overhead to the deck
        const u = 1.15 + (1 + Math.cos(ph)) * 0.95;
        r.arms = [[u, u + 0.12], [u - 0.15, u]];
        r.legs = [[0.32, 0.22], [-0.36, -0.26]];
        r.drop = 2 + (1 - Math.cos(ph)) * 1.2;
        r.lean = 0.12 * Math.sin(ph);
        break;
      }
      case "pitch":                // a pitcher's stride; the throwing arm belongs to the game
        r.legs = [[0.58, 0.22], [-0.42, -0.36]];
        r.drop = 2;
        break;
      case "carry":                // holding something overhead while walking
        runLegs();
        r.arms = [[2.85, 3.05], [2.75, 2.95]];
        r.lean = 0.02;
        break;
      case "slide":                // feet-first under a barrier, leaning right back
        r.legs = [[1.45, 1.5], [1.2, 1.4]];
        r.arms = [[-0.5, -0.1], [0.9, 1.3]];
        r.drop = 17; r.lean = -1.0;
        break;
      case "duck":                 // crouched, blaster forward
        r.legs = [[1.25, -0.8], [0.9, -1.3]];
        r.arms = [[1.57, 1.57], [0.4, 0.9]];
        r.drop = 13; r.lean = 0.2;
        break;
      case "ride":                 // astride a mount: thighs forward, shins hanging, both hands on the reins
        r.legs = [[1.3 + s * 0.04, 0.15], [1.15 + s * 0.04, 0.05]];
        r.arms = [[0.7 + s * 0.05, 1.45], [0.55 + s * 0.05, 1.3]];
        r.lean = 0.12; r.drop = s * 0.6;
        break;
      case "hurt":
        r.legs = [[0.3, 0.5], [-0.2, 0.1]];
        r.lean = -0.35;
        r.arms = [[2.3, 2.9], [-2.1, -2.6]];
        break;
      case "death":
        r.legs = [[0.15, 0.5], [-0.15, -0.5]];
        r.arms = [[2.8, 3.0], [-2.8, -3.0]];
        break;
      case "victory":
        r.legs = [[0.22, 0.22], [-0.22, -0.22]];
        r.arms = [[3.0, 3.1 + s * 0.08], [-0.7, 0.7]];
        r.drop = -Math.abs(s) * 2;
        break;
    }
    return r;
  }

  function spaceman(c, x, feetY, o = {}) {
    const pose = o.pose || "idle", ph = o.phase || 0, face = o.face < 0 ? -1 : 1, sc = o.scale || 1;
    const r = spacemanRig(pose, ph);
    const arms = o.arms || "both";       // "back" leaves the front arm to the caller, "none" leaves both
    c.save();
    c.translate(x, feetY);
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
    c.scale(face * sc * r.sx, sc * r.sy);
    if (pose === "death") { c.translate(0, -32); c.rotate(ph); c.translate(0, 32); }
    c.lineJoin = "round"; c.lineCap = "round";
    const hipY = -30 + r.drop;
    c.translate(0, hipY); c.rotate(r.lean + (o.tilt || 0)); c.translate(0, -hipY);
    const shoulder = [0.5, hipY - 18];

    const drawLeg = ([t, sh], back) => {
      const hip = [back ? -2 : 2, hipY];
      const knee = bone(hip[0], hip[1], 14, t), foot = bone(knee[0], knee[1], 14.5, sh);
      const suit = back ? SP.shade : SP.suit;
      limb(c, [hip, knee], 6.5, suit);
      const bootTop = [lerp(knee[0], foot[0], 0.1), lerp(knee[1], foot[1], 0.1)];
      limb(c, [bootTop, foot], 6.8, back ? "#d4d8de" : "#f6f7f9");
      const band = [lerp(knee[0], foot[0], 0.22), lerp(knee[1], foot[1], 0.22)];
      ell(c, band[0], band[1], 3.8, 1.4, SP.navy, null, 0, sh);
      // sole points forward along the ground-facing side of the shin
      c.save(); c.translate(foot[0], foot[1]); c.rotate(sh * 0.6);
      poly(c, [[-3.5, -1.5], [6.5, -1.5], [7, 1.8], [-3.5, 1.8]], SP.sole, INK, 1.2);
      c.restore();
    };
    const drawArm = ([u, f], back) => {
      const sp = [shoulder[0] + (back ? -2 : 1.5), shoulder[1] + 1.5];
      const el = bone(sp[0], sp[1], 11, u), hand = bone(el[0], el[1], 10, f);
      limb(c, [sp, el, hand], 5, back ? SP.shade : SP.suit);
      const cuff = [lerp(el[0], hand[0], 0.78), lerp(el[1], hand[1], 0.78)];
      stroke(c, [cuff, [lerp(el[0], hand[0], 0.9), lerp(el[1], hand[1], 0.9)]], SP.navy, 5);
      ell(c, hand[0], hand[1], 2.6, 2.6, back ? SP.skinShade : SP.skin, INK, 1.2);
      return hand;
    };

    // gear carried on the back shows the power tier
    if (o.amp) {
      poly(c, [[-13, hipY - 21], [-6, hipY - 21], [-6, hipY - 5], [-13, hipY - 5]], "#2a2230", INK, 1.8);
      c.shadowColor = "#ffb347"; c.shadowBlur = 6;
      ell(c, -9.5, hipY - 16, 1.4, 2, "#ffcf7a", null); ell(c, -9.5, hipY - 10, 1.4, 2, "#ffcf7a", null);
      c.shadowBlur = 0;
    }
    if (o.guitar && !r.guitar) guitar(c, -6, hipY - 10, 0.55, 0.62);

    if (arms !== "none") drawArm(r.arms[1], true);
    drawLeg(r.legs[1], true);
    // torso: one-piece suit, shaded on the back side
    poly(c, [[-6.5, hipY - 20], [7, hipY - 20], [7.5, hipY + 1], [-6.5, hipY + 1]], SP.suit, INK, 2);
    poly(c, [[-6.5, hipY - 20], [-2.5, hipY - 20], [-2.5, hipY + 1], [-6.5, hipY + 1]], SP.shade, null);
    stroke(c, [[3.5, hipY - 18], [3.5, hipY]], "#b9bec6", 0.9);            // zip
    // navy cosmic vest with its two hanging straps
    poly(c, [[-6.5, hipY - 19], [2, hipY - 19], [2.2, hipY - 7], [-6.5, hipY - 8]], "#172a47", INK, 1.4);
    poly(c, [[4.5, hipY - 19], [7.8, hipY - 18.5], [8, hipY - 7], [4.5, hipY - 7]], SP.navy, INK, 1.4);
    ell(c, -3, hipY - 15, 1.8, 1.8, SP.print[0], null); ell(c, 0.2, hipY - 10.5, 1.2, 1.2, SP.print[1], null);
    ell(c, 6.2, hipY - 14, 1.3, 1.3, SP.print[0], null); ell(c, -4.8, hipY - 10, 0.9, 0.9, SP.print[2], null);
    stroke(c, [[0.5, hipY - 7], [0.5, hipY - 1.5]], SP.navy, 1.6);
    stroke(c, [[6.2, hipY - 7], [6.2, hipY - 1.5]], SP.navy, 1.6);

    if (r.guitar) guitar(c, r.guitar.x, hipY + r.guitar.dy, r.guitar.a, 0.78);
    drawLeg(r.legs[0], false);

    // head: helmet-seal neck ring, hair behind, face, aviators
    const hy = hipY - 27;
    ell(c, 0.5, hy + 6, 5.8, 2.6, SP.suit, INK, 1.6);
    poly(c, [[-6, hy - 4], [0, hy - 8], [5.5, hy - 5], [-1, hy - 1], [-3, hy + 6], [-9, hy + 9], [-8.5, hy + 2]], SP.hair, INK, 1.6);
    ell(c, 1.8, hy, 5, 5.9, SP.skin, INK, 1.8);
    ell(c, -0.6, hy + 0.5, 2, 4.2, SP.skinShade, null);
    poly(c, [[-5.3, hy - 2.5], [-1, hy - 7.2], [4.5, hy - 6.4], [6.6, hy - 3.2], [2, hy - 4.3], [-2.5, hy - 1.5]], SP.hair, null);
    stroke(c, [[3.4, hy - 2.7], [7, hy - 3.1]], SP.hair, 1.2);             // stern brow
    stroke(c, [[0.5, hy - 1], [7.2, hy - 1.1]], SP.frame, 1);
    ell(c, 5.2, hy - 0.2, 1.9, 1.5, SP.lens, SP.frame, 0.8);
    c.shadowColor = "#ffd27a"; c.shadowBlur = 3;
    ell(c, 5.7, hy - 0.8, 0.7, 0.5, "#e9b86a", null);
    c.shadowBlur = 0;
    stroke(c, [[4.6, hy + 3.6], [6.6, hy + 3.4]], SP.skinShade, 1);

    if (arms !== "both") { c.restore(); return null; }
    const hand = drawArm(r.arms[0], false);
    if (o.hammer) {                // a mic stand held along the forearm, head outward
      const f = r.arms[0][1], dx = Math.sin(f), dy = Math.cos(f);
      const tip = [hand[0] + dx * 24, hand[1] + dy * 24], butt = [hand[0] - dx * 8, hand[1] - dy * 8];
      limb(c, [butt, tip], 2.6, "#9aa3b2");
      c.shadowColor = "#d9ff63"; c.shadowBlur = 10;
      ell(c, tip[0] + dx * 4, tip[1] + dy * 4, 5, 5, "#e2e8f0", INK, 1.6);
      c.shadowBlur = 0;
      stroke(c, [[tip[0] + dx * 2 - dy * 3, tip[1] + dy * 2 + dx * 3], [tip[0] + dx * 2 + dy * 3, tip[1] + dy * 2 - dx * 3]], "#475569", 1);
    }
    if (pose === "shoot" || pose === "runShoot" || pose === "airShoot" || pose === "duck") {
      c.shadowColor = "#a9f5e3"; c.shadowBlur = 8;
      ell(c, hand[0] + 2, hand[1], 2.4, 2.4, "#dffcf5", null);
      c.shadowBlur = 0;
    }
    c.restore();
    return hand;
  }

  // ============================================================
  // PLUMBMONKEY
  // ============================================================
  function monkeyRig(pose, ph) {
    const s = Math.sin(ph), co = Math.cos(ph);
    const r = { legs: [[0.14, 0.14], [-0.14, -0.14]], arms: [[0.35, 0.2], [-0.3, -0.15]], drop: 0, lean: 0, nod: 0, hairSwing: s * 0.25, mouth: 1, rot: 0 };
    switch (pose) {
      case "idle":   // headbang
        r.nod = Math.max(0, s) * 0.32; r.drop = Math.max(0, s) * 2;
        r.hairSwing = -co * 0.55;
        r.arms = [[0.45 + s * 0.1, 0.3], [-0.4 - s * 0.1, -0.2]];
        break;
      case "taunt":  // chest pound
        r.arms = [[1.9 + s * 0.35, -0.9 + s * 0.5], [1.9 - s * 0.35, -0.9 - s * 0.5]];
        r.lean = -0.08; r.mouth = 1.4;
        break;
      case "horns":
        r.arms = [[2.7, 3.0], [-2.7, -3.0]];
        r.nod = -0.2; r.mouth = 1.5; r.hairSwing = s * 0.6;
        break;
      case "throw": { // phase 0..PI: wind-up overhead, PI..2PI: release forward
        const k = (ph % (Math.PI * 2)) / (Math.PI * 2);
        const up = k < 0.55 ? k / 0.55 : 1 - (k - 0.55) / 0.45;
        r.arms = [[lerp(0.4, 3.0, up) - (k > 0.55 ? (k - 0.55) * 3.2 : 0), lerp(0.4, 3.1, up) - (k > 0.55 ? (k - 0.55) * 2.6 : 0)],
                  [lerp(-0.3, -2.9, up), lerp(-0.3, -3.0, up)]];
        r.lean = k > 0.55 ? 0.22 : -0.15 * up;
        break;
      }
      case "command":
        r.arms = [[1.62, 1.55], [-0.35, 0.4]];
        r.lean = 0.08; r.nod = -0.08; r.mouth = 1.3;
        break;
      case "stomp": {
        const lift = Math.max(0, s);
        r.legs = [[0.14 + lift * 1.1, 0.14 - lift * 0.2], [-0.14, -0.14]];
        r.drop = -lift * 3;
        r.arms = [[1.2 + lift, 1.6], [-1.2 - lift, -1.6]];
        break;
      }
      case "hit":
        r.lean = -0.3; r.nod = -0.3; r.mouth = 1.6;
        r.arms = [[2.2, 2.7], [-1.8, -2.4]];
        break;
      case "dizzy":
        r.lean = s * 0.12; r.nod = 0.15 + co * 0.1; r.mouth = 0.8;
        r.arms = [[0.8 + s * 0.3, 0.5], [-0.8 + s * 0.3, -0.5]];
        r.legs = [[0.3, 0.2], [-0.05, -0.3]];
        break;
      case "defeat":
        r.rot = -Math.min(1, ph / Math.PI) * 1.45;
        r.arms = [[2.6, 3], [-2.4, -2.9]]; r.mouth = 1.7;
        r.legs = [[0.6, 0.3], [0.3, 0.1]];
        break;
    }
    return r;
  }

  function plumbmonkey(c, x, feetY, o = {}) {
    const pose = o.pose || "idle", ph = o.phase || 0, face = o.face < 0 ? -1 : 1, sc = o.scale || 1;
    const r = monkeyRig(pose, ph);
    c.save();
    c.translate(x, feetY);
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
    c.scale(face * sc, sc);
    if (r.rot) { c.translate(-20, 0); c.rotate(r.rot); c.translate(20, 0); }
    c.lineJoin = "round"; c.lineCap = "round";
    const hipY = -36 + r.drop;
    c.translate(0, hipY); c.rotate(r.lean); c.translate(0, -hipY);
    const shY = hipY - 32;

    const drawLeg = ([t, sh], back) => {
      const hip = [back ? -5 : 5, hipY];
      const knee = bone(hip[0], hip[1], 15, t), foot = bone(knee[0], knee[1], 15, sh);
      limb(c, [hip, knee, foot], 10, back ? "#161f27" : PM.denim);
      c.save(); c.translate(foot[0], foot[1]); c.rotate(sh * 0.5);
      poly(c, [[-6, -6], [8, -5], [11, 1], [-6, 1]], back ? "#101012" : "#1a1a1e", INK, 1.8);    // canvas high-top
      poly(c, [[-6.5, 1], [11.5, 1], [11, 4.5], [-6.5, 4.5]], PM.sole, INK, 1.6);
      stroke(c, [[0, -4.5], [5, -3.5]], "#f2f0ea", 1.2);                                            // laces
      c.restore();
    };
    const drawArm = ([u, f], back) => {
      const sp = [back ? -10 : 10, shY + 4];
      const el = bone(sp[0], sp[1], 21, u), hand = bone(el[0], el[1], 20, f);
      limb(c, [sp, el], 10, back ? "#111014" : PM.leather);
      stroke(c, [[lerp(sp[0], el[0], 0.3), lerp(sp[1], el[1], 0.3)], [lerp(sp[0], el[0], 0.7), lerp(sp[1], el[1], 0.7)]], PM.leatherHi, 2);
      limb(c, [el, hand], 7, back ? PM.furShade : PM.fur);
      ell(c, hand[0], hand[1], 5.2, 4.6, back ? PM.furShade : PM.face, INK, 1.8);
      if (pose === "horns") {
        stroke(c, [[hand[0] - 2, hand[1] - 3], [hand[0] - 3, hand[1] - 10]], INK, 3.4);
        stroke(c, [[hand[0] + 2, hand[1] - 3], [hand[0] + 3, hand[1] - 10]], INK, 3.4);
        stroke(c, [[hand[0] - 2, hand[1] - 3], [hand[0] - 3, hand[1] - 10]], PM.face, 2);
        stroke(c, [[hand[0] + 2, hand[1] - 3], [hand[0] + 3, hand[1] - 10]], PM.face, 2);
      }
      return hand;
    };

    // the mane falls behind everything
    const hx = 2, hy = shY - 17, sw = r.hairSwing * 10;
    poly(c, [[hx - 18, hy - 8], [hx + 8, hy - 20], [hx + 16, hy - 6], [hx + 10, hy + 14], [hx - 4 + sw * 0.4, hy + 30],
             [hx - 16 + sw, hy + 44], [hx - 22 + sw, hy + 32], [hx - 30 + sw * 1.2, hy + 38], [hx - 26 + sw * 0.8, hy + 16]], PM.hair, INK, 2);
    stroke(c, [[hx - 14, hy + 2], [hx - 20 + sw, hy + 30]], PM.hairLight, 2);
    stroke(c, [[hx - 6, hy + 6], [hx - 10 + sw * 0.7, hy + 32]], PM.hairLight, 1.5);

    drawArm(r.arms[1], true);
    drawLeg(r.legs[1], true);
    // black belt, tee, leather jacket with an asymmetric zip and lapels
    poly(c, [[-14, shY], [14, shY], [15, hipY + 2], [-14, hipY + 2]], PM.leather, INK, 2.2);
    poly(c, [[-3, shY + 1], [7, shY + 1], [6, hipY - 2], [-2, hipY - 2]], PM.tee, null);
    poly(c, [[7, shY + 1], [14, shY + 2], [9, shY + 14], [4, shY + 9]], PM.leatherHi, INK, 1.4);
    poly(c, [[-3, shY + 1], [-12, shY + 2], [-6, shY + 13]], PM.leatherHi, INK, 1.4);
    stroke(c, [[8, shY + 12], [3, hipY - 2]], PM.metal, 1.3);
    ell(c, -10, shY + 17, 1.3, 1.3, PM.metal, null); ell(c, 12, shY + 16, 1.3, 1.3, PM.metal, null);
    poly(c, [[-14, hipY - 3], [15, hipY - 3], [15, hipY + 2], [-14, hipY + 2]], "#0b0b0d", INK, 1.2);
    poly(c, [[1, hipY - 3.5], [7, hipY - 3.5], [7, hipY + 2.5], [1, hipY + 2.5]], PM.metal, INK, 1);
    drawLeg(r.legs[0], false);

    // head: ~1/3 of his height
    c.save(); c.translate(hx, hy + 8); c.rotate(r.nod); c.translate(-hx, -hy - 8);
    ell(c, hx - 16, hy + 1, 5.5, 6.5, PM.fur, INK, 2);                     // ear
    ell(c, hx - 16, hy + 1, 2.8, 3.8, PM.face, null);
    ell(c, hx, hy, 18, 17.5, PM.fur, INK, 2.4);
    ell(c, hx - 6, hy + 2, 9, 12, PM.furShade, null);
    poly(c, [[hx - 12, hy - 10], [hx + 4, hy - 20], [hx + 17, hy - 12], [hx + 6, hy - 13], [hx - 6, hy - 6]], PM.hair, null); // fringe
    ell(c, hx + 7, hy + 6, 10.5, 9.5, PM.face, INK, 1.6);                    // muzzle
    ell(c, hx + 12, hy + 1.5, 1.2, 0.9, PM.furShade, null);
    ell(c, hx + 9, hy + 9, 2.8 * r.mouth, 3.2 * r.mouth, "#2a1030", INK, 1.2); // the "o" mouth
    // black wraparound shades with a cold glint
    poly(c, [[hx - 10, hy - 6], [hx + 18, hy - 7], [hx + 17, hy - 1], [hx + 9, hy + 0.5], [hx + 5, hy - 2], [hx - 9, hy - 1]], PM.lens, INK, 1.4);
    c.shadowColor = o.rage ? "#ff4d6d" : "#c9b6ff"; c.shadowBlur = 6;
    stroke(c, [[hx + 3, hy - 5], [hx + 12, hy - 5.5]], o.rage ? "#ff8095" : "rgba(220,210,255,0.8)", 1.3);
    c.shadowBlur = 0;
    c.restore();

    const hand = drawArm(r.arms[0], false);
    c.restore();
    return hand;
  }

  // ---------- cached frames ----------
  const cache = {};
  const BOX = { spaceman: [96, 96, 48, 84], plumbmonkey: [190, 170, 95, 158] };
  function frames(name, pose, count = 1, opts = {}) {
    const key = [name, pose, count, JSON.stringify(opts)].join("|");
    if (cache[key]) return cache[key];
    const sc = opts.scale || 1, [w, h, ox, oy] = BOX[name], out = [];
    for (let i = 0; i < count; i++) {
      const cv = document.createElement("canvas");
      cv.width = Math.ceil(w * sc); cv.height = Math.ceil(h * sc);
      const g = cv.getContext("2d");
      const o = Object.assign({}, opts, { pose, phase: (i / count) * Math.PI * 2, scale: sc, face: 1 });
      (name === "spaceman" ? spaceman : plumbmonkey)(g, ox * sc, oy * sc, o);
      cv.ox = ox * sc; cv.oy = oy * sc;
      out.push(cv);
    }
    return (cache[key] = out);
  }
  // Blit a cached frame at the feet anchor, mirrored for face -1.
  function blit(c, cv, x, feetY, face = 1) {
    if (face < 0) { c.save(); c.translate(x, feetY); c.scale(-1, 1); c.drawImage(cv, -cv.ox, -cv.oy); c.restore(); }
    else c.drawImage(cv, x - cv.ox, feetY - cv.oy);
  }

  /* For games that animate the Spaceman's arms themselves (Mess Hall's overhand
     pitch, Swarm's aimed rifle): draw him with { arms: "back" } or
     { arms: "none" }, ask where the shoulder is for the same options, and draw
     the arm with HeroKit.arm so it matches the suit. */
  function shoulder(o = {}, back = false) {
    const r = spacemanRig(o.pose || "idle", o.phase || 0), face = o.face < 0 ? -1 : 1, sc = o.scale || 1;
    const hipY = -30 + r.drop, lean = r.lean + (o.tilt || 0);
    const dx = 0.5 + (back ? -2 : 1.5), dy = -16.5;      // shoulder relative to the hip, before the lean
    const lx = dx * Math.cos(lean) - dy * Math.sin(lean), ly = dx * Math.sin(lean) + dy * Math.cos(lean) + hipY;
    return { x: lx * face * sc * r.sx, y: ly * sc * r.sy };
  }
  // pts: [shoulder, elbow, hand] in world space
  function arm(c, pts, o = {}) {
    const sc = o.scale || 1, back = !!o.back, [s, e, h] = pts;
    c.save();
    c.lineJoin = "round"; c.lineCap = "round";
    stroke(c, pts, INK, 8 * sc);
    stroke(c, pts, back ? SP.shade : SP.suit, 5 * sc);
    const k0 = [lerp(e[0], h[0], 0.72), lerp(e[1], h[1], 0.72)], k1 = [lerp(e[0], h[0], 0.88), lerp(e[1], h[1], 0.88)];
    stroke(c, [k0, k1], SP.navy, 5 * sc);
    ell(c, h[0], h[1], 2.8 * sc, 2.8 * sc, back ? SP.skinShade : SP.skin, INK, 1.2 * sc);
    c.restore();
    void s;
  }

  /* MINI pilot portrait (~16px, head and shoulders) for a cockpit canopy.
     Anchor is the base of the neck. look 0 faces forward, 1 glances down. */
  function pilot(c, x, y, o = {}) {
    const face = o.face < 0 ? -1 : 1, sc = o.scale || 1, lk = o.look ? 1 : 0;
    c.save();
    c.translate(x, y); c.scale(face * sc, sc);
    c.lineJoin = "round"; c.lineCap = "round";
    poly(c, [[-7, 4], [7, 4], [6, -1], [-6, -1]], SP.suit, INK, 1.2);
    poly(c, [[-6, -0.5], [-1.5, -0.5], [-1.5, 4], [-6, 4]], SP.navy, null);
    ell(c, -4, 1.5, 0.9, 0.9, SP.print[0], null);
    ell(c, 0.5, -1.5, 4, 1.6, SP.suit, INK, 1);
    c.translate(lk * 0.6, lk * 0.5);
    poly(c, [[-4, -10], [2, -12], [5, -9], [0, -7], [-2, -3], [-8, 0], [-7, -5]], SP.hair, INK, 1);
    ell(c, 1.5, -7, 3.6, 4.2, SP.skin, INK, 1.2);
    ell(c, -0.3, -6.6, 1.3, 3, SP.skinShade, null);
    poly(c, [[-3.5, -8.5], [0, -11.6], [4.5, -10.5], [5.2, -8.4], [1.5, -9.3], [-1.5, -7.5]], SP.hair, null);
    stroke(c, [[0, -7.2], [5.4, -7.4]], SP.frame, 0.8);
    ell(c, 4, -6.8, 1.5, 1.1, SP.lens, SP.frame, 0.6);
    c.shadowColor = "#ffd27a"; c.shadowBlur = 3;
    ell(c, 4.4, -7.2, 0.5, 0.35, "#e9b86a", null);
    c.restore();
  }

  const api = { spaceman, plumbmonkey, pilot, guitar, frames, blit, shoulder, arm, SPACEMAN: SP, PLUMBMONKEY: PM, INK };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HeroKit = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
