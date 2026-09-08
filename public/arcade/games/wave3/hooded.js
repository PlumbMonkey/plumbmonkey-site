/* House of the Hooded: deterministic roof rules and canvas artwork.
   The model is independent of the browser so movement/collision can be tested. */
(function (root) {
  "use strict";
  const ROWS = 7, HOP = .2, BUFFER = .24;
  const moves = { ul: [-1, -1], ur: [-1, 0], dl: [1, 0], dr: [1, 1] };
  const valid = (r, c) => r >= 0 && r < ROWS && c >= 0 && c <= r;
  const same = (a, b) => a.r === b.r && a.c === b.c;
  const tileIndex = (r, c) => r * (r + 1) / 2 + c;
  const position = (r, c) => ({ x: 480 + (c - r / 2) * 98, y: 112 + r * 61 });
  const neighbours = p => Object.values(moves).map(([r, c]) => ({ r: p.r + r, c: p.c + c })).filter(p => valid(p.r, p.c));

  function enemies(level) {
    const pace = Math.min(level - 1, 10) * .035;
    return [
      { type: "frank", r: 6, c: 0, wait: 2.6, period: 1.35 - pace, duration: .30 },
      { type: "ghost", r: 6, c: 6, wait: 3.2, period: 1.12 - pace, duration: .34 },
      { type: "witch", r: 4, c: 2, wait: 3.8, period: 1.02 - pace, duration: .25, patrol: 0 }
    ];
  }
  function createState(level = 1) {
    return {
      level, time: 0, phase: "play", phaseTime: 0,
      p: { r: 0, c: 0, inv: 2.2, land: 0, move: null },
      tiles: Array.from({ length: 28 }, (_, i) => i === 0),
      enemies: enemies(level), history: [{ r: 0, c: 0 }], queue: null
    };
  }
  function respawn(s) {
    s.p = { r: 0, c: 0, inv: 2.5, land: 0, move: null };
    s.enemies = enemies(s.level);
    s.history = [{ r: 0, c: 0 }];
    s.queue = null; s.phase = "play"; s.phaseTime = 0;
  }
  function targetFor(e, s) {
    const choices = neighbours(e);
    if (e.type === "witch") {
      // A fixed diamond patrol: her intent can be learned, unlike the pursuer.
      const route = [{ r: 4, c: 2 }, { r: 5, c: 3 }, { r: 6, c: 3 }, { r: 5, c: 2 }];
      e.patrol = (e.patrol + 1) % route.length;
      return route[e.patrol];
    }
    const target = e.type === "ghost" ? s.history[Math.max(0, s.history.length - 4)] : s.p;
    const distance = p => Math.abs(p.r - target.r) + Math.abs((p.c - p.r / 2) - (target.c - target.r / 2));
    return choices.sort((a, b) => distance(a) - distance(b))[0];
  }
  function damage(s, events) {
    if (s.p.inv > 0 || s.p.move || s.phase !== "play") return false;
    if (!s.enemies.some(e => !e.move && same(e, s.p))) return false;
    s.phase = "hit"; s.phaseTime = .65; s.queue = null;
    events.push({ type: "hit" });
    return true;
  }
  function step(s, dt, direction) {
    const events = [];
    s.time += dt;
    if (s.phase !== "play") {
      if (s.phase === "waiting") return events;
      s.phaseTime -= dt;
      if (s.phaseTime <= 0) {
        events.push({ type: s.phase === "clear" ? "next" : "lose" });
        s.phase = "waiting";
      }
      return events;
    }
    s.p.inv = Math.max(0, s.p.inv - dt);
    s.p.land = Math.max(0, s.p.land - dt);
    if (s.queue) { s.queue.ttl -= dt; if (s.queue.ttl <= 0) s.queue = null; }
    if (moves[direction]) s.queue = { direction, ttl: BUFFER };

    // Commit the tile only at landing. Airborne sprites do not occupy either tile.
    if (s.p.move) {
      const m = s.p.move; m.elapsed += dt;
      if (m.elapsed >= HOP) {
        s.p.r = m.to.r; s.p.c = m.to.c; s.p.move = null; s.p.land = .14;
        s.history.push({ r: s.p.r, c: s.p.c });
        if (s.history.length > 12) s.history.shift();
        const i = tileIndex(s.p.r, s.p.c);
        if (!s.tiles[i]) { s.tiles[i] = true; events.push({ type: "tile", ...position(s.p.r, s.p.c) }); }
        events.push({ type: "land" });
      }
    }
    for (const e of s.enemies) {
      if (e.move) {
        e.move.elapsed += dt;
        if (e.move.elapsed >= e.duration) {
          e.r = e.move.to.r; e.c = e.move.to.c; e.move = null; e.wait = e.period;
        }
      } else {
        e.wait -= dt;
        if (e.wait <= .32 && !e.target) e.target = targetFor(e, s);
        if (e.wait <= 0) {
          e.move = { from: { r: e.r, c: e.c }, to: e.target, elapsed: 0 };
          e.target = null;
        }
      }
    }
    if (damage(s, events)) return events;
    if (s.tiles.every(Boolean)) {
      s.phase = "clear"; s.phaseTime = .8; s.queue = null;
      events.push({ type: "clear" }); return events;
    }
    if (!s.p.move && s.queue) {
      const [dr, dc] = moves[s.queue.direction];
      const to = { r: s.p.r + dr, c: s.p.c + dc };
      s.queue = null;
      if (!valid(to.r, to.c)) {
        s.phase = "fall"; s.phaseTime = .75;
        s.fall = { from: position(s.p.r, s.p.c), dx: dc - dr / 2 };
        events.push({ type: "fall" });
      } else {
        s.p.move = { from: { r: s.p.r, c: s.p.c }, to, elapsed: 0 };
        events.push({ type: "hop" });
      }
    }
    return events;
  }

  function create(api) {
    const { ctx: c } = api;
    let state;
    const colors = { frank: "#a4cf75", ghost: "#ffacbb", witch: "#d5a5ff" };
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
      const t = api.reduced ? 0 : state.time;
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
    function actorPose(actor, duration) {
      const m = actor.move;
      if (!m) return { ...position(actor.r, actor.c), hop: 0, direction: 0 };
      const k = Math.min(1, m.elapsed / duration), a = position(m.from.r,m.from.c), b = position(m.to.r,m.to.c);
      return { x:a.x+(b.x-a.x)*k, y:a.y+(b.y-a.y)*k, hop:Math.sin(k*Math.PI), direction:Math.sign(b.x-a.x) };
    }
    function tile(r, col) {
      const {x,y} = position(r,col), on=state.tiles[tileIndex(r,col)];
      path([[x-47,y+26],[x,y+51],[x,y+64],[x-47,y+38]],on?"#536641":"#252a41","#151b2a",1);
      path([[x,y+51],[x+47,y+26],[x+47,y+38],[x,y+64]],on?"#394b36":"#1b2034","#151b2a",1);
      path([[x,y+2],[x+47,y+26],[x,y+51],[x-47,y+26]],on?"#a9bd78":"#42465f",on?"#deecac":"#8c83a6",1.5);
      line([[x-31,y+26],[x,y+10],[x+31,y+26]],on?"#ccd995":"#625f7e",1);
      path([[x,y+19],[x+7,y+26],[x,y+33],[x-7,y+26]],on?"#f7e3a0":"#292e46",null);
    }
    function draw() {
      api.bg(true);
      c.save(); c.globalAlpha=.15; api.house(); c.restore();
      // A quiet roof facade leaves the playing tiles and silhouettes prominent.
      path([[143,525],[817,525],[857,700],[103,700]],"#111a2b","#39465c",2);
      for(let x=190;x<820;x+=145){
        path([[x-21,660],[x-21,586],[x,567],[x+21,586],[x+21,660]],"#503f54","#726477",2);
        c.fillStyle="#b28b65"; c.fillRect(x-13,590,26,56); line([[x,584],[x,647]],"#302d40",3);
      }
      label("LIGHT THE ROOF • OUTWIT THE HAUNT",480,39,15,"#e4d5b5");
      const lit=state.tiles.filter(Boolean).length;
      label(`${lit} / 28 TILES`,480,67,18,"#cfe59a");
      for(let r=0;r<ROWS;r++)for(let col=0;col<=r;col++)tile(r,col);
      // Locked destination markers make the final 320ms of each enemy wait readable.
      for(const e of state.enemies){
        if(e.target){const q=position(e.target.r,e.target.c);line([[q.x-19,q.y+26],[q.x,q.y+16],[q.x+19,q.y+26],[q.x,q.y+36],[q.x-19,q.y+26]],colors[e.type],3);}
      }
      const actors=state.enemies.map(e=>({type:e.type,pose:actorPose(e,e.duration)}));
      if(state.phase!=="fall")actors.push({type:"hooded",pose:actorPose(state.p,HOP)});
      actors.sort((a,b)=>a.pose.y-b.pose.y);
      for(const a of actors){
        const {x,y,hop,direction}=a.pose;
        ellipse(x,y+31,19-hop*6,5-hop*2,"#09111f88");
        if(a.type==="hooded"&&state.p.inv>0){
          c.strokeStyle="#93e7db";c.lineWidth=2;c.beginPath();c.ellipse(x,y+29,27,9,0,0,Math.PI*2);c.stroke();
        }
        c.save();
        if(a.type==="hooded"&&state.phase==="hit")c.globalAlpha=api.reduced?.6:.45+Math.abs(Math.sin(state.time*18))*.55;
        sprite(a.type,x,y+8-hop*39,direction?hop:0,direction,state.p.land/.14*(a.type==="hooded"?1:0));
        c.restore();
      }
      if(state.phase==="fall"){
        const k=1-Math.max(0,state.phaseTime)/.75, q=state.fall;
        c.save();c.globalAlpha=1-k*.65;c.translate(q.from.x+q.dx*140*k,q.from.y+8-65*k+400*k*k);c.rotate(k*q.dx*2);
        sprite("hooded",0,0,.5,q.dx);c.restore();
      }
      // The diagram uses screen diagonals and keyboard labels together.
      label("DIAGONAL HOPS",12,270,13,"#e4d5b5");
      label("A / ←  ↖",-21,306,15); label("↗  W / ↑",47,306,15);
      path([[12,322],[28,331],[12,340],[-4,331]],"#577588","#a6d6dc",1);
      label("S / ↓  ↙",-21,370,15); label("↘  D / →",47,370,15);
      label("Tap to hop",12,400,13);label("Queue your next move",12,421,12);
      label("WATCH THEIR STEPS",990,230,13,"#e4d5b5");
      [["frank","FRANKENSTEIN","Chases you",290],["ghost","THE GHOST","Follows your trail",385],["witch","THE WITCH","Patrols a diamond",480]].forEach(([type,title,copy,y])=>{
        c.save();c.translate(990,y);c.scale(.67,.67);sprite(type,0,0);c.restore();
        label(title,990,y+35,12,colors[type]);label(copy,990,y+54,12);
      });
      const message=state.phase==="clear"?"ROOF RESTORED":state.phase==="fall"?"WATCH THE EDGE":state.phase==="hit"?"CAUGHT — TRY A NEW ROUTE":state.p.inv>0?"PROTECTED — PLAN YOUR ROUTE":"Light every tile. A marked tile is an enemy’s next landing.";
      c.fillStyle="#0a1021e8";c.fillRect(174,661,612,34);
      label(message,480,683,14,state.phase==="hit"||state.phase==="fall"?"#ffb3bd":"#e2decf");
    }
    return {
      reset(){state=createState(api.level());},
      respawn(){respawn(state);},
      next(){state=createState(api.level());},
      update(dt){
        const direction=api.tap("ArrowLeft","KeyA")?"ul":api.tap("ArrowUp","KeyW")?"ur":api.tap("ArrowDown","KeyS")?"dl":api.tap("ArrowRight","KeyD")?"dr":null;
        for(const event of step(state,dt,direction)){
          if(event.type==="hop")api.beep(320,.08,"triangle",.04);
          if(event.type==="land")api.beep(145,.045,"triangle",.025);
          if(event.type==="tile"){api.score(100);api.burst(event.x,event.y+26,"#d6e8a2",5);api.beep(330+state.tiles.filter(Boolean).length*17,.1,"triangle",.04);}
          if(event.type==="fall"||event.type==="hit")api.sweep(260,65,.4,"sawtooth",.05);
          if(event.type==="clear"){api.score(1400);api.chord([523,659,784,1047]);}
          if(event.type==="lose")api.lose();
          if(event.type==="next")api.next();
        }
      },draw,attract:null
    };
  }
  const api={create,createState,step,respawn,position};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.HoodedGame=api;
})(typeof window!=="undefined"?window:globalThis);
