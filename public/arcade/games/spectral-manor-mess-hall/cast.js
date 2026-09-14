// ============================================================
// MESS HALL — the cast: hero, five monsters, the Head Chef
// Drawn in the arcade house style (ink outline, shade pass, lit eyes) but
// authored for THIS game: every character has a free throwing arm, because
// the throw is a softball WINDMILL — the arm makes a full vertical circle in
// the plane of the aim (down → forward → overhead → back → down) and the food
// leaves the hand at the bottom of the circle, beside the hip.
// Figures are drawn around their FEET. Bodies mirror to face their travel;
// the throwing arm is world-space so the circle always turns toward the aim.
// ============================================================

// ---------- overhand pitch rig ----------
// (Names kept from the first version, which was an underhand softball
// windmill.) The arm turns BACKWARD through the circle: it cocks back behind
// the body, whips up over the top, releases in front of and above the
// shoulder, then follows through down across the front.
const WINDMILL_RELEASE = 0.72;         // fraction of the animation at which food leaves the hand
const DEG = Math.PI / 180;
const COCK_ANGLE = -110 * DEG;         // arm drawn back behind the body
const RELEASE_ANGLE = -235 * DEG;      // hand forward and high: the release point
const FOLLOW_ANGLE = -325 * DEG;       // follow-through, down in front

// Arm angle (radians) measured from "straight down"; negative = swinging back
// first, so the hand passes behind, then overhead, then forward.
function windmillAngle(p) {
  if (p <= 0.34) {                     // wind-up: ease the arm back
    const k = p / 0.34;
    return COCK_ANGLE * (1 - (1 - k) * (1 - k));
  }
  if (p <= WINDMILL_RELEASE) {         // the whip: accelerate over the top
    const k = (p - 0.34) / (WINDMILL_RELEASE - 0.34);
    return COCK_ANGLE + (RELEASE_ANGLE - COCK_ANGLE) * Math.pow(k, 1.6);
  }
  const k = (p - WINDMILL_RELEASE) / (1 - WINDMILL_RELEASE);
  return RELEASE_ANGLE + (FOLLOW_ANGLE - RELEASE_ANGLE) * (1 - (1 - k) * (1 - k));
}
// Where the food leaves the hand.
function releasePoint(sx, sy, aim, L) { return windmillHand(sx, sy, aim, RELEASE_ANGLE, L); }
// While the arm is cocked back the hand is behind the body, so the arm is
// drawn BEHIND the torso; once it comes over the top it is drawn in front.
// Aiming up the screen (away from the viewer) flips which side is behind.
function armIsBehind(aim, p) {
  const back = Math.sin(windmillAngle(p)) < -0.25;
  return Math.sin(aim) < -0.35 ? !back : back;
}
// A ghost's arm is a flap of its sheet, not a limb: it leaves the side of
// the sheet and reaches forward with a drooping, swaying tip.
function ghostArm(x, y, dir, t) {
  const sway = Math.sin(t * 0.08) * 3;
  // wide where it leaves the sheet, tapering to a limp tip that droops
  ctx.beginPath();
  ctx.moveTo(x - dir * 3, y - 7);
  ctx.quadraticCurveTo(x + dir * 9, y - 9 + sway * 0.4, x + dir * 17, y - 2 + sway);
  ctx.quadraticCurveTo(x + dir * 19, y + 4 + sway, x + dir * 15, y + 5 + sway);
  ctx.quadraticCurveTo(x + dir * 8, y + 1 + sway * 0.4, x - dir * 3, y + 7);
  ctx.closePath();
  ctx.fillStyle = '#d5f0ef'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
  // a fold line so it reads as cloth
  ctx.strokeStyle = 'rgba(94,140,150,0.6)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x + dir * 2, y + 1); ctx.quadraticCurveTo(x + dir * 9, y - 1 + sway * 0.4, x + dir * 14, y + 2 + sway); ctx.stroke();
}
// Hand position for a straight arm of length L at windmill angle phi.
// Forward is the aim direction, foreshortened vertically for the 3/4 view.
function windmillHand(sx, sy, aim, phi, L) {
  const fx = Math.cos(aim), fy = Math.sin(aim) * 0.55;
  const fwd = Math.sin(phi) * L, down = Math.cos(phi) * L;
  return { x: sx + fx * fwd, y: sy + fy * fwd + down };
}

function limb(pts, color, w) {
  const run = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = w + 3; run();
  ctx.strokeStyle = color; ctx.lineWidth = w; run();
}
function litEyes(pts, color, blur = 8, size = 2.4) {
  ctx.shadowColor = color; ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  pts.forEach(([x, y]) => ctx.fillRect(x - size / 2, y - size / 2, size, size));
  ctx.shadowBlur = 0;
}
function drawShadow(x, y, rx, a = 0.38) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.32, 0, 0, Math.PI * 2); ctx.fill();
}

// The throwing arm, with the motion arc that sells the circle.
// who: {throwAnim, throwDur, angle, pendingThrow|heldFood}
function drawThrowArm(sx, sy, aim, p, L, sleeve, hand, food) {
  const phi = windmillAngle(p);
  if (p > 0.08 && p < WINDMILL_RELEASE + 0.12) {
    ctx.lineCap = 'round';
    for (let i = 1; i <= 7; i++) {
      const a0 = windmillAngle(Math.max(0, p - i * 0.045)), a1 = windmillAngle(Math.max(0, p - (i - 1) * 0.045));
      const h0 = windmillHand(sx, sy, aim, a0, L + 3), h1 = windmillHand(sx, sy, aim, a1, L + 3);
      ctx.strokeStyle = `rgba(255,255,255,${0.32 - i * 0.04})`;
      ctx.lineWidth = 7 - i * 0.7;
      ctx.beginPath(); ctx.moveTo(h0.x, h0.y); ctx.lineTo(h1.x, h1.y); ctx.stroke();
    }
  }
  const elbow = windmillHand(sx, sy, aim, phi, L * 0.5);
  const h = windmillHand(sx, sy, aim, phi, L);
  limb([[sx, sy], [elbow.x, elbow.y], [h.x, h.y]], sleeve, 5);
  if (food && p < WINDMILL_RELEASE) {
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(phi); drawFoodShape(food, 5.5); ctx.restore();
  }
  inkOval(h.x, h.y, 3.2, 3.2, hand, 1.5);
}

function throwProgress(e) {
  return e.throwAnim > 0 ? 1 - e.throwAnim / e.throwDur : 0;
}

// Legs: two segments with a knee, stride driven by walkPhase.
function legs(stride, lift, color, boot, w = 5, hipY = -20, spread = 5) {
  const leg = (hx, s, l) => [[hx, hipY], [hx + s * 0.5, hipY / 2 - Math.abs(s) * 0.05], [hx + s, -l]];
  const a = leg(-spread, stride, Math.max(0, lift)), b = leg(spread, -stride, Math.max(0, -lift));
  limb(a, shade(color, -0.3), w);
  inkRect(a[2][0] - 4, a[2][1] - 3, 9, 4, shade(boot, -0.3), 1.6);
  limb(b, color, w);
  inkRect(b[2][0] - 4, b[2][1] - 3, 9, 4, boot, 1.6);
}

// ---------- hero ----------
const HERO = { suit: '#e6ecf7', trim: '#7c3aed', limb: '#6d28d9', visor: '#16305c', lamp: '#67e8f9', boot: '#3b2b52' };

function drawHero(p, t) {
  const fx = p.x + p.w / 2, fy = p.y + p.h + 2;
  drawShadow(fx, fy, 15);
  const face = Math.cos(p.angle) < 0 ? -1 : 1;
  const tp = throwProgress(p);
  const moving = p.vx || p.vy;
  const sw = moving ? Math.sin(p.walkPhase) : 0;
  const bob = moving ? Math.abs(sw) * 2 : Math.sin(t * 0.05) * 0.8;
  // a pitcher's stride: the front leg steps out through the release
  const step = tp > 0 ? Math.sin(Math.min(1, tp / WINDMILL_RELEASE) * Math.PI * 0.5) * 9 : 0;
  const aimUp = Math.sin(p.angle) < -0.35;
  const shoulder = { x: fx + face * 8, y: fy - 40 - bob };

  const armBehind = tp > 0 && armIsBehind(p.angle, tp);
  if (armBehind) drawThrowArm(shoulder.x, shoulder.y, p.angle, tp, 17, HERO.limb, '#cfe6ff', p.nextFood);

  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(face, 1);
  ctx.translate(0, -bob);
  if (tp > 0) ctx.rotate(Math.sin(tp * Math.PI) * 0.12);
  // off arm (back)
  limb([[-8, -40], [-12 + sw * 4, -33], [-12 - sw * 8, -26]], shade(HERO.limb, -0.3), 5);
  legs(sw * 13 + step, sw * 6, HERO.limb, HERO.boot);
  // torso with lit and shaded halves
  const TORSO = [[-9, -44], [9, -44], [11, -28], [8, -20], [-8, -20], [-11, -28]];
  inkPoly(TORSO, HERO.suit);
  ctx.save(); ctx.beginPath(); ctx.rect(-12, -46, 6, 30); ctx.clip(); inkPoly(TORSO, shade(HERO.suit, -0.3), 0); ctx.restore();
  ctx.fillStyle = HERO.trim; ctx.fillRect(-8, -38, 16, 3.5);
  ctx.fillStyle = shade(HERO.trim, -0.3); ctx.fillRect(-8, -25, 16, 3);
  ctx.shadowColor = HERO.lamp; ctx.shadowBlur = 8; ctx.fillStyle = HERO.lamp;
  ctx.beginPath(); ctx.arc(3.5, -31, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  // helmet, visor, antenna lamp
  const hy = -54;
  ctx.fillStyle = '#25203a'; ctx.fillRect(-6, -46, 12, 4);
  inkOval(0, hy, 11.5, 11, '#eef3fa');
  inkOval(-4, hy - 4, 4.5, 3, '#ffffff', 0);
  inkOval(2, hy + 0.5, 8.2, 7, HERO.visor, 2);
  litEyes([[1, hy], [6, hy]], HERO.lamp, 9, 3);
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(-2, hy - 3, 2.4, 1.4, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.shadowColor = HERO.lamp; ctx.shadowBlur = 10; ctx.strokeStyle = HERO.lamp; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-7, hy - 8); ctx.lineTo(-11, hy - 16); ctx.stroke();
  ctx.fillStyle = p.power ? POWER_COLORS[p.power] : HERO.lamp;
  ctx.beginPath(); ctx.arc(-11, hy - 17, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.restore();

  if (tp > 0 && !armBehind) drawThrowArm(shoulder.x, shoulder.y, p.angle, tp, 17, HERO.limb, '#cfe6ff', p.nextFood);
  else if (tp === 0) {
    // ready pose: food cradled at the hip on the throwing side
    const hx = fx + face * 12, hyy = fy - 26 - bob;
    limb([[shoulder.x, shoulder.y], [fx + face * 13, fy - 33 - bob], [hx, hyy]], HERO.limb, 5);
    if (p.nextFood && ammo > 0) { ctx.save(); ctx.translate(hx, hyy - 2); drawFoodShape(p.nextFood, 5.5); ctx.restore(); }
    inkOval(hx, hyy, 3.2, 3.2, '#cfe6ff', 1.5);
  }
}

// ---------- monsters ----------
const MONSTER_LOOK = {
  vampire:  { sleeve: '#1f1726', hand: '#e5e1ea', leg: '#1c1622', boot: '#0b0a10' },
  werewolf: { sleeve: '#7a5a44', hand: '#5b4334', leg: '#6b4f3b', boot: '#3b2a1f' },
  frank:    { sleeve: '#2f3a3f', hand: '#8fbf7a', leg: '#262a33', boot: '#141414' },
  ghost:    { sleeve: '#d5f0ef', hand: '#eafafa' },
  witch:    { sleeve: '#3b2b65', hand: '#86b86b', leg: '#1f1733', boot: '#0f0a1a' }
};

function drawMonster(c, t) {
  const fx = c.x + c.w / 2, fy = c.y + c.h + 2;
  const L = MONSTER_LOOK[c.type];
  const face = Math.cos(c.angle) < 0 ? -1 : 1;
  const tp = throwProgress(c);
  const sw = Math.sin(c.walkPhase);
  const floating = c.type === 'ghost';
  const crouch = c.pounce && c.pounce.phase === 'crouch' ? 1 : 0;
  const bob = floating ? Math.sin(t * 0.08 + c.walkPhase) * 3 + 6 : Math.abs(sw) * 1.6 - crouch * 5;
  drawShadow(fx, fy, floating ? 12 : 15, floating ? 0.25 : 0.38);
  if (c.hurtT > 0 && (c.hurtT >> 1) % 2) ctx.globalAlpha = 0.55;
  if (floating) ctx.globalAlpha *= 0.88;
  if (c.type === 'vampire' && c.blinkT > 0) ctx.globalAlpha *= 1 - c.blinkT / 12;

  const shoulder = { x: fx + face * 9, y: fy - 40 - bob + (c.type === 'frank' ? -4 : 0) };
  const aimUp = Math.sin(c.angle) < -0.35;
  const armBehind = tp > 0 && !c.carryDish && armIsBehind(c.angle, tp);
  if (armBehind) drawThrowArm(shoulder.x, shoulder.y, c.angle, tp, 16, L.sleeve, L.hand, c.pendingThrow && c.pendingThrow.food.name);

  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(face, 1);
  ctx.translate(0, -bob);
  if (!c.carryDish && !floating) ctx.rotate(sw * 0.05 + crouch * 0.25);
  BODY[c.type](c, t, sw);
  ctx.restore();

  if (c.carryDish) {                     // both arms up, the stolen dish overhead
    limb([[fx - 8, fy - 40 - bob], [fx - 10, fy - 50 - bob], [fx - 6, fy - 62 - bob]], L.sleeve, 5);
    limb([[fx + 8, fy - 40 - bob], [fx + 10, fy - 50 - bob], [fx + 6, fy - 62 - bob]], L.sleeve, 5);
    inkOval(fx, fy - 64 - bob, 12, 4.5, '#e9d5ff', 1.5);
    ctx.save(); ctx.translate(fx, fy - 70 - bob); drawFoodShape('cake', 6); ctx.restore();
  } else if (tp > 0) {
    if (!armBehind) drawThrowArm(shoulder.x, shoulder.y, c.angle, tp, 16, L.sleeve, L.hand, c.pendingThrow && c.pendingThrow.food.name);
  } else if (floating) {
    ghostArm(shoulder.x + face * 3, shoulder.y + 4, face, t + c.walkPhase * 10);
  } else {
    const swing = sw * 7;
    limb([[shoulder.x, shoulder.y], [shoulder.x + face * 2 + swing * 0.4, shoulder.y + 8], [shoulder.x + face * 3 + swing, shoulder.y + 15]], L.sleeve, 5);
    inkOval(shoulder.x + face * 3 + swing, shoulder.y + 16, 3, 3, L.hand, 1.5);
  }
  ctx.globalAlpha = 1;

  if (c.maxHp > 1) {
    ctx.fillStyle = 'rgba(15,10,26,0.8)'; ctx.fillRect(fx - 13, fy + 5, 26, 5);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(fx - 12, fy + 6, 24 * (c.hp / c.maxHp), 3);
  }
}

// Body (legs, torso, off arm, head) around the feet, facing +x.
const BODY = {
  vampire(c, t, sw) {
    const flare = Math.abs(sw) * 6 + 3;
    // cape behind everything, lined in crimson
    inkPoly([[-9, -46], [9, -46], [14 + flare * 0.3, -6], [-16 - flare, -2], [-12, -30]], '#9f1239');
    inkPoly([[-8, -46], [6, -46], [4, -10], [-14 - flare, -4]], '#16101d');
    legs(sw * 11, sw * 5, MONSTER_LOOK.vampire.leg, MONSTER_LOOK.vampire.boot);
    limb([[-7, -40], [-10, -32], [-9 - sw * 6, -25]], shade('#1f1726', -0.3), 5);
    inkPoly([[-9, -45], [9, -45], [10, -21], [-10, -21]], '#1f1726');       // tailcoat
    inkPoly([[-3, -45], [3, -45], [2, -28], [-2, -28]], '#f5f0e6', 1.5);     // shirt front
    inkPoly([[-3, -44], [0, -40], [3, -44]], '#9f1239', 1.2);                // cravat
    inkPoly([[-11, -47], [-6, -56], [-5, -44]], '#16101d', 1.5);             // high collar
    inkPoly([[11, -47], [6, -56], [5, -44]], '#16101d', 1.5);
    inkOval(0, -54, 8.5, 10, '#e5e1ea');                                     // gaunt face
    inkPoly([[-9, -57], [-8, -64], [1, -66], [9, -63], [9, -56], [4, -60], [1, -57], [-3, -60]], '#0f0a1a', 1.5); // widow's peak
    litEyes([[1, -55], [6, -55]], '#ef4444', 8, 2.4);
    ctx.fillStyle = '#fff'; ctx.fillRect(1.5, -49, 1.5, 3); ctx.fillRect(5, -49, 1.5, 3); // fangs
  },
  werewolf(c, t, sw) {
    inkPoly([[-10, -26], [-24, -30 + sw * 3], [-20, -22]], '#6b4f3b', 1.8);  // tail
    const pounce = c.pounce && c.pounce.phase === 'dash';
    legs(pounce ? 14 : sw * 13, sw * 7, MONSTER_LOOK.werewolf.leg, MONSTER_LOOK.werewolf.boot, 6);
    limb([[-7, -38], [-12, -30], [-10 - sw * 6, -22]], shade('#7a5a44', -0.3), 6);
    inkPoly([[-11, -44], [10, -46], [13, -26], [8, -19], [-9, -19], [-13, -30]], '#7a5a44');   // hunched furry torso
    inkPoly([[-8, -40], [8, -41], [9, -28], [-7, -27]], '#5b21b6', 1.5);    // torn shirt
    ctx.strokeStyle = '#7a5a44'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4, -40); ctx.lineTo(-1, -33); ctx.moveTo(3, -41); ctx.lineTo(5, -34); ctx.stroke();
    inkPoly([[-7, -62], [-10, -74], [-2, -64]], '#5b4334', 1.5);             // ears
    inkPoly([[3, -64], [7, -75], [10, -62]], '#5b4334', 1.5);
    inkOval(0, -55, 10, 10, '#8b6b52');
    inkPoly([[5, -58], [18, -54], [17, -47], [5, -48]], '#a3846a');          // snout
    inkOval(18, -54, 2.2, 1.8, '#0f0a1a', 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(10, -48, 1.5, 3); ctx.fillRect(14, -48, 1.5, 2.5);
    litEyes([[1, -58], [6, -58]], '#facc15', 8, 2.6);
    ctx.fillStyle = '#3b2a1f'; ctx.fillRect(-3, -62, 11, 2);                 // heavy brow
  },
  frank(c, t, sw) {
    const stomp = Math.abs(sw);
    legs(sw * 8, stomp * 3, MONSTER_LOOK.frank.leg, MONSTER_LOOK.frank.boot, 7, -22, 6);
    inkRect(-11, -4, 10, 5, '#141414', 1.5); inkRect(1, -4, 11, 5, '#141414', 1.5);   // platform boots
    limb([[-8, -44], [-10, -36], [-10 - sw * 3, -28]], shade('#2f3a3f', -0.3), 7);
    inkPoly([[-13, -48], [13, -48], [14, -22], [-14, -22]], '#2f3a3f');     // too-small jacket
    inkPoly([[-2, -48], [2, -48], [3, -22], [-3, -22]], '#1c2326', 1.2);
    ctx.fillStyle = '#8fbf7a'; ctx.fillRect(-12, -26, 24, 4);                // shirt gap
    // neck bolts
    inkRect(-14, -52, 5, 4, '#9ca3af', 1.2); inkRect(9, -52, 5, 4, '#9ca3af', 1.2);
    // tall flat-topped head
    inkRect(-10, -72, 20, 22, '#8fbf7a');
    ctx.fillStyle = shade('#8fbf7a', -0.25); ctx.fillRect(-9, -52, 18, 3);
    inkRect(-11, -76, 22, 7, '#111827');                                      // flat black hair
    inkPoly([[-11, -69], [-7, -65], [-4, -69], [0, -65], [4, -69], [8, -65], [11, -69]], '#111827', 1.2); // jagged fringe
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.2;                         // forehead stitches
    ctx.beginPath(); ctx.moveTo(-8, -63); ctx.lineTo(4, -64);
    for (let x = -6; x <= 3; x += 3) { ctx.moveTo(x, -66); ctx.lineTo(x, -61); }
    ctx.stroke();
    ctx.fillStyle = '#3f5f35'; ctx.fillRect(-8, -60, 16, 3);                  // heavy brow
    litEyes([[0, -57], [5.5, -57]], '#d9ff63', 6, 2.4);
    ctx.fillStyle = '#1f2937'; ctx.fillRect(-2, -53, 9, 1.6);                 // flat mouth
  },
  ghost(c, t) {
    const hem = [];
    for (let i = 0; i <= 6; i++) hem.push([13 - i * 4.4, -6 + Math.sin(t * 0.15 + i * 1.3) * 3 + (i % 2 ? 3 : 0)]);
    inkPoly([[-13, -6], [-14, -36], [-10, -52], [0, -58], [10, -53], [14, -38], [14, -6], ...hem.slice(0, 1), ...hem.slice(1)], '#d5f0ef');
    ctx.save(); ctx.beginPath(); ctx.rect(-15, -60, 9, 60); ctx.clip();
    inkPoly([[-13, -6], [-14, -36], [-10, -52], [0, -58], [10, -53], [14, -38], [14, -6]], '#a7d3d6', 0);
    ctx.restore();
    // far-side sleeve: a short sheet flap drooping off the back edge
    const s = Math.sin(t * 0.08 + 1) * 2;
    inkPoly([[-11, -42], [-19, -39 + s], [-22, -32 + s], [-18, -31 + s], [-12, -33]], '#bfe3e4', 1.8);
    inkOval(0, -42, 3.4, 5, '#18213b', 0); inkOval(8, -42, 3.4, 5, '#18213b', 0);  // hollow eyes
    inkOval(4, -31, 2.8, 3.6 + Math.sin(t * 0.1) * 0.8, '#18213b', 0);           // moaning mouth
    litEyes([[0.5, -41], [8.5, -41]], '#67e8f9', 6, 1.6);
  },
  witch(c, t, sw) {
    legs(sw * 10, sw * 5, MONSTER_LOOK.witch.leg, MONSTER_LOOK.witch.boot, 4, -14, 4);
    limb([[-7, -40], [-10, -32], [-9 - sw * 6, -25]], shade('#3b2b65', -0.3), 5);
    // dress with a tattered hem
    inkPoly([[-8, -44], [8, -44], [15, -12], [9, -15], [5, -9], [0, -14], [-5, -9], [-10, -14], [-15, -11]], '#3b2b65');
    ctx.fillStyle = '#e9b75b'; ctx.fillRect(-7, -30, 14, 2.5);               // belt
    inkPoly([[-9, -60], [-14, -40], [-8, -44]], '#111827', 1.2);             // long hair
    inkOval(0, -52, 8.5, 9, '#86b86b');
    inkPoly([[6, -54], [15, -50], [7, -48]], '#6e9e56', 1.4);                // long nose
    litEyes([[1, -54], [5.5, -54]], '#fde047', 7, 2.2);
    // hat: wide brim, crooked cone, gold band
    inkPoly([[-17, -60], [17, -60], [14, -57], [-14, -57]], '#2a1f4d', 1.8);
    inkPoly([[-9, -60], [9, -60], [4, -72], [8, -84], [-2, -74]], '#392b65', 1.8);
    ctx.fillStyle = '#e9b75b'; ctx.fillRect(-8, -64, 16, 3);
  }
};

// ---------- the Head Chef ----------
function drawHeadChef(b, t) {
  const fx = b.x, fy = b.y;
  drawShadow(fx, fy + 4, 40, 0.3);
  const face = Math.cos(b.aim) < 0 ? -1 : 1;
  const hover = Math.sin(t * 0.06) * 4 + 12;
  const flash = b.hurtT > 0 && (b.hurtT >> 1) % 2;
  const S = 1.9;                               // he is authored at hero scale, drawn nearly double
  const tp = b.throwAnim > 0 ? 1 - b.throwAnim / b.throwDur : 0;
  const shoulder = { x: fx + face * 17 * S, y: fy - hover - 40 * S };
  const aimUp = Math.sin(b.aim) < -0.35;
  if (flash) ctx.globalAlpha = 0.6;

  const armBehind = tp > 0 && armIsBehind(b.aim, tp);
  if (armBehind) drawThrowArm(shoulder.x, shoulder.y, b.aim, tp, 30, '#f5f5f4', '#e7e5e4', null);

  ctx.save();
  ctx.translate(fx, fy - hover);
  ctx.scale(face * S, S);
  // spectral tail instead of legs
  for (let i = 0; i < 3; i++) {
    const w = Math.sin(t * 0.12 + i * 2) * 4;
    inkPoly([[-12 + i * 8, -22], [-6 + i * 8, -22], [-8 + i * 7 + w, 4 + i * 2], [-12 + i * 8 + w, 2]], rgba('#c7f0ef', 0.7), 1.2);
  }
  // off arm holding the cleaver (raised during the cleaver attack)
  const raise = b.state === 'cleaver' && b.t < CLEAVER_WINDUP ? 1 - b.t / CLEAVER_WINDUP : b.state === 'bell' ? Math.abs(Math.sin(t * 0.5)) : 0;
  const ha = [-20, -30 - raise * 22];
  limb([[-12, -42], [-19, -36 - raise * 12], ha], shade('#f5f5f4', -0.25), 7);
  if (b.state !== 'cleaverOut') {
    ctx.save(); ctx.translate(ha[0], ha[1]); ctx.rotate(-0.4 - raise * 0.8);
    inkRect(-3, -2, 5, 12, '#57534e', 1.5);
    inkPoly([[-8, -18], [8, -18], [8, -2], [-8, -2]], '#d6d3d1', 1.8);
    if (raise > 0.6) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 14; ctx.fillStyle = '#fff'; ctx.fillRect(4, -17, 3, 3); ctx.shadowBlur = 0; }
    ctx.restore();
  }
  if (b.state === 'bell') {
    inkPoly([[-26, -64], [-14, -64], [-16, -74], [-24, -74]], '#fbbf24', 1.5);
  }
  // double-breasted chef coat
  inkPoly([[-15, -48], [15, -48], [18, -22], [-18, -22]], '#f5f5f4');
  ctx.save(); ctx.beginPath(); ctx.rect(-19, -50, 10, 30); ctx.clip(); inkPoly([[-15, -48], [15, -48], [18, -22], [-18, -22]], '#d6d3d1', 0); ctx.restore();
  ctx.fillStyle = '#44403c';
  [[-5, -42], [5, -42], [-5, -34], [5, -34], [-5, -26], [5, -26]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = 'rgba(185,28,28,0.7)';                                    // stains
  ctx.beginPath(); ctx.arc(9, -30, 3, 0, Math.PI * 2); ctx.arc(-10, -38, 2, 0, Math.PI * 2); ctx.fill();
  inkPoly([[-8, -50], [8, -50], [0, -44]], '#dc2626', 1.5);                  // neckerchief
  // head: jowly, handlebar moustache, glowing eyes, the tall toque
  inkOval(0, -58, 11, 10, '#dfe7e6');
  inkPoly([[-2, -54], [-10, -56], [-15, -60], [-11, -52], [-2, -51]], '#44403c', 1.2);
  inkPoly([[2, -54], [10, -56], [15, -60], [11, -52], [2, -51]], '#44403c', 1.2);
  const angry = b.state === 'dizzy' ? 0 : 1;
  if (b.state === 'dizzy') {
    ctx.strokeStyle = '#18213b'; ctx.lineWidth = 1.5;
    [[-4, -61], [4, -61]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.5, t * 0.3, t * 0.3 + 4.5); ctx.stroke(); });
  } else litEyes([[-4, -61], [4, -61]], b.phase2 ? '#f87171' : '#67e8f9', 10, 3);
  ctx.fillStyle = '#18213b'; ctx.fillRect(-7, -66 + angry, 5, 1.6); ctx.fillRect(2, -66 + angry, 5, 1.6);
  inkRect(-10, -72, 20, 5, '#f5f5f4', 1.5);
  inkPoly([[-10, -72], [-13, -84], [-6, -92], [0, -86], [6, -93], [13, -84], [10, -72]], '#fafaf9', 1.8);
  ctx.restore();

  if (tp > 0 && !armBehind) drawThrowArm(shoulder.x, shoulder.y, b.aim, tp, 30, '#f5f5f4', '#e7e5e4', null);
  else if (tp === 0) limb([[shoulder.x, shoulder.y], [shoulder.x + face * 8, shoulder.y + 14], [shoulder.x + face * 6, shoulder.y + 28]], '#f5f5f4', 7);
  if (tp > 0 && tp < WINDMILL_RELEASE) {   // the giant pie rides the windmill
    const h = windmillHand(shoulder.x, shoulder.y, b.aim, windmillAngle(tp), 30);
    ctx.save(); ctx.translate(h.x, h.y); drawFoodShape('pie', 13); ctx.restore();
  }
  ctx.globalAlpha = 1;

  if (b.state === 'dizzy') {
    for (let i = 0; i < 3; i++) {
      const a = t * 0.12 + i * 2.09;
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('★', fx + Math.cos(a) * 26, fy - hover - 190 + Math.sin(a) * 8);
    }
  }
  if (b.state === 'slam' && b.t < SLAM_WINDUP) {   // TELL: the pot rises and the ring shows
    const k = 1 - b.t / SLAM_WINDUP;
    ctx.strokeStyle = `rgba(250,204,21,${0.2 + k * 0.6})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(fx, fy, 60 + k * 30, (60 + k * 30) * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    inkOval(fx, fy - hover - 190 + k * -10, 22, 10, '#57534e', 2);
  }
}

// ---------- telegraphs and lobbed things ----------
function drawLob(l, t) {
  const k = l.t / l.dur;
  // landing ring on the floor (the tell)
  ctx.strokeStyle = l.kind === 'potion' ? `rgba(134,239,172,${0.35 + k * 0.5})` : `rgba(248,113,113,${0.35 + k * 0.5})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(l.tx, l.ty, l.radius * (0.5 + k * 0.5), l.radius * 0.42 * (0.5 + k * 0.5), 0, 0, Math.PI * 2); ctx.stroke();
  const x = l.x0 + (l.tx - l.x0) * k, gy = l.y0 + (l.ty - l.y0) * k;
  const h = Math.sin(k * Math.PI) * l.arc;
  drawShadow(x, gy, 8 * (1 - h / (l.arc * 1.5)), 0.3);
  ctx.save();
  ctx.translate(x, gy - h);
  ctx.rotate(t * 0.25);
  if (l.kind === 'potion') {
    inkOval(0, 3, 6, 6, '#22c55e', 1.5);
    inkRect(-2, -7, 4, 6, '#a7f3d0', 1.2);
    ctx.fillStyle = '#86efac'; ctx.fillRect(-3, -9, 6, 2);
  } else {
    drawFoodShape('pie', l.size || 13);
  }
  ctx.restore();
}

function drawPuddle(pd) {
  ctx.globalAlpha = Math.min(0.75, pd.life / 60);
  ctx.fillStyle = pd.color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, r = pd.r * (0.8 + ((i * 7) % 3) * 0.1);
    const x = pd.x + Math.cos(a) * r, y = pd.y + Math.sin(a) * r * 0.45;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}

const POWER_COLORS = { hotsauce: '#ef4444', triple: '#fbbf24', bigpie: '#f0abfc' };
function drawPowerPickup(p, t) {
  const col = POWER_COLORS[p.power];
  const y = p.y + Math.sin(p.bob) * 3;
  ctx.save();
  ctx.translate(p.x + 9, y + 9);
  ctx.shadowColor = col; ctx.shadowBlur = 16;
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 13 + Math.sin(t * 0.15) * 1.5, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  if (p.power === 'hotsauce') { inkRect(-4, -6, 8, 12, '#dc2626', 1.5); inkRect(-2, -10, 4, 4, '#fef3c7', 1.2); }
  else if (p.power === 'triple') { [-6, 0, 6].forEach(dx => { ctx.save(); ctx.translate(dx, 0); drawFoodShape('tomato', 3.5); ctx.restore(); }); }
  else drawFoodShape('pie', 8);
  ctx.restore();
}
