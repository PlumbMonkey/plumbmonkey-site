/* Amp Rampage — RENDERING + HOST GLUE.

   Draws the rules state from amp.js: the basement gig and its rig, the gear,
   the monsters, the Spaceman and Plumbmonkey from the Hero Kit, and the
   shared monsters from sprite-kit.js. Turns rule events into sound, particles,
   toasts and score. The host (wave3.js) owns score, lives, the HUD bar, music,
   pause and the leaderboard flow. Sets AmpGame.create. */
(function (root) {
  "use strict";
  const G = root.AmpGame, W = G.World, S = G.Stages;
  const INK = "#120b1e";

  function create(api) {
    const c = api.ctx, { H, PAD, VIEW_W } = api;
    const K = root.HeroKit, SK = root.SpriteKit;
    let s = null, acc = 0, shake = 0, flash = 0, popups = [], tally = 0, nextLife = 20000;
    const cache = {};

    // ---------- helpers ----------
    function P(pts, fill, lw = 2, stroke = INK) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (lw) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
    function O(x, y, rx, ry, fill, lw = 0, stroke = INK) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (lw) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
    function R(x, y, w, h, fill, lw = 0) { c.fillStyle = fill; c.fillRect(x, y, w, h); if (lw) { c.strokeStyle = INK; c.lineWidth = lw; c.strokeRect(x, y, w, h); } }
    function label(t, x, y, size, color, align = "center", font = "Segoe UI, sans-serif", weight = 800) { c.font = `${weight} ${size}px ${font}`; c.textAlign = align; c.fillStyle = color; c.fillText(t, x, y); }
    function glow(color, blur, fn) { c.save(); c.shadowColor = color; c.shadowBlur = blur; fn(); c.restore(); }
    const hash = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h ^= h >>> 13; return ((h >>> 0) % 1000) / 1000; };

    // ---------- glue ----------
    function reset() { s = G.createState(api.level()); acc = 0; popups = []; tally = 0; nextLife = 20000; }
    function next() { s = G.createState(api.level()); popups = []; }
    function respawn() { s = G.respawn(s); popups = []; }
    const TOASTS = { hammer: "MIC STAND — SMASH THE GEAR!", ignite: "THE AMP STACK IS ON FIRE", key: "KEY TAKEN — GET TO THE CAGE", hurry: "HURRY!",
      rigDone: "RIG COMPLETE!", bossFall: "PLUMBMONKEY TUMBLES!", collapse: "THE RIG IS COMING DOWN!" };
    function handle(events) {
      for (const e of events) {
        if (TOASTS[e.type]) api.toast(TOASTS[e.type]);
        switch (e.type) {
          case "score":
            api.score(e.n); tally += e.n;
            if (e.n >= 100) popups.push({ x: e.x, y: e.y, text: e.n.toLocaleString(), life: 50 });
            while (tally >= nextLife) { nextLife += 50000; api.addLife(); api.toast("EXTRA LIFE"); api.chord([523, 659, 784, 1047]); }
            break;
          case "jump": api.sweep(220, 640, 0.13, "triangle", 0.045); break;
          case "grab": api.beep(520, 0.05, "square", 0.025); break;
          case "grip2": api.beep(780, 0.05, "triangle", 0.025); break;
          case "hammer": api.chord([392, 523, 659, 784]); api.burst(e.x, e.y, "#d9ff63", 18); break;
          case "hammerEnd": api.sweep(700, 200, 0.2, "square", 0.03); break;
          case "smash": api.burst(e.x, e.y, e.what === "fire" ? "#fb923c" : "#fda4af", 22); api.burst(e.x, e.y, "#ffffff", 8); api.sweep(160, 45, 0.2, "sawtooth", 0.07); shake = Math.max(shake, 8); break;
          case "jumpBonus": api.beep(1175, 0.08, "triangle", 0.05); break;
          case "throw": api.sweep(180, 80, 0.2, "square", 0.05); break;
          case "warning": api.beep(200, 0.12, "triangle", 0.03); break;
          case "ladderDrop": api.sweep(420, 140, 0.18, "square", 0.035); break;
          case "bounce": api.beep(90, 0.06, "square", 0.03); break;
          case "ignite": api.burst(e.x, e.y, "#fb923c", 26); api.sweep(90, 300, 0.4, "sawtooth", 0.06); break;
          case "jack": api.beep(260, 0.07, "square", 0.025); break;
          case "cymbal": api.sweep(2400, 600, 0.35, "triangle", 0.035); break;
          case "crush": api.burst(e.x, e.y, "#fde68a", 18); api.sweep(300, 60, 0.18, "square", 0.05); break;
          case "pop": api.burst(e.x, e.y, "#94a3b8", 8); break;
          case "key": api.chord([659, 784, 988]); api.burst(e.x, e.y, "#fbbf24", 16); break;
          case "press": api.beep(330 + ((e.x | 0) % 4) * 40, 0.04, "square", 0.02); break;
          case "drop": api.sweep(500, 180, 0.25, "triangle", 0.04); break;
          case "land": if (e.x) { api.beep(110, 0.08, "square", 0.035); shake = Math.max(shake, 3); } break;
          case "stack": api.chord([262, 330, 392]); break;
          case "rigDone": api.chord([523, 659, 784, 1047]); api.burst(e.x, e.y - 40, "#d9ff63", 30); break;
          case "riders": api.toast(e.n > 1 ? `${e.n} MONSTERS RODE IT DOWN!` : "MONSTER RODE IT DOWN!"); break;
          case "feedback": api.sweep(60, 900, 0.35, "sawtooth", 0.06); flash = 6; shake = Math.max(shake, 5); break;
          case "stun": api.burst(e.x, e.y, "#67e8f9", 10); break;
          case "rivet": api.beep(1400, 0.05, "square", 0.04); api.beep(700, 0.08, "triangle", 0.03); api.burst(e.x, e.y, "#cbd5e1", 8); break;
          case "collapse": shake = 16; api.sweep(200, 40, 1.2, "sawtooth", 0.08); break;
          case "bossFall": api.sweep(900, 60, 1.0, "square", 0.06); break;
          case "clear": api.chord([392, 523, 659, 784]); break;
          case "die": api.sweep(520, 55, 0.8, "sawtooth", 0.08); shake = 10; api.burst(e.x, e.y, "#67e8f9", 24); break;
          case "lose": case "gameover": api.lose(); return;
          case "next": api.next(); return;
        }
      }
    }
    function update(dt) {
      if (!s) reset();
      acc += Math.min(dt, 0.1);
      let jump = api.tap("Space"), action = api.tap("KeyE", "KeyF", "ShiftLeft", "ShiftRight");
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        const input = { move: (api.down("ArrowRight", "KeyD") ? 1 : 0) - (api.down("ArrowLeft", "KeyA") ? 1 : 0),
          up: api.down("ArrowUp", "KeyW"), down: api.down("ArrowDown", "KeyS"), jump, action, lives: api.lives() };
        if (api.attract) Object.assign(input, G.autopilot(s, { horizon: 30, every: 8 }), { lives: 3 });
        jump = action = false;
        const st = s;
        handle(G.step(s, input));
        popups.forEach(q => { q.y -= 0.7; q.life--; });
        popups = popups.filter(q => q.life > 0);
        if (s !== st) break;
      }
      if (shake > 0) shake *= 0.87;
      if (flash > 0) flash--;
    }

    // ---------- backdrop ----------
    const ACCENT = { loadin: "#d9ff63", cables: "#67e8f9", build: "#fbbf24", rivets: "#fb7185" };
    function backdrop(kind) {
      if (cache["bg:" + kind]) return cache["bg:" + kind];
      const cv = document.createElement("canvas"); cv.width = VIEW_W; cv.height = H;
      const g = cv.getContext("2d");
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, kind === "cables" ? "#0b1830" : kind === "rivets" ? "#240b1a" : "#1a0d2b"); sky.addColorStop(1, "#05030a");
      g.fillStyle = sky; g.fillRect(0, 0, VIEW_W, H);
      for (let y = 40; y < H; y += 38) for (let x = -86; x < VIEW_W; x += 86) {
        const bx = x + (y % 76 ? 43 : 0);
        g.fillStyle = hash(x, y) > 0.5 ? "rgba(40,30,60,0.55)" : "rgba(30,22,46,0.55)"; g.fillRect(bx, y, 80, 32);
      }
      // speaker stacks either side of the play column
      for (const x0 of [8, VIEW_W - 138]) for (let k = 0; k < 4; k++) {
        const y = 250 + k * 110;
        g.fillStyle = "#17121f"; g.fillRect(x0, y, 130, 104);
        g.strokeStyle = "#2c2338"; g.lineWidth = 3; g.strokeRect(x0 + 3, y + 3, 124, 98);
        for (const [cx, cy, r] of [[x0 + 40, y + 40, 26], [x0 + 92, y + 40, 26], [x0 + 65, y + 82, 14]]) {
          g.fillStyle = "#0b0810"; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
          g.fillStyle = "#231a2e"; g.beginPath(); g.arc(cx, cy, r * 0.4, 0, 7); g.fill();
        }
      }
      if (kind === "cables") {                                       // background cable bundles
        g.strokeStyle = "rgba(20,40,70,0.9)"; g.lineWidth = 6;
        for (let i = 0; i < 14; i++) { const x = 160 + hash(i, 3) * 960; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 30, 300, x - 10, 720); g.stroke(); }
      }
      const top = g.createLinearGradient(0, 0, 0, 60); top.addColorStop(0, "#0a0710"); top.addColorStop(1, "#0a071000");
      g.fillStyle = top; g.fillRect(0, 0, VIEW_W, 60);
      const v = g.createRadialGradient(VIEW_W / 2, H * 0.45, H * 0.3, VIEW_W / 2, H * 0.45, H * 0.95);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
      g.fillStyle = v; g.fillRect(0, 0, VIEW_W, H);
      return (cache["bg:" + kind] = cv);
    }
    function lights() {
      if (api.reduced) return;
      const b = api.beat(), a = api.beatAccent(), col = ACCENT[s.kind];
      c.save(); c.globalCompositeOperation = "lighter";
      [120, 360, 600, 840].forEach((x, i) => {
        const k = 0.05 + 0.05 * Math.max(0, Math.sin(s.t * 0.02 + i)) + a * 0.07 + b * 0.02;
        const gr = c.createLinearGradient(0, 0, 0, 700);
        gr.addColorStop(0, i % 2 ? `rgba(192,132,252,${k})` : `rgba(103,232,249,${k})`); gr.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gr; c.beginPath(); c.moveTo(x - 8, 0); c.lineTo(x + 8, 0); c.lineTo(x + 150, 700); c.lineTo(x - 150, 700); c.closePath(); c.fill();
      });
      c.restore();
      // footlights along the stage lip
      for (let x = -PAD + 34; x < 960 + PAD; x += 78) {
        const k = Math.min(1.2, 0.3 + 0.35 * Math.sin(s.t * 0.04 + x / 90) + a * 0.5);
        glow(col, 8 + k * 10, () => O(x, 712, 4.5, 4.5, (x / 78 | 0) % 2 ? col : "#f0abfc"));
      }
    }

    // ---------- rig pieces ----------
    const fallOff = (i) => s.phase === "collapse" ? Math.pow(Math.max(0, (G.COLLAPSE - s.phaseT) - i * 8) / 10, 2) : 0;
    function girder(i, r, holes) {
      const drop = s.kind === "rivets" && i > 0 ? fallOff(6 - i) : 0;
      const y0 = r.y0 + drop, y1 = r.y1 + drop, len = Math.hypot(r.x1 - r.x0, y1 - y0), ang = Math.atan2(y1 - y0, r.x1 - r.x0);
      const hot = i % 2, deck = hot ? "#6d28d9" : "#3f4a5e", lip = hot ? "#c084fc" : "#9db0c9";
      c.save(); c.translate(r.x0, y0); c.rotate(ang);
      c.strokeStyle = "#2a2038"; c.lineWidth = 3; c.beginPath();
      for (let x = 0; x < len; x += 34) { const e = Math.min(len, x + 34); c.moveTo(x, 2); c.lineTo(e, 17); c.moveTo(e, 2); c.lineTo(x, 17); }
      c.stroke();
      c.fillStyle = "#241c33"; c.fillRect(0, 16, len, 4);
      c.fillStyle = deck; c.fillRect(0, -2, len, 7);
      c.fillStyle = lip; c.fillRect(0, -2, len, 2);
      c.restore();
      for (const h of holes) if (h.g === i) {
        const hy = r.y0 + (r.y1 - r.y0) * (h.x - r.x0) / (r.x1 - r.x0) + drop;
        c.fillStyle = "#07040c"; c.fillRect(h.x - W.HOLE, hy - 3, W.HOLE * 2, 24);
        c.fillStyle = "#fb7185"; c.fillRect(h.x - W.HOLE - 2, hy - 3, 3, 8); c.fillRect(h.x + W.HOLE - 1, hy - 3, 3, 8);
      }
    }
    function ladder(L) {
      const x = L.x, y1 = L.yBot, y0 = L.yTop, span = y1 - y0, rungs = Math.max(3, Math.round(span / 15));
      c.save();
      for (let k = 0; k <= rungs; k++) {
        if (L.broken && k > 1 && k < rungs - 1) continue;
        const y = y1 - k * span / rungs;
        R(x - 13, y - 2, 26, 4, "#b9c6d8");
      }
      for (const sx of [-15, 15]) {
        if (L.broken) { R(x + sx - 2, y0 - 2, 4, span * 0.25, "#5d6b80"); R(x + sx - 2, y1 - span * 0.25, 4, span * 0.25 + 2, "#5d6b80"); }
        else R(x + sx - 2, y0 - 4, 4, span + 6, "#5d6b80");
      }
      c.restore();
    }
    function flightCase(x0, x1, y) {
      R(x0, y, x1 - x0, 22, "#231c2c", 2);
      R(x0 + 2, y + 2, x1 - x0 - 4, 3, "#4b3f5c");
      [[x0, y], [x1 - 10, y], [x0, y + 12], [x1 - 10, y + 12]].forEach(([a, b]) => R(a, b, 10, 10, "#9aa3b2", 1.2));
    }
    function drumBarrel(x, y, spin, burning) {
      c.save(); c.translate(x, y - 14); c.rotate(spin);
      if (burning) glow("#67e8f9", 14, () => O(0, 0, 14, 14, "#1e3a5f", 2.5));
      else O(0, 0, 14, 14, "#b91c3c", 2.5);
      O(0, 0, 10, 10, burning ? "#67e8f9" : "#f5efe3", 1.5);
      c.strokeStyle = burning ? "#e0f2fe" : "#7a1830"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.moveTo(0, -6); c.lineTo(0, 6); c.stroke();
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; O(Math.cos(a) * 12, Math.sin(a) * 12, 1.3, 1.3, "#d9d9e0"); }
      c.restore();
    }
    function fireGhost(x, y, t) {
      const bob = Math.sin(t * 0.2) * 2;
      c.save(); c.translate(x, y + bob);
      glow("#fb923c", 14, () => P([[-12, 0], [-13, -14], [-6, -28], [-2, -20], [3, -34], [8, -18], [13, -12], [12, 0]], "#f97316", 2));
      P([[-8, -2], [-8, -12], [-2, -20], [4, -12], [8, -2]], "#fde047", 0);
      O(-4, -10, 2.2, 3, INK); O(4, -10, 2.2, 3, INK);
      c.restore();
    }
    function micStand(x, y, t) {
      c.save(); c.translate(x, y + Math.sin(t * 0.06) * 2);
      glow("#d9ff63", 12, () => { c.strokeStyle = "#9aa3b2"; c.lineWidth = 3.5; c.beginPath(); c.moveTo(0, -12); c.lineTo(0, 16); c.moveTo(-8, 16); c.lineTo(8, 16); c.stroke(); });
      O(0, -15, 6, 6, "#e2e8f0", 1.5);
      c.restore();
    }
    function fan(x, y, mood) {
      const t = s.t, cheer = mood === "cheer", bounce = Math.abs(Math.sin(t / (cheer ? 9 : 11))) * (cheer ? 7 : 4);
      c.save(); c.translate(x + (mood === "afraid" ? Math.sin(t * 0.8) : 0), y - bounce);
      c.strokeStyle = INK; c.lineWidth = 5; c.lineCap = "round";
      c.beginPath(); c.moveTo(-4, -14); c.lineTo(-6, 0); c.moveTo(4, -14); c.lineTo(6, 0); c.stroke();
      c.strokeStyle = "#f1c7a5"; c.lineWidth = 3; c.stroke();
      P([[-8, -34], [8, -34], [9, -14], [-9, -14]], "#ec4899", 2);
      const ay = cheer || mood === "afraid" ? -52 : -22;
      c.strokeStyle = INK; c.lineWidth = 4.5; c.beginPath(); c.moveTo(-7, -31); c.lineTo(-13, ay); c.moveTo(7, -31); c.lineTo(13, ay); c.stroke();
      c.strokeStyle = "#f1c7a5"; c.lineWidth = 2.5; c.stroke();
      O(0, -42, 8, 8.5, "#f1c7a5", 2);
      P([[-10, -42], [-9, -51], [0, -54], [9, -51], [10, -42], [6, -46], [-6, -46]], "#5b214e", 1.5);
      O(-3, -42, 1.2, 1.4, INK); O(3, -42, 1.2, 1.4, INK);
      c.restore();
    }
    function cage(x, y, open) {
      c.save();
      c.strokeStyle = open ? "#d9ff63" : "#94a3b8"; c.lineWidth = 3;
      c.strokeRect(x - 30, y - 70, 60, 70);
      if (!open) for (let bx = x - 20; bx <= x + 20; bx += 10) { c.beginPath(); c.moveTo(bx, y - 70); c.lineTo(bx, y); c.stroke(); }
      R(x - 34, y - 76, 68, 8, "#3f4a5e", 1.5);
      c.restore();
    }
    function snapJack(x, y, t) {
      const bite = (t >> 4) % 2;
      c.save(); c.translate(x, y);
      R(-13, -12, 26, 22, "#2a2230", 2);
      for (let k = -8; k <= 8; k += 4) R(k - 1, -9, 2, 10, "#15111a");
      P([[-12, 10], [12, 10], [10, 10 + (bite ? 8 : 3)], [-10, 10 + (bite ? 8 : 3)]], "#7f1d1d", 1.5);
      for (let k = -9; k <= 9; k += 4.5) P([[k - 2, 10], [k, 14], [k + 2, 10]], "#fff", 0);
      glow("#fb7185", 8, () => { O(-5, -3, 2, 2, "#fecdd3"); O(5, -3, 2, 2, "#fecdd3"); });
      c.restore();
    }
    function bat(x, y, t) {
      const up = (t >> 3) % 2;
      c.save(); c.translate(x, y);
      [-1, 1].forEach(d => P(up ? [[d * 4, -2], [d * 22, -14], [d * 17, -3], [d * 11, -2], [d * 7, 4]] : [[d * 4, -2], [d * 22, 8], [d * 16, 4], [d * 10, 8], [d * 6, 4]], "#5a2d4e", 1.8));
      O(0, 0, 7, 8, "#3a2146", 2);
      glow("#ffcf6a", 6, () => { R(-4, -3, 2.5, 2.5, "#ffd98a"); R(1.5, -3, 2.5, 2.5, "#ffd98a"); });
      c.restore();
    }
    function cymbal(x, y) {
      glow("#fde68a", 10, () => O(x, y, 18, 5, "#e5b94a", 2));
      O(x, y - 1, 5, 2, "#8e6f2a");
      R(x - 1, y - 12, 2, 8, "#9aa3b2");
    }
    function part(q) {
      const w = S.PART_W, x0 = q.x - w / 2;
      for (let k = 0; k < 4; k++) {
        const sag = q.state === "rest" && q.pressed[k] ? 5 : 0, x = x0 + k * S.SLICE, y = q.y + sag;
        c.save(); c.beginPath(); c.rect(x, y - 30, S.SLICE + 0.5, 34); c.clip();
        drawPartShape(q.kind, x0, y);
        c.restore();
      }
    }
    function drawPartShape(kind, x0, y) {
      const w = S.PART_W;
      if (kind === "cab") { R(x0 + 2, y - 22, w - 4, 20, "#1c1720", 2); for (let k = 0; k < 4; k++) O(x0 + 16 + k * 27, y - 12, 9, 7, "#0b0810", 1.2); }
      else if (kind === "drum") { R(x0 + 6, y - 20, w - 12, 18, "#9f1239", 2); R(x0 + 6, y - 20, w - 12, 4, "#fda4af"); R(x0 + 6, y - 6, w - 12, 3, "#fbbf24"); }
      else if (kind === "head") { R(x0 + 4, y - 18, w - 8, 16, "#2a2230", 2); R(x0 + 10, y - 14, w - 20, 5, "#c9a24a"); for (let k = 0; k < 5; k++) glow("#ffb347", 6, () => O(x0 + 22 + k * 17, y - 5, 2, 2, "#ffe0a0")); }
      else { R(x0 + 8, y - 8, w - 16, 6, "#3f4a5e", 1.5); for (let k = 0; k < 3; k++) glow("#67e8f9", 10, () => O(x0 + 28 + k * 28, y - 14, 7, 6, "#cffafe", 1.5)); }
    }

    // ---------- stages ----------
    function drawGirderStage() {
      const collapsing = s.phase === "collapse" || (s.kind === "rivets" && s.phase === "clear");
      s.geo.girders.forEach((r, i) => girder(i, r, s.holes));
      if (!collapsing) s.geo.ladders.forEach(ladder);          // the ladders come down with the rig
      if (s.rivets) for (const r of s.rivets) if (!r.pulled || r.pending) {
        const yy = W.gy(s.geo, r.g, r.x);
        glow("#fbbf24", 8, () => { O(r.x, yy + 2, 7, 7, "#c9ced8", 2); R(r.x - 4, yy + 1, 8, 2, "#52525b"); });
      }
      if (!collapsing) for (const h of s.hammers) if (!h.taken) micStand(h.x, h.y, s.t + h.x);
      if (s.drum) {
        const d = s.drum;
        R(d.x - 26, d.y - 50, 52, 50, "#1c1720", 2); O(d.x, d.y - 26, 14, 14, "#0b0810", 1.5);
        const hgt = d.lit > 0 ? 40 : 14 + Math.sin(s.t * 0.3) * 4;
        glow("#fb923c", 16, () => P([[d.x - 20, d.y - 50], [d.x - 12, d.y - 50 - hgt], [d.x - 2, d.y - 54], [d.x + 8, d.y - 50 - hgt * 0.8], [d.x + 20, d.y - 50]], "#f97316", 0));
      }
      for (const r of s.barrels || []) drumBarrel(r.x, r.y, r.spin, r.burning);
      for (const f of s.fires) if (!f.gone) fireGhost(f.x, f.y, s.t + f.x);
    }
    function drawCables() {
      const D = s.def;
      D.cables.forEach(cb => {
        c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(cb.x, cb.top - 20); c.lineTo(cb.x, cb.bottom); c.stroke();
        c.strokeStyle = "#475569"; c.lineWidth = 3; c.stroke();
        for (let y = cb.top; y < cb.bottom; y += 18) R(cb.x - 1.5, y, 3, 8, "#94a3b8");
        R(cb.x - 5, cb.top - 24, 10, 6, "#9aa3b2", 1.2);
      });
      D.platforms.forEach(pl => flightCase(pl.x0, pl.x1, pl.y));
      const pit = c.createLinearGradient(0, D.pit - 10, 0, 720);
      pit.addColorStop(0, "rgba(103,232,249,0)"); pit.addColorStop(1, `rgba(103,232,249,${0.3 + 0.1 * Math.sin(s.t * 0.1)})`);
      c.fillStyle = pit; c.fillRect(-PAD, D.pit - 10, VIEW_W, 730 - D.pit);
      for (const cy of s.cymbals) if (cy.state !== "gone") cymbal(cy.x, cy.y);
      for (const j of s.jacks) if (!j.dead || (j.dead >> 2) % 2) snapJack(j.x, j.y, s.t);
      for (const b of s.bats) if (!b.dead) bat(b.x, b.y, s.t);
      if (!s.key.taken) glow("#fbbf24", 14, () => { O(s.key.x, s.key.y - 24, 6, 6, "#fbbf24", 2); R(s.key.x - 1.5, s.key.y - 18, 3, 14, "#fbbf24"); R(s.key.x, s.key.y - 10, 6, 3, "#fbbf24"); });
      fan(s.cage.x, s.cage.y, s.phase === "clear" ? "cheer" : "afraid");
      cage(s.cage.x, s.cage.y, s.phase === "clear");
    }
    function drawBuild() {
      s.geo.girders.forEach((r, i) => girder(i, r, []));
      s.geo.ladders.forEach(ladder);
      const D = s.def;
      D.stacks.forEach(x => { R(x - 64, D.tray, 128, 10, "#3f4a5e", 2); R(x - 60, D.tray + 10, 120, 4, "#1c1720"); });
      for (const q of s.parts) part(q);
      for (const f of s.foes) {
        if (f.state === "dead") continue;
        c.save();
        if (f.stun > 0) c.globalAlpha = 0.55 + 0.3 * Math.sin(s.t * 0.5);
        c.translate(f.x, f.y - 22); c.scale(f.face < 0 ? -1 : 1, 1);
        const name = f.type === "witch" ? "witch" : f.type === "ghost" ? "ghost" : "frank";
        SK.draw(c, name, 0, name === "ghost" ? -4 : 0, { t: s.t / 60, scale: name === "witch" ? 0.62 : 0.56, stomp: Math.sin(f.t * 0.15), prop: false });
        c.restore();
        if (f.stun > 0) for (let i = 0; i < 3; i++) { const a = s.t * 0.15 + i * 2.1; glow("#67e8f9", 8, () => O(f.x + Math.cos(a) * 16, f.y - 52 + Math.sin(a) * 4, 2.5, 2.5, "#cffafe")); }
      }
      fan(D.boss.x + 110, D.boss.y + 4, s.phase === "clear" ? "cheer" : "afraid");
      cage(D.boss.x + 110, D.boss.y + 4, s.phase === "clear");
    }

    function drawBoss() {
      const b = s.boss;
      if (!b) return;
      let pose = b.pose || "idle", phase = s.t * 0.12, x = b.x, y = b.y;
      if (pose === "throw") phase = (1 - Math.max(0, b.throwT) / 42) * Math.PI * 2;
      if (s.kind === "rivets" && s.phase === "collapse") {
        const k = G.COLLAPSE - s.phaseT;
        pose = k < 90 ? "hit" : "defeat"; phase = Math.min(Math.PI, (k - 90) / 20);
        if (k > 90) y += Math.pow((k - 90) / 12, 2);
      }
      if (s.phase === "clear") { pose = s.kind === "rivets" ? "dizzy" : "horns"; phase = s.t * 0.15; if (s.kind === "rivets") y = 690; }
      K.plumbmonkey(c, x, y, { pose, phase, face: b.face || 1, scale: 0.82, rage: s.cycle > 0 });
      if (s.kind === "loadin" && pose === "throw" && b.throwT > 4 && b.throwT <= 42) drumBarrel(x + 26, y - 88, 0, false);
      if (s.fan && s.phase !== "collapse") {
        fan(s.fan.x, s.fan.y, s.phase === "clear" ? "cheer" : "afraid");
        if (s.kind === "loadin") glow("#f0abfc", 10, () => label("HELP!", s.fan.x, s.fan.y - 66, 13, "#f0abfc"));
      }
    }

    function drawHero() {
      const p = s.p;
      let pose = "idle", phase = s.t * 0.05;
      if (p.state === "dead") { pose = "death"; phase = (G.DYING - s.phaseT) * 0.15; }
      else if (s.phase === "clear") { pose = "victory"; phase = s.t * 0.1; }
      else if (p.state === "climb") { pose = "climb"; phase = p.climb * 0.12; }
      else if (p.state === "hang") { pose = p.grip === 2 ? "hang2" : "hang"; phase = p.climb * 0.1 + s.t * 0.03; }
      else if (p.state === "air") pose = p.vy < 0 ? "jump" : "fall";
      else if (p.hammer > 0) { pose = "smash"; phase = s.t * 0.28; }
      else if (Math.abs(p.vx) > 0.1) { pose = p.key ? "carry" : "run"; phase = p.dist * 0.1; }
      c.save();
      if (p.hammer > 0 && p.hammer < 120 && (s.t >> 3) % 2) c.globalAlpha = 0.75;
      K.spaceman(c, p.x, p.y, { pose, phase, face: p.face, scale: 0.85, hammer: p.hammer > 0 && p.state !== "dead" });
      c.restore();
      if (p.key && p.state !== "dead") glow("#fbbf24", 10, () => { O(p.x - 6 * p.face, p.y - 30, 3.5, 3.5, "#fbbf24", 1.2); R(p.x - 6 * p.face - 1, p.y - 27, 2, 8, "#fbbf24"); });
      if (p.hammer > 0 && p.state !== "dead") { R(p.x - 18, p.y - 70, 36, 4, "rgba(7,4,15,0.7)"); R(p.x - 18, p.y - 70, 36 * p.hammer / 600, 4, "#d9ff63"); }
    }

    // ---------- HUD ----------
    function banner(title, sub, a, color) {
      if (a <= 0) return;
      c.save(); c.globalAlpha = Math.min(1, a);
      const y = 330, band = c.createLinearGradient(0, y - 70, 0, y + 56);
      band.addColorStop(0, "rgba(7,4,15,0)"); band.addColorStop(0.3, "rgba(7,4,15,0.82)"); band.addColorStop(0.7, "rgba(7,4,15,0.82)"); band.addColorStop(1, "rgba(7,4,15,0)");
      c.fillStyle = band; c.fillRect(-PAD, y - 70, VIEW_W, 126);
      c.shadowColor = color; c.shadowBlur = 20; label(title, 480, y, 44, color, "center", "Georgia, serif"); c.shadowBlur = 0;
      if (sub) label(sub, 480, y + 34, 18, "#ede9fe", "center", "Segoe UI, sans-serif", 600);
      c.restore();
    }
    function hud() {
      const col = ACCENT[s.kind];
      c.fillStyle = "rgba(7,4,15,0.65)"; c.fillRect(-PAD + 12, 10, 300, 30);
      label(`STAGE ${s.n} · ${s.def.name}${s.cycle ? ` · LOOP ${s.cycle + 1}` : ""}`, -PAD + 24, 31, 14, col, "left");
      const hurry = s.bonus <= 1000 && (s.t >> 4) % 2;
      c.fillStyle = "rgba(7,4,15,0.65)"; c.fillRect(960 + PAD - 170, 10, 158, 44);
      c.strokeStyle = hurry ? "#fb7185" : col; c.lineWidth = 2; c.strokeRect(960 + PAD - 170, 10, 158, 44);
      label("BONUS", 960 + PAD - 91, 26, 11, "#cbd5e1");
      label(s.bonus.toLocaleString(), 960 + PAD - 91, 48, 20, hurry ? "#fb7185" : "#fef9c3");
      if (s.kind === "build") {
        label("FEEDBACK", -PAD + 24, 62, 11, "#cbd5e1", "left");
        for (let i = 0; i < s.charges; i++) glow("#67e8f9", 8, () => O(-PAD + 100 + i * 16, 58, 5, 5, "#67e8f9"));
      }
    }

    function draw() {
      if (!s) reset();
      c.save();
      if (shake > 0.5 && !api.reduced) c.translate(Math.sin(s.t * 1.7) * shake * 0.6, Math.cos(s.t * 2.3) * shake * 0.5);
      c.drawImage(backdrop(s.kind), -PAD, 0);
      lights();
      if (s.kind === "cables") drawCables();
      else if (s.kind === "build") drawBuild();
      else drawGirderStage();
      drawBoss();
      drawHero();
      c.font = "800 15px Segoe UI, sans-serif"; c.textAlign = "center";
      popups.forEach(q => { c.globalAlpha = Math.min(1, q.life / 15); c.fillStyle = "#fef9c3"; c.fillText(q.text, q.x, q.y); });
      c.globalAlpha = 1;
      if (flash > 0) { c.fillStyle = `rgba(165,243,252,${flash * 0.04})`; c.fillRect(-PAD, 0, VIEW_W, H); }
      c.restore();
      hud();
      const col = ACCENT[s.kind];
      if (s.phase === "intro") banner(`STAGE ${s.n} · ${s.def.name}`, s.def.sub, Math.min(s.phaseT / 20, (G.INTRO - s.phaseT) / 20 + 0.2), col);
      else if (s.phase === "clear") banner(s.kind === "rivets" ? "THE RIG COMES DOWN!" : s.kind === "build" ? "FOUR RIGS STACKED" : "FAN RESCUED", `Bonus ${s.def ? s.bonus.toLocaleString() : ""}`, Math.min(1, (G.CLEAR - s.phaseT) / 20), "#fde68a");
      else if (s.phase === "ending" || s.phase === "over") banner("GAME OVER", "", Math.min(1, (G.ENDING - s.phaseT) / 30), "#fb7185");
    }

    reset();
    // current + jump() are for inspection in the browser (visual checks), not gameplay
    const inst = { reset, next, respawn, update, draw, attract: null, state: () => s, jump: n => { s = G.createState(n); s.phase = "play"; } };
    G.current = inst;
    return inst;
  }

  G.create = create;
})(typeof window !== "undefined" ? window : globalThis);
