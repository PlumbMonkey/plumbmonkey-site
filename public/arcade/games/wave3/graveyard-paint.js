/* Graveyard Shift — PAINTERS (pure drawing, no state).

   Every function here paints one thing around a local origin into whatever
   2D context it is handed, so graveyard-art.js can rasterise it once into a
   cached canvas per (thing, frame) and blit it. House style: ink outline, a
   darker shading pass, lit eyes and glows via shadowBlur, soft gradients
   rather than long thin strokes. */
(function (root) {
  "use strict";
  const INK = "#120b1e", TILE = 48;

  const THEMES = {
    cemetery: { sky: ["#1b1033", "#07040f"], far: "#191430", mid: "#231a3a", ground: "#2a2336", top: "#5f7d4b", topHi: "#a8c799", stone: "#4a4658", stoneHi: "#8c86a0", accent: "#a8c799", fog: "196,181,253", outdoor: true },
    crypt:    { sky: ["#100c17", "#040306"], far: "#17121f", mid: "#1f1928", ground: "#2a2230", top: "#6b5848", topHi: "#b39271", stone: "#433a48", stoneHi: "#7d6f80", accent: "#e9ac77", fog: "233,172,119" },
    steps:    { sky: ["#2b1331", "#0b050f"], far: "#1c1426", mid: "#281c35", ground: "#2b2a36", top: "#8a8298", topHi: "#cfc9dd", stone: "#4d4a5c", stoneHi: "#a39fb5", accent: "#f2a65a", fog: "242,166,90", outdoor: true },
    foyer:    { sky: ["#2c1b25", "#130b11"], far: "#3a2230", mid: "#4a2c36", ground: "#3a2418", top: "#8a5a36", topHi: "#d9a066", stone: "#5a4034", stoneHi: "#b98a5e", accent: "#f0c674", fog: "240,198,116" },
    gallery:  { sky: ["#1f2233", "#0c0d16"], far: "#262a3f", mid: "#30344d", ground: "#2d2530", top: "#b08d57", topHi: "#f1d59a", stone: "#3b3550", stoneHi: "#8f86b0", accent: "#c4a7ff", fog: "196,167,255" },
    other:    { sky: ["#062421", "#010a09"], far: "#0b2e2a", mid: "#0f3934", ground: "#0c2622", top: "#3fd4b8", topHi: "#b6fff0", stone: "#134a43", stoneHi: "#5be3c9", accent: "#5eead4", fog: "94,234,212" },
    music:    { sky: ["#1e0f2c", "#08040e"], far: "#241536", mid: "#2f1c44", ground: "#231a2e", top: "#cc9cea", topHi: "#f3dcff", stone: "#3a2d4a", stoneHi: "#9b84b8", accent: "#cc9cea", fog: "204,156,234" }
  };

  // ---------- helpers ----------
  function P(g, pts, fill, lw = 2, stroke = INK) {
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (lw) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  function O(g, x, y, rx, ry, fill, lw = 0, stroke = INK) {
    g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (lw) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  function R(g, x, y, w, h, fill, lw = 0, r = 0) {
    g.beginPath(); if (r && g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (lw) { g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); }
  }
  function glow(g, color, blur, fn) { g.save(); g.shadowColor = color; g.shadowBlur = blur; fn(); g.restore(); }
  const hash = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h ^= h >>> 13; return ((h >>> 0) % 10000) / 10000; };
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    const ch = v => Math.round(v + (t - v) * p);
    return "#" + ((1 << 24) + (ch(n >> 16 & 255) << 16) + (ch(n >> 8 & 255) << 8) + ch(n & 255)).toString(16).slice(1);
  }
  function note(g, x, y, s, color) {        // an eighth note, centred
    g.save(); g.translate(x, y); g.scale(s, s);
    O(g, -3, 5, 5, 3.6, color, 1.6);
    P(g, [[1, 5], [2.5, 5], [2.5, -10], [1, -10]], color, 1.2);
    P(g, [[2.5, -10], [9, -6], [8, -3], [2.5, -6]], color, 1.2);
    g.restore();
  }

  // ============================================================ backdrops
  /* One 1280x720 sky per theme (static), plus two tileable parallax strips. */
  function paintSky(g, T, w, h, name) {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, T.sky[0]); gr.addColorStop(1, T.sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (T.outdoor) {
      for (let i = 0; i < 90; i++) { g.globalAlpha = 0.25 + hash(i, 3) * 0.6; g.fillStyle = "#fff"; g.fillRect(hash(i, 1) * w, hash(i, 2) * h * 0.55, 1.6, 1.6); }
      g.globalAlpha = 1;
      const mx = w * 0.78, my = 130, mg = g.createRadialGradient(mx, my, 10, mx, my, 150);
      mg.addColorStop(0, "rgba(255,248,220,0.5)"); mg.addColorStop(1, "rgba(255,248,220,0)");
      g.fillStyle = mg; g.fillRect(mx - 150, my - 150, 300, 300);
      O(g, mx, my, 52, 52, "#f6efd8"); O(g, mx + 14, my - 8, 10, 8, "#e2d9bd"); O(g, mx - 16, my + 14, 7, 6, "#e2d9bd");
    } else {
      // interior: panelled wall with soft sconce pools
      for (let x = 40; x < w; x += 320) {
        const sg = g.createRadialGradient(x, 260, 4, x, 260, 170);
        sg.addColorStop(0, `rgba(${T.fog},0.18)`); sg.addColorStop(1, `rgba(${T.fog},0)`);
        g.fillStyle = sg; g.fillRect(x - 170, 90, 340, 340);
      }
      if (name === "music") for (let i = 0; i < 5; i++) {
        const x = 140 + i * 250, cone = g.createLinearGradient(0, 0, 0, h);
        cone.addColorStop(0, i % 2 ? "rgba(204,156,234,0.22)" : "rgba(94,234,212,0.16)"); cone.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = cone; g.beginPath(); g.moveTo(x - 10, 0); g.lineTo(x + 10, 0); g.lineTo(x + 140, h); g.lineTo(x - 140, h); g.fill();
      }
    }
  }
  function paintFar(g, T, name, w, h) {
    g.fillStyle = T.far;
    if (name === "cemetery" || name === "steps") {
      // the manor on its hill, far away, with lit windows
      g.beginPath(); g.moveTo(0, h); g.quadraticCurveTo(w * 0.3, h - 170, w * 0.55, h - 150); g.quadraticCurveTo(w * 0.8, h - 130, w, h - 190); g.lineTo(w, h); g.fill();
      const mx = name === "steps" ? w * 0.45 : w * 0.62, by = h - 150;
      P(g, [[mx - 150, by], [mx - 150, by - 150], [mx - 90, by - 210], [mx - 30, by - 150], [mx + 30, by - 150], [mx + 30, by - 250], [mx + 60, by - 300], [mx + 90, by - 250], [mx + 90, by - 150], [mx + 150, by - 150], [mx + 150, by]], T.far, 0);
      for (let i = 0; i < 9; i++) { const x = mx - 130 + (i % 5) * 52, y = by - 120 + Math.floor(i / 5) * 50; g.fillStyle = hash(i, 9) > 0.4 ? "rgba(255,210,120,0.55)" : "rgba(120,110,150,0.3)"; g.fillRect(x, y, 12, 20); }
    } else if (name === "crypt") {
      for (let x = 0; x < w; x += 160) { R(g, x + 20, 120, 100, h - 120, T.far); g.fillStyle = T.sky[1]; g.beginPath(); g.ellipse(x + 70, 220, 34, 60, 0, Math.PI, 0); g.fill(); g.fillRect(x + 36, 220, 68, 120); }
    } else if (name === "foyer" || name === "gallery" || name === "other") {
      for (let x = 0; x < w; x += 200) {
        R(g, x + 30, 90, 140, 260, T.far);
        const wg = g.createLinearGradient(0, 110, 0, 330);
        wg.addColorStop(0, name === "foyer" ? "rgba(140,160,220,0.35)" : `rgba(${T.fog},0.12)`); wg.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = wg; g.fillRect(x + 46, 110, 108, 220);
      }
    } else if (name === "music") {
      for (let x = 0; x < w; x += 220) { R(g, x + 30, 280, 110, 280, T.far); for (let k = 0; k < 3; k++) O(g, x + 85, 330 + k * 80, 30, 30, T.mid); }
    }
  }
  function paintMid(g, T, name, w, h) {
    if (name === "cemetery") {
      for (let i = 0; i < 12; i++) {
        const x = hash(i, 4) * w, y = h - 90 - hash(i, 5) * 40, s = 0.7 + hash(i, 6) * 0.6;
        if (hash(i, 7) > 0.5) { R(g, x, y, 26 * s, 40 * s, T.mid); O(g, x + 13 * s, y, 13 * s, 12 * s, T.mid); }
        else { R(g, x + 10 * s, y - 20 * s, 7 * s, 60 * s, T.mid); R(g, x, y - 6 * s, 27 * s, 7 * s, T.mid); }
      }
      // a dead tree
      g.strokeStyle = T.mid; g.lineCap = "round";
      [[w * 0.3, h - 60, -1.57, 120, 14]].forEach(function br([x, y, a, len, wd], d = 0) {
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        if (d < 3) { br([x2, y2, a - 0.5, len * 0.62, wd * 0.6], d + 1); br([x2, y2, a + 0.45, len * 0.55, wd * 0.6], d + 1); }
      });
    } else if (name === "steps") {
      for (let x = 0; x < w; x += 140) { R(g, x, h - 260, 40, 260, T.mid); O(g, x + 20, h - 265, 26, 12, T.mid); }
    } else if (name === "crypt") {
      for (let x = 0; x < w; x += 110) for (let y = 380; y < h; y += 60) { g.fillStyle = hash(x, y) > 0.5 ? T.mid : shade(T.mid, -0.2); g.fillRect(x + (y % 120 ? 0 : 55), y, 100, 52); }
    } else if (name === "foyer") {
      // the double staircase banister and portraits
      g.strokeStyle = T.mid; g.lineWidth = 10;
      for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(k * w / 2, h); g.lineTo(k * w / 2 + w / 2, h - 360); g.stroke(); for (let i = 0; i < 12; i++) { const t = i / 12; R(g, k * w / 2 + t * w / 2 - 3, h - t * 360 - 60, 6, 60, T.mid); } }
    } else if (name === "gallery" || name === "other") {
      for (let x = 0; x < w; x += 260) { R(g, x + 40, 150, 150, 190, T.mid); R(g, x + 54, 164, 122, 162, shade(T.mid, -0.35)); }
    } else if (name === "music") {
      for (let x = 0; x < w; x += 180) { R(g, x + 20, h - 200, 120, 200, T.mid); R(g, x + 30, h - 190, 100, 40, shade(T.mid, -0.3)); O(g, x + 80, h - 90, 34, 34, shade(T.mid, -0.3)); }
    }
  }

  // ============================================================ tiles
  /* Every tile is painted at 0..48 x 0..48. `v` is a per-cell variant hash and
     `edge` says the cell above is open (so the top gets a lip). */
  function paintTile(g, T, ch, v, edge, frame = 0) {
    switch (ch) {
      case "#": {
        R(g, 0, 0, TILE, TILE, T.ground);
        for (let i = 0; i < 6; i++) { g.fillStyle = hash(v, i) > 0.5 ? shade(T.ground, 0.12) : shade(T.ground, -0.25); g.fillRect(hash(v, i + 10) * 42, hash(v, i + 20) * 42, 5, 4); }
        if (edge) {
          const eg = g.createLinearGradient(0, 0, 0, 14); eg.addColorStop(0, T.topHi); eg.addColorStop(0.35, T.top); eg.addColorStop(1, shade(T.ground, 0.05));
          g.fillStyle = eg; g.fillRect(0, 0, TILE, 14);
          if (T.outdoor) for (let i = 0; i < 5; i++) { const x = hash(v, i + 30) * 44; P(g, [[x, 2], [x + 2, -5 - hash(v, i) * 4], [x + 4, 2]], T.topHi, 0); }
          g.fillStyle = INK; g.fillRect(0, 0, TILE, 1.5);
        }
        break;
      }
      case "B": case "S": {
        const c = ch === "S" ? "#2d7b70" : T.stone, hi = ch === "S" ? "#7ff5de" : T.stoneHi;
        R(g, 1, 1, 46, 46, c, 2, 4);
        P(g, [[3, 3], [45, 3], [41, 8], [7, 8]], shade(hi, -0.1), 0);
        P(g, [[3, 45], [45, 45], [41, 40], [7, 40]], shade(c, -0.35), 0);
        if (ch === "S") glow(g, "#5eead4", 10, () => { O(g, 17, 22, 3, 4, "#b6fff0"); O(g, 31, 22, 3, 4, "#b6fff0"); });
        else { g.strokeStyle = shade(c, -0.4); g.lineWidth = 1.2; g.beginPath(); g.moveTo(10 + hash(v, 1) * 20, 12); g.lineTo(18 + hash(v, 2) * 12, 26); g.lineTo(14, 34); g.stroke(); }
        break;
      }
      case "G": {                     // a ghost, packed into a block
        const bob = frame % 2 ? 1 : 0;
        g.save(); g.translate(0, bob);
        glow(g, "rgba(233,213,255,0.8)", 10, () => {
          P(g, [[4, 12], [10, 3], [38, 3], [44, 12], [44, 40], [38, 46], [32, 41], [24, 46], [16, 41], [10, 46], [4, 40]], "#e6d6f2", 2, "#6d4f86");
        });
        P(g, [[30, 4], [38, 3], [44, 12], [44, 40], [38, 46], [32, 41]], "#bda3d4", 0);
        O(g, 16, 20, 4.5, 6, "#3a2150"); O(g, 32, 20, 4.5, 6, "#3a2150");
        glow(g, "#ff9ecb", 6, () => { g.fillStyle = "#ffc2dc"; g.fillRect(15, 18, 2, 3); g.fillRect(31, 18, 2, 3); });
        O(g, 24, 32, 3.5, frame % 2 ? 4.5 : 3.5, "#4a2a5e");
        g.restore();
        break;
      }
      case "L": {                     // echo block: a teal outline that fills in when solid
        if (frame) { R(g, 2, 2, 44, 44, "rgba(94,234,212,0.55)", 0, 6); glow(g, "#5eead4", 12, () => { g.strokeStyle = "#b6fff0"; g.lineWidth = 2.5; g.strokeRect(3, 3, 42, 42); }); }
        else { g.setLineDash([6, 5]); g.strokeStyle = "rgba(94,234,212,0.45)"; g.lineWidth = 2; g.strokeRect(4, 4, 40, 40); g.setLineDash([]); }
        break;
      }
      case "?": case "!": case "$": case "*": case "u": {
        const used = ch === "u", col = { "?": "#f5c451", "!": "#ff6f91", "$": "#86efac", "*": "#67e8f9", u: "#6b5a4a" }[ch];
        R(g, 2, 3, 44, 42, used ? "#3a2c26" : "#5a3422", 2, 5);
        R(g, 5, 6, 38, 36, used ? "#2d221e" : "#40241a", 0, 3);
        g.strokeStyle = used ? "#6b5a4a" : "#d8a84e"; g.lineWidth = 2; g.strokeRect(6, 7, 36, 34);
        [[7, 8], [41, 8], [7, 40], [41, 40]].forEach(([x, y]) => O(g, x, y, 2, 2, used ? "#6b5a4a" : "#f5d27a"));
        if (!used) {
          const pulse = frame % 4 === 1 || frame % 4 === 2 ? 14 : 8;
          glow(g, col, pulse, () => {
            if (ch === "!") P(g, [[24, 11], [28, 21], [38, 21], [30, 28], [33, 38], [24, 32], [15, 38], [18, 28], [10, 21], [20, 21]], col, 1.4);
            else note(g, 23, 25, 1.25, col);
          });
          if (ch === "*") { g.strokeStyle = "rgba(103,232,249,0.6)"; g.lineWidth = 1.5; g.beginPath(); g.arc(24, 24, 16, -0.4, 4.4); g.stroke(); }
        }
        break;
      }
      case "-": {
        R(g, 0, 0, TILE, 12, T.stoneHi, 2, 3);
        R(g, 2, 8, 44, 4, shade(T.stone, -0.2));
        P(g, [[6, 12], [14, 12], [10, 22]], shade(T.stone, -0.3), 1.5);
        P(g, [[34, 12], [42, 12], [38, 22]], shade(T.stone, -0.3), 1.5);
        break;
      }
      case "=": {
        R(g, 1, 1, 46, 46, shade(T.stone, 0.05), 2, 3);
        g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath();
        g.moveTo(8, 4); g.lineTo(16, 18); g.lineTo(12, 30); g.lineTo(20, 44);
        g.moveTo(34, 3); g.lineTo(28, 16); g.lineTo(36, 28); g.stroke();
        R(g, 3, 3, 42, 5, T.stoneHi);
        break;
      }
      case "^": {
        R(g, 0, 30, TILE, 18, T.ground);
        for (let i = 0; i < 4; i++) P(g, [[i * 12, 32], [i * 12 + 6, 4], [i * 12 + 12, 32]], "#c9ced8", 1.6);
        for (let i = 0; i < 4; i++) P(g, [[i * 12 + 6, 4], [i * 12 + 9, 22], [i * 12 + 6, 32]], "#8b90a0", 0);
        break;
      }
      case "U": {                     // the cursed urn
        P(g, [[10, 48], [6, 28], [12, 12], [8, 6], [40, 6], [36, 12], [42, 28], [38, 48]], "#6d5a7a", 2);
        P(g, [[26, 10], [40, 6], [36, 12], [42, 28], [38, 48], [28, 48]], "#4b3c57", 0);
        R(g, 6, 2, 36, 7, "#8c77a0", 2, 2);
        g.strokeStyle = "#c9a24a"; g.lineWidth = 2; g.beginPath(); g.moveTo(9, 28); g.lineTo(39, 28); g.stroke();
        break;
      }
      case "g": {                     // open grave slab
        paintTile(g, T, "#", v, edge);
        R(g, 8, 2, 32, 12, "#07040c", 1.5, 3);
        glow(g, "#a78bfa", 8, () => { g.strokeStyle = "rgba(167,139,250,0.7)"; g.lineWidth = 1.5; g.strokeRect(10, 3, 28, 9); });
        break;
      }
    }
  }

  // ============================================================ scenery objects
  function paintLantern(g, lit) {
    R(g, -3, -6, 6, 58, "#2a2530", 1.5);
    if (lit) { const lg = g.createRadialGradient(0, -22, 2, 0, -22, 60); lg.addColorStop(0, "rgba(255,200,110,0.55)"); lg.addColorStop(1, "rgba(255,200,110,0)"); g.fillStyle = lg; g.fillRect(-60, -82, 120, 120); }
    P(g, [[-10, -34], [10, -34], [8, -10], [-8, -10]], lit ? "#ffd27a" : "#3b3346", 2);
    P(g, [[-12, -34], [0, -44], [12, -34]], "#2a2530", 2);
    if (lit) glow(g, "#ffb347", 14, () => O(g, 0, -22, 4, 7, "#fff1c9"));
  }
  function paintDoor(g, open) {
    P(g, [[-30, 0], [-30, -66], [0, -88], [30, -66], [30, 0]], "#3a2418", 3);
    if (open) { const dg = g.createLinearGradient(0, -80, 0, 0); dg.addColorStop(0, "#ffe7b0"); dg.addColorStop(1, "#f2a65a"); P(g, [[-22, 0], [-22, -62], [0, -79], [22, -62], [22, 0]], dg, 2); }
    else { P(g, [[-22, 0], [-22, -62], [0, -79], [22, -62], [22, 0]], "#5a3422", 2); g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -78); g.lineTo(0, 0); g.stroke(); O(g, 8, -34, 2.5, 2.5, "#c9a24a"); }
  }
  function paintPortal(g, t, other) {
    const c = other ? "#5eead4" : "#c4a7ff";
    R(g, -26, -34, 52, 64, "#b08d57", 3, 3);
    R(g, -20, -28, 40, 52, "#140f22");
    g.save(); g.beginPath(); g.rect(-20, -28, 40, 52); g.clip();
    for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(${other ? "94,234,212" : "196,167,255"},${0.5 - i * 0.12})`; g.lineWidth = 3; g.beginPath(); g.arc(0, -2, 6 + i * 8, t * 0.08 + i, t * 0.08 + i + 4); g.stroke(); }
    g.restore();
    glow(g, c, 10, () => O(g, 0, -2, 4, 4, "#fff"));
  }
  function paintTombDoor(g) {
    P(g, [[-24, 0], [-24, -50], [0, -70], [24, -50], [24, 0]], "#4a4658", 3);
    P(g, [[-14, 0], [-14, -42], [0, -54], [14, -42], [14, 0]], "#07040c", 2);
    glow(g, "#a78bfa", 8, () => { g.fillStyle = "#c4b5fd"; g.font = "700 16px Georgia"; g.textAlign = "center"; g.fillText("↓", 0, -18); });
  }
  // The level exit: a great lantern on a stone plinth, far bigger than a
  // checkpoint lantern. lit: 0 dark, 1/2 the two flicker frames.
  function paintGreatLantern(g, lit) {
    const head = -142;
    if (lit) {
      const hg = g.createRadialGradient(0, head, 6, 0, head, 128);
      hg.addColorStop(0, "rgba(255,210,122,0.55)"); hg.addColorStop(0.5, "rgba(255,179,71,0.18)"); hg.addColorStop(1, "rgba(255,179,71,0)");
      g.fillStyle = hg; g.fillRect(-128, head - 128, 256, 256);
    }
    // plinth
    P(g, [[-50, 0], [-44, -26], [44, -26], [50, 0]], "#4a4658", 3);
    P(g, [[14, -26], [44, -26], [50, 0], [18, 0]], "#38344a", 0);
    R(g, -38, -40, 76, 14, "#5f5b72", 2.5, 3);
    g.strokeStyle = "rgba(20,12,30,0.5)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-20, -24); g.lineTo(-24, -2); g.moveTo(22, -24); g.lineTo(20, -8); g.stroke();
    // iron column with a brass collar
    const cg = g.createLinearGradient(-10, 0, 10, 0); cg.addColorStop(0, "#1d1a24"); cg.addColorStop(0.5, "#5b5566"); cg.addColorStop(1, "#1d1a24");
    R(g, -10, -98, 20, 60, cg, 2);
    R(g, -24, -106, 48, 10, "#c9a24a", 2, 2);
    R(g, -16, -114, 32, 8, "#2a2530", 2);
    // the cage: glass panes between iron bars, wider at the top
    const glass = lit ? (() => { const gg = g.createLinearGradient(0, -184, 0, -114); gg.addColorStop(0, lit === 1 ? "#ffe39a" : "#ffd27a"); gg.addColorStop(1, "#f2a65a"); return gg; })() : "#2c2638";
    P(g, [[-30, -114], [30, -114], [38, -184], [-38, -184]], glass, 3);
    if (!lit) { g.fillStyle = "rgba(167,139,250,0.12)"; P(g, [[-24, -120], [-12, -120], [-14, -178], [-30, -178]], "rgba(167,139,250,0.12)", 0); }
    g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-10, -114); g.lineTo(-13, -184); g.moveTo(10, -114); g.lineTo(13, -184); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(-34, -150); g.lineTo(34, -150); g.stroke();
    // flame, or a cold wick
    if (lit) glow(g, "#ffb347", 26, () => {
      const h = lit === 1 ? 30 : 26, w = lit === 1 ? 9 : 11;
      g.beginPath(); g.moveTo(0, head - h); g.quadraticCurveTo(w * 1.6, head - 4, 0, head + 14); g.quadraticCurveTo(-w * 1.6, head - 4, 0, head - h); g.fillStyle = "#ffb347"; g.fill();
      O(g, 0, head + 4, w * 0.45, 9, "#fff1c9");
    });
    else { R(g, -2, head - 2, 4, 14, "#3b3346"); O(g, 0, head + 14, 8, 3, "#2a2530"); }
    // roof, brass trim and finial
    R(g, -42, -190, 84, 7, "#c9a24a", 2, 2);
    P(g, [[-50, -190], [50, -190], [22, -218], [-22, -218]], "#2a2530", 3);
    P(g, [[6, -218], [22, -218], [50, -190], [26, -190]], "#1b1822", 0);
    P(g, [[-22, -218], [22, -218], [0, -244]], "#3a3542", 3);
    O(g, 0, -252, 7, 8, null, 3);
    if (lit) glow(g, "#ffd27a", 10, () => { g.strokeStyle = "rgba(255,210,122,0.8)"; g.lineWidth = 2; g.beginPath(); g.moveTo(-36, -110); g.lineTo(36, -110); g.stroke(); });
  }
  function paintPedestal(g, t) {
    const lg = g.createRadialGradient(0, -60, 4, 0, -60, 90); lg.addColorStop(0, "rgba(255,230,150,0.5)"); lg.addColorStop(1, "rgba(255,230,150,0)");
    g.fillStyle = lg; g.fillRect(-90, -150, 180, 180);
    P(g, [[-24, 0], [-18, -8], [-12, -44], [12, -44], [18, -8], [24, 0]], "#e8e2f0", 2);
    R(g, -18, -50, 36, 8, "#fff", 2, 2);
  }

  // ============================================================ foes
  function paintSkull(g, f, squash) {
    if (squash) { O(g, 0, -6, 18, 7, "#e9e2cf", 2); O(g, -6, -7, 3, 2, INK); O(g, 6, -7, 3, 2, INK); return; }
    const k = f % 4, legs = [[-14, -2 + (k === 0 ? -3 : 0)], [-6, 0 + (k === 1 ? -3 : 0)], [6, 0 + (k === 2 ? -3 : 0)], [14, -2 + (k === 3 ? -3 : 0)]];
    legs.forEach(([x, y], i) => { g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(x * 0.6, -10); g.lineTo(x, y); g.stroke(); g.strokeStyle = "#cfc6ae"; g.lineWidth = 2; g.stroke(); });
    O(g, 0, -17, 16, 13, "#ece5d2", 2);
    P(g, [[-10, -8], [10, -8], [8, -2], [-8, -2]], "#d6ccb2", 1.6);
    O(g, 5, -20, 5, 6, "#170f1f"); O(g, -7, -20, 4.5, 5.5, "#170f1f");
    glow(g, "#ff5b6e", 6, () => { O(g, 5, -19, 1.6, 1.6, "#ff9aa6"); O(g, -7, -19, 1.4, 1.4, "#ff9aa6"); });
    P(g, [[-1, -12], [1, -12], [0, -9]], "#170f1f", 0);
    for (let i = -6; i <= 6; i += 4) R(g, i - 1, -8, 2, 4, "#170f1f");
  }
  function paintArmourShell(g, f) {
    P(g, [[-18, 0], [-17, -20], [-8, -32], [8, -32], [17, -20], [18, 0]], "#6f7686", 2);
    P(g, [[2, -32], [8, -32], [17, -20], [18, 0], [6, 0]], "#4d5360", 0);
    for (let i = 0; i < 3; i++) { g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-17, -8 - i * 8); g.lineTo(17, -8 - i * 8); g.stroke(); }
    glow(g, "#ffedac", 6, () => { g.fillStyle = "#ffedac"; g.fillRect(-7, -14 + (f % 2), 4, 3); g.fillRect(3, -14 + (f % 2), 4, 3); });
  }
  function paintBat(g, f) {
    const up = f % 2 === 0;
    [-1, 1].forEach(d => P(g, up ? [[d * 4, -2], [d * 22, -16], [d * 18, -4], [d * 12, -2], [d * 8, 4]] : [[d * 4, -2], [d * 22, 8], [d * 16, 4], [d * 11, 8], [d * 6, 4]], "#5a2d4e", 1.8));
    O(g, 0, 0, 7, 9, "#3a2146", 2);
    P(g, [[-5, -7], [-3, -13], [-1, -7]], "#3a2146", 1.2); P(g, [[5, -7], [3, -13], [1, -7]], "#3a2146", 1.2);
    glow(g, "#ffcf6a", 6, () => { g.fillStyle = "#ffd98a"; g.fillRect(-4, -3, 2.5, 2.5); g.fillRect(1.5, -3, 2.5, 2.5); });
  }
  function paintFlower(g, f) {
    const open = f % 2;
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6, -14, 0, -26); g.stroke();
    g.strokeStyle = "#3f7a3a"; g.lineWidth = 3.5; g.stroke();
    P(g, [[0, -12], [12, -18], [6, -10]], "#4f9a48", 1.4);
    const a = open ? 0.55 : 0.2;
    g.save(); g.translate(0, -30);
    g.save(); g.rotate(-a); P(g, [[-16, 0], [-12, -12], [0, -16], [12, -12], [16, 0]], "#7a2e8e", 2); for (let i = -10; i <= 10; i += 5) P(g, [[i - 2, 0], [i, 5], [i + 2, 0]], "#fff", 0); g.restore();
    g.save(); g.rotate(a); P(g, [[-16, 0], [-12, 10], [0, 13], [12, 10], [16, 0]], "#5a1f6a", 2); for (let i = -10; i <= 10; i += 5) P(g, [[i - 2, 0], [i, -5], [i + 2, 0]], "#fff", 0); g.restore();
    glow(g, "#e879f9", 8, () => { O(g, -5, -9, 1.8, 1.8, "#f5d0fe"); O(g, 5, -9, 1.8, 1.8, "#f5d0fe"); });
    g.restore();
  }
  function paintCloud(g, f) {
    const b = f % 2;
    [[-20, 4, 16], [0, 0, 20], [20, 5, 15], [-8, 10, 14], [10, 11, 14]].forEach(([x, y, r]) => O(g, x, y + b, r, r * 0.75, "#8a7fa6", 2));
    [[-20, 4, 13], [0, 0, 17], [20, 5, 12]].forEach(([x, y, r]) => O(g, x, y - 2 + b, r, r * 0.6, "#b3a8cf"));
  }
  function paintPumpkin(g, f) {
    g.save(); g.rotate(f * 0.5);
    O(g, 0, 0, 13, 11, "#e8782c", 2);
    O(g, -5, 0, 5, 10, "#c95e1e"); O(g, 5, 0, 5, 10, "#c95e1e");
    glow(g, "#ffd24a", 8, () => { P(g, [[-7, -4], [-3, -4], [-5, -1]], "#ffe28a", 0); P(g, [[3, -4], [7, -4], [5, -1]], "#ffe28a", 0); P(g, [[-6, 3], [6, 3], [3, 6], [0, 4], [-3, 6]], "#ffe28a", 0); });
    R(g, -1.5, -15, 3, 5, "#3f7a3a", 1);
    g.restore();
  }
  function paintGargoyle(g, awake) {
    P(g, [[-28, 56], [-30, 24], [-22, 8], [-12, 14], [-10, 0], [-4, 10], [4, 10], [10, 0], [12, 14], [22, 8], [30, 24], [28, 56]], "#6a6475", 2.5);
    P(g, [[8, 12], [22, 8], [30, 24], [28, 56], [12, 56]], "#4d4858", 0);
    P(g, [[-16, 30], [-8, 22], [8, 22], [16, 30], [10, 40], [-10, 40]], "#57515f", 2);
    for (let i = -9; i <= 9; i += 6) P(g, [[i - 2, 40], [i, 46], [i + 2, 40]], "#e8e2d0", 1);
    if (awake) glow(g, "#ff6b3d", 12, () => { O(g, -7, 30, 3, 2.5, "#ffb08a"); O(g, 7, 30, 3, 2.5, "#ffb08a"); });
    else { O(g, -7, 30, 3, 1.2, INK); O(g, 7, 30, 3, 1.2, INK); }
  }
  function paintChandelier(g, t) {
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(-68, 0); g.quadraticCurveTo(0, 22, 68, 0); g.stroke();
    g.strokeStyle = "#c9a24a"; g.lineWidth = 3.5; g.stroke();
    R(g, -72, -6, 144, 12, "#8e6f2a", 2, 4);
    for (let i = -3; i <= 3; i++) {
      const x = i * 20;
      R(g, x - 3, -20, 6, 14, "#f3ead6", 1.2);
      glow(g, "#ffb347", 10, () => P(g, [[x - 3, -21], [x, -31 - (t + i) % 3], [x + 3, -21]], "#ffd27a", 0));
    }
  }
  function paintPlatform(g, w) {
    R(g, 0, 0, w, 16, "#6b4a30", 2, 3);
    R(g, 3, 3, w - 6, 4, "#8a6340");
    for (let x = 10; x < w; x += 44) { O(g, x, 11, 2, 2, "#c9ced8"); }
  }
  function paintAmp(g, t) {
    R(g, -16, -30, 32, 30, "#221d28", 2, 3);
    R(g, -13, -26, 26, 17, "#3a3342", 0, 2);
    for (let y = -24; y < -10; y += 3) { g.fillStyle = "#15111a"; g.fillRect(-12, y, 24, 1.3); }
    R(g, -13, -8, 26, 5, "#c9a24a", 1);
    glow(g, "#ffb347", 10, () => { O(g, -7, -5.5, 1.6, 1.6, "#ffe0a0"); O(g, 7, -5.5, 1.6, 1.6, "#ffe0a0"); });
  }
  function paintEncore(g, t) {
    g.save(); g.rotate(t * 0.12);
    glow(g, "#fde68a", 16, () => P(g, [[0, -16], [5, -5], [16, -4], [7, 3], [10, 15], [0, 8], [-10, 15], [-7, 3], [-16, -4], [-5, -5]], "#fde047", 2));
    g.restore();
    note(g, 0, 0, 0.7, "#7c2d12");
  }
  function paintBarrel(g, spin) {
    g.save(); g.rotate(spin);
    O(g, 0, 0, 17, 17, "#b91c3c", 2.5);
    O(g, 0, 0, 13, 13, "#f5efe3", 1.5);
    glow(g, "#f472b6", 6, () => { g.fillStyle = "#7a1830"; g.font = "900 11px Segoe UI"; g.textAlign = "center"; g.fillText("PM", 0, 4); });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; O(g, Math.cos(a) * 15, Math.sin(a) * 15, 1.6, 1.6, "#d9d9e0"); }
    g.restore();
  }
  function paintPotion(g, t) {
    g.save(); g.rotate(t * 0.25);
    O(g, 0, 2, 7, 7, "#4ade80", 2);
    R(g, -2.5, -9, 5, 6, "#a7f3d0", 1.5);
    O(g, -2, 0, 2, 2, "#dcfce7");
    g.restore();
  }

  const exports = { THEMES, INK, hash, shade, P, O, R, glow, note, paintSky, paintFar, paintMid, paintTile, paintLantern, paintDoor, paintPortal,
    paintTombDoor, paintGreatLantern, paintPedestal, paintSkull, paintArmourShell, paintBat, paintFlower, paintCloud, paintPumpkin, paintGargoyle,
    paintChandelier, paintPlatform, paintAmp, paintEncore, paintBarrel, paintPotion };
  if (typeof module !== "undefined" && module.exports) module.exports = exports;
  else root.GraveyardPaint = exports;
})(typeof window !== "undefined" ? window : globalThis);
