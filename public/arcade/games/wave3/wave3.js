(() => {
  "use strict";
  /* PRESENTATION vs WORLD.
     Waves 1 and 2 are 960x540 — 16:9 — so fullscreen scales them to 84vh and
     they fill 84% of a 16:9 monitor's width. Wave 3 was authored at 960x720
     (4:3) and, capped at the same 84vh, came out 400px narrower with 355px of
     black down each side. That is the mismatch.

     The fix is presentational, not a re-layout. The WORLD stays 960x720: every
     hardcoded coordinate in the four game modules, every jump arc, platform
     height and pyramid row is untouched, and so is collision and input (these
     games are keyboard-only — nothing reads canvas coordinates). What changes
     is the VIEW: the canvas becomes 1280x720, exactly waves 1-2's 16:9, and
     each frame is drawn through a +PAD translate so the world sits centred.

     The 160px that opens up on each side is not black. Everything that draws a
     full-width backdrop — bg(), mansionBackdrop(), and the ground/sky bands and
     tiling loops inside the game modules — was already written against W, so
     each is widened to -PAD..W+PAD and paints the whole view. The games gain
     scenery either side of the playfield instead of letterbox bars. Two are
     deliberately left at world width: the mansion cutout, which would distort
     if stretched, and fog(), which already wraps over a range wider than the
     view. Offscreen spawn and wrap points move out to the view edge too, so
     nothing pops into existence inside the visible area.

     The playable column is still 960 wide. Promoting that scenery to real play
     area would mean re-authoring each game's layout; this makes the cabinets
     present identically first. */
  const canvas=document.querySelector("canvas"),ctx=canvas.getContext("2d"),W=960,H=720;
  const VIEW_W=Math.round(H*16/9), PAD=(VIEW_W-W)/2;   // 1280x720, PAD=160
  canvas.width=VIEW_W;canvas.height=H;
  const id=document.body.dataset.game, accent=document.body.dataset.accent||"#c084fc";
  document.documentElement.style.setProperty("--accent",accent);
  const $=s=>document.querySelector(s), overlay=$("#startOverlay"),scoreEl=$("#score"),livesEl=$("#lives"),levelEl=$("#level");
  const attractMode=/[?&]attract\b/.test(location.search);
  const keys={}, pressed={}; let prevKeys={}; window.wave3Keys=keys; let running=false,paused=false,last=0,audio=null,musicBus=null,sfxBus=null,musicClock=0,musicStep=0,reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Discrete on-screen taps must survive even when no frame sees a held key.
  window.wave3Tap=code=>{pressed[code]=true;};
  const storage=`plumbmonkey.arcade.wave3.${id}.highScore`;
  const mansion=new Image();mansion.src="/assets/haunted-house-branded.jpg";
  const houseCutout=new Image();houseCutout.src="../wave3/haunted-house-cutout.png";
  let particles=[];
  let score=0,lives=3,level=1,high=+(localStorage.getItem(storage)||0),beamBonusAwarded=false;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=(a,b)=>a+Math.random()*(b-a),hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const down=(...c)=>c.some(x=>keys[x]); const tap=(...c)=>c.some(x=>pressed[x]);
  addEventListener("keydown",e=>{if(!keys[e.code])pressed[e.code]=true;keys[e.code]=true;if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();if(e.code==="Escape"||e.code==="KeyP")togglePause();if(!running&&!e.repeat&&e.code==="Enter")start()});
  addEventListener("keyup",e=>keys[e.code]=false);addEventListener("blur",()=>{if(running&&!paused)togglePause()});
  // Route through the shared arcade mixer: separate music/SFX buses, saved
  // levels and a limiter, all controlled by the 🔊 panel the other games use.
  // Falls back to a bare context if arcade-audio.js somehow failed to load.
  function audioStart(){
    // Cabinet previews auto-start, and the hub shows twelve at once — now that
    // every game has a track, that would be twelve soundtracks the moment any
    // click lets the suspended contexts resume. Previews stay silent.
    if(attractMode)return;
    // NB: arcade-audio.js declares `const ArcadeAudio` at the top level of a
    // classic script, which is a script-scoped binding — it is NOT on window.
    // Checking window.ArcadeAudio silently always fails over to the fallback.
    const shared=typeof ArcadeAudio!=="undefined"?ArcadeAudio:null;
    if(!audio){
      if(shared){audio=shared.context();sfxBus=shared.output("sfx");musicBus=shared.output("music")}
      else{audio=new (window.AudioContext||window.webkitAudioContext)();sfxBus=audio.destination;musicBus=audio.createGain();musicBus.connect(audio.destination)}
    }
    if(shared)shared.resume();else audio.resume();
  }
  function beep(f=440,d=.08,type="square",vol=.04){if(!audio||!sfxBus)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(sfxBus);o.start();o.stop(audio.currentTime+d)}
  function sweep(a,b,d=.12,type="sawtooth",vol=.05){if(!audio||!sfxBus)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(a,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(30,b),audio.currentTime+d);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(sfxBus);o.start();o.stop(audio.currentTime+d)}
  function chord(notes,d=.18,vol=.035){if(notes.length===3&&notes[0]===196&&notes[1]===165&&notes[2]===147){notes.forEach((f,i)=>setTimeout(()=>{sweep(f,72+i*4,.16,"square",.065);setTimeout(()=>beep(82-i*5,.11,"sawtooth",.035),55)},i*185));return}notes.forEach((f,i)=>setTimeout(()=>beep(f,d,"triangle",vol),i*45))}
  function musicVoice(f,d=.2,type="triangle",vol=.01,cutoff=900,detune=0){if(!audio||!musicBus)return;const o=audio.createOscillator(),g=audio.createGain(),filter=audio.createBiquadFilter(),now=audio.currentTime;o.type=type;o.frequency.value=f;o.detune.value=detune;filter.type="lowpass";filter.frequency.value=cutoff;filter.Q.value=2.5;g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(vol,now+.018);g.gain.exponentialRampToValueAtTime(.001,now+d);o.connect(filter);filter.connect(g);g.connect(musicBus);o.start(now);o.stop(now+d+.02)}
  // One step sequencer for all four games. Each ticks its own clock so tempo is
  // per-game, and every voice goes to the shared music bus (which the arcade's
  // mixer keeps at 0.45 against 0.75 for SFX, so the track sits under the game).
  function music(dt){
    if(!audio||!musicBus)return;
    musicClock-=dt;if(musicClock>0)return;
    const s=musicStep++;
    beat=1;if(s%4===0)beatAccent=1;
    if(id==="ampRampage"){
      musicClock+=.32;
      const step=s%32,arp=[261.63,311.13,369.99,415.3,369.99,311.13,277.18,233.08,261.63,311.13,349.23,392,349.23,311.13,246.94,220],bass=[65.41,61.74,69.3,58.27,65.41,77.78,69.3,55];
      musicVoice(arp[step%16]*(step>15?.5:1),.19,"triangle",.009,1350,step%2?7:-7);
      if(step%4===0){const b=bass[(step/4)%8];musicVoice(b,.3,"sawtooth",.024,260);musicVoice(b*2,.14,"square",.006,520,-9)}
      if(step===0||step===16){const root=step?58.27:65.41;[root,root*1.1892,root*1.4142].forEach((f,i)=>musicVoice(f,.92,"sawtooth",.0055,390,i*5-5))}
      if(step%8===6)musicVoice(step<16?185:164.81,.34,"square",.006,680,11);
    }else if(id==="beamMeUpLive"){
      // A minor, urgent 16ths — tightens as the waves climb, floored so late
      // levels stay playable rather than turning into a buzz
      musicClock+=Math.max(.135,.185-level*.004);
      const step=s%16,
        arp=[440,523.25,659.25,880,783.99,659.25,523.25,659.25,415.3,523.25,622.25,830.61,783.99,622.25,523.25,622.25],
        bass=[55,55,43.65,43.65,49,49,41.2,41.2];
      musicVoice(arp[step],.15,"square",.0065,1700,step%2?6:-6);
      if(step%2===0){const b=bass[(step/2)%8];musicVoice(b,.26,"sawtooth",.021,250);musicVoice(b*2,.12,"triangle",.005,600,-8)}
      if(step%4===2)musicVoice(1760,.045,"triangle",.0035,3200);
      if(step===0)[110,130.81,164.81].forEach((f,i)=>musicVoice(f,.8,"sawtooth",.005,430,i*6-6));
    }else if(id==="houseOfTheHooded"){
      // 3/4 music box, D minor — light and a little askew, to match the hopping
      musicClock+=.235;
      const step=s%24,mel=[587.33,698.46,880,698.46,587.33,466.16,523.25,622.25,830.61,622.25,523.25,415.3],
        bass=[73.42,73.42,58.27,58.27,65.41,65.41,49,49];
      musicVoice(mel[step%12],.28,"triangle",.0085,2400,step%3===0?0:9);
      if(step%3===0)musicVoice(bass[(step/3)%8],.34,"sawtooth",.017,230);
      if(step%12===9)musicVoice(1174.66,.18,"triangle",.004,3000,-12);
      if(step===0)[146.83,174.61,220].forEach((f,i)=>musicVoice(f,.95,"triangle",.0045,520,i*7-7));
    }else if(id==="graveyardShift"){
      // E minor, and it follows the chapters: sparse crypt, pulsing basement,
      // then the concert stage picks up the tempo and switches to power chords
      const rock=level>=6,mid=level>=4&&!rock;
      musicClock+=rock?0.17:mid?0.21:0.27;
      const step=s%16,low=[82.41,82.41,61.74,61.74,73.42,73.42,55,55],lead=[329.63,392,493.88,392,329.63,293.66,246.94,293.66];
      if(step%2===0)musicVoice(low[(step/2)%8],rock?0.2:0.42,"sawtooth",rock?0.022:0.016,rock?300:200);
      if((rock||mid)&&step%4===0)musicVoice(lead[(step/4)%8]*(rock?1:.5),.3,"square",.007,rock?1500:900,7);
      if(rock&&step%2===1)musicVoice(1318.51,.05,"triangle",.003,3200);
      if(!rock&&!mid&&step%8===0)musicVoice([164.81,146.83,123.47,146.83][(s>>3)%4],1.1,"triangle",.006,700,-5);
      if(step===0)[82.41,98,123.47].forEach((f,i)=>musicVoice(f,rock?.55:1,"sawtooth",.005,rock?520:360,i*6-6));
    }else musicClock+=.5;
  }
  /* The rig's lights are driven by the SEQUENCER, not by a clock of their own:
     music() raises these on each step and each downbeat, and loop() decays
     them, so the clamp lights and the footlights breathe with the track that is
     actually playing. They also keep a slow sine underneath, because the audio
     context stays suspended until the player interacts and a dead rig would
     otherwise be the first thing they see. */
  let beat=0,beatAccent=0;
  function hud(){scoreEl.textContent=score.toLocaleString();livesEl.textContent=lives;levelEl.textContent=level;$("#high").textContent=high.toLocaleString()}
  function addScore(n){score+=n;if(score>high){high=score;if(!attractMode)localStorage.setItem(storage,String(high))}hud()}
  // Hub cabinet previews are non-interactive, so a toast fading in and out over
  // the attract loop just reads as text flashing across the screen.
  /* Toasts QUEUE rather than overwrite. Amp Rampage fires two or three in a row
     at the moments that matter most — pick stowed, key taken, cage unlocked —
     and each one used to stamp over the last mid-fade, so the important line was
     reliably the one you did not get to read. Repeats collapse and the queue is
     capped at three, so a burst cannot back the messages up behind the moment
     they are describing. */
  let toastQ=[],toastBusy=false;
  function toast(t){
    if(attractMode)return;
    if(toastQ[toastQ.length-1]===t)return;
    toastQ.push(t);
    if(toastQ.length>3)toastQ.shift();
    pumpToast();
  }
  function pumpToast(){
    if(toastBusy||!toastQ.length)return;
    const e=$("#toast");
    if(!e)return;
    toastBusy=true;
    e.textContent=toastQ.shift();
    e.classList.add("show");
    setTimeout(()=>{e.classList.remove("show");setTimeout(()=>{toastBusy=false;pumpToast()},170)},900);
  }
  /* board=true only for the end screen: the global top 10 from leaderboard.js, which redraws itself in place when the live board arrives. The start and pause screens share show() and stay as they were. */
  function show(title,body,button="PLAY",board=false){const top=board&&window.Arcade&&Arcade.boardHTML?`<p class="small" style="margin-top:.7rem;letter-spacing:.08em">TOP 10</p>${Arcade.boardHTML(Arcade.slug)}`:"";overlay.innerHTML=`<h2>${title}</h2><p>${body}</p><p class="small">High score: ${high.toLocaleString()}</p>${top}<button>${button}</button>`;overlay.classList.remove("hidden")}
  function start(){audioStart();score=0;lives=3;level=1;beamBonusAwarded=false;musicClock=0;musicStep=0;running=true;paused=false;game.reset();overlay.classList.add("hidden");hud();last=performance.now()}
  function end(win=false){running=false;hud();const finish=()=>show(win?"SABOTAGE STOPPED":"SIGNAL LOST",`${win?"Ghost Circuit is back online.":"Plumbmonkey wins this round."} Score: ${score.toLocaleString()}`,"PLAY AGAIN",true);if(window.Arcade&&Arcade.submitFlow)Arcade.submitFlow(score,finish);else finish()}
  function lose(){if(!running)return;lives--;beep(90,.3,"sawtooth",.07);if(lives<=0)end(false);else{game.respawn();hud()}}
  function next(){level++;addScore(500*level);beep(780,.15);game.next();hud();if(id!=="beamMeUpLive"&&id!=="graveyardShift")toast(`LEVEL ${level}`)}
  function togglePause(){if(!running)return;paused=!paused;if(paused)show("PAUSED","The sabotage is holding. Press P, Esc, or Resume.","RESUME");else overlay.classList.add("hidden")}
  overlay.addEventListener("click",()=>paused?(paused=false,overlay.classList.add("hidden")):!running&&start());
  /* -PAD..W+PAD, not 0..W: the view is wider than the world (see VIEW_W), and a
     backdrop drawn only over the world would leave the side margins black —
     which is the letterboxing this was meant to remove. Star count scales with
     the extra area so density stays what it was. */
  function bg(storm=false){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,storm?"#281238":"#160928");g.addColorStop(1,"#05030b");ctx.fillStyle=g;ctx.fillRect(-PAD,0,VIEW_W,H);ctx.fillStyle="#ffffff";for(let i=0;i<Math.round(55*VIEW_W/W);i++){const x=(i*173+level*19)%VIEW_W-PAD,y=(i*i*31)%400;ctx.globalAlpha=.2+(i%5)/8;ctx.fillRect(x,y,2,2)}ctx.globalAlpha=1;const mg=ctx.createRadialGradient(130,120,10,130,120,85);mg.addColorStop(0,"#fffde7");mg.addColorStop(.55,"#e9d5ff");mg.addColorStop(1,"#e9d5ff00");ctx.fillStyle=mg;ctx.beginPath();ctx.arc(130,120,85,0,7);ctx.fill()}
  function text(t,x,y,size=20,color="#fff",align="center"){ctx.fillStyle=color;ctx.font=`800 ${size}px Segoe UI`;ctx.textAlign=align;ctx.fillText(t,x,y)}
  function glow(color=accent,blur=16){ctx.shadowColor=color;ctx.shadowBlur=blur}
  function noGlow(){ctx.shadowBlur=0}
  /* Static sprites are rasterised once per (sprite, scale) pair and then blitted,
     so the per-frame cost is a single drawImage instead of a stroke/fill chain
     plus a shadow pass. Baking at the FINAL scale matters: shadowBlur is measured
     in device pixels and is not affected by the transform, so caching one sprite
     and scaling it at draw time would resize the glow along with the shape. Call
     sites use a fixed set of scales, so this settles at ~11 cached canvases.
     The blit is left on fractional coordinates - letting drawImage filter tracks
     the old sub-pixel placement about twice as closely as rounding does. */
  const spriteCache={};
  function cachedSprite(key,hx,hy,blur,color,s,fn){
    const id=key+"@"+s;
    let spr=spriteCache[id];
    if(!spr){
      const hw=Math.ceil(hx*s+blur+2),hh=Math.ceil(hy*s+blur+2);
      spr=document.createElement("canvas");spr.width=hw*2;spr.height=hh*2;
      const c=spr.getContext("2d");
      c.translate(hw,hh);c.scale(s,s);
      c.shadowColor=color;c.shadowBlur=blur;
      fn(c);
      spr.ox=hw;spr.oy=hh;
      spriteCache[id]=spr;
    }
    return spr;
  }
  function blitSprite(spr,x,y){ctx.drawImage(spr,x-spr.ox,y-spr.oy)}
  function burst(x,y,color=accent,n=10){if(reduced)n=Math.ceil(n/3);for(let i=0;i<n;i++)particles.push({x,y,vx:rnd(-130,130),vy:rnd(-150,40),life:rnd(.3,.8),color,size:rnd(2,6)})}
  function fx(dt=0){particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt;p.life-=dt});particles=particles.filter(p=>p.life>0);particles.forEach(p=>{ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size)});ctx.globalAlpha=1}
  function fog(offset=0){for(let i=0;i<5;i++){const x=((performance.now()*.012*(i+1)+i*260+offset)%1400)-220,y=500+i*38;const g=ctx.createRadialGradient(x,y,5,x,y,170);g.addColorStop(0,"#c4b5fd22");g.addColorStop(1,"#c4b5fd00");ctx.fillStyle=g;ctx.fillRect(x-180,y-90,360,180)}}
  function mansionBackdrop(alpha=.7){if(mansion.complete&&mansion.naturalWidth){ctx.globalAlpha=alpha;ctx.drawImage(mansion,0,0,mansion.naturalWidth,mansion.naturalHeight,-PAD,0,VIEW_W,H);ctx.globalAlpha=1}}
  function hoodedCloak(t,hop,dir,flare,amp){const hemY=28+hop*6,seg=8,bulge=amp*.6,wob=u=>Math.sin(t/95+u*7.4)*amp*(.35+.65*Math.sin(u*Math.PI));ctx.beginPath();ctx.arc(0,-23,16,Math.PI,0);ctx.quadraticCurveTo(21+bulge,1,24-dir*flare,hemY+wob(1));for(let i=seg;i>=0;i--){const u=i/seg;ctx.lineTo(-24+48*u-dir*flare,hemY+wob(u))}ctx.quadraticCurveTo(-21-bulge,1,-16,-23);ctx.closePath()}
  function drawHooded(x,y,s=1,bright=false,hop=0,dir=0,land=0){const t=performance.now();y+=Math.sin(t/260)*3*(1-hop);const sx=1-hop*.14+land*.26,sy=1+hop*.26-land*.30,trail=dir||1,flare=hop*11,amp=2.2+hop*7.5+Math.abs(dir)*1.6;ctx.save();ctx.translate(x,y);ctx.rotate(dir*hop*.26);ctx.scale(s*sx,s*sy);glow(bright?"#d9ff63":"#67e8f9",12);ctx.fillStyle="#a5f3fc";for(let i=3;i>0;i--){ctx.globalAlpha=.055*i*(1+hop*1.7);ctx.save();ctx.translate(-trail*i*6,i*.6);hoodedCloak(t-i*52,hop,dir,flare*(1-i*.1),amp*(1+i*.24));ctx.fill();ctx.restore()}ctx.globalAlpha=1;ctx.fillStyle=bright?"#d9ff63":"#a5f3fc";hoodedCloak(t,hop,dir,flare,amp);ctx.fill();ctx.fillStyle="#163047";ctx.beginPath();ctx.arc(0,-18,12,0,7);ctx.fill();ctx.fillStyle="#d9ff63";ctx.fillRect(-8,-20,5,3);ctx.fillRect(3,-20,5,3);noGlow();ctx.restore()}
  /* ==================================================================
     AMP RAMPAGE — THE HERO, REDRAWN.

     What was here before: a 20x28 rectangle, a circle for a helmet and
     four round-capped strokes for limbs, all posed from one `step` sine
     that ran on WALL-CLOCK time rather than on how far the hero had
     actually moved — so he skated, and at 0.8 scale he was the smallest
     readable thing on a screen full of glowing stage gear.

     This is the same two characters drawn the way the rest of the manor's
     cast is drawn (wave3/sprite-kit.js): layered shapes, an ink outline, a
     darker shading pass, lit eyes. One rig, two skins. The pose phase is
     advanced by the game from DISTANCE TRAVELLED, so the feet keep up with
     the ground; there is squash on the landing and stretch on the jump, a
     real alternating reach on the ladder, the neon pick held and swung in
     smash mode, and the cage key on the belt once it has been found.

     Only Amp Rampage draws these, which is why they can change shape
     freely — the shared monsters live in sprite-kit.js and are untouched. */
  const RIG_INK="#120b1e";
  const HERO_SKINS={
    spaceman:{suit:"#e6ecf7",trim:"#7c3aed",limb:"#6d28d9",face:"#cfe6ff",visor:"#16305c",lamp:"#67e8f9",boot:"#3b2b52",pack:"#94a3b8"},
    monkey:{suit:"#7b4a86",trim:"#f5d0fe",limb:"#5b315f",face:"#c084fc",visor:"#1b1030",lamp:"#f0abfc",boot:"#2b1440",pack:"#6b3e75"}
  };
  function rigShade(hex,amt){const n=parseInt(hex.slice(1),16),tgt=amt<0?0:255,k=Math.abs(amt),ch=v=>Math.round(v+(tgt-v)*k);return"#"+((1<<24)+(ch((n>>16)&255)<<16)+(ch((n>>8)&255)<<8)+ch(n&255)).toString(16).slice(1)}
  function inkShape(pts,fill,w=2.4){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(w){ctx.strokeStyle=RIG_INK;ctx.lineWidth=w;ctx.lineJoin="round";ctx.stroke()}}
  function inkOval(x,y,rx,ry,fill,w=2.4){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,7);if(fill){ctx.fillStyle=fill;ctx.fill()}if(w){ctx.strokeStyle=RIG_INK;ctx.lineWidth=w;ctx.stroke()}}
  function inkLimb(pts,color,w){const run=()=>{ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke()};ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle=RIG_INK;ctx.lineWidth=w+3;run();ctx.strokeStyle=color;ctx.lineWidth=w;run()}

  /* h = {x, y (FEET, not centre), skin, face:-1|1, phase, state, land, power,
          swing, key, groundY} */
  function drawRigHero(h){
    const S=HERO_SKINS[h.skin]||HERO_SKINS.spaceman, t=performance.now();
    const run=h.state==="run",climb=h.state==="climb",jump=h.state==="jump",fall=h.state==="fall",air=jump||fall;
    const sw=Math.sin(h.phase);

    /* Contact shadow, in world space — before the figure is flipped or
       squashed, and faded by height so a jump visibly leaves the deck. */
    if(h.groundY!=null&&!climb){
      const gap=clamp((h.groundY-h.y)/110,0,1);
      ctx.save();ctx.globalAlpha=.45*(1-gap);ctx.fillStyle="#04020a";
      ctx.beginPath();ctx.ellipse(h.x,h.groundY-1,16-gap*7,4.6-gap*2.3,0,0,7);ctx.fill();ctx.restore();
    }

    ctx.save();
    ctx.translate(h.x,h.y);
    const sx=1+h.land*.26-(jump?.08:0), sy=1-h.land*.30+(jump?.14:0);
    ctx.scale(h.face*sx,sy);
    ctx.translate(0,-(run?Math.abs(sw)*2.4:climb?0:air?0:Math.sin(t/540)*1.3));

    // smash-mode aura
    if(h.power>0&&!reduced){
      const r=24+Math.sin(t/95)*4;
      ctx.save();ctx.globalAlpha=.30;glow("#d9ff63",20);
      ctx.strokeStyle="#d9ff63";ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(0,-31,r,r*1.2,0,0,7);ctx.stroke();
      noGlow();ctx.restore();
    }

    /* Proportions matter more than detail at this size: legs are 40% of the
       figure, torso 35%, head 25%. The first pass had a 24px torso over 17px
       legs and read as a fridge with a helmet on it. */
    const leg=(hx,swing,lift)=>[[hx,-20],[hx+swing*.55,-11-Math.abs(swing)*.06],[hx+swing,-lift]];
    const arm=(shx,swing,rise)=>[[shx,-40],[shx+swing*.5,-33+rise*.45],[shx+swing,-26+rise]];
    let L;
    if(climb){const a=sw;L={legA:leg(-5.5,a*4,Math.max(0,a*11)),legB:leg(5.5,-a*4,Math.max(0,-a*11)),armA:arm(-9.5,-2,-21-a*10),armB:arm(9.5,2,-21+a*10)}}
    else if(jump)L={legA:leg(-5.5,8,11),legB:leg(5.5,-5,5),armA:arm(-9.5,-7,-22),armB:arm(9.5,7,-22)};
    else if(fall)L={legA:leg(-5.5,13,4),legB:leg(5.5,-11,0),armA:arm(-9.5,-13,-12),armB:arm(9.5,13,-12)};
    else if(run)L={legA:leg(-5.5,sw*16,Math.max(0,sw*8)),legB:leg(5.5,-sw*16,Math.max(0,-sw*8)),armA:arm(-9.5,-sw*13,3),armB:arm(9.5,sw*13,3)};
    else{const i=Math.sin(t/540)*2;L={legA:leg(-5.5,2,0),legB:leg(5.5,-2,0),armA:arm(-9.5,-3+i,5),armB:arm(9.5,3-i,5)}}

    // BACK limbs, then body, then FRONT limbs — the depth order is what makes
    // the walk read as a walk rather than as four sticks on one plane.
    if(h.skin==="monkey"){
      const wag=Math.sin(h.phase*.5+t/300)*5;
      inkLimb([[-9,-24],[-19,-20+wag*.4],[-22,-31+wag]],rigShade(S.limb,-.2),4.5);
    }
    inkLimb(L.legA,rigShade(S.limb,-.34),6);
    inkLimb(L.armA,rigShade(S.limb,-.34),5);

    // pack / shoulder rig, behind the torso on the back side
    inkShape([[-13,-39],[-8,-40],[-7,-25],[-12,-24]],rigShade(S.pack,-.2),2);

    // torso: narrow, with a lit front panel and a shaded back edge so it has
    // some form rather than reading as one flat slab
    const TORSO=[[-9,-43],[9,-43],[11,-27],[8,-19],[-8,-19],[-11,-27]];
    inkShape(TORSO,S.suit);
    ctx.save();ctx.beginPath();ctx.rect(-12,-46,5.5,32);ctx.clip();
    inkShape(TORSO,rigShade(S.suit,-.30),0);
    ctx.restore();
    ctx.save();ctx.beginPath();ctx.rect(0,-46,7,32);ctx.clip();
    inkShape(TORSO,rigShade(S.suit,.35),0);
    ctx.restore();
    ctx.fillStyle=S.trim;ctx.fillRect(-8,-37,16,3.5);
    ctx.fillStyle=rigShade(S.trim,-.3);ctx.fillRect(-8,-24,16,3);
    inkShape([[-11,-43],[-5,-44],[-4,-37],[-11,-36]],rigShade(S.suit,-.14),1.8);
    inkShape([[11,-43],[5,-44],[4,-37],[11,-36]],rigShade(S.suit,.12),1.8);
    glow(S.lamp,9);ctx.fillStyle=S.lamp;
    ctx.beginPath();ctx.arc(3.5,-31,2.4,0,7);ctx.fill();noGlow();

    inkLimb(L.legB,S.limb,6);
    [L.legA,L.legB].forEach((g,i)=>{const f=g[2];inkShape([[f[0]-5.5,f[1]-3],[f[0]+6.5,f[1]-3],[f[0]+6.5,f[1]+2],[f[0]-5.5,f[1]+2]],i?S.boot:rigShade(S.boot,-.3),2)});
    inkLimb(L.armB,S.limb,5);

    // head
    const hy=-53;
    if(h.skin==="monkey"){
      inkOval(-11,hy-1,3.6,4.2,rigShade(S.face,-.18),2);   // ears, for silhouette
      inkOval(11,hy-1,3.6,4.2,rigShade(S.face,-.18),2);
      inkOval(0,hy,10.5,10,S.face);
      inkOval(2,hy+3.5,7,5,rigShade(S.face,.3),1.6);        // muzzle
      ctx.fillStyle=RIG_INK;ctx.beginPath();ctx.ellipse(1,hy+2.4,1.6,1.2,0,0,7);ctx.ellipse(4.6,hy+2.4,1.6,1.2,0,0,7);ctx.fill();
      if(!climb){
        ctx.fillStyle=RIG_INK;ctx.fillRect(-6,hy-2,4,4.2);ctx.fillRect(1.6,hy-2,4,4.2);
        glow(S.lamp,7);ctx.fillStyle=S.lamp;ctx.fillRect(-5,hy-1.2,1.8,1.8);ctx.fillRect(2.6,hy-1.2,1.8,1.8);noGlow();
      }else{ctx.fillStyle=rigShade(S.face,-.34);ctx.fillRect(-7,hy-2,14,4.6)}
      inkShape([[-11.5,hy-2],[11.5,hy-2],[10,hy-11],[-9,hy-12]],S.visor);
      ctx.fillStyle="#d9ff63";ctx.fillRect(-12,hy-4.2,24,2.8);
    }else{
      ctx.fillStyle="#25203a";ctx.fillRect(-6,-45,12,4.5);     // neck ring
      inkOval(0,hy,11.5,11,"#eef3fa");
      inkOval(-4,hy-4,4.5,3,"#ffffff",0);
      if(climb){inkOval(1,hy+1,7.5,7,rigShade("#eef3fa",-.3),1.8)}
      else{
        inkOval(1.5,hy+.5,8.2,7,S.visor,2);
        glow(S.lamp,9);ctx.fillStyle=S.lamp;
        ctx.fillRect(-1,hy-1.5,3.2,3);ctx.fillRect(4.4,hy-1.5,3.2,3);noGlow();
        ctx.globalAlpha=.5;ctx.fillStyle="#ffffff";
        ctx.beginPath();ctx.ellipse(-3,hy-3.2,2.6,1.5,-.5,0,7);ctx.fill();ctx.globalAlpha=1;
      }
      glow(S.lamp,10);ctx.strokeStyle=S.lamp;ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-8,hy-8);ctx.lineTo(-12,hy-16);ctx.stroke();
      ctx.fillStyle=S.lamp;ctx.beginPath();ctx.arc(-12,hy-17,2.4,0,7);ctx.fill();noGlow();
    }

    // the neon pick, held and swung
    if(h.power>0){
      const hand=L.armB[2];
      ctx.save();ctx.translate(hand[0],hand[1]);ctx.rotate(-.55+(h.swing||0)*2.5);
      glow("#d9ff63",18);ctx.fillStyle="#d9ff63";
      ctx.beginPath();ctx.moveTo(-1.5,-5);ctx.quadraticCurveTo(10,-4,13,0);ctx.quadraticCurveTo(10,4,-1.5,5);ctx.quadraticCurveTo(-4.5,0,-1.5,-5);ctx.fill();
      ctx.strokeStyle=RIG_INK;ctx.lineWidth=1.6;ctx.stroke();noGlow();ctx.restore();
    }
    // the cage key, on the belt
    if(h.key){
      ctx.save();ctx.translate(-9,-22);ctx.rotate(.38);
      glow("#fbbf24",10);ctx.fillStyle="#fbbf24";
      ctx.beginPath();ctx.arc(0,0,3.4,0,7);ctx.fill();
      ctx.fillRect(-1.2,2.4,2.4,9.5);ctx.fillRect(-1.2,8.4,5,1.9);ctx.fillRect(-1.2,11.4,3.8,1.9);
      noGlow();ctx.restore();
    }
    ctx.restore();
  }
  function drawWitch(x,y,s=1){
    blitSprite(cachedSprite("witch",30,26,16,"#c084fc",s,c=>{
      c.strokeStyle="#fbbf24";c.lineWidth=4;c.beginPath();c.moveTo(-27,15);c.lineTo(28,7);c.stroke();
      c.fillStyle="#8b5cf6";c.beginPath();c.moveTo(-4,-26);c.lineTo(15,-5);c.lineTo(-19,-5);c.fill();
      c.fillStyle="#2e1065";c.beginPath();c.arc(-2,3,11,0,7);c.fill();
      c.fillStyle="#d9ff63";c.fillRect(-7,0,4,3);
    }),x,y);
  }
  function drawBat(x,y,s=1){
    blitSprite(cachedSprite("bat",31,21,10,"#fb7185",s,c=>{
      c.fillStyle="#6b102d";c.beginPath();c.moveTo(0,3);c.quadraticCurveTo(-20,-16,-31,0);c.quadraticCurveTo(-20,-3,-12,14);c.quadraticCurveTo(0,21,12,14);c.quadraticCurveTo(20,-3,31,0);c.quadraticCurveTo(20,-16,0,3);c.fill();
      c.fillStyle="#fb7185";c.fillRect(-7,2,3,3);c.fillRect(4,2,3,3);
    }),x,y);
  }
  function drawGhost(x,y,s=1){
    blitSprite(cachedSprite("ghost",18,25,16,"#a5f3fc",s,c=>{
      c.globalAlpha=.72;c.fillStyle="#cffafe";c.beginPath();c.arc(0,-8,17,Math.PI,0);c.lineTo(18,23);c.lineTo(8,16);c.lineTo(0,24);c.lineTo(-9,16);c.lineTo(-18,23);c.closePath();c.fill();
      c.globalAlpha=1;c.fillStyle="#0e3b55";c.beginPath();c.arc(-6,-8,3,0,7);c.arc(6,-8,3,0,7);c.fill();
    }),x,y);
  }
  /* The rig boss, from the shared cast in wave3/sprite-kit.js.

     Amp Rampage carried its own Frankenstein, Vampire and Ghost — a THIRD set,
     after House of the Hooded's and Mess Hall's. They are drawn large here
     (roughly 80px), which is the size the kit's full figures are authored for,
     so this is the one place a full figure fits without shrinking.

     The throw telegraph is preserved: `throwPhase` drives the kit's wind-up arm
     (see throwArm in sprite-kit.js). Losing it would remove the player's only
     warning that stage gear is about to come down the rig, so if the kit is
     ever unavailable this falls back to wave3's original art rather than
     dropping the tell. */
  const BOSS_REACH=64;
  function drawRigBoss(boss,bossY){
    const phase=boss.throwing?boss.throwPhase:-1;
    const name=boss.type==="frank"?"frank":boss.type==="vamp"?"vampire":"ghost";
    /* The boss leans into a swipe rather than standing square to it: the kit
       draws the character, the lean and the arc are ours. */
    const sw=boss.swipe, lean=!sw||sw.state==="idle"?0:sw.state==="wind"?-.13:.22;
    ctx.save();
    if(lean){ctx.translate(boss.x,bossY+18);ctx.rotate(lean*boss.dir);ctx.translate(-boss.x,-(bossY+18))}
    if(!(window.SpriteKit&&SpriteKit.draw(ctx,name,boss.x,bossY+18,{t:performance.now()/1000,scale:1.15,throwPhase:phase,stomp:Math.abs(Math.sin(performance.now()/140))}))){
      if(boss.type==="frank")drawFrankenstein(boss.x,bossY,1.15,phase);
      else if(boss.type==="vamp")drawVampire(boss.x,bossY,1.05,phase);
      else drawGhost(boss.x,bossY,1.2);
    }
    ctx.restore();
    drawBossSwipe(boss,bossY);
  }
  /* THE SWIPE. The boss used to have no collision at all — you walked straight
     through him on the top floor, which is where the cage is, so the character
     the whole game is about was the one thing on the rig that could not touch
     you. He now takes a swing when you come up onto his floor: half a second of
     wind-up with a dashed arc showing exactly what it will cover, then a quick
     strike. Jumping clears it — the read is the point, not the damage. */
  function drawBossSwipe(boss,bossY){
    const s=boss.swipe;
    if(!s||s.state==="idle")return;
    const wind=s.state==="wind", k=wind?1-s.t/.5:1-s.t/.26;
    ctx.save();
    ctx.translate(boss.x,bossY-2);
    ctx.save();ctx.scale(boss.dir,1);
    if(wind){
      ctx.globalAlpha=.22+.42*Math.abs(Math.sin(performance.now()/70));
      ctx.strokeStyle="#fb7185";ctx.lineWidth=3;ctx.setLineDash([9,7]);
      ctx.beginPath();ctx.arc(0,0,BOSS_REACH,-1.05,1.05);ctx.stroke();
      ctx.setLineDash([]);
    }else{
      glow("#fff1f2",20);
      ctx.strokeStyle="#fff1f2";ctx.lineWidth=10-k*7;ctx.globalAlpha=1-k*.75;
      ctx.beginPath();ctx.arc(0,0,BOSS_REACH,-1.15+k*1.2,1.15);ctx.stroke();
      noGlow();
    }
    ctx.globalAlpha=1;ctx.restore();
    if(wind){glow("#fb7185",14);text("!",0,-58,26,"#fb7185");noGlow()}
    ctx.restore();
  }
  function drawFrankenstein(x,y,s=1,throwPhase=-1){const tantrum=Math.sin(performance.now()/90),stomp=Math.abs(Math.sin(performance.now()/140))*5,throwing=throwPhase>=0,wind=throwing?Math.sin(Math.min(1,throwPhase)*Math.PI):0;ctx.save();ctx.translate(x,y-stomp);ctx.scale(s,s);glow("#4ade80",8);ctx.fillStyle="#65a30d";ctx.fillRect(-16,-21,32,38);ctx.fillStyle="#172016";ctx.fillRect(-18,-27,36,10);ctx.fillStyle="#d9ff63";ctx.fillRect(-10,-10,5,3);ctx.fillRect(5,-10,5,3);ctx.strokeStyle="#65a30d";ctx.lineWidth=9;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-15,-6);ctx.lineTo(throwing?-28-22*throwPhase:-29,throwing?-20-28*wind:-18-tantrum*12);ctx.moveTo(15,-6);ctx.lineTo(throwing?4-30*throwPhase:29,throwing?-28-22*wind:-18+tantrum*12);ctx.stroke();ctx.fillStyle="#94a3b8";ctx.fillRect(-22,-8,6,6);ctx.fillRect(16,-8,6,6);ctx.fillStyle="#292524";ctx.fillRect(-15,17,11,17+stomp);ctx.fillRect(4,17,11,22-stomp);noGlow();ctx.restore()}
  function drawAlien(x,y,s=1){
    blitSprite(cachedSprite("alien",18,25,12,"#4ade80",s,c=>{
      c.fillStyle="#86efac";c.beginPath();c.ellipse(0,0,18,25,0,0,7);c.fill();
      c.fillStyle="#07140b";c.beginPath();c.ellipse(-7,-4,5,9,-.3,0,7);c.ellipse(7,-4,5,9,.3,0,7);c.fill();
    }),x,y);
  }
  function drawTentacle(x,y,s=1,phase=0){const clock=performance.now()/520,pulse=1+Math.sin(clock+phase)*.045;ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.strokeStyle="#86efac";ctx.lineWidth=4;ctx.lineCap="round";for(let i=0;i<5;i++){const bx=(i-2)*7,wig=Math.sin(clock+phase+i*.72)*5;ctx.beginPath();ctx.moveTo(bx,9);ctx.bezierCurveTo(bx+wig,17,bx-wig*.7,25,bx+wig*.45,33);ctx.stroke()}glow("#4ade80",12);ctx.fillStyle="#65a30d";ctx.beginPath();ctx.ellipse(0,0,18*pulse,15/pulse,0,0,7);ctx.fill();ctx.fillStyle="#d9ff63";ctx.beginPath();ctx.arc(-6,-3,3,0,7);ctx.arc(6,-3,3,0,7);ctx.fill();noGlow();ctx.restore()}
  function drawShip(x,y,s=1){
    blitSprite(cachedSprite("ship",28,22,15,"#67e8f9",s,c=>{
      c.fillStyle="#cbd5e1";c.beginPath();c.moveTo(0,-20);c.lineTo(28,16);c.lineTo(9,11);c.lineTo(0,22);c.lineTo(-9,11);c.lineTo(-28,16);c.closePath();c.fill();
      c.fillStyle="#22d3ee";c.beginPath();c.ellipse(0,-4,7,11,0,0,7);c.fill();
      c.fillStyle="#f0abfc";c.fillRect(-20,15,8,5);c.fillRect(12,15,8,5);
    }),x,y);
  }
  function drawVampire(x,y,s=1,throwPhase=-1){const cape=Math.sin(performance.now()/230)*4,wind=throwPhase<0?0:Math.sin(throwPhase*Math.PI);ctx.save();ctx.translate(x,y);ctx.scale(s,s);glow("#fb7185",12);ctx.fillStyle="#2e102f";ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(-29-cape,28);ctx.lineTo(0,17);ctx.lineTo(29+cape,28);ctx.closePath();ctx.fill();ctx.fillStyle="#d6c7da";ctx.beginPath();ctx.arc(0,-22,12,0,7);ctx.fill();ctx.fillStyle="#111827";ctx.beginPath();ctx.moveTo(-14,-30);ctx.lineTo(0,-43);ctx.lineTo(14,-30);ctx.fill();ctx.fillStyle="#ef4444";ctx.fillRect(-7,-25,4,3);ctx.fillRect(3,-25,4,3);ctx.fillStyle="#fff";ctx.beginPath();ctx.moveTo(-5,-15);ctx.lineTo(-1,-8);ctx.lineTo(1,-15);ctx.moveTo(5,-15);ctx.lineTo(1,-8);ctx.lineTo(-1,-15);ctx.fill();ctx.strokeStyle="#d6c7da";ctx.lineWidth=6;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-9,-6);ctx.lineTo(throwPhase<0?-20:-20-25*throwPhase,throwPhase<0?7:-16-22*wind);ctx.moveTo(9,-6);ctx.lineTo(throwPhase<0?20:5-22*throwPhase,throwPhase<0?7:-22-18*wind);ctx.stroke();noGlow();ctx.restore()}
  /* STAGE GEAR. The type art is unchanged — what is new is that the HAZARD
     reads before the object does. Each piece now carries a chassis rim and an
     underglow in its hazard colour (amber = inert, violet = enchanted, cyan =
     electric) instead of the hazard living only in a drop shadow, which was
     indistinguishable from the glow every other object on the rig also has.

     Electric amps additionally TELEGRAPH. They used to kill from 40px away on
     contact-less proximity with no warning of any kind. Now they idle, crackle
     for a quarter second, then go hot — and only while hot do they reach, with
     a ring drawn at exactly the radius that reaches. */
  const ARC_REACH=44;
  function hazardColor(a){return a.electric?"#67e8f9":a.enchanted?"#c084fc":"#fb923c"}
  function drawStageItem(a){const t=performance.now()/90,col=hazardColor(a);ctx.save();if(!reduced){const ug=ctx.createRadialGradient(a.x+a.w/2,a.y+a.h+2,1,a.x+a.w/2,a.y+a.h+2,36);ug.addColorStop(0,col+"55");ug.addColorStop(1,col+"00");ctx.fillStyle=ug;ctx.fillRect(a.x-18,a.y+a.h-20,a.w+36,44)}ctx.translate(a.x+a.w/2,a.y+a.h/2);ctx.rotate(a.rot||0);ctx.translate(-a.w/2,-a.h/2);glow(col,a.electric&&a.hot?26:a.enchanted?17:9);if(a.type==="guitar"||a.type==="bass"){ctx.save();ctx.rotate(-.35);ctx.fillStyle=a.type==="bass"?"#7c3aed":"#dc2626";ctx.beginPath();ctx.ellipse(11,19,11,9,.25,0,7);ctx.ellipse(25,18,9,11,-.25,0,7);ctx.fill();ctx.fillStyle="#d6a76c";ctx.fillRect(25,14,28,6);ctx.fillStyle="#fbbf24";ctx.fillRect(51,11,7,12);ctx.strokeStyle="#fff7";ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(18,15+i*3);ctx.lineTo(55,14+i*3);ctx.stroke()}ctx.restore()}else if(a.type==="drum"){ctx.fillStyle="#9f1239";ctx.fillRect(5,8,32,18);ctx.fillStyle="#fda4af";ctx.beginPath();ctx.ellipse(21,8,16,6,0,0,7);ctx.fill();ctx.strokeStyle="#fbbf24";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(8,2);ctx.lineTo(31,-7);ctx.moveTo(29,2);ctx.lineTo(13,-8);ctx.stroke()}else if(a.type==="mic"){ctx.strokeStyle="#94a3b8";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(20,8);ctx.lineTo(20,28);ctx.moveTo(8,28);ctx.lineTo(32,28);ctx.stroke();ctx.fillStyle="#e2e8f0";ctx.beginPath();ctx.arc(20,7,7,0,7);ctx.fill();ctx.strokeStyle="#334155";ctx.lineWidth=1;for(let i=-4;i<=4;i+=4){ctx.beginPath();ctx.moveTo(16,7+i/3);ctx.lineTo(24,7+i/3);ctx.stroke()}}else if(a.type==="light"){ctx.fillStyle="#312e81";ctx.fillRect(2,3,38,24);ctx.fillStyle="#67e8f9";ctx.beginPath();ctx.arc(21,14,10,0,7);ctx.fill();ctx.fillStyle="#67e8f933";ctx.beginPath();ctx.moveTo(21,14);ctx.lineTo(2,35);ctx.lineTo(40,35);ctx.fill()}else{ctx.fillStyle=a.type==="speaker"?"#18181b":"#431407";ctx.fillRect(0,0,a.w,a.h);ctx.strokeStyle="#fb923c";ctx.lineWidth=1;ctx.strokeRect(2,2,a.w-4,a.h-4);ctx.fillStyle=a.type==="speaker"?"#fb923c":"#fed7aa";if(a.type==="speaker"){ctx.beginPath();ctx.arc(13,15,8,0,7);ctx.arc(30,15,8,0,7);ctx.fill()}else{ctx.fillRect(7,7,28,14);ctx.fillStyle="#111";for(let i=0;i<4;i++)ctx.fillRect(9+i*7,4,3,3)}}noGlow();ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.globalAlpha=.92;ctx.strokeRect(-3.5,-3.5,a.w+7,a.h+7);ctx.globalAlpha=1;if(a.electric){const amt=a.hot?1:a.warn?.45:0;if(amt>0){ctx.strokeStyle=a.hot?"#e0faff":"#67e8f9";ctx.lineWidth=a.hot?3:1.7;ctx.globalAlpha=amt;for(let i=0;i<(a.hot?3:2);i++){ctx.beginPath();ctx.moveTo(-6,7+i*9);ctx.lineTo(4+Math.sin(t+i)*8,3+i*9);ctx.lineTo(a.w-2+Math.cos(t+i)*7,9+i*5);ctx.lineTo(a.w+8,4+i*9);ctx.stroke()}ctx.globalAlpha=1}ctx.fillStyle=a.hot?"#e0faff":"#1c4f63";ctx.beginPath();ctx.arc(-4,a.h/2,3,0,7);ctx.arc(a.w+4,a.h/2,3,0,7);ctx.fill();if(a.hot&&!reduced){glow("#67e8f9",18);ctx.strokeStyle="#67e8f9";ctx.lineWidth=2;ctx.globalAlpha=.45;ctx.beginPath();ctx.ellipse(a.w/2,a.h/2,ARC_REACH,ARC_REACH*.8,0,0,7);ctx.stroke();ctx.globalAlpha=1;noGlow()}}if(a.vertical){glow("#67e8f9",10);ctx.fillStyle="#67e8f9";ctx.beginPath();ctx.moveTo(a.w/2-9,-16);ctx.lineTo(a.w/2+9,-16);ctx.lineTo(a.w/2,-5);ctx.closePath();ctx.fill()}noGlow();ctx.restore()}

  /* THE RIG ITSELF. Each floor used to be a single 12px stroke with a row of
     empty rectangles on it — "scaffolding lines" rather than a stage rig. It is
     now a real truss: top chord you walk on, bottom chord, X bracing between
     them, verticals on the bay spacing and a cable run sagging underneath. */
  function drawRigTruss(i,floors,dirs){
    const x0=35,y0=floors[i],x1=925,y1=floors[i]-18*dirs[i];
    const ang=Math.atan2(y1-y0,x1-x0),len=Math.hypot(x1-x0,y1-y0);
    const hot=i%2,deck=hot?"#6d28d9":"#3f4a5e",lip=hot?"#c084fc":"#9db0c9";
    ctx.save();ctx.translate(x0,y0);ctx.rotate(ang);
    ctx.strokeStyle="#2a2038";ctx.lineWidth=3;ctx.beginPath();
    for(let x=0;x<len;x+=38){const e=Math.min(len,x+38);ctx.moveTo(x,2);ctx.lineTo(e,19);ctx.moveTo(e,2);ctx.lineTo(x,19)}
    ctx.stroke();
    ctx.fillStyle="#241c33";ctx.fillRect(0,18,len,5);
    ctx.strokeStyle="#392c52";ctx.lineWidth=3;ctx.beginPath();
    for(let x=0;x<=len;x+=76){ctx.moveTo(x,0);ctx.lineTo(x,20)}
    ctx.stroke();
    ctx.strokeStyle="#120d1c";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,23);
    for(let x=0;x<len;x+=38)ctx.quadraticCurveTo(x+19,30,Math.min(len,x+38),23);
    ctx.stroke();
    ctx.fillStyle=deck;ctx.fillRect(0,-7,len,9);
    ctx.fillStyle=lip;ctx.fillRect(0,-7,len,2.5);
    ctx.fillStyle="rgba(0,0,0,.28)";
    for(let x=6;x<len;x+=46)ctx.fillRect(x,-4,30,4);
    ctx.restore();
  }
  /* Clamp lights on the underside of every truss, and the cone each throws down
     onto the floor below. The cones breathe on the same clock the music bed
     runs on, which is most of what makes the rig feel lit rather than drawn. */
  const LIGHT_XS=[170,470,770];
  function lightPos(i,k,floors,dirs){const x=LIGHT_XS[k]+(i%2?90:0);return{x,y:floors[i]-((x-35)/890)*18*dirs[i]+23}}
  function drawRigLights(floors,dirs){
    for(let i=1;i<floors.length;i++)for(let k=0;k<LIGHT_XS.length;k++){
      const{x,y}=lightPos(i,k,floors,dirs);
      ctx.fillStyle="#1b1526";ctx.fillRect(x-9,y-6,18,10);
      ctx.fillStyle="#0d0a14";ctx.fillRect(x-7,y+3,14,5);
      ctx.fillStyle=i%2?"#c084fc":"#67e8f9";ctx.fillRect(x-6,y+6,12,2.5);
    }
    if(reduced)return;
    const t=performance.now()/520;
    ctx.save();ctx.globalCompositeOperation="lighter";
    for(let i=1;i<floors.length;i++)for(let k=0;k<LIGHT_XS.length;k++){
      const{x,y}=lightPos(i,k,floors,dirs),drop=floors[i-1]-y;
      if(drop<=0)continue;
      const pulse=.07+.055*Math.max(0,Math.sin(t+i*1.25+k*.8))+beatAccent*.075+beat*.02;
      const c=i%2?"124,58,237":"34,211,238";
      const g=ctx.createLinearGradient(0,y,0,y+drop);
      g.addColorStop(0,"rgba("+c+","+pulse+")");g.addColorStop(1,"rgba("+c+",0)");
      ctx.fillStyle=g;ctx.beginPath();
      ctx.moveTo(x-9,y+6);ctx.lineTo(x+9,y+6);ctx.lineTo(x+64,y+drop);ctx.lineTo(x-64,y+drop);
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
  function drawRigLadder(l,floors,dirs){const sx=(l.x-35)/890*18,y1=floors[l.a]-sx*dirs[l.a],y2=floors[l.a+1]-sx*dirs[l.a+1],span=y1-y2,rungs=Math.max(3,Math.round(span/16)),rw=24;ctx.save();ctx.fillStyle="#0d0a12aa";ctx.fillRect(l.x-rw-6,y2-4,rw*2+12,span+8);for(let i=0;i<=rungs;i++){const y=y1-i*(span/rungs);ctx.fillStyle="#0f0b12";ctx.fillRect(l.x-rw+2,y-1,rw*2-4,5);ctx.fillStyle="#b9c6d8";ctx.fillRect(l.x-rw+2,y-3,rw*2-4,4);ctx.fillStyle="#e7edf6";ctx.fillRect(l.x-rw+2,y-3,rw*2-4,1)}glow("#a78bfa",8);for(const s of[-1,1]){ctx.fillStyle="#3b4757";ctx.fillRect(l.x+s*rw-3,y2-6,6,span+12);ctx.fillStyle="#7f8fa6";ctx.fillRect(l.x+s*rw-3,y2-6,2,span+12)}noGlow();ctx.fillStyle=l.a%2?"#6d28d9":"#3f4a5e";ctx.fillRect(l.x-rw-5,y1-4,rw*2+10,6);ctx.fillStyle=(l.a+1)%2?"#6d28d9":"#3f4a5e";ctx.fillRect(l.x-rw-5,y2-4,rw*2+10,6);ctx.restore()}

  /* THE BASEMENT. Two changes of substance. The brick course used to sit only a
     shade under the sprites (#211b28 / #29222f against a #09070d ground), so a
     full-screen texture competed with every foreground object for attention: it
     is down about a third in value now, with a vignette over it, and the play
     column reads first. And the dead band along the bottom — four faint arches
     nothing ever happened in front of — is now the lip of a stage, with
     footlights and monitor wedges, which is what the rig is standing on. */
  function drawBasement(){
    bg(true);
    ctx.fillStyle="#06040a";ctx.fillRect(-PAD,0,VIEW_W,H);
    /* one course further left than the view edge: alternate rows are offset +42
       below, so starting exactly at -PAD left a 42px unbricked strip down the
       left margin on every other row */
    for(let y=35;y<H;y+=38)for(let x=-20-PAD-86;x<W+PAD;x+=86){
      const bx=x+(y%76?42:0);
      ctx.fillStyle=(x/86+y/38)%2?"#18132a":"#1d1731";ctx.fillRect(bx,y,80,32);
      ctx.strokeStyle="#241f30";ctx.lineWidth=1;ctx.strokeRect(bx,y,80,32);
    }
    ctx.fillStyle="#0b0912";ctx.fillRect(-PAD,0,VIEW_W,58);
    ctx.strokeStyle="#3f4a5e";ctx.lineWidth=12;ctx.beginPath();
    ctx.moveTo(0,42);ctx.lineTo(210,42);ctx.quadraticCurveTo(265,42,265,96);ctx.lineTo(265,155);
    ctx.moveTo(960,28);ctx.lineTo(815,28);ctx.quadraticCurveTo(770,28,770,76);ctx.lineTo(770,145);
    ctx.stroke();
    ctx.fillStyle="#2c1e1b";ctx.fillRect(30,500,110,135);ctx.fillRect(830,475,100,160);
    ctx.strokeStyle="#a16207";ctx.lineWidth=3;ctx.strokeRect(42,515,86,100);ctx.strokeRect(842,490,76,125);
    drawStageFront();
    /* The sign used to sit at x=55..340, which is where the ladders at x=180 and
       x=260 run — it was drawn first, so a ladder was painted straight over it
       and the board read "VICTORIAN MANSION — ...NT". x=335..635 is clear of
       every ladder run (180, 260, 720, 760). */
    ctx.fillStyle="#140f1b";ctx.fillRect(335,150,300,32);
    ctx.strokeStyle="#7c3aed";ctx.lineWidth=2;ctx.strokeRect(335,150,300,32);
    text("VICTORIAN MANSION — BASEMENT",485,171,12,"#c4b5fd");
    const v=ctx.createRadialGradient(W/2,H*.46,H*.30,W/2,H*.46,H*.95);
    v.addColorStop(0,"rgba(0,0,0,0)");v.addColorStop(1,"rgba(0,0,0,.56)");
    ctx.fillStyle=v;ctx.fillRect(-PAD,0,VIEW_W,H);
  }
  function drawStageFront(){
    ctx.fillStyle="#120d1b";ctx.fillRect(-PAD,700,VIEW_W,H-700);
    ctx.fillStyle="#241a33";ctx.fillRect(-PAD,694,VIEW_W,7);
    ctx.fillStyle="#3b2b52";ctx.fillRect(-PAD,692,VIEW_W,2);
    [-70,240,550,860].forEach(x=>{
      ctx.fillStyle="#1b1426";ctx.beginPath();
      ctx.moveTo(x,694);ctx.lineTo(x+74,694);ctx.lineTo(x+61,664);ctx.lineTo(x+13,664);ctx.closePath();ctx.fill();
      ctx.strokeStyle="#3b2b52";ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle="#0d0a14";ctx.beginPath();ctx.ellipse(x+37,681,16,8,0,0,7);ctx.fill();
    });
    for(let x=-PAD+34;x<W+PAD;x+=78){
      const pulse=clamp(.30+.36*Math.sin(performance.now()/430+x/90)+beatAccent*.55,0,1.3);
      glow("#fbbf24",8+pulse*11);
      ctx.fillStyle=(x/78|0)%2?"#fbbf24":"#f0abfc";
      ctx.beginPath();ctx.arc(x,700,4.5,0,7);ctx.fill();noGlow();
    }
  }

  function drawFan(x,y,s=1,mood="calm"){
    const female=level%2===1,t=performance.now(),cheer=mood==="cheer",afraid=mood==="afraid";
    const bounce=Math.abs(Math.sin(t/(cheer?150:180)))*(cheer?9:6),step=Math.sin(t/110),shiver=afraid?Math.sin(t/38)*1.1:0;
    const hair=female?"#5b214e":"#3f2c24",shirt=female?"#ec4899":"#22d3ee",tone="#f1c7a5";
    ctx.save();ctx.translate(x+shiver,y-bounce);ctx.scale(s,s);
    inkLimb([[-5,15],[-7+step*3,22],[-8+step*4,28]],tone,4.5);
    inkLimb([[5,15],[7-step*3,22],[8-step*4,28]],tone,4.5);
    inkShape([[-10,-9],[10,-9],[11,15],[-11,15]],shirt,2);
    const ay=afraid?-20:cheer?-25+Math.sin(t/120)*5:7;
    inkLimb([[-7,-4],[-12,(ay-4)/2],[-14,ay]],tone,4);
    inkLimb([[7,-4],[12,(ay-4)/2],[14,ay]],tone,4);
    inkOval(0,-18,9.5,10,tone,2);
    inkShape([[-14,-17],[-13,-27],[0,-32],[13,-27],[14,-17],[9,-22],[-9,-22]],hair,2);
    ctx.fillStyle=RIG_INK;
    ctx.fillRect(-5.2,-20,2.6,afraid?3.6:2.6);ctx.fillRect(2.6,-20,2.6,afraid?3.6:2.6);
    if(afraid){ctx.beginPath();ctx.ellipse(0,-13,2.6,3.2,0,0,7);ctx.fill()}
    else{ctx.strokeStyle=RIG_INK;ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(0,-15.5,4,.28,Math.PI-.28);ctx.stroke()}
    ctx.restore();
  }
  /* The cage. While it is locked the bars rattle and the fan hammers on them;
     once the key and the boss are both dealt with, the door swings open and she
     steps to the front of it — so "unlocked" is something you can SEE from the
     other end of the rig, not just a line of toast you may have missed. */
  function drawFanCage(fan){
    const t=performance.now(),caged=!fan.safe;
    const rattle=caged&&!reduced?Math.sin(t/47)*1.2:0;
    ctx.save();
    ctx.strokeStyle="#4b3a68";ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(785,0);ctx.lineTo(785,36);ctx.stroke();
    ctx.fillStyle="#3a2414";ctx.fillRect(742,111,88,18);
    ctx.fillStyle="#6d28d9";ctx.fillRect(750,103,72,10);
    ctx.fillStyle="#c084fc";ctx.fillRect(750,103,72,2.5);
    ctx.translate(rattle,0);
    drawFan(fan.x,fan.y,.68,fan.safe?"cheer":"afraid");
    ctx.strokeStyle="#5b6b85";ctx.lineWidth=4;ctx.strokeRect(752,38,66,72);
    ctx.strokeStyle="#3d4a5e";ctx.lineWidth=3;
    for(let x=762;x<818;x+=14){ctx.beginPath();ctx.moveTo(x,39);ctx.lineTo(x,109);ctx.stroke()}
    const angle=-(1-(fan.door||0))*1.22-(fan.open||0)*1.18;
    ctx.save();ctx.translate(752,39);ctx.rotate(angle);
    glow(fan.safe?"#d9ff63":"#cbd5e1",fan.safe?14:8);
    ctx.strokeStyle=fan.safe?"#d9ff63":"#cbd5e1";ctx.lineWidth=4;ctx.strokeRect(0,0,66,70);
    for(let x=10;x<66;x+=12){ctx.beginPath();ctx.moveTo(x,1);ctx.lineTo(x,69);ctx.stroke()}
    ctx.fillStyle=fan.safe?"#d9ff63":"#fbbf24";ctx.fillRect(54,37,10,12);
    noGlow();ctx.restore();
    ctx.restore();
  }
  /* Once the cage is open, chevrons run along the top deck toward it. The only
     cue before was the words "FAN FREE!" over a cage 500px away. */
  function drawCageTrail(floors,dirs){
    const t=performance.now()/260;
    for(let i=0;i<6;i++){
      const x=540+i*40,y=floors[4]-((x-35)/890)*18*dirs[4]-30;
      ctx.globalAlpha=.16+.52*Math.max(0,Math.sin(t-i*.55));
      glow("#d9ff63",12);ctx.strokeStyle="#d9ff63";ctx.lineWidth=4;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x+11,y);ctx.lineTo(x,y+8);ctx.stroke();
      noGlow();ctx.globalAlpha=1;
    }
  }
  function drawHouseSilhouette(alpha=.55){if(houseCutout.complete&&houseCutout.naturalWidth){ctx.globalAlpha=alpha;ctx.drawImage(houseCutout,0,80,W,540);ctx.globalAlpha=1}const damage=canvas._battleDamage||0;if(damage>.15){ctx.save();const t=performance.now()/100;ctx.fillStyle=`rgba(35,2,8,${Math.min(.52,damage*.045)})`;ctx.fillRect(300,155,365,375);ctx.strokeStyle=`rgba(255,92,35,${Math.min(.95,.28+damage*.07)})`;ctx.lineWidth=2;for(let i=0;i<Math.ceil(damage);i++){const x=365+(i*53)%235,y=210+(i*67)%245;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-13,y+22);ctx.lineTo(x+5,y+39);ctx.lineTo(x-9,y+61);ctx.stroke()}for(let i=0;i<Math.ceil(damage*1.4);i++){const x=335+(i*71)%300,y=475-(i%5)*58,h=22+Math.sin(t+i)*10;glow("#ff3b17",18);ctx.fillStyle=i%2?"#ff3b17":"#fbbf24";ctx.beginPath();ctx.moveTo(x-11,y);ctx.quadraticCurveTo(x-4,y-h*.55,x+2,y-h);ctx.quadraticCurveTo(x+15,y-h*.3,x+11,y);ctx.fill();noGlow()}ctx.fillStyle=`rgba(20,15,28,${Math.min(.6,damage*.05)})`;for(let i=0;i<Math.floor(damage/2);i++){ctx.beginPath();ctx.arc(380+(i*83)%230,145-(i%3)*25,28+i*3,0,7);ctx.fill()}ctx.restore()}}
  // Gamepad / touch / VR layers write keys[code] directly with no key event, so
  // derive rising edges here rather than only in the keydown handler. Keyboard
  // still sets pressed[] on keydown so a tap between two frames is never lost.
  function syncEdges(){for(const k in keys){if(keys[k]&&!prevKeys[k])pressed[k]=true}prevKeys=Object.assign({},keys)}
  /* Re-established every frame rather than once at startup: the game modules
     use ctx.save()/restore() freely and a stray imbalance would otherwise leave
     the world drifting. setTransform is absolute, so this cannot accumulate. */
  function viewport(){ctx.setTransform(1,0,0,1,PAD,0)}
  function loop(now){requestAnimationFrame(loop);const dt=Math.min(.034,(now-last)/1000||0);last=now;beat=Math.max(0,beat-dt*4.5);beatAccent=Math.max(0,beatAccent-dt*2.6);syncEdges();if(!running&&!paused&&pressed.Enter)start();viewport();if(running&&!paused){music(dt);game.update(dt);game.draw();fx(dt)}else if(!running){game.draw()}Object.keys(pressed).forEach(k=>delete pressed[k])}

  const games={
    /* BEAM ME UP: LIVE! now lives in beam-data.js (venues, flight paths),
       beam.js (rules) and beam-art.js (cast, bosses, HUD). The host still owns
       lives, score, the HUD, music, pause and the leaderboard flow. */
    beamMeUpLive(){
      return window.BeamGame.create({ctx,W,H,PAD,VIEW_W,level:()=>level,lives:()=>lives,addLife:()=>{lives++;hud()},
        down,tap,reduced,attract:attractMode,score:addScore,burst,beep,sweep,chord,toast,lose,next});
    },
    /* ==================================================================
       AMP RAMPAGE.

       WHY THE CAGE COULD NOT BE OPENED. The two neon picks sat at floor 1
       x=420 and floor 3 x=450. The route up the rig alternates sides —
       you arrive on floor 1 at the ladder at x=760 and leave by the one at
       x=180, arrive on floor 3 at x=720 and leave at x=260 — so BOTH picks
       lay directly between the ladder you came up and the ladder you left
       by, and pickup was automatic on contact. There was no way to walk the
       only path without spending both of them, and they were spent early,
       while the first stage gear was still seven seconds of rolling away
       from the floor you were on. The boss needed 3+level hits. Two picks,
       no gear in reach, four hits required: `fan.safe` could never be set,
       so the cage stayed locked however many times you reached it, and the
       only way to get picks back was to die.

       Three things fix it, and they are meant to be read together:
         - picks are BANKED, not triggered. Walking over one stows it; you
           spend it when you choose to. That alone removes the trap.
         - pick sites sit on spurs, past the ladder the route uses, so
           collecting one is a decision instead of something the path does
           to you.
         - each site comes back on a timer, so no sequence of play can
           leave the level unwinnable.
       Boss health comes down to 2+level to match, and the smash clock only
       runs at full speed while there is gear on your floor to spend it on.

       The rig is also seeded with gear at reset. Everything used to spawn
       at the top, so the first twenty seconds of every level were spent on
       empty floors. */
    ampRampage(){
      const floors=[650,520,390,260,130], dirs=[1,-1,1,-1,1];
      const LADDER_SPEC=[{x:760,a:0},{x:180,a:1},{x:720,a:2},{x:260,a:3}];
      // floor 1 arrives at 760 and leaves at 180; floor 2 arrives 180 leaves
      // 720; floor 3 arrives 720 leaves 260. These three sit outside all of it.
      const PICK_SPEC=[{x:96,a:1},{x:872,a:2},{x:872,a:3}];
      const ITEM_TYPES=["amp","speaker","light","guitar","bass","drum","mic"];
      const PICK_RESPAWN=8, SMASH_TIME=5, CAGE_X=730;

      let p,items,picks,debris,ladders,boss,fan,cageKey,introT,deathT,spawnT,shake,hudCache;

      const floorY=(fl,x)=>floors[fl]-((x-35)/890)*18*dirs[fl];
      const standY=(fl,x)=>floorY(fl,x)-40;

      function knockOut(why){
        if(deathT>0||p.inv>0)return;
        deathT=1.55;p.inv=99;p.vy=-330;shake=Math.max(shake,14);
        burst(p.x+14,p.y+20,"#67e8f9",28);burst(p.x+14,p.y+20,"#ffffff",12);
        toast(why||"HERO HIT — RETURNING TO BASE");sweep(360,70,.55,"sawtooth",.085);
      }
      function makeItem(o){
        const type=o.type||ITEM_TYPES[Math.floor(rnd(0,ITEM_TYPES.length))];
        const it={x:o.x,y:0,w:42,h:28,floor:o.floor,type,
          v:o.v!=null?o.v:110+level*18,
          enchanted:level>1&&Math.random()<.6,
          electric:type==="amp"&&Math.random()<Math.min(.7,.22+level*.1),
          vertical:Math.random()<.3,
          held:o.held||0,holdMax:o.held||0,
          dodged:false,rot:0,zapT:rnd(0,1.5),warn:false,hot:false,hotFired:false};
        it.y=floorY(it.floor,it.x)-it.h;
        return it;
      }
      function unlockCage(){
        if(fan.safe||boss.hp>0||!cageKey.taken)return;
        fan.safe=true;
        toast("CAGE UNLOCKED — GET TO THE FAN");
        chord([523,659,784,1047]);
      }
      function smash(a){
        const col=hazardColor(a);
        a.dead=true;boss.hp=Math.max(0,boss.hp-1);p.swing=1;shake=Math.max(shake,12);
        burst(a.x+20,a.y+12,col,22);burst(a.x+20,a.y+12,"#ffffff",8);
        addScore(a.electric?350:a.enchanted?300:250);
        sweep(130,45,.2,"sawtooth",.07);
        if(!reduced)for(let i=0;i<5;i++)debris.push({x:a.x+20,y:a.y+12,vx:rnd(-200,200),vy:rnd(-280,-70),rot:rnd(0,7),spin:rnd(-10,10),life:.75,col});
        if(boss.hp<=0){
          if(!boss.beaten){boss.beaten=true;chord([196,165,147],.22,.06)}
          if(!cageKey.taken)toast("GEAR DESTROYED — NOW FIND THE CAGE KEY");
        }
        unlockCage();
      }
      function set(sel,v){const e=$(sel);if(e&&hudCache[sel]!==v){e.textContent=v;hudCache[sel]=v}}
      function syncHud(){
        set("#bossHp",String(Math.max(0,boss.hp)));
        const hpEl=$("#bossHp");if(hpEl)hpEl.classList.toggle("done",boss.hp<=0);
        set("#pickCount",String(p.picks));
        set("#keyState",cageKey.taken?"HELD":"—");
        const bar=$("#smashBar");
        if(bar){
          const pct=clamp(p.power/SMASH_TIME,0,1);
          bar.style.transform="scaleX("+pct.toFixed(3)+")";
          bar.style.opacity=p.power>0?"1":".25";
        }
      }

      return{
        reset(){
          p={x:90,y:0,w:28,h:40,vy:0,floor:0,climb:false,ladder:null,
             power:0,inv:0,phase:0,face:1,land:0,swing:0,picks:1,state:"idle"};
          p.y=standY(0,p.x);
          items=[];debris=[];hudCache={};shake=0;
          ladders=LADDER_SPEC.map(l=>({...l}));
          picks=PICK_SPEC.map(s=>({x:s.x,y:floorY(s.a,s.x)-27,w:26,h:26,a:s.a,on:true,cool:0}));
          boss={type:["frank","vamp","ghost"][(level-1)%3],hp:2+level,x:-70,stomp:0,dir:1,
                throwing:false,throwPhase:-1,laughed:false,beaten:false,
                swipe:{state:"idle",t:0,cool:2.2}};
          fan={x:-48,y:56,safe:false,carried:true,door:0,open:0};
          cageKey={x:665,y:floorY(3,665)-34,w:26,h:26,taken:false};
          introT=5.4;deathT=0;spawnT=1.2;
          // gear already on the rig, so the opening twenty seconds are not spent
          // walking empty floors waiting for the first thing to smash
          [{floor:3,x:820},{floor:2,x:300},{floor:2,x:640},{floor:1,x:560}].forEach(s=>items.push(makeItem(s)));
          toast((boss.type==="frank"?"FRANKENSTEIN":boss.type==="vamp"?"THE VAMPIRE":"THE GHOST")+" IS BRINGING IN A CAPTIVE!");
        },
        respawn(){
          p.x=90;p.floor=0;p.y=standY(0,90);p.vy=0;p.inv=2;p.climb=false;p.ladder=null;
          p.power=0;p.face=1;p.land=0;p.swing=0;p.picks=Math.max(1,p.picks);
          picks.forEach(k=>{k.on=true;k.cool=0});
          boss.swipe={state:"idle",t:0,cool:2.2};
          deathT=0;shake=0;
          toast("HERO BACK AT BASE — PICKS RESTORED");
        },
        next(){this.reset()},
        update(dt){
          if(introT>0){
            if(tap("Space","Enter"))introT=dt;
            introT=Math.max(0,introT-dt);
            const q=1-introT/5.4,smooth=v=>v*v*(3-2*v);
            if(q<.16){const s=smooth(q/.16);boss.x=-70+300*s;fan.carried=true;fan.x=boss.x+20;fan.y=53-Math.sin(s*Math.PI)*8}
            else if(q<.66){const s=smooth((q-.16)/.5);boss.x=230+485*s;fan.carried=true;fan.x=boss.x+20;fan.y=53+Math.sin(s*Math.PI*8)*3}
            else if(q<.79){const s=smooth((q-.66)/.13);boss.x=715;fan.carried=false;fan.x=735+(785-735)*s;fan.y=53+(82-53)*s}
            else if(q<.9){const s=smooth((q-.79)/.11);boss.x=700;fan.x=785;fan.y=82;fan.door=s;if(s>.55&&!fan.slammed){fan.slammed=true;burst(785,105,"#94a3b8",18);sweep(520,70,.28,"square",.09);toast("CAGE DOOR SLAMMED!")}}
            else{const s=smooth((q-.9)/.1);boss.x=700-120*s;fan.x=785;fan.y=82;fan.door=1;if(!boss.laughed){boss.laughed=true;chord([196,165,147],.22,.06);toast("HA! HA! HA!")}}
            if(introT===0){boss.x=500;fan.x=785;fan.y=82;fan.door=1;toast("FIND THE KEY — SMASH THE GEAR — FREE THE FAN")}
            syncHud();
            return;
          }
          shake=Math.max(0,shake-dt*38);
          if(deathT>0){
            deathT=Math.max(0,deathT-dt);
            p.vy+=720*dt;p.y+=p.vy*dt;p.x+=Math.sin(deathT*22)*75*dt;p.phase+=dt*18;
            if(deathT===0){p.inv=0;lose()}
            return;
          }
          p.inv-=dt;
          p.land=Math.max(0,p.land-dt*5);
          p.swing=Math.max(0,p.swing-dt*4);
          if(fan.safe)fan.open=Math.min(1,fan.open+dt*2.2);

          /* --- picks: stow, then spend ---------------------------------- */
          picks.forEach(k=>{
            if(!k.on){
              k.cool-=dt;
              if(k.cool<=0){k.on=true;burst(k.x+13,k.y+13,"#d9ff63",8);beep(660,.07,"triangle",.03)}
              return;
            }
            if(hit(p,k)){
              k.on=false;k.cool=PICK_RESPAWN;p.picks++;addScore(150);
              burst(k.x+13,k.y+13,"#d9ff63",16);
              toast("NEON PICK STOWED — "+p.picks+" HELD");
              chord([220,330,440]);
            }
          });
          if(tap("KeyE","KeyF","ShiftLeft","ShiftRight")&&p.picks>0&&p.power<=0){
            p.picks--;p.power=SMASH_TIME;shake=Math.max(shake,8);
            burst(p.x+14,p.y+10,"#d9ff63",22);
            toast("SMASH MODE — "+SMASH_TIME+"s");
            chord([330,440,660]);
          }

          /* --- movement -------------------------------------------------- */
          const up=down("ArrowUp","KeyW"),dn=down("ArrowDown","KeyS");
          const goL=down("ArrowLeft","KeyA"),goR=down("ArrowRight","KeyD");
          if(!p.climb){
            const foot=ladders.find(l=>l.a===p.floor&&Math.abs(p.x+14-l.x)<18),
                  head=ladders.find(l=>l.a===p.floor-1&&Math.abs(p.x+14-l.x)<18);
            if(up&&foot){p.climb=true;p.ladder=foot;p.vy=0}
            else if(dn&&head){p.climb=true;p.ladder=head;p.vy=0}
          }
          if(p.climb&&p.ladder){
            const l=p.ladder,prevY=p.y,sx=(l.x-35)/890*18;
            p.x+=(l.x-14-p.x)*12*dt;
            p.y+=(up?-150:dn?150:0)*dt;
            p.phase+=Math.abs(p.y-prevY)/7;
            const upper=floors[l.a+1]-sx*dirs[l.a+1]-40,lower=floors[l.a]-sx*dirs[l.a]-40;
            if(p.y<=upper){p.floor=l.a+1;p.y=upper;p.climb=false;p.ladder=null}
            if(p.y>=lower){p.floor=l.a;p.y=lower;p.climb=false;p.ladder=null}
          }else{
            p.climb=false;
            const prevX=p.x;
            if(goL)p.face=-1;else if(goR)p.face=1;
            p.x=clamp(p.x+(goL?-210:goR?210:0)*dt,28,900);
            p.phase+=Math.abs(p.x-prevX)/8;
            if(tap("Space")&&p.vy===0){
              p.vy=-390;sweep(level%2?210:170,level%2?760:620,.14,"triangle",.055);
              setTimeout(()=>beep(level%2?980:820,.06,"square",.025),45);
            }
            p.vy+=980*dt;p.y+=p.vy*dt;
            const ground=standY(p.floor,p.x);
            if(p.y>=ground){
              if(p.vy>240){p.land=1;burst(p.x+14,p.y+40,"#2b2140",5);beep(120,.06,"square",.02)}
              p.y=ground;p.vy=0;
            }
          }
          p.state=p.climb?"climb":p.vy<-8?"jump":p.vy>8?"fall":(goL||goR)?"run":"idle";
          const airborne=!p.climb&&p.y<standY(p.floor,p.x)-24;

          /* --- boss: patrol, and a telegraphed swipe on his own floor ----- */
          boss.stomp+=dt*8;
          const sw=boss.swipe;
          if(sw.state==="idle"){
            boss.x+=boss.dir*(45+level*5)*dt;
            if(boss.x<240||boss.x>600)boss.dir*=-1;
            sw.cool-=dt;
            if(p.floor===4&&Math.abs(p.x+14-boss.x)<150&&sw.cool<=0){
              sw.state="wind";sw.t=.5;boss.dir=(p.x+14)<boss.x?-1:1;
              sweep(150,320,.4,"square",.05);
            }
          }else if(sw.state==="wind"){
            sw.t-=dt;
            if(sw.t<=0){sw.state="strike";sw.t=.26;sweep(420,90,.24,"sawtooth",.07);shake=Math.max(shake,9)}
          }else{
            sw.t-=dt;
            if(p.floor===4&&!airborne&&Math.abs(p.x+14-(boss.x+boss.dir*BOSS_REACH*.62))<BOSS_REACH)
              knockOut("BOSS SWIPE — JUMP IT NEXT TIME");
            if(sw.t<=0){sw.state="idle";sw.cool=1.9}
          }

          /* --- gear ------------------------------------------------------ */
          spawnT-=dt;
          if(spawnT<=0){
            items.push(makeItem({floor:4,x:boss.x,held:1.05}));
            boss.throwing=true;boss.throwPhase=0;
            spawnT=Math.max(1.05,2.5-level*.14);
            sweep(180,75,.18,"square",.045);
          }
          boss.throwing=false;boss.throwPhase=-1;
          let gearNear=false;
          items.forEach(a=>{
            if(a.held>0){
              a.held=Math.max(0,a.held-dt);
              const ph=1-a.held/a.holdMax,lift=Math.sin(ph*Math.PI);
              a.x=boss.x-21-ph*ph*42;a.y=floors[4]-68-lift*38;
              boss.throwing=true;boss.throwPhase=ph;
              return;
            }
            if(a.falling){
              a.vy+=900*dt;a.x+=a.vx*dt;a.y+=a.vy*dt;a.rot=(a.rot||0)+a.spin*dt;
              const landX=clamp(a.x,35,885),landY=floorY(a.targetFloor,landX)-a.h;
              if(a.y>=landY){
                a.y=landY;
                if(!a.bounced){a.bounced=true;a.x=landX;a.vy=-125;a.vx=-a.edgeDir*45;a.spin*=-.5;burst(a.x+a.w/2,a.y+a.h,"#fb923c",7);sweep(120,60,.1,"square",.025)}
                else{a.floor=a.targetFloor;a.x=clamp(a.x,40,880);a.y=landY;a.falling=false;a.dropped=false;a.vy=0;a.v=Math.max(95,a.v*.94);a.rot*=.35}
              }
            }else{
              const slope=dirs[a.floor],dir=-slope,prevX=a.x;
              a.x+=dir*a.v*dt;
              a.y=floorY(a.floor,a.x)-a.h;
              a.rot=Math.sin(a.x/30)*.09;
              if(!a.dodged&&a.floor===p.floor&&p.vy!==0&&((dir>0&&prevX<=p.x&&a.x>p.x)||(dir<0&&prevX>=p.x&&a.x<p.x))){
                a.dodged=true;addScore(100+level*25);toast("JUMP DODGE +"+(100+level*25));beep(880,.09,"triangle",.065);
              }
              if(a.vertical&&!a.dropped&&a.floor>0){
                const lad=ladders.find(l=>l.a===a.floor-1&&Math.abs(a.x+a.w/2-l.x)<20);
                if(lad){a.dropped=true;a.falling=true;a.targetFloor=a.floor-1;a.edgeDir=dir;a.vx=dir*20;a.vy=95;a.spin=dir*3.2;a.bounced=false;burst(a.x+a.w/2,a.y+a.h,"#67e8f9",7);sweep(320,110,.16,"square",.045)}
              }
              if(a.x<35||a.x>885){
                if(a.floor>0){a.falling=true;a.targetFloor=a.floor-1;a.edgeDir=dir;a.vx=dir*(65+level*6);a.vy=45;a.spin=dir*(4.5+Math.random()*3);a.bounced=false;a.x=clamp(a.x,28,892)}
                else a.dead=true;
              }
            }
            if(a.electric){
              a.zapT+=dt;
              const cyc=a.zapT%1.6;
              a.warn=cyc>.95&&cyc<=1.25;
              a.hot=cyc>1.25;
              if(a.hot&&!a.hotFired){a.hotFired=true;sweep(70,250,.2,"sawtooth",.028)}
              if(!a.hot)a.hotFired=false;
            }
            if(!a.falling&&a.floor===p.floor&&Math.abs(a.x+a.w/2-(p.x+p.w/2))<430)gearNear=true;
            if(a.hot&&p.power<=0&&p.inv<=0&&!a.falling&&a.floor===p.floor&&
               Math.abs(a.x+a.w/2-p.x-p.w/2)<ARC_REACH&&Math.abs(a.y-p.y)<40){
              burst(p.x+14,p.y+20,"#67e8f9",10);knockOut("ARC FLASH — WAIT FOR IT TO COOL");
            }
            if(hit(p,a)){
              if(p.power>0)smash(a);
              else if(p.inv<=0){a.dead=true;knockOut()}
            }
          });
          items=items.filter(a=>!a.dead);
          // the clock barely moves while there is nothing on your floor to spend
          // it on, so a pick cannot be wasted simply by being in the wrong place
          p.power=Math.max(0,p.power-dt*(gearNear?1:.25));

          debris.forEach(d=>{d.vy+=900*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.rot+=d.spin*dt;d.life-=dt});
          debris=debris.filter(d=>d.life>0);

          if(!cageKey.taken&&hit(p,cageKey)){
            cageKey.taken=true;burst(cageKey.x,cageKey.y,"#fbbf24",18);
            addScore(500);chord([659,784,988]);
            if(boss.hp>0)toast("CAGE KEY TAKEN — NOW SMASH THE BOSS'S GEAR");
            unlockCage();
          }
          if(fan.safe&&p.floor===4&&p.x>CAGE_X){
            burst(fan.x,fan.y,"#f0abfc",30);burst(fan.x,fan.y,"#d9ff63",16);
            addScore(1500);shake=14;next();return;
          }
          syncHud();
        },
        draw(){
          ctx.save();
          if(shake>.1){const a=performance.now()/9;ctx.translate(Math.sin(a)*shake*.6,Math.cos(a*1.7)*shake*.45)}
          drawBasement();
          drawRigLights(floors,dirs);
          floors.forEach((y,i)=>drawRigTruss(i,floors,dirs));
          ladders.forEach(l=>drawRigLadder(l,floors,dirs));
          if(fan.safe)drawCageTrail(floors,dirs);
          items.forEach(drawStageItem);
          debris.forEach(d=>{ctx.save();ctx.globalAlpha=clamp(d.life*1.6,0,1);ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle=d.col;ctx.fillRect(-5,-3,10,6);ctx.restore()});
          ctx.globalAlpha=1;
          picks.forEach(k=>{
            if(k.on){
              const f=1+Math.sin(performance.now()/220)*.12;
              ctx.save();ctx.translate(k.x+13,k.y+14);ctx.scale(f,f);
              glow("#d9ff63",18);ctx.fillStyle="#d9ff63";
              ctx.beginPath();ctx.moveTo(-11,-11);ctx.quadraticCurveTo(11,-13,12,-6);ctx.quadraticCurveTo(11,8,0,14);ctx.quadraticCurveTo(-12,4,-11,-11);ctx.fill();
              ctx.strokeStyle=RIG_INK;ctx.lineWidth=2;ctx.stroke();
              ctx.strokeStyle="#3f5c0c";ctx.lineWidth=1.4;ctx.beginPath();
              for(let q=-1;q<2;q++){ctx.moveTo(q*4,-8);ctx.lineTo(q*4-1,6)}
              ctx.stroke();noGlow();ctx.restore();
              text("PICK",k.x+13,k.y-10,11,"#d9ff63");
            }else{
              ctx.globalAlpha=.30;ctx.strokeStyle="#d9ff63";ctx.lineWidth=2;ctx.setLineDash([4,4]);
              ctx.beginPath();ctx.arc(k.x+13,k.y+13,13,-1.57,-1.57+(1-k.cool/PICK_RESPAWN)*6.283);ctx.stroke();
              ctx.setLineDash([]);ctx.globalAlpha=1;
            }
          });
          if(!cageKey.taken){
            glow("#fbbf24",18);
            text("⚿",cageKey.x+13,cageKey.y+24,30,"#fbbf24");
            text("CAGE KEY",cageKey.x+13,cageKey.y-8,11,"#fde68a");
            noGlow();
          }
          ctx.save();
          if(deathT>0){
            ctx.globalAlpha=.45+.45*Math.abs(Math.sin(deathT*18));
            ctx.translate(p.x+14,p.y+20);ctx.rotate((1.55-deathT)*5);ctx.translate(-(p.x+14),-(p.y+20));
          }else if(p.inv>0&&Math.sin(performance.now()/60)>0)ctx.globalAlpha=.45;
          drawRigHero({x:p.x+p.w/2,y:p.y+p.h,skin:level%2?"spaceman":"monkey",
            face:p.face,phase:p.phase,state:deathT>0?"fall":p.state,land:p.land,
            power:p.power,swing:p.swing,key:cageKey.taken,
            groundY:p.climb?null:floorY(p.floor,p.x+p.w/2)});
          ctx.restore();
          drawFanCage(fan);
          const bossY=introT>0?96:floors[4]-45;
          drawRigBoss(boss,bossY);
          text(boss.type.toUpperCase()+" — "+Math.max(0,boss.hp)+" GEAR LEFT",boss.x,bossY-56,14,boss.hp>0?"#fb7185":"#d9ff63");
          text(fan.safe?"FAN FREE!":"ABDUCTED FAN",fan.x,24,12,fan.safe?"#d9ff63":"#f0abfc");
          if(p.power>0){glow("#d9ff63",14);text("SMASH "+p.power.toFixed(1)+"s",p.x+14,p.y-34,15,"#d9ff63");noGlow()}
          else if(p.picks>0&&boss.hp>0){ctx.globalAlpha=.55+.35*Math.sin(performance.now()/300);text("PRESS E TO SMASH",p.x+14,p.y-34,12,"#d9ff63");ctx.globalAlpha=1}
          if(introT>0){
            text("THE FAN HAS BEEN TAKEN!",480,208,22,"#fb7185");
            if(!attractMode)text("PRESS SPACE TO SKIP",480,236,13,"#c4b5fd");
          }
          if(deathT>0)text("KNOCKED OUT — RETURNING TO BASE",480,300,18,"#67e8f9");
          ctx.restore();
        },
        attract:null
      };
    },
    houseOfTheHooded(){
      return window.HoodedGame.create({ctx,level:()=>level,tap,reduced,
        bg,house:()=>drawHouseSilhouette(.25),score:addScore,burst,beep,sweep,chord,lose,next});
    },
    graveyardShift(){
      return window.GraveyardGame.create({ctx,W,H,PAD,VIEW_W,level:()=>level,lives:()=>lives,addLife:()=>{lives++;hud()},
        down,tap,reduced,attract:attractMode,bg,score:addScore,burst,beep,sweep,chord,toast,lose,next,end});
    }
  };
  const game=games[id]();game.reset();hud();show($("h1").textContent,$("#intro").textContent,"START");
  window.startGame=start;
  if(attractMode){const s=document.createElement("style");s.textContent=".tools,.kicker,.topbar,.controls,.toast,h1{display:none!important}body{padding:0!important}.game{width:100%!important}.frame{width:100vw!important;height:100vh!important;max-height:100vh!important;aspect-ratio:auto!important;border:none!important;border-radius:0!important;box-shadow:none!important}.frame:after{display:none!important}";document.head.appendChild(s)}
  requestAnimationFrame(loop);
})();
