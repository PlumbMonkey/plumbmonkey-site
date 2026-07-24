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

  // rAF shim state — see installRafShim().
  let realRaf = null, realCancel = null, rafQueue = [], rafId = 1;

  const api = { init, enter, exit, mapInput,
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

  // ------------------------------------------------------------- rAF shim
  // Every game drives itself with window.requestAnimationFrame. Inside an
  // immersive session the page's rAF is throttled or paused, so the games
  // would crawl. Redirecting it through the XR frame callback runs all eight
  // at headset framerate without touching a single game.js — and it is fully
  // reverted on exit, so a normal page load never sees it.
  function installRafShim() {
    if (realRaf) return;
    realRaf = window.requestAnimationFrame.bind(window);
    realCancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      const id = rafId++;
      rafQueue.push({ id, cb });
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      rafQueue = rafQueue.filter((q) => q.id !== id);
    };
  }

  function removeRafShim() {
    if (!realRaf) return;
    window.requestAnimationFrame = realRaf;
    window.cancelAnimationFrame = realCancel;
    realRaf = realCancel = null;
    // Hand any still-pending callbacks back to the real clock, or the game
    // loop would be left dangling with nothing scheduled to resume it.
    const pending = rafQueue;
    rafQueue = [];
    pending.forEach((q) => window.requestAnimationFrame(q.cb));
  }

  function flushRaf(t) {
    const batch = rafQueue;
    rafQueue = [];
    for (const q of batch) {
      try { q.cb(t); } catch (e) { console.error('[ArcadeVR] frame:', e); }
    }
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
      if (pressed(gp, 3) || btnA) start = true;
    }

    if (anyPrimary) {
      const prim = p.buttons && p.buttons[0];
      codes.add(prim ? prim.code : 'Space');
    }
    return { codes, aim, start };
  }

  function readControllers() {
    if (!session || typeof ArcadeControls === 'undefined') return;
    const r = mapInput(session.inputSources, ArcadeControls.profile);
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

    startCooldown = Math.max(0, startCooldown - 1);
    readControllers();
    flushRaf(t);              // run the game's own loop → repaints gameCanvas

    const pose = frame.getViewerPose(refSpace);
    if (!pose) return;
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
      installRafShim();
      setBtn(true);
      s.requestAnimationFrame(onXRFrame);
    } catch (err) {
      console.error('[ArcadeVR] could not enter VR:', err);
      session = null;
      removeRafShim();
      setBtn(false);
    }
  }

  function exit() { if (session) session.end(); }

  function onSessionEnd() {
    session = null;
    refSpace = null;
    removeRafShim();
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

  return api;
})();
