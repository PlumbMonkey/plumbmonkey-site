// ============================================================
// SPECTRAL MANOR SOUL CIRCUIT
// Hedge maze · Crystals · Magic Field
// Ghost Circuit / Plumbmonkey Media
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ---------- Audio ----------
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = ArcadeAudio.context();
  ArcadeAudio.resume();
}
  function tone(freq, dur, type='square', vol=0.05, slide=0, bus='sfx') {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slide) o.frequency.linearRampToValueAtTime(freq+slide, audioCtx.currentTime+dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
  o.connect(g); g.connect(ArcadeAudio.output(bus));
  o.start(); o.stop(audioCtx.currentTime+dur);
}
const sfx = {
  collect: () => tone(880, 0.06, 'sine', 0.04),
  power:   () => { tone(440,0.08); setTimeout(()=>tone(660,0.08),60); setTimeout(()=>tone(880,0.12),120); },
  respawn: () => { tone(220,0.1,'sawtooth',0.05); setTimeout(()=>tone(330,0.1,'sawtooth',0.04),80); },
  hurt:    () => tone(120, 0.2, 'sawtooth', 0.06, -40),
  // soul dissolve — long falling wail
  dissolve:() => { tone(600, 0.5, 'sine', 0.06, -450); tone(900, 0.4, 'triangle', 0.04, -700); setTimeout(()=>tone(300,0.45,'sine',0.05,-220),150); },
  pickup:  () => { tone(700,0.06,'square',0.05); setTimeout(()=>tone(1050,0.09,'square',0.05),60); },
  freeze:  () => { tone(1200,0.12,'sine',0.05,-500); setTimeout(()=>tone(800,0.15,'sine',0.04,-400),90); },
  life:    () => { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.09,'triangle',0.06),i*70)); },
  win:     () => { tone(523,0.08); setTimeout(()=>tone(659,0.08),80); setTimeout(()=>tone(784,0.15),160); }
};

// ---------- 8-bit background music (A-minor spooky loop) ----------
// lead melody + walking bass, stepped every 8th note
let musicTimer = null, musicStep = 0;
const A=440, C=523.25, D=587.33, E=659.25, F=698.46, G=783.99, Ah=880, r=0;
const leadLine = [A,0,C,0,E,0,D,0, F,0,E,0,C,0,A,0, G,0,E,0,G,0,Ah,0, E,0,D,0,C,0,A,0];
const bassLine = [220,0,0,0,174.61,0,0,0, 196,0,0,0,164.81,0,0,0,
                  220,0,0,0,174.61,0,0,0, 130.81,0,0,0,164.81,0,0,0];
function musicTick() {
  if (!gameRunning || dying > 0 || awaitingReady || !audioCtx) return;
  const n = leadLine[musicStep % leadLine.length];
    if (n) tone(n, 0.13, 'square', 0.035, 0, 'music');
  const b = bassLine[musicStep % bassLine.length];
    if (b) tone(b, 0.16, 'triangle', 0.045, 0, 'music');
  musicStep++;
}
function startMusic() { if (!musicTimer) musicTimer = setInterval(musicTick, 165); }

// ---------- Maze (1 = hedge wall, 0 = path, 2 = small crystal, 3 = power crystal) ----------
// 40 cols × 22 rows  (each cell 24×24 → 960×528)
const COLS = 40, ROWS = 22, CELL = 24;
const mazeTemplate = [
  "1111111111111111111111111111111111111111",
  "1000000000110000000000000011000000000001",
  "1011111100110111111111110110011111110101",
  "1010000100000100000000010000010000010101",
  "1010110101110101111111010111010110110101",
  "1000110000010001000000010001000011000001",
  "1110110111011101011111010111011101101111",
  "1000000100000001000000010000000100000001",
  "1011110101111111011111011111110101111101",
  "1000000000000000000000000000000000000001",
  "1011111111011111101101111110111111110101",
  "1000000000010000001100000010000000000001",
  "1111011111010111101101111010111110111111",
  "1000010000000100000000000100000010000001",
  "1011010111110101111111010111110101101101",
  "1000010000010001000000010001000001000001",
  "1011111100011101011111010111010001111101",
  "1000000100000001000000010000000100000001",
  "1011110101111111011111011111110101111101",
  "1000000000110000000000000011000000000001",
  "1011111111110111111111110111111111110101",
  "1111111111111111111111111111111111111111"
];

/* The graveyard and the ethereal plane.

   Both were generated and checked before being pasted in: solid border, the row
   9 artery kept clear (PLAYER_START and EXIT_CELL both sit on it), all four
   POWER_CELLS open, and — the important one — every open cell reachable from
   the start. A sealed pocket holding a single crystal would make the level
   uncompletable, which is exactly the failure the +4 counting bug produced. */
const MAZE_SET = [
  mazeTemplate,
  [
    "1111111111111111111111111111111111111111",
    "1000000000100000000000100000000000001011",
    "1111111110111111101110011011110111101011",
    "1000000010001000001010000000000000001011",
    "1001111011101011111011010110110011100011",
    "1000101000100010000000000000100010001011",
    "1110100000101110111111111111101110011011",
    "1010100010000010001000001000001000100011",
    "1010101110101011101011111011101011111011",
    "1000000000000000000000000000000000000001",
    "1011101011101010101100101110111010111011",
    "1000000010001000100000100000001000100011",
    "1010111010111110101110111010100011101111",
    "1010100010101000001010001000100000101011",
    "1010101110101010111011101101111110000011",
    "1010100010100010001010000000100000101011",
    "1010101110101111101010111110100110101011",
    "1010100000100010001010000010100010100011",
    "1010111010111110111011011010111001111001",
    "1000000000000000100000000000001000000011",
    "1000000000000000000000000000000000000001",
    "1111111111111111111111111111111111111111",
  ],
  [
    "1111111111111111111111111111111111111111",
    "1000001000000000000000000000001000000011",
    "1111101101111110111011111011111011110011",
    "1000001000000010000010000000000010001011",
    "1011111011111010101110111010111110101011",
    "1000000010001010001000100010000000001011",
    "1111111110001011111011101111111010101011",
    "1000000000101010000010000010000000101011",
    "1011111111101010111111101110101011111011",
    "1000000000000000000000000000000000000001",
    "1010101111111011111010111011111110111011",
    "1000100010001000001010000000100010000011",
    "1011101010101110101111110111101010101111",
    "1010001000000000101000000000001010100011",
    "1000101011111111101011111111111000111011",
    "1000100000100010001010000000001000101011",
    "1011111110101010111010101110111011101011",
    "1000000000101010100010000010100010001011",
    "1011110111101010111010111010101000101001",
    "1000000000001000000000000000001000100001",
    "1000000000000000000000000000000000000001",
    "1111111111111111111111111111111111111111",
  ],
];

/* One theme per maze. Only the walls and the ground change — the crystals stay
   cyan and the player stays violet, because those two are how you read the
   board at a glance and they should not move between levels. */
const THEMES = [
  { name: 'HEDGE MAZE',      ground: '#0a0614', wall: 'hedge' },
  { name: 'THE GRAVEYARD',   ground: '#080a10', wall: 'stone' },
  { name: 'THE ETHEREAL PLANE', ground: '#0b0718', wall: 'aether' }
];

function themeFor(lvl) { return THEMES[(lvl - 1) % THEMES.length]; }
function mazeFor(lvl)  { return MAZE_SET[(lvl - 1) % MAZE_SET.length]; }

let maze = [];
let score = 0, lives = 3, level = 1, crystalsLeft = 0;
let gameRunning = false, gameOver = false;
let magicField = 0; // frames remaining
let keys = {};

// Death sequence + extra power-ups
let dying = 0;            // frames left in the soul-dissolve animation
let awaitingReady = false;// paused on the "READY?" prompt after a death
let particles = [];       // dissolve wisps
let pickups = [];         // maze power-ups: speed / freeze / life
let pickupTimer = 600;    // frames until the next pickup can appear
let speedBoost = 0;       // frames of extra speed
let freezeTime = 0;       // frames monsters stay frozen

function spawnPickup() {
  // find a random open corridor cell
  for (let tries = 0; tries < 60; tries++) {
    const c = 1 + Math.floor(Math.random() * (COLS - 2));
    const r = 1 + Math.floor(Math.random() * (ROWS - 2));
    if (maze[r][c] === 0 || maze[r][c] === 2) {
      const roll = Math.random();
      const type = roll < 0.12 ? 'life' : (roll < 0.55 ? 'speed' : 'freeze');
      pickups.push({
        c, r,
        x: c * CELL + CELL / 2, y: r * CELL + CELL / 2,
        type, life: 720, bob: Math.random() * Math.PI * 2
      });
      return;
    }
  }
}

function startDeath() {
  if (dying > 0) return; // one death at a time
  lives--;
  dying = 75;
  magicField = 0;
  sfx.dissolve();
  // soul wisps drift up and away
  for (let i = 0; i < 26; i++) {
    particles.push({
      x: player.x, y: player.y,
      vx: (Math.random() - 0.5) * 2.5,
      vy: -0.5 - Math.random() * 2.2,
      life: 40 + Math.random() * 40,
      size: 2 + Math.random() * 4,
      color: Math.random() < 0.5 ? '#c084fc' : '#e9d5ff'
    });
  }
  updateHUD();
}

function resumeAfterDeath() {
  awaitingReady = false;
  player.x = PLAYER_START.x; player.y = PLAYER_START.y;
  player.dir = {x:0,y:0}; player.nextDir = {x:0,y:0};
  spawnMonsters();
  speedBoost = 0; freezeTime = 0;
  sfx.respawn();
  document.getElementById('startOverlay').classList.add('hidden');
}

// Player — starts mid-maze in the open corridor (row 9 is fully open),
// far from all four monster home corners
/* The four power crystals.

   THIS LIST USED TO CONTAIN (18,36), WHICH IS A WALL. Only three crystals were
   ever placed, but the counter did `crystalsLeft += 4` regardless — so the total
   bottomed out at 1 and `if (crystalsLeft <= 0)` never fired. You could clear
   every crystal in the maze and the level simply would not end. (18,38) is the
   nearest open cell on that row.

   Placement is now counted as it happens rather than added as a constant, so a
   cell that lands on a wall can no longer make the level uncompletable. */
const POWER_CELLS = [
  { r: 9,  c: 20 },
  { r: 9,  c: 19 },
  { r: 3,  c: 3  },
  { r: 18, c: 38 }
];

/* Where the way out appears once the maze is clear. Row 9 is the long open
   artery, so it is reachable from anywhere, and column 38 is the far end of it
   from the player's start at column 10 — clearing the maze should still leave
   you a run for the door. */
const EXIT_CELL = { r: 9, c: 38 };
let exitOpen = false;
let exitPulse = 0;
let bannerText = '', bannerTime = 0;

const PLAYER_START = { x: 10.5 * CELL, y: 9.5 * CELL }; // open corridor, away from power crystals & monster corners
const player = {
  x: PLAYER_START.x, y: PLAYER_START.y,
  r: 9, speed: 2.4,
  dir: {x:0,y:0}, nextDir: {x:0,y:0}
};

// Monsters
const monsterDefs = [
  { name: 'Vampire',    color: '#ef4444', speed: 1.9, home: {c:38, r:1} },
  { name: 'Frank',      color: '#4ade80', speed: 1.3, home: {c:1,  r:20} },
  { name: 'Werewolf',   color: '#a8a29e', speed: 1.7, home: {c:38, r:20} },
  { name: 'Witch',      color: '#a855f7', speed: 1.6, home: {c:1,  r:1} }
];
let monsters = [];

/* Scatter and chase.

   The AI comment said "simple chase / scatter" and every monster had a
   `scatter` field, but nothing ever read it — all of them simply beelined at
   the player forever. With four permanent pursuers and no corner assist, the
   maze had no rhythm and no safe moment to go and collect anything.

   Now the hunt breathes: for SCATTER_FRAMES the monsters head for their own
   home corner (which is where they already spawn, so it reads as retreating),
   then they hunt for CHASE_FRAMES. Chase is much longer, so the maze is still
   mostly dangerous — this is breathing room, not a holiday. */
/* Same collision box as the player. At 7 against the player's 8 the hunters
   cornered better than you did, which is a strange way to lose. */
const MONSTER_R = 8;

const SCATTER_FRAMES = 7 * 60;
const CHASE_FRAMES = 20 * 60;
let aiPhase = 0;               // 0 = scatter, 1 = chase
let aiPhaseTimer = SCATTER_FRAMES;

// ---------- Helpers ----------
function cellAt(x, y) {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return 1;
  return maze[r][c];
}
function isWall(x, y) {
  return cellAt(x, y) === 1;
}
function canMove(x, y, r = 8) {
  return !isWall(x - r, y - r) && !isWall(x + r, y - r) &&
         !isWall(x - r, y + r) && !isWall(x + r, y + r);
}

/* ---- Cornering feel -------------------------------------------------------

   Corridors are one cell wide (24px) and the player's collision box is 16px,
   so there are only 4px of slack either side. Turning used to be tested from
   wherever the player happened to be, with nothing pulling them onto the middle
   of the corridor — so if you entered a corridor a few pixels off-centre you
   stayed off-centre, and every junction after that refused your turn. That is
   what made the maze feel like it was grabbing you, and why level one was
   effectively unclearable.

   Two assists fix it without removing the friction entirely:

     CENTRE_PULL  eases you onto the corridor's centre line as you travel, so
                  drift does not accumulate down a long run.
     TURN_SLACK   lets a turn succeed when you are within this many pixels of
                  the centre line, snapping you onto it as you go.

   TURN_SLACK is deliberately less than the 12px half-cell: a genuinely mistimed
   turn still misses, so a corner can still cost you. Raise it toward 12 for a
   more forgiving maze, drop it toward 3 to bring back the old bite. */
const CENTRE_PULL = 1.1;   // px per frame, ~4 frames to centre at walking speed
const TURN_SLACK = 6;      // px of grace either side of the centre line

/* The centre line of the corridor a coordinate sits in. */
function laneCentre(v) {
  return (Math.floor(v / CELL) + 0.5) * CELL;
}

/* Ease `value` toward `target` by at most `step`, without overshooting. */
function easeTo(value, target, step) {
  const delta = target - value;
  if (Math.abs(delta) <= step) return target;
  return value + Math.sign(delta) * step;
}

// ---------- Init / Level ----------
/* A tiny deterministic PRNG, so a level's crystal layout is the same every time
   you play it. It used to be Math.random(), which meant "level 1" was a
   different board on every attempt — a different crystal count, a different
   route — so you could never learn it and never tell whether you were improving
   or the board had simply been kinder. Seeded by level, so levels still differ
   from each other. */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMaze() {
  const rand = mulberry32((level * 2654435761));
  maze = mazeFor(level).map(row => row.split('').map(ch => parseInt(ch)));
  // place crystals
  crystalsLeft = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (maze[r][c] === 0) {
        // power crystals in open areas
        if (POWER_CELLS.some(pc => pc.r === r && pc.c === c)) {
          maze[r][c] = 3;
          crystalsLeft++;
        } else if (rand() < 0.55) {
          maze[r][c] = 2;
          crystalsLeft++;
        }
      }
    }
  }

  exitOpen = false;
  exitPulse = 0;
}

/* How many hunters are loose. All four used to be out from level one, coming at
   you from all four corners at once with nowhere to run. The maze needs room to
   get harder, so it starts with two and gains one per level. */
function monsterCountFor(lvl) {
  return Math.min(monsterDefs.length, 2 + Math.floor((lvl - 1) / 2));
}

function spawnMonsters() {
  monsters = monsterDefs.slice(0, monsterCountFor(level)).map(d => ({
    ...d,
    x: d.home.c * CELL + CELL/2,
    y: d.home.r * CELL + CELL/2,
    dir: {x:0, y:0}
  }));
  aiPhase = 0;
  aiPhaseTimer = SCATTER_FRAMES;
}

function startGame() {
  score = 0; lives = 3; level = 1; magicField = 0;
  dying = 0; awaitingReady = false;
  particles = []; pickups = []; pickupTimer = 600;
  speedBoost = 0; freezeTime = 0;
  buildMaze();
  player.x = PLAYER_START.x; player.y = PLAYER_START.y;
  player.dir = {x:0,y:0}; player.nextDir = {x:0,y:0};
  spawnMonsters();
  gameRunning = true; gameOver = false;
  document.getElementById('startOverlay').classList.add('hidden');
  startMusic();
  updateHUD();
}

function nextLevel() {
  level++;
  buildMaze();
  // Name the place you have just walked into.
  bannerText = themeFor(level).name;
  bannerTime = 150;
  player.x = PLAYER_START.x; player.y = PLAYER_START.y;
  player.dir = {x:0,y:0}; player.nextDir = {x:0,y:0};
  spawnMonsters();
  magicField = 0;
  sfx.win();
  updateHUD();
}

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'Enter' && !e.repeat) {
    if (awaitingReady) resumeAfterDeath();
    else if (!gameRunning) startGame();
  }
});
window.addEventListener('keyup', e => keys[e.code] = false);
document.getElementById('startOverlay').addEventListener('click', () => {
  initAudio();
  if (awaitingReady) resumeAfterDeath();
  else if (!gameRunning) startGame();
});

// ---------- Update ----------
function update() {
  // Dissolve wisps drift even while paused on READY? / game over
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy -= 0.02; p.life--; });
  particles = particles.filter(p => p.life > 0);

  if (!gameRunning || awaitingReady) return;

  // Soul dissolve in progress — world holds its breath
  if (dying > 0) {
    dying--;
    if (dying === 0) {
      if (lives <= 0) {
        gameOver = true;
        gameRunning = false;
        const finalScore = score;
        Arcade.submitFlow(finalScore, () => {
          document.getElementById('startOverlay').classList.remove('hidden');
          document.getElementById('startOverlay').innerHTML = `
            <h2>SOUL LOST</h2>
            <p>Final Score: ${finalScore}</p>
            <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP SOULS</p>
            ${Arcade.boardHTML(Arcade.slug)}
            <p style="margin-top:0.8rem; opacity:0.8">Click or ENTER to try again</p>
          `;
        });
      } else {
        awaitingReady = true;
        document.getElementById('startOverlay').classList.remove('hidden');
        document.getElementById('startOverlay').innerHTML = `
          <h2>READY?</h2>
          <p>${lives} ${lives === 1 ? 'soul remains' : 'souls remain'}</p>
          <p style="margin-top:0.8rem; opacity:0.8">Click or ENTER when you're ready</p>
        `;
      }
    }
    return;
  }

  // Power-up spawning (keep up to 2 in the maze)
  pickupTimer--;
  if (pickupTimer <= 0 && pickups.length < 2) {
    spawnPickup();
    pickupTimer = 500 + Math.random() * 400;
  }
  pickups.forEach((p, pi) => {
    p.bob += 0.08;
    p.life--;
    if (p.life <= 0) { pickups.splice(pi, 1); return; }
    if (Math.hypot(p.x - player.x, p.y - player.y) < 16) {
      pickups.splice(pi, 1);
      if (p.type === 'speed') { speedBoost = 420; sfx.pickup(); }
      else if (p.type === 'freeze') { freezeTime = 300; sfx.freeze(); }
      else { lives++; sfx.life(); }
      score += 25;
      updateHUD();
    }
  });
  if (speedBoost > 0) speedBoost--;
  if (freezeTime > 0) freezeTime--;
  player.speed = speedBoost > 0 ? 3.4 : 2.4;

  // Desired direction
  if (keys['ArrowLeft'] || keys['KeyA']) player.nextDir = {x:-1, y:0};
  if (keys['ArrowRight']|| keys['KeyD']) player.nextDir = {x:1,  y:0};
  if (keys['ArrowUp']   || keys['KeyW']) player.nextDir = {x:0,  y:-1};
  if (keys['ArrowDown'] || keys['KeyS']) player.nextDir = {x:0,  y:1};

  /* Try to change direction. Tested straight first; if that fails, retry from
     the corridor's centre line and snap there, which is what lets a turn taken
     a few pixels wide of the junction still land. */
  const want = player.nextDir;
  if (want.x || want.y) {
    if (canMove(player.x + want.x * player.speed, player.y + want.y * player.speed)) {
      player.dir = {...want};
    } else if (want.x !== 0) {
      const cy = laneCentre(player.y);
      if (Math.abs(cy - player.y) <= TURN_SLACK &&
          canMove(player.x + want.x * player.speed, cy)) {
        player.y = cy;
        player.dir = {...want};
      }
    } else if (want.y !== 0) {
      const cx = laneCentre(player.x);
      if (Math.abs(cx - player.x) <= TURN_SLACK &&
          canMove(cx, player.y + want.y * player.speed)) {
        player.x = cx;
        player.dir = {...want};
      }
    }
  }

  // Move
  let mx = player.x + player.dir.x * player.speed;
  let my = player.y + player.dir.y * player.speed;
  if (canMove(mx, my)) {
    player.x = mx; player.y = my;

    /* Ease onto the centre of the corridor being travelled. Only ever applied
       across the direction of travel, so it never pushes you forwards into a
       wall or backwards out of a junction you just entered. */
    if (player.dir.x !== 0) {
      const cy = laneCentre(player.y);
      if (canMove(player.x, easeTo(player.y, cy, CENTRE_PULL))) {
        player.y = easeTo(player.y, cy, CENTRE_PULL);
      }
    } else if (player.dir.y !== 0) {
      const cx = laneCentre(player.x);
      if (canMove(easeTo(player.x, cx, CENTRE_PULL), player.y)) {
        player.x = easeTo(player.x, cx, CENTRE_PULL);
      }
    }
  } else {
    /* Stopped against a wall. Square up on the axis crossing the corridor so
       the turn you make next actually fits — this is the "snap to center of
       cell" the old comment promised and never did, which is how a player
       ended up wedged in a corner with no legal move. */
    if (player.dir.x !== 0) {
      const cy = laneCentre(player.y);
      if (canMove(player.x, cy)) player.y = cy;
    } else if (player.dir.y !== 0) {
      const cx = laneCentre(player.x);
      if (canMove(cx, player.y)) player.x = cx;
    }
    player.dir = {x:0,y:0};
  }

  // Wrap (optional tunnels)
  if (player.x < 0) player.x = W;
  if (player.x > W) player.x = 0;

  // Collect crystals
  const pc = Math.floor(player.x / CELL);
  const pr = Math.floor(player.y / CELL);
  if (pr >= 0 && pr < ROWS && pc >= 0 && pc < COLS) {
    if (maze[pr][pc] === 2) {
      maze[pr][pc] = 0;
      score += 10;
      crystalsLeft--;
      sfx.collect();
      updateHUD();
    } else if (maze[pr][pc] === 3) {
      maze[pr][pc] = 0;
      score += 50;
      crystalsLeft--;
      magicField = 480; // ~8 seconds
      sfx.power();
      updateHUD();
    }
  }

  if (magicField > 0) magicField--;

  // Level clear
  /* Clearing the crystals no longer ends the level on the spot — it opens a way
     out, and you have to reach it with the hunters still after you. That last
     run is the most interesting thirty seconds in the maze, and the old code
     skipped it entirely. */
  if (crystalsLeft <= 0 && !exitOpen) {
    exitOpen = true;
    exitPulse = 0;
    sfx.power();
    bannerText = 'THE WAY OUT HAS OPENED';
    bannerTime = 150;
  }

  if (exitOpen) {
    exitPulse++;
    const ex = (EXIT_CELL.c + 0.5) * CELL, ey = (EXIT_CELL.r + 0.5) * CELL;
    if (Math.hypot(player.x - ex, player.y - ey) < CELL * 0.7) {
      score += 250 + level * 100;
      sfx.collect();
      nextLevel();
    }
  }

  /* Advance the scatter/chase clock. Frozen monsters do not get to sit out
     their scatter phase — the clock is the maze's rhythm, not theirs. */
  if (--aiPhaseTimer <= 0) {
    aiPhase = aiPhase === 0 ? 1 : 0;
    aiPhaseTimer = aiPhase === 0 ? SCATTER_FRAMES : CHASE_FRAMES;
  }

  // Monsters AI — frozen monsters stand still
  monsters.forEach(m => {
    if (freezeTime > 0) return;
    // occasionally pick new direction
    if (Math.random() < 0.04 || (m.dir.x === 0 && m.dir.y === 0)) {
      const options = [];
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
        if (canMove(m.x + dx * 12, m.y + dy * 12, MONSTER_R)) options.push({x:dx,y:dy});
      });
      if (options.length) {
        /* Where this monster wants to be right now: its home corner while
           scattering, the player while hunting. The magic field inverts it —
           it runs from wherever it was headed. */
        const scattering = aiPhase === 0 && magicField === 0;
        const goal = scattering
          ? { x: m.home.c * CELL + CELL / 2, y: m.home.r * CELL + CELL / 2 }
          : player;
        const flee = magicField > 0;
        options.sort((a, b) => {
          const da = Math.hypot(m.x + a.x - goal.x, m.y + a.y - goal.y);
          const db = Math.hypot(m.x + b.x - goal.x, m.y + b.y - goal.y);
          return flee ? db - da : da - db;
        });
        m.dir = options[0];
      }
    }
    const speed = magicField > 0 ? m.speed * 0.7 : m.speed;
    let nmx = m.x + m.dir.x * speed;
    let nmy = m.y + m.dir.y * speed;
    if (canMove(nmx, nmy, MONSTER_R)) {
      m.x = nmx; m.y = nmy;
    } else {
      m.dir = {x:0,y:0};
    }
    // wrap
    if (m.x < 0) m.x = W;
    if (m.x > W) m.x = 0;

    // collision with player
    const dist = Math.hypot(m.x - player.x, m.y - player.y);
    if (dist < 16) {
      if (magicField > 0) {
        // force respawn
        m.x = m.home.c * CELL + CELL/2;
        m.y = m.home.r * CELL + CELL/2;
        m.dir = {x:0,y:0};
        score += 200;
        sfx.respawn();
        updateHUD();
      } else {
        // player caught — soul dissolves, then READY? before the next life
        startDeath();
      }
    }
  });
}

// ---------- Draw ----------
/* One wall painter per theme. All three are lit from above and shaded beneath
   so the maze reads as solid objects rather than tiling, and all three derive
   their detail from the cell's own (r, c) rather than Math.random(), or the
   walls would shimmer every frame. */
function drawWall(kind, x, y, r, c) {
  const seed = (r * 7 + c * 13) % 5;
  if (kind === 'stone') {
    // Graveyard: mossy granite blocks with a chiselled top edge.
    ctx.fillStyle = '#0b0d13';
    ctx.fillRect(x, y, CELL, CELL);
    ctx.fillStyle = '#2b3040';
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 3);
    ctx.fillStyle = '#3c4356';
    ctx.fillRect(x + 1, y + 1, CELL - 2, 5);
    ctx.fillStyle = '#070810';
    ctx.fillRect(x + 1, y + CELL - 4, CELL - 2, 3);
    // mortar course, offset every other row so blocks stagger
    ctx.fillStyle = '#161a24';
    ctx.fillRect(x + 1, y + 11, CELL - 2, 1.5);
    ctx.fillRect(x + (r % 2 ? 7 : 15), y + 12, 1.5, CELL - 16);
    // a patch of moss, always in the same corner for this cell
    ctx.fillStyle = '#2f4a33';
    ctx.fillRect(x + 3 + seed, y + CELL - 8, 4, 2);
    return;
  }
  if (kind === 'aether') {
    // Ethereal plane: translucent violet crystal, brighter at the edges.
    ctx.fillStyle = '#120a22';
    ctx.fillRect(x, y, CELL, CELL);
    ctx.fillStyle = 'rgba(124,58,237,0.34)';
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    ctx.strokeStyle = 'rgba(196,181,253,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
    // an internal facet, angled by the cell so the field is not uniform
    ctx.strokeStyle = 'rgba(232,121,249,0.45)';
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 5 + seed);
    ctx.lineTo(x + CELL - 4, y + CELL - 6 - seed);
    ctx.stroke();
    ctx.fillStyle = 'rgba(233,213,255,0.5)';
    ctx.fillRect(x + 4 + seed, y + 4, 2, 2);
    return;
  }
  /* Hedge, lit from above. It used to be two flat squares and two dots, which
     read as tiling rather than planting. */
  ctx.fillStyle = '#0d1a0b';
  ctx.fillRect(x, y, CELL, CELL);
  ctx.fillStyle = '#193318';
  ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 3);
  ctx.fillStyle = '#23461f';
  ctx.fillRect(x + 1, y + 1, CELL - 2, 5);
  ctx.fillStyle = '#080f07';
  ctx.fillRect(x + 1, y + CELL - 4, CELL - 2, 3);
  ctx.fillStyle = '#2d5828';
  ctx.fillRect(x + 4 + seed, y + 7, 4, 3);
  ctx.fillRect(x + 13 - seed, y + 13, 4, 3);
  ctx.fillStyle = '#3a6f33';
  ctx.fillRect(x + 5 + seed, y + 8, 2, 1);
  ctx.fillRect(x + 14 - seed, y + 14, 2, 1);
}

function draw() {
  const theme = themeFor(level);
  // Background
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, 0, W, H);

  // Maze hedges
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * CELL, y = r * CELL;
      if (maze[r][c] === 1) {
        drawWall(theme.wall, x, y, r, c);
      } else if (maze[r][c] === 2) {
        // small crystal
        ctx.fillStyle = '#67e8f9';
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(x+12, y+6);
        ctx.lineTo(x+17, y+12);
        ctx.lineTo(x+12, y+18);
        ctx.lineTo(x+7, y+12);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (maze[r][c] === 3) {
        // power crystal
        ctx.fillStyle = '#e879f9';
        ctx.shadowColor = '#e879f9';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(x+12, y+3);
        ctx.lineTo(x+20, y+12);
        ctx.lineTo(x+12, y+21);
        ctx.lineTo(x+4, y+12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f5d0fe';
        ctx.beginPath();
        ctx.moveTo(x+12, y+7);
        ctx.lineTo(x+16, y+12);
        ctx.lineTo(x+12, y+17);
        ctx.lineTo(x+8, y+12);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  // Power-up pickups
  pickups.forEach(p => {
    const by = Math.sin(p.bob) * 2.5;
    ctx.save();
    ctx.translate(p.x, p.y + by);
    ctx.globalAlpha = Math.min(1, p.life / 60);
    if (p.type === 'speed') {
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
      // lightning bolt
      ctx.beginPath();
      ctx.moveTo(1, -8); ctx.lineTo(-4, 1); ctx.lineTo(0, 1);
      ctx.lineTo(-1, 8); ctx.lineTo(4, -1); ctx.lineTo(0, -1);
      ctx.closePath();
      ctx.fill();
    } else if (p.type === 'freeze') {
      ctx.strokeStyle = '#67e8f9';
      ctx.shadowColor = '#67e8f9';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      // snowflake
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * -8, Math.sin(a) * -8);
        ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.stroke();
      }
    } else {
      // heart (extra life)
      ctx.fillStyle = '#f472b6';
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(-3, -2, 4, 0, Math.PI * 2);
      ctx.arc(3, -2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-6.5, 0); ctx.lineTo(0, 8); ctx.lineTo(6.5, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });

  /* Monsters — the Vampire, Frankenstein, Werewolf and Witch from
     wave3/sprite-kit.js, the same four figures Mess Hall and House of the
     Hooded draw. They were flat rectangles and arcs here.

     Drawn from the kit's MINIATURE cast, not its full figures. The full ones
     are authored for a 75px body and turn to mud below about 40px; a 24px
     corridor leaves roughly 22px, so these are the versions drawn at that size
     to begin with.

     The frozen and magic-field tints are preserved by tinting the whole sprite
     through globalCompositeOperation, so a scared monster still reads cyan
     without needing a second set of artwork. */
  const frozen = freezeTime > 0;
  const KIT_NAME = { Vampire: 'vampire', Frank: 'frank', Werewolf: 'werewolf', Witch: 'witch' };

  monsters.forEach(m => {
    const scared = magicField > 0;
    const tint = frozen ? '#93c5fd' : (scared ? '#67e8f9' : null);

    ctx.save();
    ctx.translate(m.x, m.y + 2);
    if (scared) ctx.globalAlpha = 0.75 + Math.sin(Date.now() * 0.01) * 0.2;
    ctx.shadowColor = tint || m.color;
    ctx.shadowBlur = 10;

    const drew = window.SpriteKit && SpriteKit.drawMini(ctx, KIT_NAME[m.name], 0, 0, {
      t: Date.now() / 1000
    });
    ctx.shadowBlur = 0;

    if (!drew) {
      ctx.fillStyle = tint || m.color;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    } else if (tint) {
      // Wash the figure toward the state colour, keeping its own shading.
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = tint;
      ctx.globalAlpha = 0.62;
      ctx.fillRect(-12, -26, 24, 40);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  });


  /* The way out. Only exists once the last crystal is gone, and it is loud on
     purpose — a spinning gate of light in a maze that is otherwise all greens
     and dim cyan, so you can find it from across the board without a minimap. */
  if (exitOpen) {
    const ex = (EXIT_CELL.c + 0.5) * CELL, ey = (EXIT_CELL.r + 0.5) * CELL;
    const spin = exitPulse * 0.05;
    const beat = 1 + Math.sin(exitPulse * 0.12) * 0.12;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.shadowColor = '#fde68a';
    ctx.shadowBlur = 26;
    ctx.fillStyle = 'rgba(253,230,138,0.18)';
    ctx.beginPath(); ctx.arc(0, 0, 16 * beat, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 11 * beat, 0, Math.PI * 2); ctx.stroke();
    // Four turning spokes, so the gate reads as active rather than a pickup.
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = spin + i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
      ctx.lineTo(Math.cos(a) * 14 * beat, Math.sin(a) * 14 * beat);
      ctx.stroke();
    }
    ctx.fillStyle = '#fffbeb';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // Player — a glowing spirit with a trailing wisp (hidden while dissolving)
  if (dying === 0 && !awaitingReady) {
    ctx.save();
    ctx.translate(player.x, player.y);
    const glow = magicField > 0 ? '#e879f9' : '#c084fc';
    // wisp tail behind movement direction
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(-player.dir.x * 9, -player.dir.y * 9 + 2, 7, 5, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(-player.dir.x * 5, -player.dir.y * 5 + 1, 8.5, 7, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowColor = glow;
    ctx.shadowBlur = magicField > 0 ? 20 : 12;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, player.r, 0, Math.PI*2);
    ctx.fill();
    // inner core
    ctx.fillStyle = '#f3e8ff';
    ctx.beginPath();
    ctx.arc(0, -1, 4.5, 0, Math.PI*2);
    ctx.fill();
    // eyes look where you're headed
    ctx.fillStyle = '#2e1065';
    const lx = player.dir.x * 1.5, ly = player.dir.y * 1.5;
    ctx.fillRect(-3.5 + lx, -3 + ly, 2.5, 3);
    ctx.fillRect(1 + lx, -3 + ly, 2.5, 3);
    // speed boost sparkle
    if (speedBoost > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, player.r + 4, 0, Math.PI * 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // Dissolve wisps
  particles.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 40);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Magic field ring
  if (magicField > 0) {
    ctx.strokeStyle = `rgba(232,121,249,${0.3 + Math.sin(Date.now()*0.02)*0.2})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 22 + Math.sin(Date.now()*0.02)*3, 0, Math.PI*2);
    ctx.stroke();
  }

  drawBanner();
}

function drawBanner() {
  if (bannerTime <= 0) return;
  bannerTime--;
  const fade = Math.min(1, bannerTime / 40);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#fde68a';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#fde68a';
  ctx.fillText(bannerText, W / 2, 64);
  ctx.restore();
  ctx.shadowBlur = 0;
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = level;
  document.getElementById('crystals').textContent = crystalsLeft;
  document.getElementById('field').textContent = magicField > 0 ? 'ON' : 'OFF';
  document.getElementById('field').style.color = magicField > 0 ? '#e879f9' : '#c084fc';
}

// ---------- Loop ----------
// Build the maze immediately so the first draw() has data
// (previously maze was empty until Start, crashing the loop on frame one)
buildMaze();
spawnMonsters();

function loop() {
  update();
  draw();
  ArcadeVR.schedule(loop);
}
loop();
console.log('Spectral Manor Soul Circuit ready');
