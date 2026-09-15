// ============================================================
// SPECTRAL MANOR CRUISE — cars
// Every car is painted once per pose into a canvas and scaled with drawImage:
// crisp at any distance, and no shadowBlur halo eating a far car (the old
// "fuzzy racers" problem). Five poses per car — seen square from behind, and
// turned either way — so a rival off to one side shows you its flank.
// ============================================================

const CAR_CW = 300, CAR_CH = 200;         // canvas size of one pose
const CAR_BASE_Y = 186;                   // tyres touch the road here
const CAR_BODY_PX = 250;                  // body width in canvas px
const CAR_WORLD_W = 560;                  // ...which is this many world units
const POSES = [-1, -0.5, 0, 0.5, 1];

const CAR_DEFS = {
  player:   { style: 'cruiser', color: '#7c3aed', trim: '#c4b5fd', light: '#ff3355', driver: 'hero',     name: 'YOU' },
  vampire:  { style: 'hearse',  color: '#991b1b', trim: '#fca5a5', light: '#ff2244', driver: 'vampire',  name: 'Vampire' },
  werewolf: { style: 'muscle',  color: '#78716c', trim: '#e7e5e4', light: '#ff5533', driver: 'werewolf', name: 'Werewolf' },
  witch:    { style: 'buggy',   color: '#7e22ce', trim: '#86efac', light: '#4ade80', driver: 'witch',    name: 'Witch' },
  frank:    { style: 'ratrod',  color: '#3f6212', trim: '#bef264', light: '#ff4433', driver: 'frank',    name: 'Frank' },
  ghost:    { style: 'phantom', color: '#67e8f9', trim: '#ecfeff', light: '#a5f3fc', driver: 'ghost',    name: 'Ghost', ghost: true }
};

function carPoly(c, pts, fill, w = 3) {
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (w) { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(); }
}
function carRect(c, x, y, w, h, r, fill, lw = 3) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (lw) { c.strokeStyle = INK; c.lineWidth = lw; c.stroke(); }
}
function lamp(c, x, y, w, h, color, bright) {
  // An elliptical halo that reaches transparency inside its own fill: a round
  // gradient sized to a wide bar's width, clipped to a thin box, left a hard
  // translucent rectangle behind the car.
  const rx = w / 2 + h * (bright ? 1.6 : 1.1), ry = h * (bright ? 1.9 : 1.4);
  c.save();
  c.translate(x + w / 2, y + h / 2); c.scale(rx / ry, 1);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, ry);
  g.addColorStop(0, rgba(color, bright ? 0.9 : 0.55)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.fillRect(-ry, -ry, ry * 2, ry * 2);
  c.restore();
  carRect(c, x, y, w, h, Math.min(w, h) * 0.35, color, 2);
  c.fillStyle = bright ? '#ffffff' : shade(color, 0.55);
  c.fillRect(x + w * 0.2, y + h * 0.25, w * 0.6, h * 0.3);
}
function glass(c, pts) {
  const ys = pts.map(p => p[1]), top = Math.min(...ys), bot = Math.max(...ys);
  const g = c.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, '#1e1b4b'); g.addColorStop(0.5, '#312e81'); g.addColorStop(1, '#0f0a1a');
  carPoly(c, pts, g, 3);
  const xs = pts.map(p => p[0]), l = Math.min(...xs), r = Math.max(...xs);
  c.save(); c.clip();
  c.strokeStyle = 'rgba(224,231,255,0.35)'; c.lineWidth = 6;
  c.beginPath(); c.moveTo(l + (r - l) * 0.15, bot); c.lineTo(l + (r - l) * 0.45, top); c.stroke();
  c.restore();
}

/* The driver, seen from behind through the rear window. */
function drawDriver(c, kind, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  if (kind === 'hero') {
    // the Spaceman from behind, in the Hero Kit palette: white quilted flight
    // suit, navy vest straps, high neck ring, long dark swept-back hair, gold aviator arms
    carRect(c, -19, -2, 38, 20, 7, '#eef0f2', 2);                              // suit shoulders
    c.strokeStyle = '#c3c8cf'; c.lineWidth = 1.5;
    for (const qx of [-4, 4]) { c.beginPath(); c.moveTo(qx, 3); c.lineTo(qx, 16); c.stroke(); }   // quilting
    carPoly(c, [[-15, -1], [-8, -1], [-9, 18], [-16, 18]], '#1e3558', 1.5);      // vest straps
    carPoly(c, [[15, -1], [8, -1], [9, 18], [16, 18]], '#1e3558', 1.5);
    c.fillStyle = '#d98a3a'; c.fillRect(-13, 7, 3, 3); c.fillStyle = '#e9b86a'; c.fillRect(11, 11, 3, 3);   // cosmic print
    carRect(c, -11, -9, 22, 9, 4, '#eef0f2', 2);                               // helmet-seal neck ring
    carPoly(c, [[-13, -20], [-16, -1], [-7, -5], [0, -2], [7, -5], [16, -1], [13, -20]], '#2a211c', 2);   // hair to the shoulders
    c.beginPath(); c.ellipse(0, -20, 13, 14, 0, 0, Math.PI * 2); c.fillStyle = '#2a211c'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    c.strokeStyle = '#4a3a30'; c.lineWidth = 1.5;
    for (const hx of [-6, 0, 6]) { c.beginPath(); c.moveTo(hx * 0.5, -32); c.quadraticCurveTo(hx, -18, hx * 1.4, -4); c.stroke(); }   // swept-back strands
    c.fillStyle = '#c28a66'; c.fillRect(-15, -21, 3, 6); c.fillRect(12, -21, 3, 6);    // ears
    c.fillStyle = '#c9a24a'; c.fillRect(-17, -22, 6, 2); c.fillRect(11, -22, 6, 2);    // aviator arms
  } else if (kind === 'vampire') {
    carPoly(c, [[-20, 16], [-22, -4], [-10, 2], [0, -6], [10, 2], [22, -4], [20, 16]], '#7f1d1d', 2);   // high collar
    c.beginPath(); c.arc(0, -12, 12, 0, Math.PI * 2); c.fillStyle = '#120a16'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#e6d3d8'; c.fillRect(-13, -12, 3, 7); c.fillRect(10, -12, 3, 7);
  } else if (kind === 'werewolf') {
    c.beginPath(); c.arc(0, -8, 16, 0, Math.PI * 2); c.fillStyle = '#6b5a4d'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    carPoly(c, [[-14, -16], [-8, -34], [-2, -20]], '#5d4d42', 2); carPoly(c, [[14, -16], [8, -34], [2, -20]], '#5d4d42', 2);
    c.strokeStyle = '#8a7768'; c.lineWidth = 2; for (let i = -10; i <= 10; i += 5) { c.beginPath(); c.moveTo(i, -2); c.lineTo(i + 2, 8); c.stroke(); }
  } else if (kind === 'witch') {
    c.beginPath(); c.arc(0, -6, 11, 0, Math.PI * 2); c.fillStyle = '#3b1f52'; c.fill();
    carPoly(c, [[-22, -10], [22, -10], [16, -16], [-16, -16]], '#3b1f52', 2);
    carPoly(c, [[-12, -14], [12, -14], [6, -34], [-6, -50]], '#4c2566', 2);
    c.fillStyle = '#e0b35a'; c.fillRect(-12, -17, 24, 4);
  } else if (kind === 'frank') {
    carRect(c, -14, -26, 28, 30, 3, '#8fb574', 2);
    c.fillStyle = '#172431'; c.fillRect(-15, -28, 30, 8);
    c.fillStyle = '#abc0d0'; c.fillRect(-20, -4, 6, 6); c.fillRect(14, -4, 6, 6);
    carRect(c, -22, 4, 44, 14, 3, '#3d493d', 2);
  } else if (kind === 'ghost') {
    c.globalAlpha = 0.85;
    c.beginPath(); c.moveTo(-18, 16); c.lineTo(-18, -8); c.arc(0, -8, 18, Math.PI, 0); c.lineTo(18, 16);
    c.quadraticCurveTo(9, 8, 0, 16); c.quadraticCurveTo(-9, 8, -18, 16);
    c.fillStyle = '#e0f2fe'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
  }
  c.restore();
}

/* One pose. `yaw` −1..1 turns the car: the roof slides one way and the flank
   it shows appears on the other. */
function paintCar(c, def, yaw, brake) {
  const cx = CAR_CW / 2, base = CAR_BASE_Y, bw = CAR_BODY_PX;
  const shift = -yaw * 14;                  // roof slides against the turn
  const flank = Math.abs(yaw) * 26;         // visible side panel width
  const side = yaw > 0 ? -1 : 1;            // which edge shows the flank
  const col = def.color, dark = shade(col, -0.45), lit = shade(col, 0.28);
  const L = cx - bw / 2, R = cx + bw / 2;

  // ground shadow
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.beginPath(); c.ellipse(cx, base - 2, bw * 0.56, 12, 0, 0, Math.PI * 2); c.fill();

  // tyres (the phantom hovers instead)
  const tyre = (x, w) => { carRect(c, x, base - 44, w, 44, 8, '#111016', 3); c.fillStyle = '#2a2833'; c.fillRect(x + 4, base - 38, w - 8, 5); c.fillRect(x + 4, base - 22, w - 8, 5); };
  const tyreW = def.style === 'muscle' || def.style === 'cruiser' ? 44 : def.style === 'buggy' ? 48 : 36;
  if (!def.ghost) { tyre(L - 6, tyreW); tyre(R + 6 - tyreW, tyreW); }
  else {
    [L + 30, R - 30].forEach(x => { const g = c.createRadialGradient(x, base - 12, 0, x, base - 12, 34); g.addColorStop(0, 'rgba(165,243,252,0.8)'); g.addColorStop(1, 'rgba(165,243,252,0)'); c.fillStyle = g; c.fillRect(x - 34, base - 46, 68, 68); });
  }

  // flank
  if (flank > 1) {
    const fx = side > 0 ? R : L - flank;
    carPoly(c, side > 0 ? [[R, base - 36], [R + flank, base - 42], [R + flank, base - 96], [R, base - 104]] : [[L, base - 36], [L - flank, base - 42], [L - flank, base - 96], [L, base - 104]], dark, 3);
    if (!def.ghost) carRect(c, fx + (side > 0 ? 2 : -2), base - 46, flank, 40, 6, '#111016', 2);
  }

  // main body (lower)
  const bodyTop = def.style === 'muscle' ? base - 92 : def.style === 'buggy' ? base - 84 : base - 104;
  const g = c.createLinearGradient(0, bodyTop, 0, base - 30);
  g.addColorStop(0, lit); g.addColorStop(0.45, col); g.addColorStop(1, dark);
  if (def.style === 'phantom') {
    carPoly(c, [[L + 10, base - 30], [R - 10, base - 30], [R, base - 70], [cx + 60, bodyTop], [cx - 60, bodyTop], [L, base - 70]], g, 3);
  } else {
    carPoly(c, [[L, base - 34], [R, base - 34], [R + 4, base - 70], [R - 8, bodyTop], [L + 8, bodyTop], [L - 4, base - 70]], g, 3);
  }
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(L + 12, bodyTop + 6, bw - 24, 4);

  // chrome bumper + plate + exhausts
  if (!def.ghost) {
    carRect(c, L - 4, base - 44, bw + 8, 12, 5, '#d4d4d8', 3);
    c.fillStyle = '#fafafa'; c.fillRect(L + 6, base - 42, bw - 12, 2);
    carRect(c, cx - 26, base - 66, 52, 20, 3, '#e5e7eb', 2);
    c.fillStyle = INK; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText(def.driver === 'hero' ? 'GC-13' : def.name.slice(0, 5).toUpperCase(), cx, base - 51);
    [[L + 30, 1], [R - 30, 1]].forEach(([x]) => { c.beginPath(); c.arc(x, base - 30, 7, 0, 7); c.fillStyle = '#a1a1aa'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); c.fillStyle = '#18181b'; c.beginPath(); c.arc(x, base - 30, 3.5, 0, 7); c.fill(); });
  }

  // style-specific upper body, lights, driver
  const lt = def.light;
  const S = {
    cruiser() {
      // hot-rod hearse: tall cabin, chrome rails, flame decals, full-width light bar
      carPoly(c, [[L + 22 + shift, bodyTop], [R - 22 + shift, bodyTop], [R - 34 + shift, base - 170], [L + 34 + shift, base - 170]], shade(col, -0.2), 3);
      glass(c, [[L + 40 + shift, bodyTop - 8], [R - 40 + shift, bodyTop - 8], [R - 48 + shift, base - 160], [L + 48 + shift, base - 160]]);
      drawDriver(c, 'hero', cx + shift, bodyTop - 22, 1);
      c.fillStyle = '#e5e7eb'; c.fillRect(L + 30 + shift, base - 176, bw - 60, 5);
      // flames licking up the tailgate
      c.fillStyle = '#f97316';
      [[L + 18, 1], [R - 18, -1]].forEach(([x, d]) => carPoly(c, [[x, base - 40], [x + d * 60, base - 40], [x + d * 40, base - 62], [x + d * 52, base - 78], [x + d * 22, base - 64], [x + d * 16, base - 92]], '#f97316', 2));
      lamp(c, L + 8, base - 88, bw - 16, 13, lt, brake);
    },
    hearse() {
      carPoly(c, [[L + 16 + shift, bodyTop], [R - 16 + shift, bodyTop], [R - 22 + shift, base - 178], [L + 22 + shift, base - 178]], shade(col, -0.25), 3);
      glass(c, [[L + 40 + shift, bodyTop - 10], [R - 40 + shift, bodyTop - 10], [R - 44 + shift, base - 166], [L + 44 + shift, base - 166]]);
      c.fillStyle = '#fde68a'; carPoly(c, [[L + 42 + shift, base - 166], [cx - 20 + shift, base - 166], [L + 50 + shift, bodyTop - 12]], '#fef3c7', 0);
      carPoly(c, [[R - 42 + shift, base - 166], [cx + 20 + shift, base - 166], [R - 50 + shift, bodyTop - 12]], '#fef3c7', 0);
      drawDriver(c, 'vampire', cx + shift, bodyTop - 26, 1);
      // landau bars
      c.strokeStyle = '#e5e7eb'; c.lineWidth = 4;
      [[L + 24, 1], [R - 24, -1]].forEach(([x, d]) => { c.beginPath(); c.moveTo(x + shift, bodyTop - 50); c.bezierCurveTo(x + d * 16 + shift, bodyTop - 40, x - d * 6 + shift, bodyTop - 20, x + d * 12 + shift, bodyTop - 8); c.stroke(); });
      carRect(c, cx - 50 + shift, base - 194, 100, 16, 4, '#3f1d1d', 2);        // coffin on the roof rack
      c.fillStyle = '#fbbf24'; c.fillRect(cx - 4 + shift, base - 192, 8, 12); c.fillRect(cx - 10 + shift, base - 188, 20, 4);
      // tail fins
      carPoly(c, [[L - 4, base - 70], [L + 16, base - 70], [L + 12, base - 128]], dark, 3); carPoly(c, [[R + 4, base - 70], [R - 16, base - 70], [R - 12, base - 128]], dark, 3);
      lamp(c, L + 4, base - 96, 16, 24, lt, brake); lamp(c, R - 20, base - 96, 16, 24, lt, brake);
    },
    muscle() {
      carPoly(c, [[L + 50 + shift, bodyTop], [R - 50 + shift, bodyTop], [R - 70 + shift, base - 138], [L + 70 + shift, base - 138]], shade(col, -0.2), 3);
      glass(c, [[L + 60 + shift, bodyTop - 4], [R - 60 + shift, bodyTop - 4], [R - 76 + shift, base - 132], [L + 76 + shift, base - 132]]);
      drawDriver(c, 'werewolf', cx + shift, bodyTop - 12, 0.9);
      c.fillStyle = '#f5f5f4'; c.fillRect(cx - 22, bodyTop, 12, base - 34 - bodyTop); c.fillRect(cx + 10, bodyTop, 12, base - 34 - bodyTop);   // racing stripes
      carRect(c, L - 8 + shift * 0.5, base - 150, bw + 16, 14, 4, dark, 3);       // spoiler wing
      c.fillStyle = INK; c.fillRect(L + 30, base - 138, 8, 44); c.fillRect(R - 38, base - 138, 8, 44);
      [L + 14, L + 44, R - 64, R - 34].forEach(x => { c.beginPath(); c.arc(x + 10, base - 78, 10, 0, 7); c.fillStyle = lt; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); if (brake) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 10, base - 78, 4, 0, 7); c.fill(); } });
    },
    buggy() {
      // glass dome, exposed engine, witch hat through the roof
      const dg = c.createRadialGradient(cx + shift - 20, bodyTop - 50, 10, cx + shift, bodyTop - 30, 90);
      dg.addColorStop(0, 'rgba(233,213,255,0.7)'); dg.addColorStop(1, 'rgba(76,29,149,0.55)');
      c.beginPath(); c.ellipse(cx + shift, bodyTop, 88, 70, 0, Math.PI, 0); c.closePath(); c.fillStyle = dg; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
      drawDriver(c, 'witch', cx + shift, bodyTop - 16, 1.1);
      carRect(c, cx - 40, bodyTop + 4, 80, 34, 6, '#52525b', 3);
      c.fillStyle = '#a1a1aa'; for (let i = 0; i < 4; i++) c.fillRect(cx - 32 + i * 18, bodyTop + 10, 10, 22);
      const eg = c.createRadialGradient(cx, bodyTop + 20, 0, cx, bodyTop + 20, 40); eg.addColorStop(0, 'rgba(134,239,172,0.55)'); eg.addColorStop(1, 'rgba(134,239,172,0)'); c.fillStyle = eg; c.fillRect(cx - 40, bodyTop - 20, 80, 80);
      c.strokeStyle = '#78350f'; c.lineWidth = 4; c.beginPath(); c.moveTo(R - 20, bodyTop); c.lineTo(R - 4, bodyTop - 70); c.stroke();
      carPoly(c, [[R - 4, bodyTop - 70], [R - 16, bodyTop - 96], [R + 10, bodyTop - 92]], '#d97706', 2);
      lamp(c, L + 10, base - 84, 26, 16, lt, brake); lamp(c, R - 36, base - 84, 26, 16, lt, brake);
    },
    ratrod() {
      // chopped cab to one side, blower engine and stacks
      carPoly(c, [[L + 20 + shift, bodyTop], [cx + 10 + shift, bodyTop], [cx + 4 + shift, base - 156], [L + 30 + shift, base - 156]], '#44403c', 3);
      glass(c, [[L + 32 + shift, bodyTop - 8], [cx - 2 + shift, bodyTop - 8], [cx - 6 + shift, base - 148], [L + 38 + shift, base - 148]]);
      drawDriver(c, 'frank', L + 72 + shift, bodyTop - 14, 0.95);
      carRect(c, cx + 20, bodyTop - 30, 80, 36, 5, '#a1a1aa', 3);
      c.fillStyle = '#52525b'; for (let i = 0; i < 5; i++) c.fillRect(cx + 26 + i * 15, bodyTop - 26, 8, 28);
      [cx + 30, cx + 88].forEach(x => { carRect(c, x - 6, bodyTop - 76, 12, 48, 3, '#d4d4d8', 2); });
      c.fillStyle = '#65a30d'; c.fillRect(L + 14, bodyTop + 14, 40, 14); c.fillRect(R - 70, bodyTop + 22, 26, 10);  // primer patches
      c.fillStyle = INK; [L + 20, L + 40, R - 60].forEach(x => { c.beginPath(); c.arc(x, bodyTop + 40, 3, 0, 7); c.fill(); });
      lamp(c, L + 6, base - 84, 22, 22, lt, brake); lamp(c, R - 28, base - 84, 22, 22, lt, brake);
    },
    phantom() {
      c.globalAlpha = 0.9;
      const pg = c.createLinearGradient(0, base - 170, 0, bodyTop);
      pg.addColorStop(0, 'rgba(236,254,255,0.75)'); pg.addColorStop(1, 'rgba(34,211,238,0.35)');
      carPoly(c, [[cx - 70 + shift, bodyTop], [cx + 70 + shift, bodyTop], [cx + 30 + shift, base - 160], [cx - 30 + shift, base - 160]], pg, 3);
      drawDriver(c, 'ghost', cx + shift, bodyTop - 26, 1);
      carPoly(c, [[cx - 6 + shift, base - 160], [cx + 6 + shift, base - 160], [cx + shift, base - 190]], '#a5f3fc', 2);   // tail fin
      c.globalAlpha = 1;
      lamp(c, L + 30, base - 62, bw - 60, 10, lt, brake);
    }
  };
  S[def.style]();
}

let CAR_SPRITES = null;
function buildCars() {
  if (CAR_SPRITES) return CAR_SPRITES;
  CAR_SPRITES = {};
  Object.entries(CAR_DEFS).forEach(([key, def]) => {
    CAR_SPRITES[key] = { normal: [], brake: [] };
    POSES.forEach(yaw => {
      ['normal', 'brake'].forEach(state => {
        if (state === 'brake' && key !== 'player') return;
        const cv = makeCanvas(CAR_CW, CAR_CH);
        if (cv) { const c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round'; paintCar(c, def, yaw, state === 'brake'); }
        CAR_SPRITES[key][state].push(cv);
      });
    });
  });
  return CAR_SPRITES;
}

/* Draw a car with its tyres on (x, y). `pxPerUnit` is the projection scale in
   screen px per world unit at that depth. */
function drawCarSprite(ctx, key, x, y, pxPerUnit, yaw, brake, alpha = 1) {
  const set = buildCars()[key];
  const idx = Math.max(0, Math.min(POSES.length - 1, Math.round((yaw + 1) * 2)));
  const cv = (brake && set.brake.length ? set.brake : set.normal)[idx];
  const w = CAR_CW * (CAR_WORLD_W / CAR_BODY_PX) * pxPerUnit;
  if (w < 4 || !cv) return w;
  const h = w * CAR_CH / CAR_CW;
  ctx.globalAlpha = alpha;
  ctx.drawImage(cv, Math.round(x - w / 2), Math.round(y - h * CAR_BASE_Y / CAR_CH), Math.round(w), Math.round(h));
  ctx.globalAlpha = 1;
  return w;
}
