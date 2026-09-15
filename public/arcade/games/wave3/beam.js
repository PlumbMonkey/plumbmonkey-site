/* Beam Me Up: Live! — RULES (no drawing; beam-art.js renders and wires the host).

   Galaga, played at the manor. Every stage number maps to a venue and a stage
   kind: two formation waves, a SURVIVAL round (flyers loop their patterns and
   shoot back until a 30-second clock runs out) and a BOSS. Formation waves keep the capture mechanic: an abductor
   dives, parks and lowers its tractor beam; a hero caught in it is carried back
   to the formation. Shoot that abductor while it is DIVING and the hero flies
   back to join you (double, then triple fire); shoot it in formation and the
   hero turns and attacks you.

   Everything here runs on fixed 1/60 s frames. step(s, input) returns events
   ({type, ...}) that the renderer turns into sound, particles and score. */
(function (root) {
  "use strict";
  const DATA = typeof module !== "undefined" && module.exports ? require("./beam-data.js") : root.BeamData;
  const { VENUES, ENTRY, SURVIVAL } = DATA;

  const W = 960, H = 720, PY = 652;
  const INTRO = 150, CLEAR = 110, RESULT = 210, DYING = 80, ENDING = 150, READY = 90, CAPTURE = 110;
  const SURVIVE = 1800;   // the survival round's clock: 30 s of play
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  const TYPES = {
    bat:      { hp: 1, pts: 50,  dive: 100,  r: 16 },
    witch:    { hp: 1, pts: 80,  dive: 160,  r: 17 },
    abductor: { hp: 2, pts: 150, dive: 400,  r: 20 },
    gargoyle: { hp: 2, pts: 100, dive: 200,  r: 18 },
    wraith:   { hp: 1, pts: 120, dive: 240,  r: 17 },
    drone:    { hp: 1, pts: 200, dive: 200,  r: 15 },
    wisp:     { hp: 1, pts: 60,  dive: 60,   r: 12 },
    eyeball:  { hp: 1, pts: 100, dive: 150,  r: 13 },
    turncoat: { hp: 1, pts: 500, dive: 1000, r: 16 }
  };

  // ---------- flight paths ----------
  const pathCache = {};
  function path(points, mirror) {
    const id = JSON.stringify(points) + (mirror ? "m" : "");
    if (pathCache[id]) return pathCache[id];
    const P = points.map(([x, y]) => [mirror ? W - x : x, y]), pts = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let k = 0; k < 12; k++) {
        const t = k / 12, t2 = t * t, t3 = t2 * t;
        const f = j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
        pts.push([f(0), f(1)]);
      }
    }
    pts.push(P[P.length - 1]);
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return (pathCache[id] = { pts, len, total: len[len.length - 1] });
  }
  function along(pa, d) {
    if (d >= pa.total) { const q = pa.pts[pa.pts.length - 1]; return [q[0], q[1], true]; }
    let i = 1;
    while (pa.len[i] < d) i++;
    const k = (d - pa.len[i - 1]) / ((pa.len[i] - pa.len[i - 1]) || 1), a = pa.pts[i - 1], b = pa.pts[i];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, false];
  }
  // move to (x,y) and turn to face the direction of travel (sprites face DOWN at ang 0)
  function face(e, x, y) {
    const dx = x - e.x, dy = y - e.y;
    if (dx || dy) e.ang = Math.atan2(dy, dx) - Math.PI / 2;
    e.x = x; e.y = y;
  }

  // ---------- stage setup ----------
  function stageInfo(level) {
    const i = Math.max(0, level - 1);
    return { cycle: Math.floor(i / 16), venue: Math.floor(i / 4) % 4, stage: i % 4, kind: i % 4 === 2 ? "survival" : i % 4 === 3 ? "boss" : "wave" };
  }
  let uid = 0;
  function makeEnemy(type, o) {
    return Object.assign({ id: ++uid, type, hp: TYPES[type].hp, x: -300, y: -300, ang: 0, anim: Math.random() * 60,
      state: "wait", t: 0, dist: 0, speed: 7, flash: 0, row: 0, col: 0 }, o);
  }
  function slotPos(s, row, col) {
    const b = s.breathe || 0;
    return [480 + (col - 4.5) * (58 + b * 9), 96 + row * (50 + b * 4)];
  }

  function createState(level = 1, carry) {
    const info = stageInfo(level), venue = VENUES[info.venue];
    const s = {
      level, info, venue, t: 0, phase: "intro", phaseT: INTRO,
      diff: Math.min(1, (level - 1) / 14) + info.cycle * 0.35,
      p: { x: 480, ally: (carry && carry.ally) || 0, inv: 0, cd: 0 },
      enemies: [], shots: [], bolts: [], popups: [], strikes: [],
      hazardT: 360, diveT: 240, breathe: 0, boss: null, rescue: null,
      capBy: 0, capT: 0, capX: 480, hits: 0, total: 0, bonus: 0, playT: 0,
      surviveT: info.kind === "survival" ? SURVIVE : 0, streakT: 0, deaths: 0, secs: 0
    };
    if (info.kind === "wave") buildFormation(s);
    else if (info.kind === "survival") buildSurvival(s);
    else s.boss = createBoss(s);
    return s;
  }

  function buildFormation(s) {
    const V = s.venue, spd = 6.5 + 1.5 * Math.min(s.diff, 1.5);
    const cols = [[3, 4, 5, 6], [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]];
    const slots = [];
    cols.forEach((cs, row) => cs.forEach(col => {
      let type = V.rows[row];
      if (type === "drone" && col % 3 !== 0) type = "bat";
      slots.push({ row, col, type });
    }));
    const take = f => { const out = []; for (let i = slots.length - 1; i >= 0; i--) if (f(slots[i])) out.unshift(slots.splice(i, 1)[0]); return out; };
    // Galaga's order: centre bats from the top, then abductors + witches from
    // the lower left, witches from the lower right, then the outer bats.
    const groups = [take(q => q.row >= 3 && q.col >= 3 && q.col <= 6), take(q => q.row === 0 || (q.row === 1 && q.col <= 4)), take(q => q.row === 1 || (q.row === 2 && q.col <= 4))];
    while (slots.length) groups.push(slots.splice(0, 8));
    groups.forEach((g, gi) => {
      const top = gi % 2 === 0;
      g.forEach((q, i) => {
        const mirror = top ? i % 2 === 1 : gi === 3;
        s.enemies.push(makeEnemy(q.type, { row: q.row, col: q.col, t: 20 + gi * 140 + (top ? Math.floor(i / 2) * 10 : i * 9),
          path: path(ENTRY[top ? "top" : "bottom"], mirror), speed: spd }));
      });
    });
    s.total = s.enemies.length;
  }

  function buildSurvival(s) {
    const pats = SURVIVAL[s.info.venue], types = ["bat", "witch", "bat", s.venue.rows[1], "witch"];
    for (let g = 0; g < 5; g++) for (let i = 0; i < 8; i++) {
      const mirror = g === 2 ? i % 2 === 1 : g >= 3;
      s.enemies.push(makeEnemy(types[g], { survivor: true, hp: 1, group: g, t: 30 + g * 190 + (g === 2 ? Math.floor(i / 2) * 10 : i * 8),
        path: path(pats[g % 2], mirror), speed: 7 + 1.5 * Math.min(s.diff, 1) }));
    }
    s.total = 40;
  }

  // ---------- helpers ----------
  function shipXs(p) {
    const n = 1 + p.ally;
    return (n === 1 ? [0] : n === 2 ? [-19, 19] : [-38, 0, 38]).map(o => p.x + o);
  }
  function isDiving(e) { return e.state === "dive" || e.state === "beamdown" || e.state === "beam" || e.state === "beamup"; }
  function beamHalf(e) { return 22 + (PY - e.y) * 0.14; }
  function fireFrom(s, x, y, dvx = 0) {
    const vy = 5.6 + 1.4 * Math.min(s.diff, 2), tt = Math.max(20, (PY - y) / vy);
    s.bolts.push({ x, y, vx: clamp((s.p.x - x) / tt, -3, 3) + dvx, vy });
  }
  function startDive(s, e, leader) {
    e.state = "dive"; e.dphase = "loop"; e.dt = 0;
    e.side = e.x < 480 ? -1 : 1; e.cx = e.x + e.side * 42; e.cy = e.y; e.a0 = e.side > 0 ? Math.PI : 0;
    e.shotsLeft = e.type === "bat" ? 1 : 2; e.vx = 0; e.vy = 0; e.leader = leader || 0;
  }
  function startSwoop(e, vx) { e.state = "dive"; e.dphase = "swoop"; e.dt = 0; e.vx = vx; e.vy = 2; e.shotsLeft = 1; e.noSlot = true; }
  function shielded(s, e) {
    return e.type !== "drone" && e.state === "form" &&
      s.enemies.some(o => o.type === "drone" && !o.gone && o.state === "form" && Math.abs(o.col - e.col) <= 1 && Math.abs(o.row - e.row) <= 1);
  }
  function popup(s, text, x, y) { s.popups.push({ text, x, y, life: 50 }); }

  // ---------- enemies ----------
  function scheduleDives(s, input) {
    const d = s.diff, p = s.p;
    const settled = !s.enemies.some(e => e.state === "wait" || e.state === "enter" || e.state === "home");
    s.breathe += ((settled ? 0.5 + 0.5 * Math.sin(s.t * 0.035) : 0) - s.breathe) * 0.05;
    if (s.phase !== "play" || s.playT < 330) return;
    if (--s.diveT > 0) return;
    const left = s.enemies.length, form = s.enemies.filter(e => e.state === "form" && !(e.restT > 0));
    const diving = s.enemies.filter(isDiving).length, maxD = left <= 6 ? 3 : 2 + Math.floor(1.6 * Math.min(d, 2));
    if (form.length && diving < maxD) {
      const ab = form.filter(e => e.type === "abductor");
      if (ab.length && Math.random() < 0.35) {
        const e = ab[Math.floor(Math.random() * ab.length)];
        const canBeam = !e.captive && !s.enemies.some(o => o.captive || o.state.startsWith("beam")) && !s.rescue &&
          p.ally === 0 && (input.lives ?? 3) > 1 && Math.random() < 0.55;
        if (canBeam) { e.state = "beamdown"; e.tx = clamp(p.x, 120, 840); e.ty = 410; }
        else {
          startDive(s, e);
          form.filter(o => o.row === 1 && Math.abs(o.col - e.col) <= 1).slice(0, 2).forEach(o => startDive(s, o, e.id));
        }
      } else {
        const pool = form.filter(e => e.type !== "abductor");
        if (pool.length) startDive(s, pool[Math.floor(Math.random() * pool.length)]);
      }
    }
    s.diveT = left <= 6 ? 55 : Math.max(35, Math.round(150 - 55 * Math.min(d, 2) - rnd(0, 40)));
    if (d > 0.4 && form.length && Math.random() < 0.25 * d) fireFrom(s, ...(() => { const e = form[Math.floor(Math.random() * form.length)]; return [e.x, e.y + 14]; })());
  }

  function updateEnemy(s, e, ev) {
    e.anim++;
    if (e.flash > 0) e.flash--;
    const p = s.p;
    switch (e.state) {
      case "wait":
        if (--e.t <= 0) e.state = "enter";
        break;
      case "enter": {
        e.dist += e.speed;
        const [x, y, done] = along(e.path, e.dist);
        face(e, x, y);
        if (e.survivor) {
          // every pattern starts and ends off-screen, so looping it is seamless
          if (done) e.dist = 0;
          if (s.phase === "play" && e.y > 110 && e.y < 470 && s.bolts.length < 3 + Math.round(2 * Math.min(s.diff, 1)) && Math.random() < 0.003) fireFrom(s, e.x, e.y + 14);
        } else if (done) e.state = "home";
        break;
      }
      case "flee":
        e.fleeV = Math.min(12, (e.fleeV || 2) + 0.5);
        face(e, e.x, e.y - e.fleeV);
        if (e.y < -40) e.gone = true;
        break;
      case "home":
      case "return": {
        const [tx, ty] = slotPos(s, e.row, e.col), dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy), sp = Math.max(3.5, e.speed * 0.8);
        if (d <= sp) { e.x = tx; e.y = ty; e.state = "form"; e.restT = 90; }   // a short rest before it can dive again
        else face(e, e.x + dx / d * sp, e.y + dy / d * sp);
        break;
      }
      case "form": {
        const [tx, ty] = slotPos(s, e.row, e.col);
        e.x = tx; e.y = ty; e.ang *= 0.8;
        if (e.restT > 0) e.restT--;
        break;
      }
      case "dive":
        if (e.dphase === "loop") {
          const k = Math.min(1, ++e.dt / 34), a = e.a0 + e.side * k * 1.5 * Math.PI;
          face(e, e.cx + Math.cos(a) * 42, e.cy + Math.sin(a) * 42);
          if (k >= 1) { e.dphase = "swoop"; e.vx = -e.side * 2.2; e.vy = 2.5; }
        } else {
          e.dt++;
          e.vy = Math.min(4.6 + 1.6 * Math.min(s.diff, 2), e.vy + 0.12);
          e.vx = clamp(e.vx + clamp((p.x - e.x) * 0.0035, -0.22, 0.22), -4.2, 4.2);
          let nx = e.x + e.vx;
          if (e.type === "bat" || e.type === "wisp" || e.type === "eyeball") nx += Math.sin(e.dt * 0.11) * 2.2;
          face(e, nx, e.y + e.vy);
          if (e.shotsLeft > 0 && e.y > 170 && e.y < 470 && s.phase === "play" && Math.random() < 0.018 + 0.012 * Math.min(s.diff, 2)) {
            e.shotsLeft--; fireFrom(s, e.x, e.y + 14);
          }
          if (e.y > H + 40) {
            if (e.noSlot) e.gone = true;
            else { e.state = "return"; e.x = slotPos(s, e.row, e.col)[0]; e.y = -40; }
          }
        }
        break;
      case "beamdown": {
        const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
        if (d <= 5) { e.x = e.tx; e.y = e.ty; e.state = "beam"; e.bt = 0; }
        else face(e, e.x + dx / d * 5, e.y + dy / d * 5);
        break;
      }
      case "beam":
        e.ang *= 0.8;
        e.bt++;
        if (e.bt === 40) ev.push({ type: "beam" });
        if (s.phase === "captured" && s.capBy === e.id) { e.bt = Math.min(e.bt, 150); break; }
        if (e.bt >= 40 && e.bt < 190 && s.phase === "play" && p.inv <= 0 && p.ally === 0 && Math.abs(p.x - e.x) < beamHalf(e)) {
          s.phase = "captured"; s.capBy = e.id; s.capT = 0; s.capX = p.x; s.shots = [];
          ev.push({ type: "captured", x: p.x, y: PY });
        }
        if (e.bt >= 190) e.state = "beamup";
        break;
      case "beamup":
        face(e, e.x, e.y - 5);
        if (e.y < -40) { e.state = "return"; e.y = -40; }
        break;
    }
  }

  function hitEnemy(s, e, ev) {
    e.hp--; e.flash = 8;
    if (e.hp > 0) { ev.push({ type: "armor", x: e.x, y: e.y }); return; }
    e.gone = true;
    const T = TYPES[e.type];
    let pts = isDiving(e) || e.state === "enter" ? T.dive : T.pts;
    if (e.survivor) { pts = 100; s.hits++; }
    if (e.type === "abductor" && e.state === "dive") {
      const esc = s.enemies.filter(o => !o.gone && o.leader === e.id && o.state === "dive").length;
      pts = [400, 800, 1600][esc];
    }
    ev.push({ type: "kill", x: e.x, y: e.y, enemy: e.type });
    ev.push({ type: "score", n: pts });
    if (pts >= 150) popup(s, String(pts), e.x, e.y);
    if (e.type === "wraith") {
      [-1, 1].forEach(side => { const w = makeEnemy("wisp", { x: e.x + side * 12, y: e.y }); startSwoop(w, side * 2.6); s.enemies.push(w); });
      ev.push({ type: "split", x: e.x, y: e.y });
    }
    if (e.captive) {
      if (isDiving(e)) { s.rescue = { x: e.x, y: e.y - 34, t: 0 }; ev.push({ type: "rescue", x: e.x, y: e.y }); }
      else {
        const t = makeEnemy("turncoat", { x: e.x, y: e.y - 34 });
        startSwoop(t, e.x < s.p.x ? 1.5 : -1.5);
        s.enemies.push(t);
        ev.push({ type: "turncoat", x: e.x, y: e.y });
      }
    }
  }

  // ---------- bosses ----------
  function createBoss(s) {
    const type = s.venue.boss.type, sc = 1 + s.info.cycle * 0.3;
    const b = { type, name: s.venue.boss.name, t: 0, flash: 0, dying: 0, enraged: false, x: 480, y: -140, state: "enter", atk: 0 };
    if (type === "queen") Object.assign(b, { hp: Math.round(34 * sc), vx: 1.6, dome: 0, bt: 0, wait: 160,
      turrets: [{ dx: -92, hp: 6, cd: 40, flash: 0 }, { dx: 92, hp: 6, cd: 75, flash: 0 }] });
    if (type === "colossus") Object.assign(b, { hp: Math.round(40 * sc), wait: 0, strikes: 0, k: 0 });
    if (type === "coven") Object.assign(b, { witches: [0, 1, 2].map(i => ({ a: i * 2.094, hp: Math.round(10 * sc), flash: 0, cd: 40 + i * 30, x: 480, y: -140 })),
      hex: 0, hexT: 220, r: 150, spin: 0.012, wispT: 240 });
    if (type === "deep") Object.assign(b, { hp: Math.round(36 * sc), eye: 0, wait: 90, lanes: [], spawnT: 260, ringT: 150 });
    if (type === "coven") b.hp = b.witches.reduce((n, w) => n + w.hp, 0);
    b.maxHp = b.hp;
    return b;
  }
  function addStrike(s, x, ev) { s.strikes.push({ x: clamp(x, 40, 920), t: 0 }); ev.push({ type: "warning" }); }
  function passHex(b) {
    for (let k = 1; k <= 3; k++) { const i = (b.hex + k) % 3; if (b.witches[i].hp > 0) { b.hex = i; return; } }
  }

  function updateBoss(s, b, ev) {
    b.t++;
    if (b.flash > 0) b.flash--;
    b.enraged = b.hp <= b.maxHp / 2;
    const live = s.phase === "play", p = s.p, d = Math.min(s.diff, 1.5);
    if (b.type === "queen") {
      if (b.state === "enter") { b.y += 2; if (b.y >= 150) { b.y = 150; b.state = "hover"; } return; }
      b.turrets.forEach(t => { if (t.flash > 0) t.flash--; });
      const turretsUp = b.turrets.some(t => t.hp > 0);
      if (b.state === "hover") {
        b.x += b.vx * (b.enraged ? 1.4 : 1);
        if (b.x < 220 || b.x > 740) { b.vx *= -1; b.x = clamp(b.x, 220, 740); }
        b.dome = Math.max(turretsUp ? 0 : 0.7, b.dome - 0.05);  // no turrets left = the core stays exposed
        if (live) {
          b.turrets.forEach(t => { if (t.hp > 0 && --t.cd <= 0) { t.cd = Math.round(90 - 30 * d); fireFrom(s, b.x + t.dx, b.y + 26); } });
          if (--b.wait <= 0) { b.state = ["beam", "launch"][b.atk++ % 2]; b.bt = 0; if (b.state === "beam") ev.push({ type: "warning" }); }
        }
      } else if (b.state === "beam") {
        b.bt++;
        b.x += clamp(p.x - b.x, -2.4, 2.4);
        b.dome = Math.max(turretsUp ? 0 : 0.7, b.dome - 0.05);
        if (b.bt === 50) ev.push({ type: "beam" });
        if (b.bt >= 190) { b.state = "vent"; b.bt = 0; ev.push({ type: "open" }); }
      } else if (b.state === "vent") {
        // the beam overheats: the dome slides open and the core is exposed
        b.bt++; b.dome = Math.min(1, b.dome + 0.08);
        if (live) b.turrets.forEach(t => { if (t.hp > 0 && --t.cd <= 0) { t.cd = Math.round(110 - 30 * d); fireFrom(s, b.x + t.dx, b.y + 26); } });
        if (b.bt >= 110) { b.state = "hover"; b.wait = Math.round(150 - 40 * d); }
      } else if (b.state === "launch") {
        if (++b.bt === 20) {
          for (let i = -1; i <= 1; i++) { const m = makeEnemy("bat", { x: b.x + i * 60, y: b.y + 30 }); startSwoop(m, i * 2); s.enemies.push(m); }
          ev.push({ type: "launch" });
        }
        if (b.bt >= 50) { b.state = "hover"; b.wait = 140; }
      }
    } else if (b.type === "colossus") {
      if (b.state === "enter" || b.state === "enterBack") {
        b.y += b.state === "enter" ? 2.5 : 4; b.x += (480 - b.x) * 0.05;
        if (b.y >= 130) { b.y = 130; b.state = "perch"; b.wait = 150; b.strikes = 0; }
      } else if (b.state === "perch") {
        b.x += (480 - b.x) * 0.05; b.y += (130 - b.y) * 0.08;
        if (live) {
          if (b.wait % 55 === 0 && b.wait > 0 && b.strikes < 3) { addStrike(s, p.x, ev); b.strikes++; }
          if (--b.wait <= 0) { b.state = "wake"; b.wait = 45; ev.push({ type: "wake" }); }
        }
      } else if (b.state === "wake") {
        if (--b.wait <= 0) { b.state = "swoop"; b.k = 0; b.hovered = false; b.hover = 0; }
      } else if (b.state === "swoop") {
        // it dips to the middle of the field and hangs there, flapping, before climbing away
        if (b.k >= 0.5 && !b.hovered) { if (++b.hover >= (b.enraged ? 45 : 60)) b.hovered = true; }
        else b.k += 1 / (b.enraged ? 260 : 320);
        const a = b.k * Math.PI * 2;
        b.x = 480 + Math.sin(a) * 360; b.y = 130 + (1 - Math.cos(a)) * 165;
        if (live && b.t % 64 === 0) {
          const n = b.enraged ? 5 : 3, base = Math.atan2(PY - b.y, p.x - b.x);
          for (let i = 0; i < n; i++) { const ang = base + (i - (n - 1) / 2) * 0.22; s.bolts.push({ x: b.x, y: b.y + 20, vx: Math.cos(ang) * 5, vy: Math.sin(ang) * 5, shard: true }); }
          ev.push({ type: "shards" });
        }
        if (b.k >= 1) { if (b.enraged && live) { b.state = "aim"; b.wait = 40; ev.push({ type: "warning" }); } else { b.state = "perch"; b.wait = 170; b.strikes = 0; } }
      } else if (b.state === "aim") {
        b.x += clamp(p.x - b.x, -6, 6);
        if (--b.wait <= 0) b.state = "plunge";
      } else if (b.state === "plunge") {
        b.y += 13;
        if (b.y >= H + 60) { b.y = -80; b.state = "enterBack"; }
      }
    } else if (b.type === "coven") {
      if (b.state === "enter") { b.y += 2; if (b.y >= 210) { b.y = 210; b.state = "fight"; } }
      b.witches.forEach(w => {
        if (w.flash > 0) w.flash--;
        w.a += b.spin * (b.state === "fight" ? 1 : 0.5);
        w.x = b.x + Math.cos(w.a) * b.r * 1.5; w.y = b.y + Math.sin(w.a) * b.r * 0.55;
      });
      if (b.state === "fight" && live) {
        if (--b.hexT <= 0) { passHex(b); b.hexT = 200; ev.push({ type: "hex" }); }
        b.witches.forEach((w, i) => {
          if (w.hp <= 0 || --w.cd > 0) return;
          if (i === b.hex) { [-1.6, 0, 1.6].forEach(k => fireFrom(s, w.x, w.y + 14, k)); w.cd = Math.round(60 - 15 * d); }
          else { fireFrom(s, w.x, w.y + 14); w.cd = 110; }
        });
        if (--b.wispT <= 0) { b.wispT = 240; const m = makeEnemy("wisp", { x: b.x, y: b.y + 10 }); startSwoop(m, rnd(-2, 2)); s.enemies.push(m); }
      }
      b.hp = b.witches.reduce((n, w) => n + Math.max(0, w.hp), 0);
    } else if (b.type === "deep") {
      if (b.state === "enter") { b.y += 2; if (b.y >= 140) { b.y = 140; b.state = "idle"; b.wait = 80; } return; }
      b.lanes.forEach(l => { l.t++; if (l.t === 50) ev.push({ type: "slam", x: l.x }); });
      b.lanes = b.lanes.filter(l => l.t < 110);
      if (b.state === "idle") {
        b.eye = Math.max(0, b.eye - 0.08);
        if (live && --b.wait <= 0) {
          b.lanes = [{ x: clamp(p.x, 40, 920), t: 0 }];
          if (b.enraged) b.lanes.push({ x: clamp(p.x + (p.x < 480 ? 170 : -170), 40, 920), t: -14 });
          b.state = "lash"; ev.push({ type: "warning" });
        }
      } else if (b.state === "lash") {
        if (!b.lanes.length) { b.state = "open"; b.wait = b.enraged ? 80 : 95; ev.push({ type: "open" }); }
      } else if (b.state === "open") {
        b.eye = Math.min(1, b.eye + 0.1);
        if (--b.wait <= 0) { b.state = "idle"; b.wait = 60; }
      }
      if (live) {
        if (--b.spawnT <= 0) { b.spawnT = 260; [-1, 1].forEach(i => { const m = makeEnemy("eyeball", { x: b.x + i * 110, y: b.y + 40 }); startSwoop(m, i * 1.5); s.enemies.push(m); }); }
        if (b.enraged && --b.ringT <= 0) {
          b.ringT = 170;
          for (let k = 0; k < 10; k++) { const a = Math.PI * (0.12 + 0.76 * k / 9); s.bolts.push({ x: b.x, y: b.y + 30, vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 4.2 }); }
        }
      }
    }
  }

  function damageBoss(s, b, n, x, y, ev) {
    b.hp -= n; b.flash = 6;
    ev.push({ type: "bossHit", x, y });
    ev.push({ type: "score", n: 20 * n });
    if (b.hp <= 0) {
      b.hp = 0; b.dying = 120;
      const pts = 5000 * (s.info.venue + 1) * (1 + s.info.cycle);
      ev.push({ type: "bossDown", x: b.x, y: b.y });
      ev.push({ type: "score", n: pts });
      popup(s, String(pts), b.x, b.y);
      s.bolts = []; s.strikes = [];
      if (b.lanes) b.lanes = [];
    }
  }

  // one shot vs the boss → true if the shot was used up
  function bossShot(s, b, sh, ev) {
    const dx = sh.x - b.x, dy = sh.y - b.y;
    if (b.type === "queen") {
      for (const t of b.turrets) {
        if (t.hp > 0 && Math.abs(sh.x - (b.x + t.dx)) < 20 && Math.abs(sh.y - (b.y + 24)) < 18) {
          t.flash = 6;
          if (--t.hp <= 0) { ev.push({ type: "turretDown", x: b.x + t.dx, y: b.y + 24 }); ev.push({ type: "score", n: 500 }); popup(s, "500", b.x + t.dx, b.y + 24); }
          else ev.push({ type: "armor", x: sh.x, y: sh.y });
          return true;
        }
      }
      if (b.dome > 0.6 && Math.abs(dx) < 30 && dy < 44 && dy > -50) { damageBoss(s, b, 1, sh.x, sh.y, ev); return true; }
      if (Math.abs(dx) < 120 && Math.abs(dy) < 40) { ev.push({ type: "clang", x: sh.x, y: sh.y }); return true; }
      return false;
    }
    if (b.type === "colossus") {
      if (Math.abs(dx) < 64 && Math.abs(dy) < 42) {
        if (b.state === "perch" || b.state === "enter" || b.state === "enterBack") ev.push({ type: "clang", x: sh.x, y: sh.y });
        else damageBoss(s, b, 1, sh.x, sh.y, ev);
        return true;
      }
      return false;
    }
    if (b.type === "coven") {
      for (let i = 0; i < 3; i++) {
        const w = b.witches[i];
        if (w.hp > 0 && Math.abs(sh.x - w.x) < 22 && Math.abs(sh.y - w.y) < 22) {
          if (i !== b.hex) { ev.push({ type: "clang", x: sh.x, y: sh.y }); return true; }
          w.hp--; w.flash = 6;
          damageBoss(s, b, 1, sh.x, sh.y, ev);
          if (w.hp <= 0 && b.hp > 0) { b.r += 24; b.spin *= 1.35; passHex(b); ev.push({ type: "witchDown", x: w.x, y: w.y }); }
          return true;
        }
      }
      return false;
    }
    if (b.type === "deep") {
      if (Math.abs(sh.x - b.x) < 28 && sh.y < b.y + 64 && sh.y > b.y - 40) {
        if (b.eye > 0.6) damageBoss(s, b, 1, sh.x, sh.y, ev); else ev.push({ type: "clang", x: sh.x, y: sh.y });
        return true;
      }
      if (Math.abs(dx) < 140 && Math.abs(dy) < 60) { ev.push({ type: "clang", x: sh.x, y: sh.y }); return true; }
      return false;
    }
    return false;
  }

  function bossTouches(b, x) {
    if (b.dying) return false;
    if (b.type === "queen") return b.state === "beam" && b.bt >= 50 && b.bt < 190 && Math.abs(x - b.x) < 64;
    if (b.type === "colossus") return b.state === "plunge" && Math.abs(x - b.x) < 44 && b.y > PY - 50 && b.y < PY + 50;
    if (b.type === "deep") return b.lanes.some(l => l.t >= 54 && l.t < 82 && Math.abs(x - l.x) < 30);
    return false;
  }
  function bossRetreat(b) {
    if (b.type === "queen" && b.state !== "enter") { b.state = "hover"; b.wait = 150; }
    if (b.type === "colossus" && (b.state === "aim" || b.state === "plunge")) { b.state = "enterBack"; b.y = -80; }
    if (b.type === "deep") { b.lanes = []; if (b.state !== "enter") { b.state = "idle"; b.wait = 120; } }
  }

  // ---------- the player ----------
  function playerHits(s, ev) {
    const p = s.p;
    if (p.inv > 0) return;
    for (const x of shipXs(p)) {
      let hit = null;
      for (const b of s.bolts) if (Math.abs(b.x - x) < 11 && Math.abs(b.y - PY) < 16) { hit = b; b.y = H + 99; break; }
      if (!hit) for (const e of s.enemies) {
        if (e.gone || e.state === "wait" || e.state === "form" || e.state === "flee") continue;
        const r = TYPES[e.type].r + 10;
        if (Math.abs(e.x - x) < r && Math.abs(e.y - PY) < r) { hit = e; e.hp = 1; hitEnemy(s, e, ev); break; }
      }
      if (!hit && s.boss && bossTouches(s.boss, x)) hit = s.boss;
      if (!hit && s.strikes.some(k => k.t >= 60 && k.t < 80 && Math.abs(k.x - x) < 26)) hit = {};
      if (!hit) continue;
      if (p.ally > 0) { p.ally--; p.inv = 60; ev.push({ type: "shipLost", x, y: PY }); }
      else { s.phase = "dying"; s.dying = DYING; s.shots = []; s.streakT = 0; s.deaths++; ev.push({ type: "die", x, y: PY }); }
      return;
    }
  }

  function beginRegroup(s) {
    if (s.phase === "ending" || s.phase === "over" || s.phase === "regroup" || s.phase === "ready") return;
    s.phase = "regroup"; s.phaseT = 150;
    s.bolts = []; s.shots = []; s.strikes = [];
    s.enemies.forEach(e => { if (isDiving(e)) { if (e.noSlot) e.gone = true; else e.state = "return"; } });
    s.enemies = s.enemies.filter(e => !e.gone);
    if (s.boss) bossRetreat(s.boss);
  }

  function checkClear(s, ev) {
    if (s.enemies.length || s.boss || s.rescue) return;
    if (s.info.kind === "survival") {
      // 100 a second since your last loss; clearing the sky early banks the rest of the clock
      s.streakT += s.surviveT; s.surviveT = 0;
      s.secs = Math.floor(s.streakT / 60);
      s.bonus = s.secs * 100 + (s.deaths === 0 ? 10000 : 0);
      s.phase = "result"; s.phaseT = RESULT;
      if (s.bonus) ev.push({ type: "score", n: s.bonus });
      ev.push({ type: s.deaths === 0 ? "untouched" : "survived" });
    } else {
      s.phase = "clear"; s.phaseT = CLEAR;
      ev.push({ type: "stageClear" });
    }
  }

  // ---------- one frame ----------
  function step(s, input = {}) {
    const ev = [], p = s.p;
    s.t++;
    s.popups.forEach(q => { q.y -= 0.7; q.life--; });
    s.popups = s.popups.filter(q => q.life > 0);
    if (s.phase === "intro") { if (--s.phaseT <= 0) { s.phase = "play"; if (s.boss) ev.push({ type: "warning" }); } return ev; }
    if (s.phase === "clear" || s.phase === "result") { if (--s.phaseT <= 0) { s.phase = "done"; ev.push({ type: "next" }); } return ev; }
    if (s.phase === "done" || s.phase === "over") return ev;

    if (p.inv > 0) p.inv--;
    if (p.cd > 0) p.cd--;
    if (s.phase === "play") {
      s.playT++;
      if (s.surviveT > 0) {
        s.streakT++;
        if (--s.surviveT <= 0) {
          s.bolts = [];
          s.enemies.forEach(e => { if (e.state === "wait") e.gone = true; else e.state = "flee"; });
          ev.push({ type: "timeUp" });
        }
      }
      const n = 1 + p.ally, half = (n - 1) * 19;
      p.x = clamp(p.x + clamp(input.move || 0, -1, 1) * 6.2, 40 + half, W - 40 - half);
      if (input.fire && p.cd <= 0 && s.shots.length < 2 * n) {
        shipXs(p).forEach(x => s.shots.push({ x, y: PY - 22 }));
        p.cd = 7;
        ev.push({ type: "shoot", dual: n > 1 });
      }
    }
    s.shots.forEach(sh => { sh.y -= 15; });
    s.shots = s.shots.filter(sh => sh.y > -30);

    if (s.info.kind === "wave") scheduleDives(s, input);
    s.enemies.forEach(e => updateEnemy(s, e, ev));
    s.enemies = s.enemies.filter(e => !e.gone);

    if (s.boss) {
      const b = s.boss;
      if (b.dying) {
        if (b.dying % 10 === 0) ev.push({ type: "boom", x: b.x + rnd(-80, 80), y: b.y + rnd(-40, 40) });
        if (--b.dying <= 0) { s.boss = null; ev.push({ type: "bossGone" }); }
      } else updateBoss(s, b, ev);
    }

    s.bolts.forEach(b => { b.x += b.vx; b.y += b.vy; });
    s.bolts = s.bolts.filter(b => b.y < H + 20 && b.y > -40 && b.x > -40 && b.x < W + 40);

    if (s.venue.hazard === "lightning" && s.info.kind === "wave" && s.phase === "play" && --s.hazardT <= 0) {
      s.hazardT = Math.round(rnd(300, 420) - 80 * Math.min(s.diff, 2));
      addStrike(s, p.x + rnd(-110, 110), ev);
    }
    s.strikes.forEach(k => {
      if (++k.t !== 60) return;
      ev.push({ type: "strike", x: k.x });
      s.enemies.forEach(e => { if (!e.gone && e.state !== "wait" && !e.captive && Math.abs(e.x - k.x) < 30) { e.gone = true; ev.push({ type: "kill", x: e.x, y: e.y, enemy: e.type }); } });
    });
    s.strikes = s.strikes.filter(k => k.t < 80);
    s.enemies = s.enemies.filter(e => !e.gone);

    if (s.rescue) {
      const r = s.rescue;
      r.t++;
      r.x += (p.x - r.x) * 0.06;
      if (r.y < PY) r.y = Math.min(s.phase === "play" ? PY : 560, r.y + 3.2);
      if (r.y >= PY && s.phase === "play") { p.ally = Math.min(2, p.ally + 1); s.rescue = null; p.inv = Math.max(p.inv, 40); ev.push({ type: "dual", ships: 1 + p.ally }); }
    }

    // shots: boss first, then each enemy — a captive hero before its abductor
    for (const sh of s.shots) {
      if (s.boss && !s.boss.dying && bossShot(s, s.boss, sh, ev)) { sh.dead = true; continue; }
      for (const e of s.enemies) {
        if (e.gone || e.state === "wait") continue;
        if (e.captive && Math.abs(sh.x - e.x) < 14 && Math.abs(sh.y - (e.y - 34)) < 16) {
          e.captive = false; sh.dead = true;
          ev.push({ type: "captiveLost", x: e.x, y: e.y - 34 });
          break;
        }
        const r = TYPES[e.type].r;
        if (Math.abs(sh.x - e.x) < r && Math.abs(sh.y - e.y) < r + 6) {
          sh.dead = true;
          if (shielded(s, e)) ev.push({ type: "shield", x: e.x, y: e.y });
          else hitEnemy(s, e, ev);
          break;
        }
      }
    }
    s.shots = s.shots.filter(sh => !sh.dead);
    s.enemies = s.enemies.filter(e => !e.gone);

    if (s.phase === "play") playerHits(s, ev);

    switch (s.phase) {
      case "dying":
        if (--s.dying <= 0) {
          if ((input.lives ?? 3) <= 1) { s.phase = "ending"; s.phaseT = ENDING; }
          else { ev.push({ type: "lose" }); beginRegroup(s); }
        }
        break;
      case "captured": {
        const by = s.enemies.find(e => e.id === s.capBy);
        if (!by) { s.phase = "play"; p.inv = 90; break; }
        if (++s.capT >= CAPTURE) { by.captive = true; by.state = "beamup"; ev.push({ type: "lose" }); beginRegroup(s); }
        break;
      }
      case "regroup":
        if (--s.phaseT <= 0 || !s.enemies.some(isDiving)) { s.phase = "ready"; s.phaseT = READY; p.x = 480; }
        break;
      case "ready":
        if (--s.phaseT <= 0) { s.phase = "play"; p.inv = 100; }
        break;
      case "ending":
        if (--s.phaseT <= 0) { s.phase = "over"; ev.push({ type: "gameover" }); }
        break;
    }
    if (s.phase === "play" || s.phase === "ready" || s.phase === "regroup") checkClear(s, ev);
    return ev;
  }

  // Attract-mode pilot for the hub preview.
  function autopilot(s) {
    const p = s.p, b = s.boss;
    let tx = 480;
    if (b && !b.dying) tx = b.type === "coven" ? b.witches[b.hex].x : b.x;
    else {
      let best = 1e9;
      for (const e of s.enemies) { if (e.state === "wait") continue; const d = Math.abs(e.x - p.x) - e.y * 0.5 + (isDiving(e) ? 260 : 0); if (d < best) { best = d; tx = e.x; } }
    }
    let move = Math.abs(tx - p.x) > 8 ? Math.sign(tx - p.x) : 0;
    const threat = s.bolts.find(q => q.y > PY - 170 && q.y < PY && Math.abs(q.x - p.x) < 34) ||
      s.strikes.find(k => Math.abs(k.x - p.x) < 50) ||
      s.enemies.find(e => (e.state === "beam" && Math.abs(e.x - p.x) < beamHalf(e) + 30) || (e.state === "dive" && e.y > PY - 140 && Math.abs(e.x - p.x) < 50)) ||
      (b && !b.dying && ((b.lanes && b.lanes.find(l => Math.abs(l.x - p.x) < 60)) || (b.type === "queen" && b.state === "beam" && b) || (b.type === "colossus" && b.state === "aim" && b)));
    if (threat) move = p.x < threat.x ? -1 : 1;
    if ((p.x < 90 && move < 0) || (p.x > 870 && move > 0)) move = -move;
    return { move, fire: true };
  }

  const exports = { createState, step, respawn: beginRegroup, stageInfo, shipXs, autopilot, isDiving, slotPos, beamHalf,
    startDive, hitEnemy, makeEnemy, TYPES, PY, W, H, VENUES, SURVIVE };
  if (typeof module !== "undefined" && module.exports) module.exports = exports;
  else root.BeamGame = exports;
})(typeof window !== "undefined" ? window : globalThis);
