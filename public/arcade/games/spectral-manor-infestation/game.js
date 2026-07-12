// ============================================================
// SPECTRAL MANOR INFESTATION — STARTER
// Basic Centipede-style · Hauntipede + player shooter
// Expand with Grok Build using PROMPTS.md
// ============================================================
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let keys = {};
window.addEventListener('keydown', e => { keys[e.code]=true; if(e.code==='Space') e.preventDefault(); });
window.addEventListener('keyup', e => keys[e.code]=false);

const player = { x: W/2, y: H-40, w: 28, h: 16, speed: 5 };
let bullets = [];
let segments = [];
let score = 0;

function spawnHauntipede() {
  segments = [];
  const len = 12;
  for (let i=0; i<len; i++) {
    segments.push({
      x: 40 + i * 22,
      y: 60,
      dir: 1,
      r: 10
    });
  }
}
spawnHauntipede();

function update() {
  if (keys['ArrowLeft']||keys['KeyA']) player.x -= player.speed;
  if (keys['ArrowRight']||keys['KeyD']) player.x += player.speed;
  player.x = Math.max(20, Math.min(W-20, player.x));

  if (keys['Space']) {
    if (!player.lastShot || Date.now()-player.lastShot > 200) {
      bullets.push({ x: player.x, y: player.y-10, vy: -8 });
      player.lastShot = Date.now();
    }
  }

  bullets.forEach(b => b.y += b.vy);
  bullets = bullets.filter(b => b.y > -10);

  // simple hauntipede movement
  let hitEdge = false;
  segments.forEach(s => {
    s.x += s.dir * 1.8;
    if (s.x < 20 || s.x > W-20) hitEdge = true;
  });
  if (hitEdge) {
    segments.forEach(s => {
      s.dir *= -1;
      s.y += 18;
    });
  }

  // bullet vs segment
  bullets.forEach((b, bi) => {
    segments.forEach((s, si) => {
      if (Math.hypot(b.x-s.x, b.y-s.y) < s.r+3) {
        bullets.splice(bi,1);
        segments.splice(si,1);
        score += 50;
      }
    });
  });

  if (segments.length === 0) {
    score += 500;
    spawnHauntipede();
  }
}

function draw() {
  ctx.fillStyle = '#0a0614';
  ctx.fillRect(0,0,W,H);

  // ground line
  ctx.strokeStyle = '#2d1a4a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H-50); ctx.lineTo(W, H-50);
  ctx.stroke();

  // segments (Hauntipede)
  segments.forEach((s, i) => {
    ctx.fillStyle = i===0 ? '#e879f9' : '#a78bfa';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  // bullets
  ctx.fillStyle = '#00ffaa';
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI*2);
    ctx.fill();
  });

  // player
  ctx.fillStyle = '#c084fc';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 12;
  ctx.fillRect(player.x - player.w/2, player.y - player.h/2, player.w, player.h);
  ctx.shadowBlur = 0;

  // HUD
  ctx.fillStyle = '#c084fc';
  ctx.font = '16px sans-serif';
  ctx.fillText('SCORE: ' + score, 20, 28);
  ctx.fillText('SPECTRAL MANOR INFESTATION — STARTER', 20, H-16);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
console.log('Spectral Manor Infestation starter ready — expand with PROMPTS.md');
