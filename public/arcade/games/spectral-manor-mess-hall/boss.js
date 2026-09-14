// ============================================================
// MESS HALL — the Head Chef (boss of the Kitchen and the Banquet Hall)
// Interface used by game.js:
//   createHeadChef(round)   round 1 = Kitchen, 2 = Banquet (+ cycle scaling)
//   updateHeadChef(b)       one 60 Hz step
//   headChefHit(b, food)    true if the hero's food struck him
//   headChefTouches()       true if the hero is touching him
// Every attack has a tell drawn in cast.js:
//   pie      a slow giant windmill, then a landing ring where it will splash
//   cleaver  raised with a glint, then thrown out and back like a boomerang
//   bell     rings for backup — two monsters come through the doors
//   slam     (below half health) the pot rises over a growing ring, then soup
//            sprays out in a circle
// Landing six hits in quick succession leaves him DIZZY: he takes double
// damage and stops attacking for a moment.
// ============================================================

const CHEF_THROW = 54, CLEAVER_WINDUP = 34, SLAM_WINDUP = 50, BELL_TIME = 60;
const DIZZY_HITS = 6, DIZZY_WINDOW = 100, DIZZY_TIME = 150;

function createHeadChef(round) {
  const hp = Math.round((round === 1 ? 36 : 56) * (1 + cycleOf(level) * 0.35));
  return {
    x: W / 2, y: WALL_H - 20, w: 64, h: 70, hp, maxHp: hp, round,
    state: 'enter', t: 90, aim: Math.PI / 2, phase2: false,
    throwAnim: 0, throwDur: CHEF_THROW, thrown: false,
    cleavers: [], recentHits: [], hurtT: 0, lastAttack: null
  };
}

function chefHitbox(b) { return { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h }; }

function updateHeadChef(b) {
  if (b.hurtT > 0) b.hurtT--;
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  b.aim = Math.atan2(py - (b.y - 60), px - b.x);
  b.phase2 = b.hp <= b.maxHp / 2;
  const fast = b.round === 2 ? 1.25 : 1;
  b.recentHits = b.recentHits.filter(f => tick - f < DIZZY_WINDOW);
  updateCleavers(b);

  if (b.state === 'enter') {
    b.y += 1.4;
    if (--b.t <= 0) { b.state = 'idle'; b.t = 50; }
    return;
  }
  if (b.state === 'dizzy') { if (--b.t <= 0) { b.state = 'idle'; b.t = 40; } return; }

  if (b.state === 'idle') {
    // keep a throwing distance: drift away when crowded, closer when far
    const d = Math.hypot(px - b.x, py - b.y) || 1;
    const want = d < 200 ? -1 : d > 320 ? 1 : 0;
    b.x += (px - b.x) / d * want * 1.2 * fast + Math.sin(tick * 0.02) * 0.6;
    b.y += (py - b.y) / d * want * 1.0 * fast;
    b.x = Math.max(60, Math.min(W - 60, b.x));
    b.y = Math.max(WALL_H + 90, Math.min(H - 30, b.y));
    if (--b.t <= 0) {
      const options = ['pie', 'pie', 'cleaver', b.phase2 ? 'slam' : 'pie'];
      if (chefs.length < 3) options.push('bell');
      let pick = options[Math.floor(Math.random() * options.length)];
      if (pick === b.lastAttack && Math.random() < 0.6) pick = options[(options.indexOf(pick) + 1) % options.length];
      b.lastAttack = pick;
      b.state = pick;
      if (pick === 'pie') { b.throwAnim = b.throwDur = Math.round(CHEF_THROW / fast); b.thrown = false; }
      if (pick === 'cleaver') b.t = CLEAVER_WINDUP;
      if (pick === 'bell') { b.t = BELL_TIME; sfx.bell(); }
      if (pick === 'slam') b.t = SLAM_WINDUP + 20;
    }
    return;
  }

  if (b.state === 'pie') {
    b.throwAnim--;
    const p = 1 - b.throwAnim / b.throwDur;
    if (!b.thrown && p >= WINDMILL_RELEASE) {
      b.thrown = true;
      const pies = b.round === 2 ? 2 : 1;
      for (let i = 0; i < pies; i++) {
        const lead = i === 0 ? 0 : 70;
        const tx = px + player.vx * 18 + (i ? Math.cos(b.aim + 1.57) * lead : 0);
        const ty = py + player.vy * 18 + (i ? Math.sin(b.aim + 1.57) * lead : 0);
        lobs.push({ kind: 'pie', x0: b.x, y0: b.y - 40, tx, ty, t: 0, dur: 58, arc: 120, radius: 50, size: 13 });
      }
      sfx.throw();
    }
    if (b.throwAnim <= 0) { b.state = 'idle'; b.t = Math.round((b.phase2 ? 50 : 75) / fast); }
    return;
  }

  if (b.state === 'cleaver') {
    if (--b.t <= 0) {
      const n = b.round === 2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = b.aim + (n === 2 ? (i ? 0.35 : -0.35) : 0);
        b.cleavers.push({ x: b.x, y: b.y - 60, vx: Math.cos(a) * 7.5, vy: Math.sin(a) * 7.5, out: 42, rot: 0 });
      }
      sfx.whoosh();
      b.state = 'cleaverOut';
    }
    return;
  }
  if (b.state === 'cleaverOut') {
    if (b.cleavers.length === 0) { b.state = 'idle'; b.t = 60; }
    return;
  }

  if (b.state === 'bell') {
    if (b.t === 30) {
      spawnMonster(Math.random() < 0.5 ? 'werewolf' : 'vampire', 30, WALL_H + 60 + Math.random() * 300);
      spawnMonster(Math.random() < 0.5 ? 'ghost' : 'witch', W - 60, WALL_H + 60 + Math.random() * 300);
    }
    if (--b.t <= 0) { b.state = 'idle'; b.t = 70; }
    return;
  }

  if (b.state === 'slam') {
    if (--b.t === 20) {
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        foods.push({ x: b.x, y: b.y - 10, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4 * 0.8, r: 6, life: 80, type: 'soup', color: '#facc15', fromChef: true, rot: 0, rotSpeed: 0.2 });
      }
      triggerShake(10, 16);
      sfx.slam();
      spawnSplat(b.x, b.y, '#facc15');
    }
    if (b.t <= 0) { b.state = 'idle'; b.t = 60; }
  }
}

function updateCleavers(b) {
  b.cleavers.forEach(c => {
    c.rot += 0.45;
    if (c.out > 0) { c.out--; }
    else {                                   // come home
      const dx = b.x - c.x, dy = (b.y - 60) - c.y, d = Math.hypot(dx, dy) || 1;
      c.vx += dx / d * 0.7; c.vy += dy / d * 0.7;
      const sp = Math.hypot(c.vx, c.vy);
      if (sp > 9) { c.vx = c.vx / sp * 9; c.vy = c.vy / sp * 9; }
      if (d < 30) c.caught = true;
    }
    c.x += c.vx; c.y += c.vy;
    if (player.invuln <= 0 && Math.hypot(c.x - (player.x + player.w / 2), c.y - (player.y + player.h / 2)) < 20) hurtPlayer('The Head Chef\'s cleaver found you.');
  });
  b.cleavers = b.cleavers.filter(c => !c.caught);
}

function drawCleavers(b, t) {
  b.cleavers.forEach(c => {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.shadowColor = '#f87171'; ctx.shadowBlur = 10;
    inkPoly([[-10, -8], [8, -8], [8, 6], [-10, 6]], '#e7e5e4', 1.8);
    ctx.shadowBlur = 0;
    inkRect(8, -3, 12, 6, '#57534e', 1.5);
    ctx.restore();
  });
}

function headChefHit(b, f) {
  if (b.state === 'enter') return false;
  const r = chefHitbox(b);
  if (!(f.x > r.x && f.x < r.x + r.w && f.y > r.y - 60 && f.y < r.y + r.h)) return false;
  const dmg = (b.state === 'dizzy' ? 2 : 1) * (f.big ? 3 : 1);
  b.hp -= dmg;
  b.hurtT = 8;
  if (b.state !== 'dizzy') {
    b.recentHits.push(tick);
    if (b.recentHits.length >= DIZZY_HITS && b.state === 'idle') {
      b.state = 'dizzy'; b.t = DIZZY_TIME; b.recentHits = [];
      bannerText = 'DIZZY!'; bannerTime = 50;
    }
  }
  return true;
}

function headChefTouches(b) {
  if (b.state === 'enter') return false;
  const r = chefHitbox(b);
  return player.x < r.x + r.w && player.x + player.w > r.x && player.y < r.y + r.h && player.y + player.h > r.y;
}
