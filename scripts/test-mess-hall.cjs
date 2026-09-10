const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const noop = () => {};
const ctx = new Proxy({}, {get:(o,k)=>o[k] || noop, set:(o,k,v)=>(o[k]=v,true)});
const elements = new Map();
const events = {};
const sandbox = {console, Math, performance:{now:()=>0}, location:{search:''}, setTimeout:noop,
  localStorage:{getItem:()=>null,setItem:noop},
  document:{body:{classList:{add:noop}}, getElementById(id){if(!elements.has(id)) elements.set(id,{width:960,height:540,getContext:()=>ctx,addEventListener:noop,classList:{add:noop,remove:noop},style:{}});return elements.get(id);}},
  window:{addEventListener:(name,fn)=>events[name]=fn},
  TouchPad:{init:noop,sync:noop,draw:noop},ArcadeControls:{applyAim:noop},ArcadeVR:{schedule:noop},Arcade:{submitFlow:noop},ArcadeAudio:{context:()=>null,resume:noop}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('public/arcade/games/spectral-manor-mess-hall/game.js','utf8'),sandbox);
const run = code => vm.runInContext(code,sandbox);
run('startGame();');
assert.equal(run('pickups.every(p=>!tables.some(t=>p.x<t.x+t.w && p.x+p.w>t.x && p.y<t.y+t.h && p.y+p.h>t.y))'),true);
assert.equal(run('chefs.every(c=>Math.hypot(c.x+15-player.x-14,c.y+17-player.y-16)>=150)'),true);
// Simultaneous incoming food costs one life, and each food can strike one target only.
run(`chefs=[{x:800,y:400,w:30,h:34,hp:3,maxHp:3,speed:0,walkPhase:0,throwTimer:999,stealTimer:999,aggression:0,type:'frank'}];
foods=Array.from({length:4},()=>({x:90,y:280,vx:0,vy:0,life:80,fromChef:true,color:'#fff'})); update();`);
assert.equal(run('lives'),2);
run(`hitPause=0; player.invuln=100; chefs=[0,1].map(()=>({x:700,y:400,w:30,h:34,hp:3,maxHp:3,speed:0,walkPhase:0,throwTimer:999,stealTimer:999,aggression:0,type:'frank'}));foods=[{x:710,y:410,vx:0,vy:0,life:80,color:'#fff'}];update();`);
assert.equal(run('chefs.reduce((sum,c)=>sum+c.hp,0)'),5);
run('ammo=0; pickups=[]; foods=[]; update();');
assert.equal(run('pickups.length'),1);
run('paused=true; keys.KeyD=true;');
const x=run('player.x');run('update();');assert.equal(run('player.x'),x);
run('paused=false; keys.KeyD=false; foods=[{x:179,y:160,vx:3,vy:1,life:80,color:"#fff"}];update();');
assert.ok(Math.abs(run('foods[0].vx') + 2.1) < 1e-9);
assert.equal(run('foods[0].vy'),1);
run("['ghost','vampire','werewolf','frank','witch'].forEach(type=>drawChefBody({type,color:'#ccc'}));draw();");
// The final plate remains recoverable while another thief is still on screen.
run(`startGame(); buffet.dishes=0; chefs=[{x:-55,y:200,speed:1,carryDish:true,walkPhase:0},{x:400,y:350,speed:1,carryDish:true,walkPhase:0}]; update();`);
assert.equal(run('gameRunning'),true);
assert.equal(run('chefs.length'),1);
run('chefs[0].x=-55; update();');
assert.equal(run('gameOver'),true);
console.log('Mess Hall: safe spawns, single-hit damage, projectile consumption, resupply, pause and bounce checks passed.');
