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
  function next(){level++;addScore(500*level);beep(780,.15);game.next();hud();if(id!=="beamMeUpLive"&&id!=="graveyardShift"&&id!=="ampRampage")toast(`LEVEL ${level}`)}
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
  function burst(x,y,color=accent,n=10){if(reduced)n=Math.ceil(n/3);for(let i=0;i<n;i++)particles.push({x,y,vx:rnd(-130,130),vy:rnd(-150,40),life:rnd(.3,.8),color,size:rnd(2,6)})}
  function fx(dt=0){particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt;p.life-=dt});particles=particles.filter(p=>p.life>0);particles.forEach(p=>{ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size)});ctx.globalAlpha=1}
  function fog(offset=0){for(let i=0;i<5;i++){const x=((performance.now()*.012*(i+1)+i*260+offset)%1400)-220,y=500+i*38;const g=ctx.createRadialGradient(x,y,5,x,y,170);g.addColorStop(0,"#c4b5fd22");g.addColorStop(1,"#c4b5fd00");ctx.fillStyle=g;ctx.fillRect(x-180,y-90,360,180)}}
  function mansionBackdrop(alpha=.7){if(mansion.complete&&mansion.naturalWidth){ctx.globalAlpha=alpha;ctx.drawImage(mansion,0,0,mansion.naturalWidth,mansion.naturalHeight,-PAD,0,VIEW_W,H);ctx.globalAlpha=1}}
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
    /* AMP RAMPAGE now lives in amp-data.js (stages), amp-world.js (girders,
       ladders, cables), amp-stages.js (stacks, leads, foes, parts, rivets), amp.js (rules
       and autopilot) and amp-art.js (drawing and glue). */
    ampRampage(){
      return window.AmpGame.create({ctx,W,H,PAD,VIEW_W,level:()=>level,lives:()=>lives,addLife:()=>{lives++;hud()},
        down,tap,reduced,attract:attractMode,beat:()=>beat,beatAccent:()=>beatAccent,score:addScore,burst,beep,sweep,chord,toast,lose,next,end});
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
