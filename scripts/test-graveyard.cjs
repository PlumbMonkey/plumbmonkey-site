const assert=require('node:assert/strict');
const {createState,step,respawn,movePlayer,hit}=require('../public/arcade/games/wave3/graveyard.js');
function quiet(level=1){const s=createState(level);s.enemies=[];return s;}
function tick(s,time,input={}){const events=[];while(time>1e-8){const dt=Math.min(.01,time);events.push(...step(s,dt,input));time-=dt;}return events;}

// Walking into solid scenery stops movement without damage or invulnerability.
{
  const s=quiet();s.p.x=400;tick(s,1,{move:1});
  assert.equal(s.p.x,410);assert.equal(s.p.health,3);assert.equal(s.p.inv,0);
  step(s,.01,{move:1,jump:true});tick(s,.35,{move:1});
  assert.ok(s.p.x>440,'A full jump must clear the first obstacle');
  tick(s,.6);assert.equal(s.p.y+s.p.h,545,'Player lands on the obstacle top');
}
// Coyote time, buffered landing jumps, release height and one-way platforms.
{
  const s=quiet();s.blocks=[];s.p.on=false;s.p.coyote=.08;s.p.y=450;
  assert.equal(movePlayer(s,.01,{jump:true}),true);
  assert.ok(s.p.vy< -500);
  movePlayer(s,.01,{jumpReleased:true});assert.ok(s.p.vy> -220);
  s.p.y=538;s.p.vy=80;s.p.on=false;s.p.coyote=0;
  step(s,.01,{jump:true});tick(s,.04);assert.ok(s.p.vy<0,'Queued jump executes upon landing');
  s.p.x=790;s.p.y=350;s.p.vy=200;s.p.jumpBuffer=0;s.p.coyote=0;s.p.on=false;
  tick(s,.35);assert.equal(s.p.y+s.p.h,465);
}
// Sonic shots follow facing even when the guardian is ahead; holding repeats.
{
  const s=quiet();s.p.power=true;s.p.face=-1;step(s,.01,{fire:true});
  assert.ok(s.shots[0].vx<0);assert.ok(s.shots[0].x<s.p.x);
  s.p.x=300;s.p.face=1;s.shots=[];s.p.fire=0;
  assert.equal(tick(s,.8,{fire:true}).filter(e=>e.type==='shoot').length,4);
}
// A projectile is consumed by the first enemy; it cannot hit two at once.
{
  const s=quiet();s.enemies=[0,1].map(()=>({x:300,y:548,w:34,h:52,home:300,type:'frank',hp:2,phase:0,flash:0}));
  s.shots=[{x:299,y:555,w:22,h:14,vx:0}];step(s,.01);
  assert.deepEqual(s.enemies.map(e=>e.hp),[1,2]);assert.equal(s.shots.length,0);
}
// Three hits cost one life. Checkpoints retain cargo and the guitar on respawn.
{
  const s=quiet();s.p.x=250;step(s,.01);assert.equal(s.p.power,true);
  s.p.x=720;step(s,.01);assert.equal(s.cargo,1);
  s.p.x=2241;step(s,.01);assert.equal(s.checkpoint,2240);s.p.x=2280;
  for(let i=0;i<3;i++){s.p.inv=0;s.bolts=[{x:s.p.x,y:s.p.y,w:30,h:58,vx:0,vy:0}];step(s,.01);}
  assert.equal(s.p.health,0);assert.equal(s.phase,'death');
  assert.equal(tick(s,1).filter(e=>e.type==='lose').length,1);
  assert.equal(tick(s,1).length,0);
  respawn(s);assert.equal(s.p.x,2240);assert.equal(s.p.health,3);assert.equal(s.p.power,true);assert.equal(s.cargo,1);
  assert.ok(s.p.inv>2);assert.ok(!s.blocks.some(o=>hit(s.p,o)));
}
// Guardians warn, attack toward either side, and take damage only when exposed.
for(let level=1;level<=3;level++){
  const s=quiet(level);s.p.x=2770;s.p.inv=99;step(s,.01);
  s.boss.phase='warn';s.boss.timer=.5;s.shots=[{x:2925,y:520,w:20,h:15,vx:0}];
  const hp=s.boss.hp;step(s,.01);assert.equal(s.boss.hp,hp);
  s.boss.phase='rest';s.boss.timer=1;s.shots=[{x:2925,y:520,w:20,h:15,vx:0}];
  step(s,.01);assert.equal(s.boss.hp,hp-1);
  s.p.x=3100;s.boss.phase='warn';s.boss.timer=.005;step(s,.01);
  assert.equal(s.bolts.length,level===3?3:1);assert.ok(s.bolts.every(b=>b.vx>0));
  s.boss.hp=0;s.p.x=3251;step(s,.01);assert.equal(s.phase,'clear');
  assert.equal(tick(s,1.1).filter(e=>e.type===(level<3?'next':'win')).length,1);
}
assert.notDeepEqual(createState(1).blocks,createState(2).blocks);
assert.notDeepEqual(createState(2).blocks,createState(3).blocks);
// Full routes remain traversable. Invulnerability isolates geometry/progression
// from combat balance; guardian health still falls only through real projectiles.
for(let level=1;level<=3;level++){
  const s=quiet(level);s.p.inv=999;let completed=false;
  for(let i=0;i<12000&&!completed;i++){
    const p=s.p;
    const obstacle=s.blocks.find(b=>b.x>=p.x+p.w-1&&b.x-(p.x+p.w)<50&&b.y<p.y+p.h);
    completed=step(s,1/60,{move:p.x<2700||s.boss.hp===0?1:0,jump:!!(p.on&&obstacle),fire:true})
      .some(e=>e.type===(level<3?'next':'win'));
  }
  assert.ok(completed,`Chapter ${level} must be traversable and its guardian defeatable`);
}
console.log('Graveyard Shift: collision, jumps, combat, pickups, checkpoints, health and all three guardians passed.');



