// Ghost Circuit VR Arcade Theater
// Presents every existing 2D cabinet as a spatial WebXR screen and translates
// xr-standard Quest controller input into the games' existing key/mouse events.
(function () {
  'use strict';
  if (!navigator.xr || new URLSearchParams(location.search).has('attract')) return;

  const slug = location.pathname.split('/').filter(Boolean).slice(-2, -1)[0] || '';
  const layouts = {
    'spectral-manor-revenger':          { actions:['Space'], aim:false },
    'spectral-food-fight':              { actions:['Space'], aim:true },
    'spectral-robotron':                { actions:['Space'], aim:true },
    'spectral-skyline':                 { actions:['Space'], aim:false },
    'spectral-manor-soul-circuit':      { actions:[], aim:false },
    'spectral-manor-crystal-dimension': { actions:['ArrowUp','Space'], aim:false },
    'spectral-manor-infestation':       { actions:['Space'], aim:false },
    'spectral-manor-cruise':            { actions:['ArrowUp','ArrowDown'], aim:false }
  };
  const layout = layouts[slug] || { actions:['Space'], aim:false };
  const settings = Object.assign({ distance:2.6, height:1.45, size:1.55, curve:.22, brightness:1, dominant:'right' },
    JSON.parse(localStorage.getItem('spectralArcade.vr.settings') || 'null') || {});
  let session=null, gl=null, layer=null, refSpace=null, program=null, texture=null, vrCanvas=null;
  let posBuffer=null, uvBuffer=null, indexBuffer=null, indexCount=0, frameHandle=0;
  let gameCanvas=null, aim={x:480,y:270}, held={}, squeezeHeld=false;

  const key=(code,down)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code==='Space'?' ':code,bubbles:true}));
  function setKey(code,on){if(!!held[code]===!!on)return;held[code]=!!on;key(code,on);}
  const pressed=(gp,i)=>!!(gp&&gp.buttons&&gp.buttons[i]&&gp.buttons[i].pressed);
  const axis=(gp,i)=>gp&&gp.axes&&typeof gp.axes[i]==='number'?gp.axes[i]:0;

  function makeButton(){
    const button=document.createElement('button');
    button.id='sm-enter-vr';button.textContent='Enter VR Theater';button.hidden=true;
    button.style.cssText='position:fixed;right:10px;top:48px;z-index:9998;padding:.55rem .8rem;border-radius:8px;cursor:pointer;' +
      'font:700 .75rem system-ui;color:#111509;background:#d9ff63;border:1px solid #efffa8;box-shadow:0 0 22px #d9ff6355';
    button.addEventListener('click',openSetup);
    document.body.appendChild(button);
    navigator.xr.isSessionSupported('immersive-vr').then(ok=>{button.hidden=!ok;}).catch(()=>{});
  }

  function openSetup(){
    let panel=document.getElementById('sm-vr-setup');
    if(panel){panel.hidden=false;return;}
    panel=document.createElement('div');panel.id='sm-vr-setup';
    panel.style.cssText='position:fixed;inset:0;z-index:10001;display:grid;place-items:center;padding:18px;background:#05030be8;font-family:system-ui;color:#eee';
    const box=document.createElement('div');box.style.cssText='width:min(430px,100%);padding:22px;border:1px solid #6d4aa0;border-radius:16px;background:#120b20;box-shadow:0 30px 90px #000';
    box.innerHTML='<div style="color:#d9ff63;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase">Spectral Manor</div>'+
      '<h2 style="margin:.35rem 0 .5rem;font:700 1.5rem Georgia,serif">VR Arcade Theater</h2>'+
      '<p style="margin:0 0 1rem;color:#b9afc9;font-size:.82rem;line-height:1.45">Seated mode · Left stick moves · Right trigger acts · Right stick aims where supported.</p>'+
      range('Distance','vrDistance',16,40,Math.round(settings.distance*10),'.1 m')+
      range('Screen height','vrHeight',8,22,Math.round(settings.height*10),'.1 m')+
      range('Screen size','vrSize',8,24,Math.round(settings.size*10),'%')+
      range('Curvature','vrCurve',0,60,Math.round(settings.curve*100),'%')+
      range('Brightness','vrBrightness',55,110,Math.round(settings.brightness*100),'%')+
      '<div style="display:flex;gap:8px;margin-top:18px"><button id="vrCancel" style="'+btnCss(false)+'">Cancel</button><button id="vrStart" style="'+btnCss(true)+'">Enter VR</button></div>';
    panel.appendChild(box);document.body.appendChild(panel);
    box.querySelector('#vrCancel').onclick=()=>panel.hidden=true;
    box.querySelector('#vrStart').onclick=()=>{
      settings.distance=+box.querySelector('#vrDistance').value/10;
      settings.height=+box.querySelector('#vrHeight').value/10;
      settings.size=+box.querySelector('#vrSize').value/10;
      settings.curve=+box.querySelector('#vrCurve').value/100;
      settings.brightness=+box.querySelector('#vrBrightness').value/100;
      localStorage.setItem('spectralArcade.vr.settings',JSON.stringify(settings));
      panel.hidden=true;enterVR();
    };
  }
  function range(label,id,min,max,value,unit){
    return '<label style="display:block;margin:.75rem 0;color:#d8d0e3;font-size:.75rem">'+label+
      '<input id="'+id+'" type="range" min="'+min+'" max="'+max+'" value="'+value+'" style="width:100%;accent-color:#d9ff63;margin-top:.35rem" aria-label="'+label+'"></label>';
  }
  function btnCss(primary){return 'flex:1;padding:.7rem;border-radius:8px;cursor:pointer;font-weight:700;border:1px solid '+(primary?'#d9ff63':'#56436f')+';background:'+(primary?'#d9ff63':'#21152f')+';color:'+(primary?'#101408':'#eee');}

  function shader(type,source){
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;
  }
  function initGL(){
    vrCanvas=document.createElement('canvas');vrCanvas.style.display='none';document.body.appendChild(vrCanvas);
    gl=vrCanvas.getContext('webgl',{xrCompatible:true,alpha:false,antialias:true});
    const vs=shader(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec2 u;uniform mat4 mvp;varying vec2 v;void main(){v=u;gl_Position=mvp*vec4(p,1.0);}');
    const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D tex;uniform float bright;varying vec2 v;void main(){vec4 c=texture2D(tex,v);gl_FragColor=vec4(c.rgb*bright,1.0);}');
    program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    buildScreen();
  }
  function buildScreen(){
    const seg=28,verts=[],uv=[],idx=[],halfW=settings.size,halfH=settings.size*9/16;
    for(let i=0;i<=seg;i++){const t=i/seg,x=(t*2-1)*halfW,z=-settings.curve*Math.pow(t*2-1,2)*.28;
      verts.push(x,-halfH,z,x,halfH,z);uv.push(t,1,t,0);
      if(i<seg){const n=i*2;idx.push(n,n+1,n+2,n+1,n+3,n+2);}}
    posBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,posBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
    uvBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(uv),gl.STATIC_DRAW);
    indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);indexCount=idx.length;
  }
  function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
  function model(){const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;m[13]=settings.height;m[14]=-settings.distance;return m;}

  async function enterVR(){
    try{
      gameCanvas=document.getElementById('gameCanvas')||document.querySelector('canvas');
      if(!gameCanvas)throw new Error('Game canvas not found');
      session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor']});
      initGL();layer=new XRWebGLLayer(session,gl);session.updateRenderState({baseLayer:layer});
      refSpace=await session.requestReferenceSpace('local-floor').catch(()=>session.requestReferenceSpace('local'));
      session.addEventListener('end',onEnd);session.addEventListener('selectstart',()=>setKey(layout.actions[0]||'Space',true));
      session.addEventListener('selectend',()=>setKey(layout.actions[0]||'Space',false));
      frameHandle=session.requestAnimationFrame(onFrame);
    }catch(e){alert('VR could not start. Open this page over HTTPS in Meta Quest Browser and allow immersive VR.');}
  }
  function pollXRInputs(frame){
    const DZ=.22;let left=null,right=null;
    session.inputSources.forEach(src=>{if(src.handedness==='left')left=src;if(src.handedness==='right')right=src;});
    const move=left&&left.gamepad,act=(settings.dominant==='left'?left:right);const gp=act&&act.gamepad;
    setKey('ArrowLeft',axis(move,2)<-DZ);setKey('ArrowRight',axis(move,2)>DZ);setKey('ArrowUp',axis(move,3)<-DZ);setKey('ArrowDown',axis(move,3)>DZ);
    if(layout.aim&&gp){
      const rx=axis(gp,2),ry=axis(gp,3),mag=Math.hypot(rx,ry);
      if(mag>DZ){aim.x=Math.max(0,Math.min(gameCanvas.width,aim.x+rx*14));aim.y=Math.max(0,Math.min(gameCanvas.height,aim.y+ry*14));}
      const rect=gameCanvas.getBoundingClientRect(),clientX=rect.left+aim.x/gameCanvas.width*rect.width,clientY=rect.top+aim.y/gameCanvas.height*rect.height;
      gameCanvas.dispatchEvent(new MouseEvent('mousemove',{clientX,clientY,bubbles:true}));
      const fire=pressed(gp,0);if(!!held.__mouse!==fire){held.__mouse=fire;gameCanvas.dispatchEvent(new MouseEvent(fire?'mousedown':'mouseup',{clientX,clientY,bubbles:true}));}
    }else if(layout.actions[0])setKey(layout.actions[0],pressed(gp,0));
    if(layout.actions[1])setKey(layout.actions[1],pressed(gp,1));
    const squeeze=pressed(gp,1);if(squeeze&&!squeezeHeld){settings.height=Math.max(.8,Math.min(2.2,settings.height));}squeezeHeld=squeeze;
  }
  function onFrame(time,frame){
    if(!session)return;session.requestAnimationFrame(onFrame);pollXRInputs(frame);
    const pose=frame.getViewerPose(refSpace);if(!pose)return;
    gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(.012,.006,.025,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);gl.enable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,gameCanvas);}catch(e){}
    gl.uniform1i(gl.getUniformLocation(program,'tex'),0);gl.uniform1f(gl.getUniformLocation(program,'bright'),settings.brightness);
    gl.bindBuffer(gl.ARRAY_BUFFER,posBuffer);let loc=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffer);loc=gl.getAttribLocation(program,'u');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);
    for(const view of pose.views){const vp=layer.getViewport(view);gl.viewport(vp.x,vp.y,vp.width,vp.height);
      gl.uniformMatrix4fv(gl.getUniformLocation(program,'mvp'),false,mul(view.projectionMatrix,mul(view.transform.inverse.matrix,model())));
      gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);}
  }
  function onEnd(){
    session=null;Object.keys(held).forEach(k=>{if(k!=='__mouse')setKey(k,false);});held={};
    if(vrCanvas){vrCanvas.remove();vrCanvas=null;}gl=null;
  }
  if(document.body)makeButton();else addEventListener('DOMContentLoaded',makeButton);
})();
