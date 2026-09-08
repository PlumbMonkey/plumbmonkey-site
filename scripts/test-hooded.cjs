const assert = require('node:assert/strict');
const {createState,step,respawn} = require('../public/arcade/games/wave3/hooded.js');
function quiet() { const s=createState(); s.enemies.forEach(e=>e.wait=999); return s; }
function tick(s,seconds) {
  const events=[];
  while(seconds>1e-8){const dt=Math.min(.01,seconds);events.push(...step(s,dt));seconds-=dt;}
  return events;
}

// A move pressed halfway through a hop must start immediately after landing.
{
  const s=quiet(); step(s,.01,'dl');tick(s,.10);step(s,.01,'dr');
  assert.deepEqual([s.p.r,s.p.c],[0,0],'Airborne player must not occupy destination');
  const landing=tick(s,.10);
  assert.deepEqual([s.p.r,s.p.c],[1,0]);
  assert.deepEqual(s.p.move.to,{r:2,c:1});
  assert.equal(landing.filter(e=>e.type==='tile').length,1);
  tick(s,.21); assert.deepEqual([s.p.r,s.p.c],[2,1]);
  assert.equal(s.p.move,null,'One press queues only one hop');
}
// A destination occupied by an enemy causes damage at landing, never takeoff.
{
  const s=quiet();s.p.inv=0;s.enemies[0].r=1;s.enemies[0].c=0;
  step(s,.01,'dl');tick(s,.15);assert.equal(s.phase,'play');
  const events=tick(s,.06);assert.equal(s.phase,'hit');
  assert.equal(events.filter(e=>e.type==='hit').length,1);
  assert.equal(tick(s,1).filter(e=>e.type==='lose').length,1);
  assert.equal(tick(s,1).length,0,'A knockout must cost only one life');
}
// Enemies also cause contact on their landing; protection expires predictably.
{
  const s=quiet();s.p.inv=.1;
  const e=s.enemies[0];e.move={from:{r:1,c:0},to:{r:0,c:0},elapsed:e.duration-.01};
  step(s,.02);assert.equal(s.phase,'play');tick(s,.09);assert.equal(s.phase,'hit');
  respawn(s);assert.equal(s.phase,'play');assert.equal(s.queue,null);assert.equal(s.p.move,null);
  assert.equal(s.p.inv,2.5);
}
// All four edges, including upward off the apex, behave the same way.
for(const [r,c,d] of [[0,0,'ul'],[0,0,'ur'],[6,0,'dl'],[6,6,'dr'],[3,0,'ul'],[3,3,'ur']]){
  const s=quiet();s.p.r=r;s.p.c=c;step(s,.01,d);assert.equal(s.phase,'fall');
  assert.equal(tick(s,1).filter(e=>e.type==='lose').length,1);
}
// Completing the roof awards once and waits for the transition.
{
  const s=quiet();s.tiles.fill(true);s.tiles[1]=false;step(s,.01,'dl');
  const events=tick(s,.21);assert.equal(s.phase,'clear');
  assert.equal(events.filter(e=>e.type==='clear').length,1);
  assert.equal(tick(s,1).filter(e=>e.type==='next').length,1);
  assert.equal(tick(s,1).length,0);
}
// Warnings lock a legal adjacent target, and the three behaviours diverge.
{
  const s=createState(20);s.p.inv=999;
  for(let i=0;i<2000;i++){
    step(s,.01);
    for(const e of s.enemies){
      const to=e.target||e.move?.to;
      if(to){assert.ok(to.r>=0&&to.r<7&&to.c>=0&&to.c<=to.r);assert.equal(Math.abs(to.r-e.r),1);}
    }
  }
  const witch=s.enemies.find(e=>e.type==='witch');assert.ok(witch.r>=4);
}
console.log('House of the Hooded: buffering, landing contact, protection, edges, progression and enemy paths passed.');
