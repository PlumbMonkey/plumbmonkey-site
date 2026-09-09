/* Graveyard Shift: side-scrolling rules kept separate from rendering. */
(function(root){
  "use strict";
  const GROUND=600, WORLD=3400, GOAL=3250;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const CHAPTERS=[
    {name:"GRAVEYARD APPROACH",boss:"THE CRYPT KEEPER",color:"#a8c799",
      blocks:[[440,70,55],[950,95,65],[1330,80,60],[1800,100,80],[2040,85,50]],
      platforms:[[780,465,120],[1660,470,130]],roster:["ghost","bat","frank","ghost","bat","frank"]},
    {name:"MANSION BASEMENT",boss:"THE BOILER WARDEN",color:"#e9ac77",
      blocks:[[460,90,60],[550,85,110],[970,100,70],[1360,90,65],[1450,90,115],[1890,90,65],[1980,90,120]],
      platforms:[[820,455,120],[1700,430,125]],roster:["frank","ghost","frank","bat","ghost","frank"]},
    {name:"CONCERT STAGE",boss:"THE FEEDBACK KING",color:"#cc9cea",
      blocks:[[440,100,75],[970,95,60],[1065,85,115],[1480,100,70],[1820,95,65],[1915,100,120]],
      platforms:[[720,450,150],[1600,440,130],[2130,440,140]],roster:["witch","bat","ghost","witch","bat","frank"]}
  ];
  function createState(level=1){
    const chapter=CHAPTERS[level-1];
    const blocks=chapter.blocks.map(([x,w,h])=>({x,y:GROUND-h,w,h}));
    const platforms=chapter.platforms.map(([x,y,w])=>({x,y,w,h:16,oneWay:true}));
    return {level,chapter,time:0,phase:"play",phaseTime:0,camera:160,checkpoint:80,
      p:{x:80,y:GROUND-58,w:30,h:58,vx:0,vy:0,face:1,on:true,coyote:.1,jumpBuffer:0,health:3,inv:0,power:level>1,fire:0,attack:0,boost:0,flight:0},
      blocks,platforms,
      pickups:[{type:"instrument",x:245,y:GROUND-52,w:36,h:52,taken:level>1},
        ...[720,1560,2330].map(x=>({type:"case",x,y:GROUND-34,w:34,h:34,taken:false})),
        {type:"jump",x:1200,y:GROUND-35,w:28,h:35,taken:false},
        {type:"flight",x:2420,y:GROUND-35,w:28,h:35,taken:false},
        ...chapter.platforms.map(([x,y,w])=>({type:"note",x:x+w/2-12,y:y-32,w:24,h:30,taken:false})),
        {type:"health",x:2240,y:GROUND-32,w:28,h:32,taken:false}],
      enemies:[650,870,1220,1630,2130,2520].map((x,i)=>({x,y:GROUND-52,w:34,h:52,home:x,type:chapter.roster[i],hp:chapter.roster[i]==="frank"?2:1,phase:i,face:-1,flash:0,fire:1.3+i*.15})),
      shots:[],bolts:[],cargo:0,
      boss:{x:2920,y:GROUND-150,w:105,h:150,hp:6+level*2,max:6+level*2,phase:"rest",timer:2,active:false,flash:0},
      checkpointFlash:0};
  }
  function respawn(s){
    const p=s.p;
    Object.assign(p,{x:s.checkpoint,y:GROUND-p.h,vx:0,vy:0,on:true,coyote:.1,jumpBuffer:0,health:3,inv:2.5,fire:0,attack:0,boost:0,flight:0});
    s.shots=[];s.bolts=[];s.phase="play";s.phaseTime=0;
    // Clear room around the checkpoint without deleting defeated-enemy progress.
    for(const e of s.enemies)if(Math.abs(e.x-p.x)<160)e.x=e.home;
    if(s.boss.hp>0){s.boss.phase="rest";s.boss.timer=2;s.boss.active=false;}
  }
  function hurt(s,events){
    const p=s.p;if(p.inv>0||s.phase!=="play")return;
    p.health--;p.inv=1.35;events.push({type:"hurt",x:p.x,y:p.y});
    if(p.health<=0){s.phase="death";s.phaseTime=.65;p.jumpBuffer=0;}
  }
  function movePlayer(s,dt,input){
    const p=s.p;
    p.coyote=p.on?.1:Math.max(0,p.coyote-dt);
    p.jumpBuffer=input.jump?.12:Math.max(0,p.jumpBuffer-dt);
    p.vx=clamp(input.move||0,-1,1)*250;
    if(p.vx)p.face=Math.sign(p.vx);
    p.x=clamp(p.x+p.vx*dt,0,WORLD-p.w);
    for(const b of s.blocks)if(hit(p,b)){
      if(p.vx>0)p.x=b.x-p.w;else if(p.vx<0)p.x=b.x+b.w;
    }
    let jumped=false;
    if(p.jumpBuffer>0&&(p.coyote>0||p.flight>0)){
      p.vy=p.boost>0?-655:-540;p.on=false;p.coyote=0;p.jumpBuffer=0;jumped=true;
    }
    if(input.jumpReleased&&p.vy< -220)p.vy=-220;
    const oldY=p.y;
    p.vy+=(p.flight>0?520:1100)*dt;p.y+=p.vy*dt;p.on=false;
    for(const b of [...s.blocks,...s.platforms]){
      if(p.x+p.w<=b.x||p.x>=b.x+b.w)continue;
      if(p.vy>=0&&oldY+p.h<=b.y+.1&&p.y+p.h>=b.y){p.y=b.y-p.h;p.vy=0;p.on=true;}
      else if(!b.oneWay&&p.vy<0&&oldY>=b.y+b.h&&p.y<=b.y+b.h){p.y=b.y+b.h;p.vy=0;}
    }
    if(p.y+p.h>=GROUND){p.y=GROUND-p.h;p.vy=0;p.on=true;}
    if(p.y<65){p.y=65;p.vy=Math.max(0,p.vy);}
    return jumped;
  }
  function step(s,dt,input={}){
    const events=[];s.time+=dt;
    if(s.phase!=="play"){
      if(s.phase==="waiting")return events;
      s.phaseTime-=dt;
      if(s.phaseTime<=0){events.push({type:s.phase==="death"?"lose":s.level<3?"next":"win"});s.phase="waiting";}
      return events;
    }
    const p=s.p,b=s.boss;
    for(const key of ["inv","fire","attack","boost","flight"])p[key]=Math.max(0,p[key]-dt);
    s.checkpointFlash=Math.max(0,s.checkpointFlash-dt);
    if(movePlayer(s,dt,input))events.push({type:"jump"});
    if(input.fire&&p.power&&p.fire<=0){
      p.fire=.24;p.attack=.16;
      s.shots.push({x:p.x+(p.face>0?p.w:-22),y:p.y+23,w:22,h:14,vx:p.face*660});
      events.push({type:"shoot"});
    }
    for(const item of s.pickups){
      if(item.taken||!hit(p,item)||(item.type==="health"&&p.health===3))continue;
      item.taken=true;
      if(item.type==="instrument")p.power=true;
      if(item.type==="case")s.cargo++;
      if(item.type==="jump")p.boost=10;
      if(item.type==="flight")p.flight=8;
      if(item.type==="health")p.health=3;
      events.push({type:"pickup",kind:item.type,x:item.x,y:item.y});
    }
    for(const checkpoint of [1120,2240]){
      if(p.x>=checkpoint&&s.checkpoint<checkpoint){s.checkpoint=checkpoint;s.checkpointFlash=2;events.push({type:"checkpoint"});}
    }
    for(const e of s.enemies){
      if(e.hp<=0)continue;e.flash=Math.max(0,e.flash-dt);
      if(e.type==="frank"){
        e.x+=Math.cos(s.time*.9+e.phase)*26*dt;e.y=GROUND-e.h;
      }else if(e.type==="ghost"){
        e.x=e.home+Math.sin(s.time*.9+e.phase)*48;e.y=GROUND-70+Math.sin(s.time*2+e.phase)*20;
      }else if(e.type==="bat"){
        e.x=e.home+Math.sin(s.time*1.5+e.phase)*72;e.y=GROUND-80+Math.sin(s.time*2.3+e.phase)*30;
      }else{
        e.x=e.home+Math.sin(s.time+e.phase)*35;e.y=GROUND-115+Math.sin(s.time*2)*15;
        e.fire-=dt;
        if(Math.abs(p.x-e.x)<460&&e.fire<=0){e.fire=2.6;s.bolts.push({x:e.x,y:e.y+20,w:14,h:14,vx:Math.sign(p.x-e.x)*145,vy:65});}
      }
      e.face=p.x<e.x?-1:1;
      if(hit(p,e))hurt(s,events);
    }
    if(p.x>2630&&b.hp>0&&!b.active){b.active=true;b.timer=1.8;events.push({type:"boss"});}
    if(b.active&&b.hp>0){
      b.timer-=dt;b.flash=Math.max(0,b.flash-dt);
      if(b.timer<=0){
        if(b.phase==="rest"){b.phase="warn";b.timer=.85;events.push({type:"warning"});}
        else if(b.phase==="warn"){
          b.phase="attack";b.timer=.45;
          const direction=p.x<b.x?-1:1, muzzle=direction<0?b.x-34:b.x+b.w+4;
          if(s.level===1)s.bolts.push({x:muzzle,y:GROUND-24,w:32,h:24,vx:direction*225,vy:0,ground:true});
          else if(s.level===2){
            const vx=p.x-(b.x-10),vy=p.y+25-(b.y+80),length=Math.hypot(vx,vy)||1;
            s.bolts.push({x:b.x-10,y:b.y+80,w:20,h:20,vx:vx/length*235,vy:vy/length*235});
          }else for(const vy of [-65,0,65])s.bolts.push({x:muzzle,y:GROUND-85,w:17,h:17,vx:direction*225,vy});
          events.push({type:"attack"});
        }else{b.phase="rest";b.timer=1.8;}
      }
      if(hit(p,b))hurt(s,events);
    }
    for(const shot of s.shots){
      shot.x+=shot.vx*dt;
      if(s.blocks.some(o=>hit(shot,o))){shot.dead=true;continue;}
      const enemy=s.enemies.find(e=>e.hp>0&&hit(shot,e));
      if(enemy){enemy.hp--;enemy.flash=.13;shot.dead=true;events.push({type:enemy.hp<=0?"kill":"impact",x:enemy.x,y:enemy.y});continue;}
      if(b.active&&b.hp>0&&hit(shot,b)){
        shot.dead=true;
        if(b.phase==="rest"){
          b.hp--;b.flash=.12;events.push({type:"impact",x:shot.x,y:shot.y});
          if(b.hp===0){s.bolts=[];events.push({type:"bossDown",x:b.x,y:b.y});}
        }else events.push({type:"blocked",x:shot.x,y:shot.y});
      }
    }
    s.shots=s.shots.filter(o=>!o.dead&&o.x>0&&o.x<WORLD);
    for(const bolt of s.bolts){
      bolt.x+=bolt.vx*dt;bolt.y+=bolt.vy*dt;
      if(s.blocks.some(o=>hit(bolt,o)))bolt.dead=true;
      if(!bolt.dead&&hit(p,bolt)){hurt(s,events);bolt.dead=true;}
    }
    s.bolts=s.bolts.filter(o=>!o.dead&&o.x>0&&o.x<WORLD&&o.y<GROUND+30&&o.y>0);
    if(p.x>GOAL&&b.hp<=0&&s.phase==="play"){
      s.phase="clear";s.phaseTime=1;events.push({type:"clear"});
    }
    // The 1280px view is translated by 160px in the shared shell.
    s.camera=clamp(p.x-300,160,WORLD-1120);
    return events;
  }

  // The approved roof character designs, posed for side-scrolling play.
  function makeSprites(c,clock,reduced){
    function path(points, fill, stroke = "#101322", width = 2.5) {
      c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      c.closePath(); c.fillStyle = fill; c.fill();
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    }
    function ellipse(x, y, rx, ry, fill) {
      c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
    }
    function line(points, color, width = 2) {
      c.strokeStyle = color; c.lineWidth = width; c.beginPath();
      points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
    }
    function label(t, x, y, size = 14, color = "#c8c4db", align = "center") {
      c.font = `600 ${size}px system-ui, sans-serif`; c.textAlign = align; c.fillStyle = color; c.fillText(t, x, y);
    }
    function sprite(type, x, y, hop = 0, direction = 1, landing = 0) {
      const t = reduced ? 0 : clock();
      c.save(); c.translate(x, y); c.lineJoin = "round"; c.lineCap = "round";
      c.scale(1 - hop * .08 + landing * .10, 1 + hop * .09 - landing * .12);
      if (type === "hooded") {
        const sway = Math.sin(t * 4) * 2 + direction * hop * 7;
        // Dark tailored cloak, cyan lining, pointed hood and a brass clasp.
        path([[-13,-35],[-22,-12],[-28+sway,1],[-20,5],[-25+sway,24],[0,18],[24+sway,24],[18,2],[25,-1],[14,-36]], "#23324d", "#95c6d5", 2);
        path([[-15,-14],[-17+sway,19],[-3,14],[0,-12]], "#4e8c9d", null);
        path([[3,-12],[7,17],[19+sway,21],[13,-17]], "#354f73", null);
        path([[-19,-27],[-13,-43],[2,-54],[17,-40],[20,-26],[11,-12],[-11,-12]], "#344964", "#a6d6dc", 2);
        path([[-12,-28],[-8,-38],[2,-42],[12,-34],[13,-24],[5,-18],[-7,-20]], "#08111e", null);
        c.shadowColor = "#8ff8eb"; c.shadowBlur = 5;
        ellipse(-5,-29,2.5,2.2,"#c6fff4"); ellipse(6,-29,2.5,2.2,"#c6fff4"); c.shadowBlur = 0;
        path([[0,-11],[5,-6],[0,0],[-5,-6]], "#e4bc6b", "#523d29", 1.5);
        line([[-1,1],[-5,13],[1,10],[5,16]],"#c7b37a",1.5);
        ellipse(-11,22,6,3,"#0a1020"); ellipse(12,22,6,3,"#0a1020");
      } else if (type === "frank") {
        const stomp = hop * 5;
        path([[-20,-19],[-24,3],[-15,7],[-12,-9],[12,-9],[16,7],[25,3],[20,-19]],"#62764d");
        path([[-17,-22],[17,-22],[19,10],[-18,10]],"#3d493d");
        path([[-15,-23],[-5,-11],[-10,3],[0,7],[8,-9],[15,-23]],"#8a9768",null);
        c.fillStyle="#1c2430"; c.fillRect(-15,8,12,14-stomp); c.fillRect(4,8,12,14+stomp);
        c.fillStyle="#0c1220"; c.fillRect(-19,19-stomp,16,7); c.fillRect(4,19+stomp,18,7);
        path([[-14,-46],[14,-46],[15,-23],[7,-18],[-12,-22]],"#b0ce7b");
        path([[-16,-47],[15,-47],[15,-37],[6,-40],[1,-36],[-5,-40],[-15,-37]],"#172431",null);
        c.fillStyle="#abc0d0"; c.fillRect(-20,-29,6,5); c.fillRect(15,-29,6,5);
        line([[-10,-33],[-3,-31]],"#34442e",3); line([[4,-31],[10,-33]],"#34442e",3);
        c.fillStyle="#ffedac"; c.fillRect(-9,-29,4,3); c.fillRect(5,-29,4,3);
        line([[-6,-24],[7,-24]],"#445139"); line([[-9,-43],[-9,-36]],"#536342",1);
      } else if (type === "ghost") {
        const sway = Math.sin(t*5)*4;
        path([[-15,-27],[-19,-11],[-20+sway,20],[-10,13],[-3+sway,25],[5,15],[18+sway,21],[16,-13],[12,-29],[0,-35]],"#d9c4df","#f4d6e3",2);
        path([[6,-26],[9,-5],[4,15],[18+sway,21],[16,-13],[12,-29]],"#a988b8",null);
        ellipse(-6,-16,4,6,"#48243f"); ellipse(6,-16,4,6,"#48243f"); ellipse(0,-3,3,5,"#6d3654");
        c.fillStyle="#ffbac7"; c.fillRect(-7,-17,2,3); c.fillRect(5,-17,2,3);
      } else {
        const sway = Math.sin(t*5)*3;
        line([[-31,16],[31,7]],"#171323",7); line([[-31,16],[31,7]],"#b68b59",3);
        path([[20,5],[35,0],[33,16],[21,13]],"#deb478","#4d3553",1.5);
        line([[25,7],[32,4]],"#78556a",1); line([[25,10],[31,13]],"#78556a",1);
        path([[-11,-11],[-19+sway,15],[8,12],[14,-5]],"#795093","#dcc0f1",1.5);
        path([[-11,-6],[-22,6],[-15,9],[1,-1]],"#b18ac6",null);
        path([[-7,-32],[9,-32],[10,-22],[17,-18],[9,-16],[5,-10],[-8,-13]],"#bfce97");
        path([[-22,-32],[-10,-38],[-6,-59],[3,-52],[10,-35],[22,-29]],"#64437e","#d6b6ec",1.5);
        line([[-9,-37],[8,-35]],"#dfb773",4);
        c.fillStyle="#172333"; c.fillRect(3,-26,4,3);
        line([[-8,-13],[-8,1],[3,5]],"#402d61",4);
      }
      c.restore();
    }

    return sprite;
  }

  function create(api){
    const c=api.ctx;let s,lastJump=false;
    const drawCharacter=makeSprites(c,()=>s.time,api.reduced);
    function rect(x,y,w,h,fill,stroke){c.fillStyle=fill;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.strokeRect(x,y,w,h);}}
    function label(t,x,y,size=16,color="#ddd9e8",align="center"){c.font=`600 ${size}px system-ui,sans-serif`;c.textAlign=align;c.fillStyle=color;c.fillText(t,x,y);}
    function ellipse(x,y,rx,ry,fill){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
    function guitar(x,y,angle=0){
      c.save();c.translate(x,y);c.rotate(angle);c.lineWidth=2;c.strokeStyle="#261c32";
      ellipse(0,9,12,14,"#cf6173");ellipse(6,1,9,10,"#e69592");
      rect(1,-22,6,27,"#e5bc80","#453653");rect(0,-28,9,8,"#dbac66");
      c.strokeStyle="#ffe0b5";c.lineWidth=1;c.beginPath();c.moveTo(4,-25);c.lineTo(4,15);c.stroke();ellipse(4,10,3,4,"#492d50");c.restore();
    }
    function drawBat(e){
      const flap=api.reduced?0:Math.sin(s.time*13+e.phase)*10;
      c.save();c.translate(e.x+17,e.y+26);c.fillStyle="#925873";c.strokeStyle="#f1bacd";c.lineWidth=1.5;
      c.beginPath();c.moveTo(-3,-4);c.lineTo(-34,-16+flap);c.lineTo(-27,5);c.lineTo(-17,2);c.lineTo(-7,15);c.lineTo(0,6);c.lineTo(7,15);c.lineTo(17,2);c.lineTo(27,5);c.lineTo(34,-16+flap);c.lineTo(3,-4);c.closePath();c.fill();c.stroke();
      ellipse(0,0,8,11,"#352a48");rect(-5,-3,3,3,"#f9d09a");rect(2,-3,3,3,"#f9d09a");c.restore();
    }
    function backdrop(){
      api.bg();
      if(s.level===1){api.mansion(.16);}
      else{
        rect(-160,0,1280,600,s.level===2?"#15151f":"#171023");
        for(let i=-1;i<9;i++){
          const x=i*190-(s.camera*.18)%190;
          if(s.level===2){rect(x,85,130,440,"#222231","#3b3548");rect(x+22,140,85,90,"#141925","#554458");}
          else{rect(x,100,38,420,"#35243d");c.fillStyle=i%2?"#9f78ce18":"#57b3bc18";c.beginPath();c.moveTo(x,140);c.lineTo(x-100,600);c.lineTo(x+170,600);c.fill();}
        }
      }
      // Background gravestones stay muted and behind a fence: solid obstacles have bright top edges.
      if(s.level===1)for(let i=-1;i<12;i++){
        const x=i*130-(s.camera*.3)%130;rect(x,520,34,72,"#293247");ellipse(x+17,520,17,15,"#293247");
        rect(x-30,578,130,3,"#465065");rect(x+5,570,3,28,"#465065");
      }
    }
    function draw(){
      backdrop();c.save();c.translate(-s.camera,0);
      rect(0,GROUND,WORLD,120,"#151c2c");rect(0,GROUND,WORLD,5,s.chapter.color);
      for(let x=0;x<WORLD;x+=70)rect(x,GROUND+20,40,2,"#30364a");
      for(const o of [...s.blocks,...s.platforms]){
        rect(o.x,o.y,o.w,o.h,s.level===1?"#414859":s.level===2?"#554350":"#3e3458","#938396");
        rect(o.x,o.y,o.w,5,s.chapter.color);
        if(!o.oneWay){
          if(s.level===3){ellipse(o.x+o.w/2,o.y+o.h*.55,Math.min(20,o.w/4),Math.min(20,o.h/3),"#201d32");}
          else{rect(o.x+8,o.y+15,o.w-16,3,"#80717b");rect(o.x+8,o.y+o.h-12,o.w-16,3,"#272735");}
        }
      }
      for(const x of [1120,2240]){
        rect(x-5,GROUND-85,5,85,"#a1b4be");rect(x,GROUND-85,28,22,s.checkpoint>=x?"#8fd4c1":"#5a627e");
        label("CHECKPOINT",x+10,GROUND-98,11,s.checkpoint>=x?"#abeddb":"#a3a8bb");
      }
      for(const item of s.pickups){
        if(item.taken)continue;const bob=api.reduced?0:Math.sin(s.time*3+item.x)*3;
        c.save();c.translate(item.x,item.y+bob);
        if(item.type==="instrument"){guitar(17,27,-.3);label("SONIC GUITAR",18,-13,13,"#f1cf9c");}
        else if(item.type==="case"){
          rect(0,2,34,30,"#5f443f","#e1bb7b");rect(6,11,22,14,"#372e38");rect(10,-3,14,5,"#ae926f");label("GC",17,23,10,"#f7d59e");
        }else if(item.type==="note")label("♪",12,24,32,"#99e9df");
        else if(item.type==="health"){ellipse(14,16,15,15,"#314c51");rect(10,6,8,21,"#b4e5c6");rect(4,12,20,8,"#b4e5c6");}
        else{ellipse(14,17,15,15,"#354251");label(item.type==="jump"?"↑":"✦",14,26,26,"#c5dd94");label(item.type==="jump"?"HIGH JUMP":"GHOST FLIGHT",14,-8,11,"#d8e9ba");}
        c.restore();
      }
      for(const e of s.enemies){
        if(e.hp<=0)continue;
        ellipse(e.x+17,GROUND+2,18,4,"#090d1788");
        c.save();if(e.flash>0)c.globalAlpha=.5;
        if(e.type==="bat")drawBat(e);
        else drawCharacter(e.type,e.x+17,e.y+e.h-23,e.type==="frank"?Math.abs(Math.sin(s.time*4))*.15:0,e.face);
        if(e.type==="frank"&&e.hp<2)label("•",e.x+17,e.y-10,18,"#e8c59a");c.restore();
      }
      const b=s.boss;
      if(b.hp>0){
        ellipse(b.x+50,GROUND+3,60,8,"#070a1488");
        c.save();c.translate(b.x+52,GROUND-45);c.scale(2.1,2.1);if(b.flash>0)c.globalAlpha=.55;
        drawCharacter(s.level===1?"ghost":s.level===2?"frank":"witch",0,0,b.phase==="warn"?.12:0,-1);
        if(s.level===3)guitar(0,3,.8);c.restore();
        if(b.phase!=="rest"){
          c.strokeStyle="#ecad8e";c.lineWidth=3;c.beginPath();c.ellipse(b.x+50,b.y+75,65,83,0,0,Math.PI*2);c.stroke();
        }
        label(s.chapter.boss,b.x+50,b.y-50,15,"#edc5c9");
        rect(b.x-20,b.y-35,145,10,"#272135");rect(b.x-18,b.y-33,141*b.hp/b.max,6,s.chapter.color);
        if(b.active)label(b.phase==="rest"?"EXPOSED — FIRE!":"BRACING — DODGE!",b.x+50,b.y-12,13,b.phase==="rest"?"#cde6ab":"#ffb2a7");
      }
      for(const shot of s.shots){
        c.strokeStyle="#a9f5e3";c.lineWidth=4;c.beginPath();c.arc(shot.x+11,shot.y+7,9,0,Math.PI*2);c.stroke();
        rect(shot.x+4,shot.y+5,14,4,"#f4ffed");
      }
      for(const bolt of s.bolts){
        if(bolt.ground){rect(bolt.x,bolt.y,bolt.w,bolt.h,"#ef8e75","#ffe0ac");}
        else{ellipse(bolt.x+bolt.w/2,bolt.y+bolt.h/2,bolt.w/2+2,bolt.h/2+2,"#ffc48e");ellipse(bolt.x+bolt.w/2,bolt.y+bolt.h/2,4,4,"#a84262");}
      }
      const p=s.p;
      ellipse(p.x+15,p.y+p.h+3,18,5,"#080f2288");
      c.save();c.translate(p.x+p.w/2,p.y+p.h-23);c.scale(p.face,1);
      if(p.inv>0){c.strokeStyle="#a6eee0";c.lineWidth=2;c.beginPath();c.ellipse(0,-7,26,38,0,0,Math.PI*2);c.stroke();}
      if(s.phase==="death")c.globalAlpha=.45;
      drawCharacter("hooded",0,0,p.on?Math.abs(Math.sin(s.time*11))*Math.abs(p.vx)/250*.12:.35,1);
      if(p.power){c.save();c.translate(p.attack>0?7:2,0);guitar(9,1,p.attack>0?.8:.45);c.restore();}
      c.restore();
      rect(GOAL,420,15,180,b.hp>0?"#684a6b":"#88c6b4");
      label(b.hp>0?"GUARDIAN SEAL":s.level<3?"NEXT CHAPTER":"TAKE THE STAGE",GOAL,398,16,"#dcd5e7");
      c.restore();
      // Keep the status text out of the playfield and off the CRT layer.
      rect(-160,0,1280,81,"#0b1022ed");
      label(s.chapter.name,-128,29,18,"#e7d7be","left");
      label(`HEALTH ${"●".repeat(p.health)}${"○".repeat(3-p.health)}`,480,28,18,"#a5dfc9");
      label(`CASES ${s.cargo}/3`,1080,29,18,"#e6c48f","right");
      let hint=!p.power?"GRAB THE GUITAR AHEAD →":s.boss.hp<=0?"GUARDIAN DOWN — FOLLOW THE EXIT →":s.boss.active?(s.boss.phase==="rest"?"GUARDIAN EXPOSED — HOLD SONIC":s.level===1?"GROUND WAVE — JUMP!":s.level===2?"AIMED BOLT — MOVE AFTER THE WARNING":"THREE-NOTE VOLLEY — FIND THE GAP"):
        "HOLD X / CTRL: SONIC  ·  TAP SPACE: JUMP  ·  CASES ARE BONUS CARGO";
      if(s.checkpointFlash>0)hint="CHECKPOINT LIT — YOUR PROGRESS IS SAFE";
      if(s.phase==="death")hint="RETURNING TO CHECKPOINT";
      if(s.phase==="clear")hint=s.level<3?"CHAPTER COMPLETE":"GHOST CIRCUIT IS BACK ONLINE";
      label(hint,480,61,15,"#ccc9dd");
      if(p.flight>0||p.boost>0)label(`${p.flight>0?"FLIGHT":"HIGH JUMP"} ${Math.ceil(p.flight||p.boost)}s`,480,110,17,"#d2e6a1");
    }
    return {
      reset(){s=createState(api.level());lastJump=false;},next(){this.reset();},respawn(){respawn(s);lastJump=false;},
      update(dt){
        const held=api.down("Space","ArrowUp","KeyW");
        const input={move:(api.down("ArrowRight","KeyD")?1:0)-(api.down("ArrowLeft","KeyA")?1:0),jump:api.tap("Space","ArrowUp","KeyW"),jumpReleased:lastJump&&!held,fire:api.down("KeyX","ControlLeft","ControlRight")||api.tap("KeyX","ControlLeft","ControlRight")};
        lastJump=held;
        for(const e of step(s,dt,input)){
          if(e.type==="jump")api.sweep(230,500,.1,"triangle",.035);
          if(e.type==="shoot")api.sweep(570,270,.12,"triangle",.035);
          if(e.type==="pickup"){
            api.score(e.kind==="case"?250:e.kind==="instrument"?400:100);api.burst(e.x,e.y,"#d4dfb0",8);
            api.toast({instrument:"SONIC GUITAR — HOLD X / CTRL",case:"EQUIPMENT SECURED",jump:"HIGH JUMP — 10 SECONDS",flight:"GHOST FLIGHT — TAP JUMP TO FLY",health:"HEALTH RESTORED",note:"BONUS NOTE"}[e.kind]);api.chord([330,440,660]);
          }
          if(e.type==="kill"){api.score(150);api.burst(e.x,e.y,"#dbb2c5",12);}
          if(e.type==="impact"){api.burst(e.x,e.y,"#d7e3b2",5);api.beep(150,.06,"triangle",.03);}
          if(e.type==="blocked")api.beep(90,.04,"triangle",.02);
          if(e.type==="hurt"){api.burst(e.x,e.y,"#ec9ba6",8);api.sweep(200,70,.2,"square",.04);}
          if(e.type==="checkpoint")api.chord([440,554,660]);
          if(e.type==="warning")api.beep(210,.16,"triangle",.035);
          if(e.type==="attack")api.sweep(160,65,.2,"sawtooth",.035);
          if(e.type==="bossDown"){api.score(1500);api.burst(e.x,e.y,"#b5e3cd",25);api.chord([330,440,660,880]);}
          if(e.type==="clear")api.score(1000+s.cargo*750);
          if(e.type==="lose")api.lose();if(e.type==="next")api.next();if(e.type==="win")api.end(true);
        }
      },draw,attract:null
    };
  }
  const exports={create,createState,step,respawn,movePlayer,hit};
  if(typeof module!=="undefined"&&module.exports)module.exports=exports;else root.GraveyardGame=exports;
})(typeof window!=="undefined"?window:globalThis);
