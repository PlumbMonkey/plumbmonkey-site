// ---------------------------------------------------------------------------
// Spectral Manor Arcade — WebXR immersive mode (Quest 2 / 3)
//
// WHY THIS EXISTS
// The Quest's Touch controllers cannot be read by flat 2D web content. The
// WebXR Gamepads spec explicitly forbids XR gamepads from appearing in
// navigator.getGamepads(), and in flat/fullscreen browsing they are exposed
// through neither that nor XRInputSource. The thumbsticks and triggers only
// become readable inside an active immersive session — so to use them at all,
// the game has to be presented from inside one.
//
// WHAT IT DOES
// Requests an immersive-vr session, draws the game's existing 2D canvas as a
// texture on a quad floating in front of the viewer, and maps the Touch
// controllers onto the same keys[]/mouse surface every other input path uses:
//
//   left thumbstick  → movement          right thumbstick → aim (twin-stick)
//   trigger / A / X  → primary action     grip / B / Y     → secondary action
//
// Nothing here runs outside a session. Keyboard, Xbox pads, touch pads and the
// on-screen laser controls are completely untouched — this is a fourth input
// source feeding the existing merge in arcade-controls.js, not a replacement.
// ---------------------------------------------------------------------------

const ArcadeVR = (function () {
  const SCREEN_DIST = 2.5;      // metres in front of the viewer
  const SCREEN_W = 3.0;         // metres wide (16:9 → 1.6875 tall)
  const DEAD = 0.22;            // thumbstick deadzone
  const AIM_DEAD = 0.25;

  let session = null, gl = null, glCanvas = null, refSpace = null;
  let prog = null, quadBuf = null, uvBuf = null, tex = null;
  let loc = {};
  let gameCanvas = null;
  let supported = false;

  // Cooperative scheduling state. Arcade loops opt in through schedule();
  // the global browser animation API is never replaced.
  const realRaf = window.requestAnimationFrame.bind(window);
  const realCancel = window.cancelAnimationFrame.bind(window);
  let rafQueue = [], rafId = 1;
  const pendingRaf = new Map();
  let rafMode = 'flat';        // 'flat' | 'xr'
  let lastError = null;        // last caught error, painted into the VR view
  let xrFrames = 0;            // counts XR frames — a frozen counter = frame loop stopped
  let inputStatus = 'controllers 0';
  let exitHold = 0;

  const api = { init, enter, exit, mapInput, schedule, cancel,
                get active() { return !!session; },
                get supported() { return supported; } };

  // ---------------------------------------------------------------- shaders
  const VERT = `
    attribute vec3 aPos;
    attribute vec2 aUV;
    uniform mat4 uProj, uView, uModel;
    varying vec2 vUV;
    void main() {
      vUV = aUV;
      gl_Position = uProj * uView * uModel * vec4(aPos, 1.0);
    }`;

  const FRAG = `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uTex;
    void main() { gl_FragColor = texture2D(uTex, vUV); }`;

  function compile(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[ArcadeVR] shader:', gl.getShaderInfoLog(s));
    }
    return s;
  }

  function buildGL() {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(VERT, gl.VERTEX_SHADER));
    gl.attachShader(prog, compile(FRAG, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    loc = {
      aPos: gl.getAttribLocation(prog, 'aPos'),
      aUV: gl.getAttribLocation(prog, 'aUV'),
      uProj: gl.getUniformLocation(prog, 'uProj'),
      uView: gl.getUniformLocation(prog, 'uView'),
      uModel: gl.getUniformLocation(prog, 'uModel'),
      uTex: gl.getUniformLocation(prog, 'uTex')
    };

    const hw = SCREEN_W / 2;
    const hh = (SCREEN_W * (gameCanvas.height / gameCanvas.width)) / 2;
    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -hw, -hh, 0,   hw, -hh, 0,   -hw, hh, 0,
      -hw,  hh, 0,   hw, -hh, 0,    hw, hh, 0
    ]), gl.STATIC_DRAW);

    uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,  1, 0,  0, 1,
      0, 1,  1, 0,  1, 1
    ]), gl.STATIC_DRAW);

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // The game canvas is 960x540 — non-power-of-two, so WebGL1 requires
    // CLAMP_TO_EDGE and no mipmaps or it samples as solid black.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }

  // Column-major translation matrix — the only transform the screen needs.
  function translation(x, y, z) {
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
  }

  // -------------------------------------------------------- frame scheduler
  // Flat play uses native rAF. During an immersive session only registered
  // arcade callbacks move to the headset clock; unrelated page code is intact.
  function schedule(cb) {
    const id = rafId++;
    const item = { id, cb, nativeId: null };
    pendingRaf.set(id, item);
    if (rafMode === 'xr') {
      rafQueue.push(item);
    } else {
      item.nativeId = realRaf(t => {
        if (!pendingRaf.delete(id)) return;
        cb(t);
      });
    }
    return id;
  }

  function cancel(id) {
    const item = pendingRaf.get(id);
    if (!item) return;
    pendingRaf.delete(id);
    if (item.nativeId !== null) realCancel(item.nativeId);
    rafQueue = rafQueue.filter(q => q.id !== id);
  }

  function drainRaf(t) {
    const batch = rafQueue;
    rafQueue = [];
    for (const q of batch) {
      if (!pendingRaf.delete(q.id)) continue;
      try {
        q.cb(t);
      } catch (e) {
        // A game loop reschedules itself on its LAST line, so a throw in
        // update()/draw() would skip that and permanently freeze the game.
        // Re-queue the callback so one bad frame can't kill the loop, and
        // record the error so the on-canvas readout can surface it in VR.
        lastError = e;
        console.error('[ArcadeVR] frame:', e);
        schedule(q.cb);
      }
    }
  }

  function setRafMode(mode) {
    if (mode === rafMode) return;
    rafMode = mode;
    if (mode === 'xr') {
      pendingRaf.forEach(item => {
        if (item.nativeId === null) return;
        realCancel(item.nativeId);
        item.nativeId = null;
        rafQueue.push(item);
      });
      return;
    }
    const queued = rafQueue;
    rafQueue = [];
    queued.forEach(item => {
      if (!pendingRaf.has(item.id)) return;
      item.nativeId = realRaf(t => {
        if (!pendingRaf.delete(item.id)) return;
        item.cb(t);
      });
    });
  }

  // --------------------------------------------------------------- input
  // xr-standard mapping puts the thumbstick on axes[2]/[3]; axes[0]/[1] are
  // the (unused) touchpad slots. Some runtimes only populate the first pair,
  // so take whichever pair is actually deflected.
  function stick(gp) {
    if (!gp || !gp.axes) return [0, 0];
    const a = gp.axes;
    const p2 = [a[2] || 0, a[3] || 0];
    const p1 = [a[0] || 0, a[1] || 0];
    return Math.hypot(p2[0], p2[1]) >= Math.hypot(p1[0], p1[1]) ? p2 : p1;
  }
  const pressed = (gp, i) => !!(gp && gp.buttons && gp.buttons[i] && gp.buttons[i].pressed);

  let startCooldown = 0;

  // Pure mapper: input sources + game profile → {codes, aim, start}. Kept
  // separate from the session so the axis handling (the fiddliest part) can be
  // exercised without a headset attached.
  function mapInput(sources, profile) {
    const p = profile || {};
    const codes = new Set();
    let aim = null;
    let start = false;

    let anyPrimary = false;
    for (const src of sources || []) {
      const gp = src.gamepad;
      if (!gp) continue;
      const [sx, sy] = stick(gp);
      const trigger = pressed(gp, 0);
      const grip = pressed(gp, 1);
      const btnA = pressed(gp, 4);   // A (right) / X (left)
      const btnB = pressed(gp, 5);   // B (right) / Y (left)

      if (src.handedness === 'right' && p.aim) {
        // Right stick aims in the twin-stick games and auto-fires, matching
        // how the touch pads and Bluetooth pads already behave.
        if (Math.hypot(sx, sy) > AIM_DEAD) {
          aim = { angle: Math.atan2(sy, sx) };
          anyPrimary = true;
        }
      } else if (src.handedness === 'right' && !p.aim) {
        // No aiming in this game, so the right stick doubles as movement.
        addMove(codes, sx, sy, p);
      }

      if (src.handedness === 'left') addMove(codes, sx, sy, p);

      if (trigger || btnA) anyPrimary = true;
      if (grip || btnB) {
        const sec = p.buttons && p.buttons[1];
        if (sec) codes.add(sec.code);
      }
      // NOT btnA — that is the primary action a few lines below, so it
      // would restart the run on the trigger-press that ended it. Thumbstick
      // click always starts; B/Y only where it is not a bound action.
      if (pressed(gp, 3) || (btnB && !(p.buttons && p.buttons[1]))) start = true;
    }

    if (anyPrimary) {
      const prim = p.buttons && p.buttons[0];
      codes.add(prim ? prim.code : 'Space');
    }
    return { codes, aim, start };
  }

  function readControllers() {
    if (!session || typeof ArcadeControls === 'undefined') return;
    const sources = Array.from(session.inputSources || []);
    inputStatus = 'controllers ' + sources.length + ' ' +
      sources.map(s => (s.handedness || 'unknown') + (s.gamepad ? ':pad' : ':no-pad')).join(' ');
    const r = mapInput(sources, ArcadeControls.profile);
    const left = sources.find(s => s.handedness === 'left');
    const right = sources.find(s => s.handedness === 'right');
    if (pressed(left && left.gamepad, 5) && pressed(right && right.gamepad, 5)) {
      exitHold++;
      if (exitHold >= 75) {
        exitHold = 0;
        exit();
        return;
      }
    } else {
      exitHold = 0;
    }
    if (r.start) tryStart();
    ArcadeControls.setXrInput(r.codes, r.aim);
  }

  function addMove(codes, sx, sy, p) {
    if (sx < -DEAD) codes.add('ArrowLeft');
    if (sx > DEAD) codes.add('ArrowRight');
    if (p.move !== 'horizontal') {
      // Thumbstick Y is +down in xr-standard, matching screen coordinates.
      if (sy < -DEAD) codes.add('ArrowUp');
      if (sy > DEAD) codes.add('ArrowDown');
    }
  }

  function tryStart() {
    if (startCooldown > 0) return;
    if (typeof ArcadeControls !== 'undefined' && ArcadeControls.tryStart) {
      ArcadeControls.tryStart();
      startCooldown = 30;
    }
  }

  // --------------------------------------------------------------- frame
  function onXRFrame(t, frame) {
    if (!session) return;
    session.requestAnimationFrame(onXRFrame);

    xrFrames++;
    startCooldown = Math.max(0, startCooldown - 1);
    // Input must never be able to freeze the game: read it defensively, then
    // always run the loop.
    try { readControllers(); } catch (e) { lastError = e; console.error('[ArcadeVR] input:', e); }
    drainRaf(t);              // run the game's own loop → repaints gameCanvas
    drawVrHud();              // paint DOM prompts and VR status into the canvas

    let pose = null;
    try { pose = frame.getViewerPose(refSpace); } catch (e) {}
    if (!pose) return;
    try {
      const layer = session.renderState.baseLayer;
      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
      gl.clearColor(0.02, 0.01, 0.05, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(prog);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // Upload the freshly-drawn 2D canvas as this frame's texture.
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gameCanvas);

      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(loc.aPos);
      gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.enableVertexAttribArray(loc.aUV);
      gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(loc.uTex, 0);
      gl.uniformMatrix4fv(loc.uModel, false, translation(0, 0, -SCREEN_DIST));

      for (const view of pose.views) {
        const vp = layer.getViewport(view);
        gl.viewport(vp.x, vp.y, vp.width, vp.height);
        gl.uniformMatrix4fv(loc.uProj, false, view.projectionMatrix);
        gl.uniformMatrix4fv(loc.uView, false, view.transform.inverse.matrix);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    } catch (e) { lastError = e; console.error('[ArcadeVR] render:', e); }
  }

  // Paint a tiny status line onto the game canvas — the headset shows only the
  // canvas texture, so this is the one place a message is visible in VR. The
  // frame counter proves the frame loop is alive; any error text says what
  // threw. Temporary diagnostic while we chase the in-headset freeze.
  function drawVrHud() {
    if (!gameCanvas) return;
    try {
      const c = gameCanvas.getContext('2d');
      if (!c) return;
      c.save();
      c.font = 'bold 15px monospace';
      c.textBaseline = 'top';
      const tag = 'VR ' + xrFrames + '  q' + rafQueue.length + '  ' + inputStatus;
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(6, 6, c.measureText(tag).width + 14, 22);
      c.fillStyle = '#8ef0a0';
      c.fillText(tag, 13, 9);
      if (lastError) {
        const msg = 'ERR ' + String((lastError && lastError.message) || lastError).slice(0, 74);
        c.fillStyle = 'rgba(0,0,0,0.75)';
        c.fillRect(6, 30, c.measureText(msg).width + 14, 22);
        c.fillStyle = '#ff8a8a';
        c.fillText(msg, 13, 33);
      }
      drawDomOverlay(c);
      const exitText = exitHold
        ? 'EXIT VR  B + Y  ' + Math.min(100, Math.round(exitHold / 75 * 100)) + '%'
        : 'A / trigger: continue     Hold B + Y: Exit VR';
      c.font = 'bold 14px system-ui';
      c.textBaseline = 'bottom';
      const ew = c.measureText(exitText).width + 28;
      c.fillStyle = 'rgba(6,3,14,0.78)';
      c.fillRect((gameCanvas.width - ew) / 2, gameCanvas.height - 36, ew, 28);
      c.fillStyle = exitHold ? '#fca5a5' : '#d8b4fe';
      c.fillText(exitText, (gameCanvas.width - ew) / 2 + 14, gameCanvas.height - 13);
      c.restore();
    } catch (e) {}
  }

  function drawDomOverlay(c) {
    const ov = document.getElementById('startOverlay');
    if (!ov || ov.classList.contains('hidden')) return;
    const heading = ov.querySelector('h2');
    const paragraphs = Array.from(ov.querySelectorAll('p'))
      .map(p => p.textContent.trim()).filter(Boolean).slice(0, 4);
    const w = Math.min(gameCanvas.width * 0.72, 690);
    const h = 112 + paragraphs.length * 27;
    const x = (gameCanvas.width - w) / 2;
    const y = (gameCanvas.height - h) / 2;
    c.fillStyle = 'rgba(7,3,17,0.92)';
    c.strokeStyle = '#a855f7';
    c.lineWidth = 3;
    c.fillRect(x, y, w, h);
    c.strokeRect(x, y, w, h);
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillStyle = '#f0abfc';
    c.font = 'bold 30px system-ui';
    c.fillText((heading && heading.textContent.trim()) || 'READY?', gameCanvas.width / 2, y + 22);
    c.font = '16px system-ui';
    c.fillStyle = '#e9d5ff';
    paragraphs.forEach((line, i) => {
      c.fillText(line.replace(/\s+/g, ' ').slice(0, 80), gameCanvas.width / 2, y + 66 + i * 24);
    });
    c.font = 'bold 17px system-ui';
    c.fillStyle = '#d9ff63';
    c.fillText('Press A or trigger to continue', gameCanvas.width / 2, y + h - 31);
    c.textAlign = 'left';
  }

  // ------------------------------------------------------------ lifecycle
  async function enter() {
    if (session || !navigator.xr) return;
    try {
      const s = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor']
      });
      session = s;

      glCanvas = document.createElement('canvas');
      gl = glCanvas.getContext('webgl', { xrCompatible: true, alpha: false });
      if (!gl) throw new Error('no webgl');
      if (gl.makeXRCompatible) await gl.makeXRCompatible();
      buildGL();

      s.updateRenderState({ baseLayer: new XRWebGLLayer(s, gl) });
      try { refSpace = await s.requestReferenceSpace('local'); }
      catch (e) { refSpace = await s.requestReferenceSpace('viewer'); }

      s.addEventListener('end', onSessionEnd);
      s.addEventListener('selectstart', () => {
        if (typeof ArcadeAudio !== 'undefined') ArcadeAudio.resume();
      });
      setRafMode('xr');        // the XR frame now pumps the game loop
      exitHold = 0;
      setBtn(true);
      s.requestAnimationFrame(onXRFrame);
    } catch (err) {
      console.error('[ArcadeVR] could not enter VR:', err);
      lastError = err;
      session = null;
      setRafMode('flat');      // hand the loop back to the real clock
      setBtn(false);
    }
  }

  function exit() { if (session) session.end(); }

  function onSessionEnd() {
    session = null;
    refSpace = null;
    setRafMode('flat');        // resume the real-clock driver for flat play
    if (typeof ArcadeControls !== 'undefined') ArcadeControls.setXrInput(new Set(), null);
    gl = null;
    glCanvas = null;
    setBtn(false);
  }

  function setBtn(inVR) {
    const b = document.getElementById('ac-vr');
    if (!b) return;
    b.textContent = inVR ? '⏏' : 'VR';
    b.title = inVR ? 'Exit VR' : 'Play in VR on your headset';
    b.classList.toggle('active', inVR);
  }

  // --------------------------------------------------------------- init
  async function init(canvas) {
    // Attract-mode cabinet previews get no VR button (and skip the XR probe).
    // The rAF router still runs so the attract loop animates; only the UI is
    // suppressed — matching arcade-controls.js.
    if (/[?&]attract\b/.test(location.search)) return;
    gameCanvas = canvas || document.getElementById('gameCanvas');
    if (!gameCanvas || !navigator.xr || !navigator.xr.isSessionSupported) return;
    try {
      supported = await navigator.xr.isSessionSupported('immersive-vr');
    } catch (e) { supported = false; }
    if (!supported) return;   // no headset → no button, nothing changes

    const bar = document.querySelector('.ac-bar');
    if (!bar) return;
    const btn = document.createElement('button');
    btn.className = 'ac-chip';
    btn.id = 'ac-vr';
    btn.textContent = 'VR';
    btn.title = 'Play in VR on your headset';
    btn.addEventListener('click', () => (session ? exit() : enter()));
    bar.insertBefore(btn, bar.firstChild);
  }

  window.addEventListener('DOMContentLoaded', () => {
    // arcade-controls.js builds .ac-bar during its own init, which runs from
    // the inline script after game.js — so wait a tick for the bar to exist.
    setTimeout(() => init(), 0);
  });

  // Read-only-ish hook for diagnosing the loop in-headset (and for tests):
  // mode + queue depth, plus manual mode/pump control.
  api._raf = {
    get mode() { return rafMode; },
    get queueLen() { return rafQueue.length; },
    setMode: setRafMode,
    pump: drainRaf
  };

  return api;
})();
