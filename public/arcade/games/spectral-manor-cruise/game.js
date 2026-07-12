// ============================================================
// SPECTRAL MANOR CRUISE — STARTER
// Basic top-down night race vs 4 monster racers
// Expand with Grok Build using PROMPTS.md
// ============================================================
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let keys = {};
window.addEventListener('keydown', e => { keys[e.code]=true; e.preventDefault(); });
window.addEventListener('keyup', e => keys[e.code]=false);

const player = { x: W/2, y: H-80, angle: -Math.PI/2, speed: 0, max: 7 };
const racers = [
  { name:'Vampire',    color:'#ef4444', x: W/2-80, y: H-40, speed: 3.2 },
  { name:'Frank',      color:'#4ade80', x: W/2-40, y: H-20, speed: 2.6 },
  { name:'Werewolf',   color:'#a8a29e', x: W/2+40, y: H-30, speed: 3.5 },
  { name:'Witch',      color:'#a855f7', x: W/2+80, y: H-50, speed: 3.0 }
];

let roadOffset = 0;

function update() {
  if (keys['ArrowLeft']||keys['KeyA']) player.angle -= 0.05;
  if (keys['ArrowRight']||keys['KeyD']) player.angle += 0.05;
  if (keys['ArrowUp']||keys['KeyW']) player.speed = Math.min(player.max, player.speed+0.15);
  else player.speed = Math.max(0, player.speed-0.08);

  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;
  // soft bounds
  player.x = Math.max(40, Math.min(W-40, player.x));
  player.y = Math.max(40, Math.min(H-40, player.y));

  roadOffset += player.speed * 0.8;

  racers.forEach(r => {
    r.y -= r.speed * 0.6;
    if (r.y < -30) { r.y = H + 40; r.x = 100 + Math.random()*(W-200); }
  });
}

function draw() {
  // night sky
  ctx.fillStyle = '#0a0614';
  ctx.fillRect(0,0,W,H);

  // simple road
  ctx.fillStyle = '#1a1525';
  ctx.fillRect(W*0.25, 0, W*0.5, H);
  // center line
  ctx.strokeStyle = '#c084fc';
  ctx.setLineDash([20, 20]);
  ctx.lineDashOffset = -roadOffset;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // roadside glow (manor feel)
  ctx.fillStyle = 'rgba(124,58,237,0.08)';
  ctx.fillRect(0,0,W*0.25,H);
  ctx.fillRect(W*0.75,0,W*0.25,H);

  // racers
  racers.forEach(r => {
    ctx.fillStyle = r.color;
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(r.x-12, r.y-18, 24, 36);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e0d4ff';
    ctx.font = '10px sans-serif';
    ctx.fillText(r.name, r.x-18, r.y-24);
  });

  // player car
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle + Math.PI/2);
  ctx.fillStyle = '#c084fc';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 16;
  ctx.fillRect(-12, -18, 24, 36);
  ctx.fillStyle = '#e9d5ff';
  ctx.fillRect(-8, -10, 16, 12);
  ctx.restore();
  ctx.shadowBlur = 0;

  // HUD
  ctx.fillStyle = '#c084fc';
  ctx.font = '16px sans-serif';
  ctx.fillText('SPEED: ' + player.speed.toFixed(1), 20, 30);
  ctx.fillText('SPECTRAL MANOR CRUISE — STARTER', 20, H-20);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
console.log('Spectral Manor Cruise starter ready — expand with PROMPTS.md');
