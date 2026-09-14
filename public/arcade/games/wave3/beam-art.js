/* Beam Me Up: Live! — RENDERER and host glue.
   The cast is drawn in the manor's house style (wave3/sprite-kit.js): ink
   outlines, a shading pass and lit eyes. Unlike the kit's ~90px figures these
   are authored at their final ~50px size and rasterised once per animation
   frame, because a formation of forty is forty drawImage calls per frame, not
   forty path-and-shadow chains. Bosses are big and stateful, so they are drawn
   live. Everything faces DOWN (toward the player) at angle 0, except the hero
   ship, which faces up. */
(function (root) {
  "use strict";
  const G = root.BeamGame;
  const INK = "#0e0a1a";
  const HERO = ["#67e8f9", "#f0abfc", "#d9ff63"];
  const KILL = { bat: "#a78bfa", witch: "#86efac", abductor: "#fbbf24", gargoyle: "#d6d3d1", wraith: "#fb7185", wisp: "#fda4af", drone: "#c084fc", eyeball: "#fca5a5", turncoat: "#f87171" };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), tgt = amt < 0 ? 0 : 255, k = Math.abs(amt), ch = v => Math.round(v + (tgt - v) * k);
    return "#" + ((1 << 24) + (ch((n >> 16) & 255) << 16) + (ch((n >> 8) & 255) << 8) + ch(n & 255)).toString(16).slice(1);
  }

  // ---------- drawing primitives (work on any context) ----------
  function P(g, pts, fill, w = 2.2) {
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (w) { g.strokeStyle = INK; g.lineWidth = w; g.lineJoin = "round"; g.stroke(); }
  }
  function O(g, x, y, rx, ry, fill, w = 2.2) {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (w) { g.strokeStyle = INK; g.lineWidth = w; g.stroke(); }
  }
  function eyes(g, pts, color, r = 2.2) {
    g.shadowColor = color; g.shadowBlur = 8; g.fillStyle = color;
    pts.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    g.shadowBlur = 0;
  }
  function lines(g, segs, color, w) {
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.beginPath();
    segs.forEach(([a, b, c2, d]) => { g.moveTo(a, b); g.lineTo(c2, d); }); g.stroke();
  }

  // ---------- the cast ----------
  function paintBat(g, f) {
    const up = [-16, -4, 9][f], mem = "#6d28d9", bone = shade(mem, -0.4);
    for (const sd of [-1, 1]) {
      P(g, [[sd * 6, -4], [sd * 18, -10 + up * 0.5], [sd * 31, up], [sd * 27, 6 + up * 0.3], [sd * 20, 4], [sd * 15, 12], [sd * 9, 8], [sd * 5, 6]], mem);
      lines(g, [[sd * 7, -2, sd * 31, up], [sd * 12, -5, sd * 20, 4], [sd * 12, -5, sd * 15, 12]], bone, 1.2);
    }
    P(g, [[-7, -5], [-9, -17], [-3, -9]], "#3b0764", 1.8);
    P(g, [[7, -5], [9, -17], [3, -9]], "#3b0764", 1.8);
    O(g, 0, 2, 9, 11, "#3b0764");
    O(g, 2, 5, 5, 6, "#581c87", 0);
    eyes(g, [[-3.5, -1], [3.5, -1]], "#fde047", 2);
    P(g, [[-3, 7], [-1.5, 11], [0, 7]], "#f8fafc", 0);
    P(g, [[3, 7], [1.5, 11], [0, 7]], "#f8fafc", 0);
  }
  function paintWitch(g, f) {
    const flap = [0, 4][f];
    g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = "round";
    g.beginPath(); g.moveTo(-25, 9); g.lineTo(20, 4); g.stroke();
    g.strokeStyle = "#a16207"; g.lineWidth = 3.5; g.stroke();
    P(g, [[17, 0], [31, -5 + flap], [33, 11 + flap], [17, 9]], "#fbbf24", 1.8);
    lines(g, [[20, 2, 31, 1 + flap], [20, 6, 32, 7 + flap]], "#b45309", 1);
    P(g, [[-8, -4], [8, -4], [17, 15 + flap], [6, 11], [0, 17 - flap], [-6, 11], [-17, 15 + flap]], "#4c1d95");
    P(g, [[-7, -4], [7, -4], [9, 10], [-9, 10]], "#6d28d9");
    P(g, [[0, -4], [7, -4], [9, 10], [2, 10]], "#5b21b6", 0);
    O(g, -10, 8, 3, 3, "#86efac", 1.5);
    O(g, 10, 6, 3, 3, "#86efac", 1.5);
    P(g, [[-6, -11], [-11, -1], [-5, -5]], "#f97316", 1.2);
    P(g, [[6, -11], [11, -1], [5, -5]], "#f97316", 1.2);
    O(g, 0, -9, 6.5, 6, "#86efac");
    eyes(g, [[-2.5, -9.5], [2.5, -9.5]], "#facc15", 1.6);
    P(g, [[0, -9], [3, -4.5], [0.5, -5.5]], "#4ade80", 1);
    O(g, 0, -14, 13, 3, "#1e1b4b");
    P(g, [[-7, -15], [7, -15], [3, -26], [-3, -33], [-1, -24]], "#1e1b4b");
    g.fillStyle = "#c084fc"; g.fillRect(-6, -18, 12, 2.5);
  }
  function paintAbductor(g, f, dmg) {
    const hull = dmg ? "#b91c1c" : "#94a3b8", band = dmg ? "#7f1d1d" : "#475569";
    P(g, [[-8, 10], [-4, 20], [-1, 11]], band, 1.5);
    P(g, [[8, 10], [4, 20], [1, 11]], band, 1.5);
    O(g, 0, -6, 14, 13, "rgba(186,230,253,0.35)", 2);
    O(g, 0, -6, 7.5, 7.5, "#4ade80", 1.5);
    g.fillStyle = "#052e16";
    g.beginPath(); g.ellipse(-3, -7, 2.2, 3.2, 0.4, 0, 7); g.ellipse(3, -7, 2.2, 3.2, -0.4, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.ellipse(-6, -12, 4, 2, -0.6, 0, 7); g.fill();
    if (dmg) lines(g, [[4, -17, 1, -10], [1, -10, 6, -4], [-9, -11, -5, -6]], "#e0f2fe", 1.2);
    O(g, 0, 5, 27, 9, hull);
    O(g, 0, 2, 25, 4.5, shade(hull, 0.3), 0);
    O(g, 0, 7, 22, 4, band, 1.5);
    for (let i = 0; i < 6; i++) {
      const lit = (i + f) % 3 === 0, x = -20 + i * 8;
      g.shadowColor = "#fde047"; g.shadowBlur = lit ? 8 : 0;
      g.fillStyle = lit ? "#fde047" : "#1e293b"; g.beginPath(); g.arc(x, 7, 1.8, 0, 7); g.fill();
    }
    g.shadowBlur = 0;
  }
  function paintGargoyle(g, f, cracked, lit = true) {
    const stone = "#78716c", dark = "#57534e";
    for (const sd of [-1, 1]) {
      const up = f ? 10 : 0;
      P(g, [[sd * 8, -6], [sd * 22, -19 + up], [sd * 31, -5 + up * 0.8], [sd * 25, 4], [sd * 17, 1], [sd * 12, 10]], dark);
      lines(g, [[sd * 9, -5, sd * 22, -19 + up], [sd * 11, -2, sd * 25, 4], [sd * 10, 1, sd * 17, 1]], shade(dark, -0.35), 1.2);
    }
    O(g, 0, 3, 10, 12, stone);
    O(g, 1.5, 6, 5, 6, "#a8a29e", 0);
    P(g, [[-8, 12], [-10, 18], [-5, 15]], dark, 1.5);
    P(g, [[8, 12], [10, 18], [5, 15]], dark, 1.5);
    P(g, [[-5, -14], [-11, -24], [-2, -15]], "#44403c", 1.5);
    P(g, [[5, -14], [11, -24], [2, -15]], "#44403c", 1.5);
    O(g, 0, -9, 8, 7, stone);
    eyes(g, [[-3, -10], [3, -10]], lit ? "#fb923c" : "#57534e", 1.9);
    P(g, [[-3, -5], [-1.5, -2], [0, -5]], "#f5f5f4", 0);
    P(g, [[3, -5], [1.5, -2], [0, -5]], "#f5f5f4", 0);
    if (cracked) lines(g, [[-4, -2, 2, 6], [2, 6, -1, 12], [6, -12, 3, -7]], "#1c1917", 1.4);
  }
  function paintWraith(g, f) {
    g.shadowColor = "#f43f5e"; g.shadowBlur = 10;
    P(g, [[-13, -6], [13, -6], [16, 16], [10, 12 + f * 3], [6, 21], [0, 14 - f * 2], [-6, 21], [-10, 12 + f * 3], [-16, 16]], "#1e1b4b");
    g.shadowBlur = 0;
    O(g, 1, 5, 5, 9, "#312e81", 0);
    lines(g, [[-12, 6, -16, 13], [12, 6, 16, 13], [-16, 13, -18, 12], [-16, 13, -15, 16], [16, 13, 18, 12], [16, 13, 15, 16]], "#e2e8f0", 1.6);
    P(g, [[-11, -4], [0, -22], [11, -4], [7, 2], [-7, 2]], "#312e81");
    O(g, 0, -6, 6, 7, "#020617", 0);
    eyes(g, [[-2.5, -7], [2.5, -7]], "#67e8f9", 1.8);
  }
  function paintWisp(g, f) {
    g.shadowColor = "#fb7185"; g.shadowBlur = 12;
    P(g, [[0, -14 - f * 2], [6, -4], [8, 6], [0, 12], [-8, 6], [-6, -4]], "#fda4af", 1.5);
    g.shadowBlur = 0;
    O(g, 0, 4, 4, 5, "#fff1f2", 0);
    g.fillStyle = INK; g.fillRect(-3, 1, 2, 2.5); g.fillRect(1, 1, 2, 2.5);
  }
  function paintDrone(g, f) {
    lines(g, [[-8, -12, -12, -20], [8, -12, 12, -20]], "#94a3b8", 2);
    O(g, 0, 0, 15, 15, "#334155");
    O(g, 0, 0, 10, 10, "#f5f3ff", 1.5);
    O(g, 0, 2, 5.5, 5.5, "#7c3aed", 0);
    O(g, 0, 3, 2.4, 2.4, INK, 0);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + f * 0.5;
      g.shadowColor = "#c084fc"; g.shadowBlur = 8; g.fillStyle = "#c084fc";
      g.beginPath(); g.arc(Math.cos(a) * 12.5, Math.sin(a) * 12.5, 1.8, 0, 7); g.fill();
    }
    g.shadowBlur = 0;
  }
  function paintEyeball(g, f) {
    g.strokeStyle = "#7f1d1d"; g.lineWidth = 2.2; g.lineCap = "round";
    for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 5, -8); g.quadraticCurveTo(i * 8 + (f ? 3 : -3), -16, i * 5, -22); g.stroke(); }
    O(g, 0, 0, 11, 11, "#fef2f2");
    lines(g, [[-9, -4, -4, -1], [8, -5, 4, -1], [-7, 6, -3, 3]], "#f87171", 0.9);
    O(g, 0, 3, 5.5, 5.5, "#dc2626", 0);
    O(g, 0, 4, 2.5, 2.8, INK, 0);
  }
  function paintShip(g, col, red) {
    const body = red ? "#fecaca" : "#e2e8f0", trim = red ? "#dc2626" : col;
    g.shadowColor = trim; g.shadowBlur = 12;
    O(g, -9, 18, 3.5, 6, trim, 0); O(g, 9, 18, 3.5, 6, trim, 0);
    g.shadowBlur = 0;
    P(g, [[0, -6], [24, 10], [22, 16], [8, 12], [-8, 12], [-22, 16], [-24, 10]], shade(body, -0.2));
    P(g, [[18, 6], [24, 10], [22, 16], [17, 13]], trim, 1.4);
    P(g, [[-18, 6], [-24, 10], [-22, 16], [-17, 13]], trim, 1.4);
    P(g, [[0, -25], [7, -8], [8, 12], [4, 18], [-4, 18], [-8, 12], [-7, -8]], body);
    P(g, [[0, -25], [-7, -8], [-8, 12], [-4, 18], [0, 18]], shade(body, -0.12), 0);
    g.fillStyle = INK; g.fillRect(-15, -2, 2.5, 9); g.fillRect(12.5, -2, 2.5, 9);
    g.fillStyle = trim; g.fillRect(-3, 5, 6, 3);
    O(g, 0, -7, 4.5, 7, "#0f172a", 1.5);
    O(g, 0, -8, 2.7, 3.2, "#f5f3ff", 0);
    g.fillStyle = INK; g.fillRect(-1.4, -9, 1, 1.4); g.fillRect(0.6, -9, 1, 1.4);
  }

  // ---------- venue backdrops (painted once per venue, full 16:9 view) ----------
  function bareTree(g, x, y, len, ang, depth) {
    if (!depth) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    g.lineWidth = depth * 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    bareTree(g, x2, y2, len * 0.72, ang - 0.45 - hash(depth, x) * 0.25, depth - 1);
    bareTree(g, x2, y2, len * 0.68, ang + 0.42 + hash(depth, y) * 0.25, depth - 1);
  }
  function glowDisc(g, x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function paintVenue(g, V, PAD, VW) {
    const H = 720;
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, V.sky[0]); sky.addColorStop(0.55, V.sky[1]); sky.addColorStop(1, V.sky[2]);
    g.fillStyle = sky; g.fillRect(-PAD, 0, VW, H);
    for (let i = 0; i < 160; i++) {
      g.globalAlpha = 0.15 + hash(i, 3) * 0.55; g.fillStyle = "#fff";
      const sz = 0.7 + hash(i, 4) * 1.4;
      g.fillRect(-PAD + hash(i, 1) * VW, hash(i, 2) * 460, sz, sz);
    }
    g.globalAlpha = 1;
    if (V.id === "lawn") {
      glowDisc(g, 130, 110, 140, V.glow, 0.18);
      g.fillStyle = "rgba(240,232,255,0.85)"; g.beginPath(); g.arc(130, 110, 38, 0, 7); g.fill();
      g.fillStyle = "rgba(150,130,190,0.35)"; [[-12, -8, 8], [10, 6, 6], [-4, 16, 4]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(130 + dx, 110 + dy, r, 0, 7); g.fill(); });
      g.fillStyle = "#0d0719";
      g.fillRect(330, 330, 300, 200);
      g.beginPath(); g.moveTo(310, 332); g.lineTo(480, 230); g.lineTo(650, 332); g.fill();
      [[345, 260, 60], [555, 240, 70]].forEach(([x, y, w]) => { g.fillRect(x, y, w, 280); g.beginPath(); g.moveTo(x - 10, y + 2); g.lineTo(x + w / 2, y - 70); g.lineTo(x + w + 10, y + 2); g.fill(); });
      g.fillStyle = "rgba(240,171,252,0.35)";
      for (let x = 360; x < 620; x += 44) for (let y = 360; y < 500; y += 58) g.fillRect(x, y, 16, 26);
      g.strokeStyle = "#0a0614"; g.lineCap = "round";
      bareTree(g, -60, 560, 60, -Math.PI / 2 + 0.1, 6); bareTree(g, 1010, 560, 64, -Math.PI / 2 - 0.12, 6);
      g.fillStyle = "#0a0716";
      for (let x = -PAD; x < 960 + PAD; x += 46) { g.beginPath(); g.arc(x, 548 + hash(x, 9) * 10, 30, Math.PI, 0); g.fill(); }
      g.fillRect(-PAD, 548, VW, 60);
    } else if (V.id === "tower") {
      for (let i = 0; i < 9; i++) {
        const x = -PAD + hash(i, 21) * VW, y = 60 + hash(i, 22) * 220;
        const cg = g.createRadialGradient(x, y, 10, x, y, 220);
        cg.addColorStop(0, "rgba(71,85,105,0.35)"); cg.addColorStop(1, "rgba(71,85,105,0)");
        g.fillStyle = cg; g.save(); g.translate(x, y); g.scale(2.2, 0.7); g.translate(-x, -y); g.fillRect(x - 220, y - 220, 440, 440); g.restore();
      }
      g.fillStyle = "#0a0f1a";
      g.beginPath(); g.moveTo(-PAD, 520);
      for (let x = -PAD; x <= 960 + PAD; x += 40) g.lineTo(x, 470 - Math.floor(hash(x, 23) * 5) * 18);
      g.lineTo(960 + PAD, 720); g.lineTo(-PAD, 720); g.fill();
      g.fillStyle = "#080c16";
      g.fillRect(690, 150, 110, 420); g.beginPath(); g.moveTo(675, 152); g.lineTo(745, 40); g.lineTo(815, 152); g.fill();
      g.fillStyle = "rgba(165,180,252,0.18)"; g.beginPath(); g.arc(745, 215, 30, Math.PI, 0); g.fillRect(715, 215, 60, 40); g.fill();
      g.fillStyle = "#070a12"; g.fillRect(-PAD, 592, VW, 128);
      for (let x = -PAD; x < 960 + PAD; x += 60) g.fillRect(x, 578, 34, 16);
    } else if (V.id === "moon") {
      glowDisc(g, 480, 250, 330, V.glow, 0.25);
      const mg = g.createRadialGradient(440, 210, 20, 480, 250, 180);
      mg.addColorStop(0, "#fecdd3"); mg.addColorStop(0.5, "#e11d48"); mg.addColorStop(1, "#7f1d1d");
      g.globalAlpha = 0.55; g.fillStyle = mg; g.beginPath(); g.arc(480, 250, 180, 0, 7); g.fill(); g.globalAlpha = 1;
      g.fillStyle = "rgba(76,5,25,0.3)"; [[-60, -40, 30], [50, 30, 22], [-20, 70, 16], [80, -70, 14]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(480 + dx, 250 + dy, r, 0, 7); g.fill(); });
      for (let i = 0; i < 3; i++) {
        const y = 420 + i * 50, band = g.createLinearGradient(0, y - 30, 0, y + 30);
        band.addColorStop(0, "rgba(190,18,60,0)"); band.addColorStop(0.5, "rgba(190,18,60,0.12)"); band.addColorStop(1, "rgba(190,18,60,0)");
        g.fillStyle = band; g.fillRect(-PAD, y - 30, VW, 60);
      }
      g.strokeStyle = "#0c0206"; g.lineCap = "round";
      bareTree(g, 40, 600, 80, -Math.PI / 2 + 0.15, 7); bareTree(g, 920, 600, 76, -Math.PI / 2 - 0.2, 7);
      g.fillStyle = "#0c0206";
      for (let i = 0; i < 12; i++) { const x = 120 + i * 64 + hash(i, 31) * 20, y = 560 - hash(i, 32) * 10; g.fillRect(x - 1.5, y - 22, 3, 24); g.fillRect(x - 7, y - 16, 14, 3); }
      g.fillRect(-PAD, 560, VW, 160);
    } else {
      [[200, 180, 260, "124,58,237", 0.25], [760, 300, 300, "34,211,238", 0.12], [480, 90, 200, "232,121,249", 0.18], [-40, 420, 240, "99,102,241", 0.16]].forEach(([x, y, r, c, a]) => glowDisc(g, x, y, r, c, a));
      g.fillStyle = "rgba(233,213,255,0.10)"; g.beginPath(); g.ellipse(480, 150, 12, 120, 0, 0, 7); g.fill();
      [[140, 470, 90], [820, 430, 110], [470, 520, 70]].forEach(([x, y, w], i) => {
        g.fillStyle = "#0b0520";
        g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + w, y); g.lineTo(x + w * 0.5, y + 40); g.lineTo(x, y + 70); g.lineTo(x - w * 0.6, y + 36); g.fill();
        if (i === 1) { g.fillRect(x - 40, y - 60, 50, 60); g.beginPath(); g.moveTo(x - 50, y - 58); g.lineTo(x - 15, y - 100); g.lineTo(x + 20, y - 58); g.fill(); }
      });
      g.fillStyle = "#06031a"; g.fillRect(-PAD, 600, VW, 120);
      g.strokeStyle = "rgba(167,139,250,0.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(-PAD, 601); g.lineTo(960 + PAD, 601); g.stroke();
    }
    // the stage the heroes launch from
    const deck = g.createLinearGradient(0, 612, 0, 720);
    deck.addColorStop(0, "rgba(40,20,70,0.9)"); deck.addColorStop(1, "rgba(10,5,20,1)");
    g.fillStyle = deck; g.fillRect(-PAD, 612, VW, 108);
    for (let x = -PAD + 20; x < 960 + PAD; x += 48) glowDisc(g, x, 616, 14, V.glow, 0.35);
  }

  // ============================================================
  function create(api) {
    const c = api.ctx, { W, H, PAD, VIEW_W } = api, PY = G.PY;
    let s, acc = 0, heldT = 0, tally = 0, nextLife = 20000, shake = 0, flash = 0;
    const cache = {}, backdrops = {};

    function sprite(key, w, h, paint) {
      if (cache[key]) return cache[key];
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const g = cv.getContext("2d"); g.translate(w / 2, h / 2); paint(g);
      return (cache[key] = cv);
    }
    function blit(cv, x, y, ang = 0) {
      if (ang) { c.save(); c.translate(x, y); c.rotate(ang); c.drawImage(cv, -cv.width / 2, -cv.height / 2); c.restore(); }
      else c.drawImage(cv, x - cv.width / 2, y - cv.height / 2);
    }
    function backdrop(V) {
      if (backdrops[V.id]) return backdrops[V.id];
      const cv = document.createElement("canvas"); cv.width = VIEW_W; cv.height = H;
      const g = cv.getContext("2d"); g.translate(PAD, 0); paintVenue(g, V, PAD, VIEW_W);
      return (backdrops[V.id] = cv);
    }
    const shipSprite = (i, red) => sprite(`ship${red ? "r" : i}`, 60, 60, g => paintShip(g, HERO[i], red));

    function enemySprite(e) {
      const fast = e.state === "dive" ? 5 : 9, f3 = Math.floor(e.anim / fast) % 3, f2 = Math.floor(e.anim / (fast + 3)) % 2;
      switch (e.type) {
        case "bat": return sprite("bat" + f3, 72, 52, g => paintBat(g, f3));
        case "witch": return sprite("witch" + f2, 76, 76, g => paintWitch(g, f2));
        case "abductor": { const dmg = e.hp < 2; return sprite(`abd${f3}${dmg}`, 64, 52, g => paintAbductor(g, f3, dmg)); }
        case "gargoyle": { const cr = e.hp < 2; return sprite(`garg${f2}${cr}`, 74, 64, g => paintGargoyle(g, f2, cr)); }
        case "wraith": return sprite("wraith" + f2, 48, 56, g => paintWraith(g, f2));
        case "wisp": return sprite("wisp" + f2, 32, 38, g => paintWisp(g, f2));
        case "drone": return sprite("drone" + f3, 48, 52, g => paintDrone(g, f3));
        case "eyeball": return sprite("eye" + f2, 40, 52, g => paintEyeball(g, f2));
        case "turncoat": return shipSprite(0, true);
      }
    }

    // ---------- glue ----------
    function reset() { s = G.createState(api.level()); acc = 0; tally = 0; nextLife = 20000; heldT = 0; }
    function next() { s = G.createState(api.level(), { ally: s ? s.p.ally : 0 }); }
    function respawn() { G.respawn(s); }
    function handle(events) {
      for (const e of events) {
        switch (e.type) {
          case "score":
            api.score(e.n); tally += e.n;
            while (tally >= nextLife) { nextLife += 60000; api.addLife(); api.toast("EXTRA HERO SHIP"); api.chord([523, 659, 784, 1047]); }
            break;
          case "shoot": api.sweep(e.dual ? 1320 : 1020, 330, 0.1, "sawtooth", 0.045); break;
          case "kill": api.burst(e.x, e.y, KILL[e.enemy] || "#f0abfc", 22); api.burst(e.x, e.y, "#ffffff", 8); api.sweep(260, 65, 0.16, "square", 0.06); break;
          case "armor": api.burst(e.x, e.y, "#cbd5e1", 6); api.beep(620, 0.05, "square", 0.03); break;
          case "clang": api.burst(e.x, e.y, "#e2e8f0", 4); api.beep(1400, 0.03, "triangle", 0.025); break;
          case "shield": api.burst(e.x, e.y, "#a78bfa", 6); api.beep(900, 0.05, "sine", 0.03); break;
          case "die": api.burst(e.x, e.y, "#67e8f9", 48); api.burst(e.x, e.y, "#ffffff", 20); api.burst(e.x, e.y, "#fbbf24", 16); api.sweep(540, 70, 0.55, "sawtooth", 0.09); shake = 10; break;
          case "shipLost": api.burst(e.x, e.y, "#67e8f9", 30); api.sweep(420, 120, 0.35, "square", 0.08); api.toast(s.p.ally ? "ONE HERO SHIP LOST" : "BACK TO A SINGLE SHIP"); break;
          case "lose": case "gameover": api.lose(); break;
          case "captured": api.toast("HERO CAPTURED!"); api.sweep(180, 55, 0.8, "sawtooth", 0.08); break;
          case "beam": api.sweep(300, 900, 0.5, "sine", 0.04); break;
          case "rescue": api.toast("ABDUCTOR DOWN — CATCH YOUR HERO"); api.chord([392, 523, 659]); break;
          case "dual": api.toast(e.ships === 3 ? "TRIPLE HERO FIRE" : "DOUBLE HERO FIRE"); api.chord([523, 659, 784, 1047]); break;
          case "turncoat": api.toast("THE CAPTURED HERO HAS TURNED!"); api.sweep(700, 200, 0.4, "square", 0.06); break;
          case "captiveLost": api.burst(e.x, e.y, "#fb7185", 24); api.toast("CAPTURED SHIP DESTROYED"); break;
          case "split": api.beep(300, 0.08, "triangle", 0.04); break;
          case "warning": api.beep(210, 0.14, "triangle", 0.035); break;
          case "strike": api.burst(e.x, PY + 10, "#e0e7ff", 24); api.sweep(1800, 60, 0.4, "sawtooth", 0.09); flash = 10; shake = 6; break;
          case "bossHit": api.burst(e.x, e.y, "#fde68a", 4); api.beep(260, 0.04, "square", 0.03); break;
          case "turretDown": api.burst(e.x, e.y, "#fb923c", 30); api.sweep(300, 50, 0.4, "sawtooth", 0.08); api.toast("TURRET DESTROYED"); break;
          case "witchDown": api.burst(e.x, e.y, "#86efac", 34); api.toast("A WITCH FALLS — THE COVEN SPEEDS UP"); break;
          case "boom": api.burst(e.x, e.y, s.venue.accent, 26); api.beep(80, 0.2, "sawtooth", 0.06); shake = 6; break;
          case "bossDown": api.toast(`${s.venue.boss.name} DEFEATED`); api.chord([392, 523, 659, 784]); shake = 14; break;
          case "slam": shake = 8; api.sweep(120, 40, 0.3, "sawtooth", 0.08); break;
          case "shards": case "launch": case "hex": api.beep(340, 0.06, "square", 0.025); break;
          case "wake": case "open": api.sweep(200, 700, 0.3, "triangle", 0.04); break;
          case "stageClear": api.chord([523, 659, 784]); break;
          case "perfect": api.toast("PERFECT! 10,000 BONUS"); api.chord([523, 659, 784, 1047, 1319]); break;
          case "challengeEnd": api.beep(660, 0.15); break;
          case "next": api.next(); return;
        }
      }
    }
    function update(dt) {
      acc += Math.min(dt, 0.1);
      const held = api.down("Space", "ControlLeft", "ControlRight");
      let tapFire = api.tap("Space", "ControlLeft", "ControlRight");
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        heldT = held ? heldT + 1 : 0;
        const input = { move: (api.down("ArrowRight", "KeyD") ? 1 : 0) - (api.down("ArrowLeft", "KeyA") ? 1 : 0),
          fire: tapFire || (held && heldT % 12 === 0), lives: api.lives() };
        if (api.attract) Object.assign(input, G.autopilot(s));
        tapFire = false;
        const st = s;
        handle(G.step(s, input));
        if (s !== st) break;   // the stage changed under us
      }
      if (shake > 0) shake *= 0.86;
      if (flash > 0) flash--;
    }

    // ---------- rendering ----------
    function banner(title, sub, a, color) {
      if (a <= 0) return;
      c.save(); c.globalAlpha = Math.min(1, a);
      const y = 330, band = c.createLinearGradient(0, y - 60, 0, y + 50);
      band.addColorStop(0, "rgba(7,4,15,0)"); band.addColorStop(0.3, "rgba(7,4,15,0.8)"); band.addColorStop(0.7, "rgba(7,4,15,0.8)"); band.addColorStop(1, "rgba(7,4,15,0)");
      c.fillStyle = band; c.fillRect(-PAD, y - 60, VIEW_W, 110);
      c.textAlign = "center"; c.font = "800 40px Georgia, serif";
      c.fillStyle = color || s.venue.accent; c.shadowColor = c.fillStyle; c.shadowBlur = 20;
      c.fillText(title, 480, y); c.shadowBlur = 0;
      if (sub) { c.font = "600 18px Segoe UI, sans-serif"; c.fillStyle = "#ede9fe"; c.fillText(sub, 480, y + 32); }
      c.restore();
    }
    function label(t, x, y, size, color, align = "center") { c.font = `800 ${size}px Segoe UI, sans-serif`; c.textAlign = align; c.fillStyle = color; c.fillText(t, x, y); }

    function drawSky() {
      c.drawImage(backdrop(s.venue), -PAD, 0);
      const t = s.t;
      for (let i = 0; i < 70; i++) {                   // Galaga's scrolling star field
        const y = (hash(i, 7) * 600 + t * (0.6 + hash(i, 8) * 1.6)) % 600;
        c.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * 0.05 + i));
        c.fillStyle = ["#ffffff", "#a5f3fc", "#f0abfc", "#fde68a"][i % 4];
        c.fillRect(-PAD + hash(i, 6) * VIEW_W, y, 2, 2);
      }
      c.globalAlpha = 1;
      if (s.venue.id === "tower" && !api.reduced) {
        c.strokeStyle = "rgba(186,200,230,0.22)"; c.lineWidth = 1; c.beginPath();
        for (let i = 0; i < 60; i++) { const x = ((hash(i, 11) * VIEW_W + t * 3) % VIEW_W) - PAD, y = (hash(i, 12) * H + t * 14) % H; c.moveTo(x, y); c.lineTo(x - 4, y + 16); }
        c.stroke();
      }
      if (flash > 0) { c.fillStyle = `rgba(224,231,255,${flash * 0.03})`; c.fillRect(-PAD, 0, VIEW_W, H); }
    }

    function drawStrikes() {
      for (const k of s.strikes) {
        if (k.t < 60) {
          const pulse = 0.35 + 0.3 * Math.sin(k.t * 0.5);
          const col = c.createLinearGradient(0, 380, 0, PY + 40);
          col.addColorStop(0, "rgba(199,210,254,0)"); col.addColorStop(1, `rgba(199,210,254,${pulse * 0.35})`);
          c.fillStyle = col; c.fillRect(k.x - 26, 380, 52, PY + 40 - 380);
          c.strokeStyle = `rgba(224,231,255,${pulse + 0.2})`; c.lineWidth = 2;
          c.beginPath(); c.ellipse(k.x, PY + 26, 30, 8, 0, 0, 7); c.stroke();
        } else {
          const a = 1 - (k.t - 60) / 20;
          c.save(); c.shadowColor = "#c7d2fe"; c.shadowBlur = 30;
          c.strokeStyle = `rgba(224,231,255,${a})`; c.lineWidth = 7; c.lineJoin = "bevel";
          c.beginPath(); c.moveTo(k.x, 0);
          for (let y = 40; y <= PY + 30; y += 40) c.lineTo(k.x + (hash(y, k.x + (k.t >> 2)) - 0.5) * 36, y);
          c.stroke(); c.lineWidth = 2.5; c.strokeStyle = `rgba(255,255,255,${a})`; c.stroke(); c.restore();
        }
      }
    }

    function beamCone(x, y0, half, k, rgb) {
      const y1 = PY + 34;
      const gr = c.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, `rgba(${rgb},${0.55 * k})`); gr.addColorStop(1, `rgba(${rgb},${0.08 * k})`);
      c.fillStyle = gr;
      c.beginPath(); c.moveTo(x - 10, y0); c.lineTo(x + 10, y0); c.lineTo(x + half, y1); c.lineTo(x - half, y1); c.closePath(); c.fill();
      c.strokeStyle = `rgba(255,255,255,${0.35 * k})`; c.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const q = ((s.t * 0.02 + i / 5) % 1), yy = y1 - (y1 - y0) * q, hw = 10 + (half - 10) * (1 - q);
        c.beginPath(); c.ellipse(x, yy, hw, 5 + 4 * (1 - q), 0, 0, Math.PI); c.stroke();
      }
    }

    function drawEnemies() {
      // drone shield fields sit behind the formation
      s.enemies.forEach(e => {
        if (e.type !== "drone" || e.state !== "form") return;
        c.fillStyle = `rgba(192,132,252,${0.07 + 0.04 * Math.sin(s.t * 0.1)})`;
        c.strokeStyle = "rgba(192,132,252,0.25)"; c.lineWidth = 1.5;
        c.beginPath(); c.roundRect ? c.roundRect(e.x - 80, e.y - 60, 160, 120, 24) : c.rect(e.x - 80, e.y - 60, 160, 120); c.fill(); c.stroke();
      });
      for (const e of s.enemies) {
        if (e.state === "wait") continue;
        if (e.state === "beam") {
          if (e.bt < 40) { if ((e.bt >> 2) % 2) beamCone(e.x, e.y + 14, G.beamHalf(e), 0.3, "165,243,252"); }
          else beamCone(e.x, e.y + 14, G.beamHalf(e), Math.min(1, (e.bt - 40) / 12), "165,243,252");
        }
        const cv = enemySprite(e);
        const ang = e.type === "turncoat" ? e.ang + Math.PI : e.ang;
        blit(cv, e.x, e.y, ang);
        if (e.flash > 0 && e.flash % 2) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.7; blit(cv, e.x, e.y, ang); c.restore(); }
        if (e.captive) blit(shipSprite(0, true), e.x + Math.sin(e.ang) * -34, e.y - Math.cos(e.ang) * 34, e.ang + Math.PI);
      }
    }

    function drawBoss(b) {
      if (b.dying && (b.dying >> 2) % 2) return;
      const t = s.t, p = s.p;
      c.save();
      if (b.type === "queen") {
        if (b.state === "beam") {
          if (b.bt < 50) { if ((b.bt >> 2) % 2) beamCone(b.x, b.y + 30, 64, 0.35, "251,113,133"); }
          else beamCone(b.x, b.y + 30, 64, Math.min(1, (b.bt - 50) / 10), "251,113,133");
        }
        c.translate(b.x, b.y);
        glowDisc(c, 0, 20, 140, "103,232,249", 0.12);
        O(c, 0, 14, 124, 28, "#334155", 3);
        O(c, 0, 6, 122, 20, "#94a3b8", 3);
        O(c, 0, 1, 112, 9, "#cbd5e1", 0);
        for (let i = 0; i < 14; i++) {
          const a = i / 14 * Math.PI * 2 + t * 0.03, x = Math.cos(a) * 110, y = 14 + Math.sin(a) * 22;
          if (Math.sin(a) < 0) continue;
          c.fillStyle = i % 2 ? "#fde047" : "#f0abfc"; c.shadowColor = c.fillStyle; c.shadowBlur = 10;
          c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); c.shadowBlur = 0;
        }
        b.turrets.forEach(tu => {
          if (tu.hp <= 0) { O(c, tu.dx, 26, 10, 6, "#1c1917", 2); c.fillStyle = "rgba(120,113,108,0.5)"; c.beginPath(); c.arc(tu.dx + Math.sin(t * 0.1) * 4, 10 - (t % 40) * 0.6, 6, 0, 7); c.fill(); return; }
          const ang = Math.atan2(PY - (b.y + 26), p.x - (b.x + tu.dx));
          c.save(); c.translate(tu.dx, 26); c.rotate(ang);
          c.fillStyle = INK; c.fillRect(0, -3, 22, 6); c.restore();
          O(c, tu.dx, 26, 15, 11, tu.flash % 2 ? "#ffffff" : "#475569", 2.5);
          eyes(c, [[tu.dx, 26]], "#fb7185", 3);
        });
        c.save(); c.beginPath(); c.ellipse(0, -18, 48, 36, 0, Math.PI, 0); c.closePath(); c.clip();
        O(c, 0, -18, 48, 36, "rgba(165,243,252,0.22)", 0);
        const open = b.dome > 0.6;
        O(c, 0, -14, 22, 20, b.flash % 2 ? "#ffffff" : open ? "#86efac" : "#3f6212", 2.5);
        c.fillStyle = "#052e16"; c.beginPath(); c.ellipse(-8, -16, 5, 7, 0.4, 0, 7); c.ellipse(8, -16, 5, 7, -0.4, 0, 7); c.fill();
        P(c, [[-14, -30], [-10, -42], [-4, -32], [0, -46], [4, -32], [10, -42], [14, -30]], "#fbbf24", 2);
        const sh = b.dome * 46;                        // dome shutters slide apart
        P(c, [[-48 - sh, -18], [-sh, -54], [-sh, -18]], "#64748b", 2.5);
        P(c, [[48 + sh, -18], [sh, -54], [sh, -18]], "#64748b", 2.5);
        c.restore();
        c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -18, 48, 36, 0, Math.PI, 0); c.stroke();
        if (open) { c.shadowColor = "#86efac"; c.shadowBlur = 20; c.strokeStyle = "rgba(134,239,172,0.6)"; c.stroke(); c.shadowBlur = 0; }
      } else if (b.type === "colossus") {
        const stone = b.state === "perch" || b.state === "enter" || b.state === "enterBack";
        c.translate(b.x, b.y);
        if (b.state === "aim") {
          c.restore(); c.save();
          const col = c.createLinearGradient(0, b.y, 0, PY + 40);
          col.addColorStop(0, "rgba(251,146,60,0)"); col.addColorStop(1, `rgba(251,146,60,${0.25 + 0.15 * Math.sin(t * 0.6)})`);
          c.fillStyle = col; c.fillRect(b.x - 44, b.y, 88, PY + 40 - b.y);
          c.translate(b.x, b.y);
        }
        if (!stone) glowDisc(c, 0, 0, 120, "251,146,60", 0.18);
        c.scale(2.7, 2.7);
        if (b.state === "plunge") c.scale(0.8, 1.15);
        paintGargoyle(c, stone ? 0 : (t >> 4) % 2, b.hp < b.maxHp / 2, !stone);
        if (stone) { c.globalCompositeOperation = "source-atop"; }
        if (b.flash % 2) { c.globalCompositeOperation = "lighter"; paintGargoyle(c, 0, false, true); }
      } else if (b.type === "coven") {
        c.strokeStyle = "rgba(251,113,133,0.12)"; c.lineWidth = 2;
        c.beginPath(); c.ellipse(b.x, b.y, b.r * 1.5, b.r * 0.55, 0, 0, 7); c.stroke();
        const cx = b.x, cy = b.y + 12;
        glowDisc(c, cx, cy - 10, 70, "132,204,22", 0.25);
        P(c, [[cx - 40, cy - 16], [cx + 40, cy - 16], [cx + 34, cy + 22], [cx - 34, cy + 22]], "#111827", 3);
        O(c, cx, cy - 16, 42, 9, "#1f2937", 3);
        O(c, cx, cy - 16, 36, 6, "#84cc16", 0);
        for (let i = 0; i < 4; i++) { const bx = cx - 24 + i * 16, by = cy - 18 - ((t * 0.6 + i * 9) % 22); c.fillStyle = "rgba(217,249,157,0.8)"; c.beginPath(); c.arc(bx, by, 3, 0, 7); c.fill(); }
        b.witches.slice().sort((u, v) => u.y - v.y).forEach(w => {
          if (w.hp <= 0) return;
          const holder = b.witches[b.hex] === w;
          c.save(); c.translate(w.x, w.y);
          if (holder) {
            c.save(); c.rotate(t * 0.05); c.strokeStyle = "rgba(240,171,252,0.8)"; c.shadowColor = "#f0abfc"; c.shadowBlur = 16; c.lineWidth = 2.5;
            c.beginPath(); for (let k = 0; k <= 5; k++) { const a = k * Math.PI * 4 / 5; k ? c.lineTo(Math.cos(a) * 34, Math.sin(a) * 34) : c.moveTo(34, 0); } c.stroke();
            c.beginPath(); c.arc(0, 0, 36, 0, 7); c.stroke(); c.restore();
          }
          c.scale(1.6, 1.6);
          if (!holder) c.globalAlpha = 0.8;
          paintWitch(c, (t >> 4) % 2);
          if (w.flash % 2) { c.globalCompositeOperation = "lighter"; paintWitch(c, 0); }
          c.restore();
          c.fillStyle = "rgba(7,4,15,0.7)"; c.fillRect(w.x - 20, w.y + 34, 40, 5);
          c.fillStyle = holder ? "#f0abfc" : "#64748b"; c.fillRect(w.x - 20, w.y + 34, 40 * w.hp / (b.maxHp / 3), 5);
        });
      } else if (b.type === "deep") {
        b.lanes.forEach(l => {
          if (l.t < 50) {
            const pulse = 0.3 + 0.25 * Math.sin(t * 0.6);
            const col = c.createLinearGradient(0, 300, 0, PY + 40);
            col.addColorStop(0, "rgba(192,132,252,0)"); col.addColorStop(1, `rgba(192,132,252,${pulse * 0.5})`);
            c.fillStyle = col; c.fillRect(l.x - 30, 300, 60, PY + 40 - 300);
          }
          const reach = l.t < 50 ? 0.25 + Math.sin(l.t * 0.3) * 0.04 : l.t < 86 ? Math.min(1, (l.t - 50) / 5) : 1 - (l.t - 86) / 24;
          const tipY = b.y + 50 + (PY + 40 - b.y - 50) * Math.max(0, reach);
          c.strokeStyle = INK; c.lineWidth = 26; c.lineCap = "round";
          c.beginPath(); c.moveTo(b.x + (l.x - b.x) * 0.3, b.y + 50); c.quadraticCurveTo(l.x, b.y + 80, l.x, tipY); c.stroke();
          c.strokeStyle = "#6d28d9"; c.lineWidth = 20; c.stroke();
          c.fillStyle = "#e9d5ff";
          for (let y = b.y + 110; y < tipY - 10; y += 30) { c.beginPath(); c.arc(l.x + 5, y, 3.5, 0, 7); c.arc(l.x - 5, y + 15, 3.5, 0, 7); c.fill(); }
        });
        c.translate(b.x, b.y);
        for (let i = 0; i < 6; i++) {
          const bx = -110 + i * 44, wig = Math.sin(t * 0.05 + i) * 18;
          c.strokeStyle = INK; c.lineWidth = 13; c.lineCap = "round";
          c.beginPath(); c.moveTo(bx, 40); c.bezierCurveTo(bx + wig, 90, bx - wig, 120, bx + wig * 0.6, 150); c.stroke();
          c.strokeStyle = "#5b21b6"; c.lineWidth = 8; c.stroke();
        }
        glowDisc(c, 0, 0, 200, "167,139,250", 0.15);
        P(c, [[-150, 40], [-140, -20], [-90, -70], [0, -90], [90, -70], [140, -20], [150, 40], [80, 60], [0, 50], [-80, 60]], b.flash % 2 ? "#ffffff" : "#2e1065", 4);
        c.fillStyle = "#4c1d95";
        [[-80, -30, 14], [70, -40, 11], [-20, -60, 9], [110, 10, 8], [-120, 10, 7]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); });
        O(c, 0, 14, 34, 30, "#1e1b4b", 3);
        const lid = 1 - b.eye;
        O(c, 0, 14, 28, 26 * Math.max(0.08, b.eye), "#fef3c7", 0);
        if (b.eye > 0.1) {
          const lx = clamp((p.x - b.x) * 0.03, -10, 10);
          O(c, lx, 16, 14 * b.eye, 14 * b.eye, "#dc2626", 0);
          c.fillStyle = INK; c.beginPath(); c.ellipse(lx, 16, 3, 11 * b.eye, 0, 0, 7); c.fill();
        }
        c.fillStyle = "#2e1065";
        c.beginPath(); c.ellipse(0, 14 - 26 * (1 - lid * 0.5), 30, 26 * lid, 0, Math.PI, 0); c.fill();
        if (b.eye > 0.6) { c.shadowColor = "#fbbf24"; c.shadowBlur = 24; c.strokeStyle = "rgba(251,191,36,0.6)"; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 14, 30, 28, 0, 0, 7); c.stroke(); c.shadowBlur = 0; }
      }
      c.restore();
    }

    function drawBossBar(b) {
      const w = 380, x = 480 - w / 2, y = 12;
      c.fillStyle = "rgba(7,4,15,0.75)"; c.fillRect(x - 6, y - 4, w + 12, 30);
      c.fillStyle = "#2e1065"; c.fillRect(x, y + 14, w, 8);
      c.fillStyle = b.enraged ? "#f43f5e" : s.venue.accent; c.fillRect(x, y + 14, w * Math.max(0, b.hp / b.maxHp), 8);
      label(b.name + (b.enraged ? " · ENRAGED" : ""), 480, y + 10, 11, "#f5f3ff");
    }

    function draw() {
      if (!s) reset();
      const p = s.p, t = s.t;
      c.save();
      if (shake > 0.5 && !api.reduced) c.translate(Math.sin(t * 1.7) * shake * 0.6, Math.cos(t * 2.3) * shake * 0.5);
      drawSky();
      drawStrikes();
      drawEnemies();
      if (s.boss) drawBoss(s.boss);

      for (const q of s.bolts) {
        if (q.shard) { c.save(); c.translate(q.x, q.y); c.rotate(t * 0.3); P(c, [[0, -6], [5, 4], [-5, 4]], "#a8a29e", 1.5); c.restore(); continue; }
        const ang = Math.atan2(q.vy, q.vx);
        c.save(); c.translate(q.x, q.y); c.rotate(ang);
        c.shadowColor = "#f472b6"; c.shadowBlur = 12; c.fillStyle = "#f9a8d4";
        c.beginPath(); c.ellipse(0, 0, 8, 3.5, 0, 0, 7); c.fill();
        c.fillStyle = "#fff"; c.beginPath(); c.ellipse(2, 0, 3.5, 1.6, 0, 0, 7); c.fill();
        c.restore();
      }
      const xs = G.shipXs(p);
      for (const sh of s.shots) {
        const i = xs.length > 1 ? Math.max(0, xs.findIndex(x => Math.abs(x - sh.x) < 2)) : 0, col = HERO[i % 3];
        c.shadowColor = col; c.shadowBlur = 14; c.fillStyle = col;
        c.fillRect(sh.x - 2.5, sh.y - 12, 5, 22);
        c.fillStyle = "#fff"; c.fillRect(sh.x - 1, sh.y - 12, 2, 16);
      }
      c.shadowBlur = 0;

      if (s.rescue) { const r = s.rescue; blit(shipSprite(1, false), r.x, r.y, r.y < PY - 20 ? r.t * 0.25 : 0); }
      if (s.phase === "captured") {
        const by = s.enemies.find(e => e.id === s.capBy);
        if (by) {
          const q = Math.min(1, s.capT / 110), x = s.capX + (by.x - s.capX) * q, y = PY + (by.y - 34 - PY) * q;
          blit(shipSprite(0, q > 0.7), x, y, q * Math.PI * 6);
        }
      }
      const showShips = s.phase === "play" || s.phase === "intro" || s.phase === "clear" || s.phase === "result" || (s.phase === "ready" && (s.phaseT >> 3) % 2);
      if (showShips && !(p.inv > 0 && (p.inv >> 2) % 2)) xs.forEach((x, i) => blit(shipSprite(i, false), x, PY));

      c.font = "800 16px Segoe UI, sans-serif"; c.textAlign = "center";
      s.popups.forEach(q => { c.globalAlpha = Math.min(1, q.life / 20); c.fillStyle = "#fef9c3"; c.fillText(q.text, q.x, q.y); });
      c.globalAlpha = 1;
      c.restore();

      // HUD
      const info = s.info, V = s.venue;
      c.fillStyle = "rgba(7,4,15,0.55)"; c.fillRect(-PAD + 12, 10, 330, 26);
      label(`${V.name} · STAGE ${s.level}${info.cycle ? ` · CYCLE ${info.cycle + 1}` : ""}`, -PAD + 22, 28, 13, V.accent, "left");
      if (info.kind === "challenge") label(`HITS ${s.hits} / ${s.total}`, 960 + PAD - 22, 28, 15, "#fde68a", "right");
      for (let i = 0; i < Math.min(6, api.lives() - 1); i++) blit(shipSprite(0, false), -PAD + 34 + i * 40, 692);
      if (s.boss) drawBossBar(s.boss);

      const ph = s.phase;
      if (ph === "intro") {
        const a = Math.min(1, s.phaseT / 25, (150 - s.phaseT) / 20);
        if (info.kind === "boss") banner(`WARNING · ${V.boss.name}`, V.boss.sub, a * ((t >> 5) % 2 ? 1 : 0.75), "#fb7185");
        else if (info.kind === "challenge") banner("CHALLENGING STAGE", "Hit all 40. Nothing shoots back", a, "#fde68a");
        else if (info.stage === 0) banner((info.cycle ? `CYCLE ${info.cycle + 1} · ` : "") + V.name, V.sub, a);
        else banner(`STAGE ${s.level}`, V.name, a);
      } else if (ph === "ready") banner("READY", `${1 + p.ally > 1 ? "HERO SQUADRON" : "NEXT HERO SHIP"} LAUNCHING`, 1, "#67e8f9");
      else if (ph === "clear") banner(info.kind === "boss" ? "VENUE CLEARED" : "STAGE CLEAR", "", Math.min(1, s.phaseT / 20, (110 - s.phaseT) / 15));
      else if (ph === "result") {
        const a = Math.min(1, s.phaseT / 20, (210 - s.phaseT) / 15);
        banner(s.hits === s.total ? "PERFECT!" : `NUMBER OF HITS  ${s.hits}`, `BONUS  ${s.bonus.toLocaleString()}`, a, "#fde68a");
      } else if (ph === "captured") banner("HERO CAPTURED", "Shoot that abductor mid-dive to win your hero back", Math.min(1, s.capT / 20), "#fb7185");
      else if (ph === "ending" || ph === "over") banner("GAME OVER", "", Math.min(1, (150 - s.phaseT) / 30), "#fb7185");
    }

    reset();
    // current + jump() are for inspection in the browser (visual checks), not gameplay
    const inst = { reset, next, respawn, update, draw, attract: null, state: () => s, jump: level => { s = G.createState(level); } };
    G.current = inst;
    return inst;
  }

  G.create = create;
  G.paint = { paintBat, paintWitch, paintAbductor, paintGargoyle, paintWraith, paintWisp, paintDrone, paintEyeball, paintShip, paintVenue };
})(typeof window !== "undefined" ? window : globalThis);
