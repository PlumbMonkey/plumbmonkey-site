// ---------------------------------------------------------------------------
// Spectral Manor Arcade — VR / gamepad / pointer control layer
//
// Every game in the arcade reads a plain `keys[code]` object (and two of them
// also read a `mouse` object). That shared surface lets this module add whole
// new input devices without touching a line of game logic: it just writes the
// same keys the keyboard would.
//
// It exists because of how the Meta Quest browser actually works. Flat 2D web
// content there has two very different input paths:
//
//   1. A paired Bluetooth gamepad — exposed through the standard Gamepad API.
//      The best experience, and the one Quest users are told to use for flat
//      games. (Bonus: this also gives desktop players controller support.)
//   2. The Touch controllers / hand tracking with NO gamepad — these act as a
//      laser pointer and emit POINTER events, never touch events. So the
//      touch pads in touch-controls.js are invisible to them, and the six
//      keyboard-only games are unplayable without this module's on-screen
//      buttons.
//
// Both paths feed one virtual-key layer, so a game can be driven by keyboard,
// gamepad, laser pointer, finger or mouse interchangeably.
//
// Usage — one script tag, then one init call AFTER game.js (an inline classic
// script can see game.js's top-level `let keys`, so the games need no edits):
//
//   <script src="../arcade-controls.js"></script>
//   <script src="game.js"></script>
//   <script>ArcadeControls.init(keys, { move: 'full', buttons: [...] });</script>
//
// Twin-stick games additionally call ArcadeControls.applyAim(mouse, cx, cy)
// once per frame to get right-stick aiming.
// ---------------------------------------------------------------------------

const ArcadeControls = (function () {
  const mq = q => !!(window.matchMedia && window.matchMedia(q).matches);
  const UA = navigator.userAgent || '';

  // Quest / Meta browser. Its UA carries "OculusBrowser"; Quest 2 and 3 also
  // report the model. navigator.xr is a secondary hint (a headset browser),
  // but on its own it is NOT proof — desktop Chrome exposes navigator.xr too,
  // so it only counts alongside the UA.
  const isQuest = /OculusBrowser|Quest/i.test(UA);
  const isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const isCoarse = isTouch && mq('(pointer: coarse)') && !mq('(any-pointer: fine)');

  // Attract-mode cabinet previews (?attract=1) are tiny, non-interactive
  // iframes on the arcade landing page — they must show only clean gameplay.
  // leaderboard.js already strips the game's own chrome there; this module
  // must likewise not add its control bar or on-screen pad on top.
  const isAttract = /[?&]attract\b/.test(location.search);

  // Deadzones: generous for digital conversion (a resting thumb must not walk
  // the player), tighter for aiming where small deflections are meaningful.
  const MOVE_DEAD = 0.35;
  const AIM_DEAD = 0.22;
  const AIM_REACH = 320;   // how far ahead the virtual cursor is projected

  const api = {
    isQuest, isTouch,
    gamepadConnected: false,
    aimActive: false,
    aimAngle: 0,
    init, applyAim, setPadVisible, setXrInput, tryStart,
    get profile() { return opts; }
  };

  let keys = null;
  let opts = {};
  let padKeys = new Set();      // codes held by the gamepad this frame
  let screenKeys = new Set();   // codes held by on-screen buttons
  let xrKeys = new Set();       // codes held by Quest Touch controllers (vr-mode.js)
  let xrAim = null;             // {angle} while the XR right thumbstick is deflected
  let ownedKeys = new Set();    // what WE set last frame, so we only clear our own
  let started = false;
  let autoFire = false;

  // ---------------------------------------------------------------------
  function init(keysRef, options) {
    if (started) return api;
    started = true;
    keys = keysRef || {};
    opts = options || {};
    opts.accent = opts.accent || '#c084fc';
    opts.move = opts.move || 'full';
    opts.buttons = opts.buttons || [];

    // Preview iframe: build no chrome, no pad, no polling. The API stays live
    // as no-ops (applyAim/setXrInput do nothing), so the games' per-frame calls
    // are harmless and the cabinet shows only the attract gameplay.
    if (isAttract) return api;

    injectStyles();
    buildChrome();
    buildPad();

    // Show the on-screen pad wherever a keyboard is unlikely: phones/tablets
    // and the Quest browser. Desktop keeps a clean screen but can summon it
    // from the toggle. Games that already ship their own touch controls pass
    // autoPad:'quest' so the two control sets never stack on a phone.
    const autoPad = opts.autoPad || 'auto';
    setPadVisible(autoPad === 'never' ? false
      : autoPad === 'quest' ? isQuest
      : (isCoarse || isQuest));

    window.addEventListener('gamepadconnected', onGamepadChange);
    window.addEventListener('gamepaddisconnected', onGamepadChange);

    requestAnimationFrame(poll);
    return api;
  }

  // ---------------------------------------------------------------------
  // Virtual key layer. Gamepad state is polled and on-screen buttons are
  // event-driven, so both are merged here each frame. We only ever clear a
  // key WE set — otherwise a virtual release would cancel a real keypress.
  function applyKeys() {
    const desired = new Set();
    padKeys.forEach(c => desired.add(c));
    screenKeys.forEach(c => desired.add(c));
    xrKeys.forEach(c => desired.add(c));
    // Auto-fire holds the primary action down. The Quest browser generally
    // gives you ONE laser cursor, so without this you cannot press a movement
    // button and the fire button at the same time in any of the shooters.
    if (autoFire && opts.buttons[0]) desired.add(opts.buttons[0].code);
    ownedKeys.forEach(c => { if (!desired.has(c)) keys[c] = false; });
    desired.forEach(c => { keys[c] = true; });
    ownedKeys = desired;
  }

  // ---------------------------------------------------------------------
  // Gamepad — standard mapping. Left stick / D-pad drive movement, face
  // buttons and triggers drive the game's action keys, right stick aims.
  function activePad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) return pads[i];
    }
    return null;
  }

  function onGamepadChange() {
    const pad = activePad();
    api.gamepadConnected = !!pad;
    const el = document.getElementById('ac-gamepad');
    if (el) {
      el.style.display = pad ? 'inline-flex' : 'none';
      el.title = pad ? pad.id : '';
    }
    // A controller makes the on-screen pad redundant on desktop, but on Quest
    // and phones we leave it — players there mix laser/touch with the pad.
    if (pad && !isCoarse && !isQuest) setPadVisible(false);
  }

  const pressed = (pad, i) => !!(pad.buttons[i] && pad.buttons[i].pressed);

  function pollGamepad() {
    const pad = activePad();
    if (!!pad !== api.gamepadConnected) onGamepadChange();
    padKeys.clear();
    if (!pad) { api.aimActive = false; return; }

    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;

    // Movement: stick or D-pad, whichever is deflected.
    if (ax < -MOVE_DEAD || pressed(pad, 14)) padKeys.add('ArrowLeft');
    if (ax > MOVE_DEAD || pressed(pad, 15)) padKeys.add('ArrowRight');
    if (opts.move !== 'horizontal') {
      if (ay < -MOVE_DEAD || pressed(pad, 12)) padKeys.add('ArrowUp');
      if (ay > MOVE_DEAD || pressed(pad, 13)) padKeys.add('ArrowDown');
    }

    // Action buttons. The profile's first button is the primary (A / right
    // trigger / right bumper); any second button binds to B / left trigger.
    const prim = opts.buttons[0], sec = opts.buttons[1];
    if (prim && (pressed(pad, 0) || pressed(pad, 7) || pressed(pad, 5))) padKeys.add(prim.code);
    if (sec && (pressed(pad, 1) || pressed(pad, 6) || pressed(pad, 4))) padKeys.add(sec.code);
    // Games where the profile has no buttons still map A to Space — harmless
    // for the ones that ignore it, and it saves a bespoke profile.
    if (!prim && (pressed(pad, 0) || pressed(pad, 7))) padKeys.add('Space');

    // Right stick aims (twin-stick games). Deflecting it also auto-fires, to
    // match how the on-screen twin-stick pads already behave.
    if (opts.aim) {
      const rx = pad.axes[2] || 0, ry = pad.axes[3] || 0;
      if (Math.hypot(rx, ry) > AIM_DEAD) {
        api.aimAngle = Math.atan2(ry, rx);
        api.aimActive = true;
      } else {
        api.aimActive = false;
      }
    }

    // Start / A on the start screen begins the game, so a controller alone is
    // enough to play. We click the overlay rather than faking a key, because
    // that is the path every game already wires up (and it inits audio).
    if (pressed(pad, 9) || pressed(pad, 0)) tryStart();
  }

  let startCooldown = 0;
  function tryStart() {
    if (startCooldown > 0) return;
    const ov = document.getElementById('startOverlay');
    if (ov && !ov.classList.contains('hidden')) {
      ov.click();
      startCooldown = 30;
    }
  }

  // Project a virtual cursor along the aim direction into the game's own
  // `mouse` object — every existing mouse-based line keeps working untouched.
  // Returns true when the gamepad actually drove the aim this frame, so the
  // caller can fall back to its touch pad or the real mouse.
  function applyAim(mouse, cx, cy) {
    if (!opts.aim || !api.aimActive) return false;
    mouse.x = cx + Math.cos(api.aimAngle) * AIM_REACH;
    mouse.y = cy + Math.sin(api.aimAngle) * AIM_REACH;
    mouse.down = true;
    return true;
  }

  // Quest Touch controllers can only be read inside a WebXR session, so
  // vr-mode.js pushes their state in here rather than writing keys[] itself.
  // Routing it through this same merge is what keeps a VR release from
  // cancelling a key the keyboard or an Xbox pad is genuinely holding.
  function setXrInput(codes, aim) {
    xrKeys = codes || new Set();
    xrAim = aim || null;
  }

  function poll() {
    if (startCooldown > 0) startCooldown--;
    pollGamepad();
    // XR aim wins over the flat gamepad — pollGamepad clears aimActive when no
    // Bluetooth pad is present, which would otherwise wipe the Touch stick.
    if (xrAim) { api.aimActive = true; api.aimAngle = xrAim.angle; }
    applyKeys();
    requestAnimationFrame(poll);
  }

  // ---------------------------------------------------------------------
  // On-screen controls. Pointer events (not touch) so the Quest laser and
  // hand-tracking pinch drive them, as do finger and mouse.
  function bindHold(el, code) {
    const down = e => {
      e.preventDefault();
      e.stopPropagation();
      screenKeys.add(code);
      el.classList.add('down');
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      tryStart();
    };
    const up = e => {
      e.preventDefault();
      screenKeys.delete(code);
      el.classList.remove('down');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    // Capture normally keeps the release on this element, but if it was
    // refused the key would stick down forever — leaving is a release too.
    el.addEventListener('pointerleave', up);
  }

  function buildPad() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas || !canvas.parentElement) return;
    const host = document.createElement('div');
    host.className = 'ac-pad';
    host.id = 'ac-pad';

    // --- movement cluster (left) ---
    const dpad = document.createElement('div');
    dpad.className = 'ac-dpad' + (opts.move === 'horizontal' ? ' horizontal' : '');
    const mk = (code, glyph, cls) => {
      const b = document.createElement('button');
      b.className = 'ac-btn ac-dir ' + cls;
      b.textContent = glyph;
      b.setAttribute('aria-label', code);
      bindHold(b, code);
      return b;
    };
    if (opts.move === 'horizontal') {
      dpad.appendChild(mk('ArrowLeft', '◀', 'l'));
      dpad.appendChild(mk('ArrowRight', '▶', 'r'));
    } else {
      dpad.appendChild(mk('ArrowUp', '▲', 'u'));
      dpad.appendChild(mk('ArrowLeft', '◀', 'l'));
      dpad.appendChild(mk('ArrowRight', '▶', 'r'));
      dpad.appendChild(mk('ArrowDown', '▼', 'd'));
    }
    host.appendChild(dpad);

    // --- action cluster (right) ---
    const acts = document.createElement('div');
    acts.className = 'ac-actions';
    opts.buttons.forEach(cfg => {
      const b = document.createElement('button');
      b.className = 'ac-btn ac-act';
      b.textContent = cfg.label;
      if (cfg.accent) b.style.borderColor = cfg.accent;
      bindHold(b, cfg.code);
      acts.appendChild(b);
    });
    host.appendChild(acts);

    canvas.parentElement.appendChild(host);
  }

  function setPadVisible(on) {
    const el = document.getElementById('ac-pad');
    if (el) el.classList.toggle('show', !!on);
    const t = document.getElementById('ac-padtoggle');
    if (t) t.classList.toggle('active', !!on);
  }

  // ---------------------------------------------------------------------
  // Chrome: fullscreen, pad toggle, controller indicator.
  function buildChrome() {
    const bar = document.createElement('div');
    bar.className = 'ac-bar';

    const fs = document.createElement('button');
    fs.className = 'ac-chip';
    fs.id = 'ac-fullscreen';
    fs.textContent = '⛶';
    // Fullscreen is the single biggest comfort win in a headset: it fills the
    // browser panel instead of floating a small canvas in a big dark page.
    fs.title = 'Fullscreen';
    fs.addEventListener('click', toggleFullscreen);
    bar.appendChild(fs);

    const pt = document.createElement('button');
    pt.className = 'ac-chip';
    pt.id = 'ac-padtoggle';
    pt.textContent = '⊞';
    pt.title = 'Show / hide on-screen controls';
    pt.addEventListener('click', () => {
      const el = document.getElementById('ac-pad');
      setPadVisible(!(el && el.classList.contains('show')));
    });
    bar.appendChild(pt);

    // Only offer auto-fire where there IS an action to repeat.
    if (opts.buttons[0]) {
      const af = document.createElement('button');
      af.className = 'ac-chip';
      af.id = 'ac-autofire';
      af.textContent = '⟳';
      af.title = 'Auto-fire — holds ' + opts.buttons[0].label +
        ' down so you can move at the same time with a single VR pointer';
      af.addEventListener('click', () => {
        autoFire = !autoFire;
        af.classList.toggle('active', autoFire);
      });
      bar.appendChild(af);
    }

    const gp = document.createElement('span');
    gp.className = 'ac-chip ac-gp';
    gp.id = 'ac-gamepad';
    gp.textContent = '🎮';
    gp.style.display = 'none';
    bar.appendChild(gp);

    document.body.appendChild(bar);
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el);
    }
  }

  // ---------------------------------------------------------------------
  function injectStyles() {
    const css = `
      .ac-bar { position: fixed; top: 8px; right: 8px; z-index: 40;
        display: flex; gap: 6px; }
      .ac-chip { font: 600 15px/1 'Segoe UI', system-ui, sans-serif;
        color: #d8d2cc; background: rgba(12,10,22,.82);
        border: 1px solid rgba(160,150,200,.4); border-radius: 8px;
        padding: 8px 10px; cursor: pointer; min-width: 38px; min-height: 34px;
        display: inline-flex; align-items: center; justify-content: center; }
      .ac-chip:hover { color: #fff; border-color: ${opts.accent}; }
      .ac-chip.active { border-color: ${opts.accent};
        box-shadow: 0 0 10px ${opts.accent}66; }
      .ac-gp { cursor: default; }

      /* On-screen pad — hidden until asked for. pointer-events only on the
         buttons so the canvas underneath still takes clicks. */
      .ac-pad { position: absolute; inset: 0; z-index: 6; display: none;
        pointer-events: none; }
      .ac-pad.show { display: block; }
      .ac-btn { pointer-events: auto; font: 700 20px/1 'Segoe UI', system-ui, sans-serif;
        color: #e9e4ff; background: rgba(18,14,32,.5);
        border: 2px solid rgba(190,170,255,.55); border-radius: 12px;
        cursor: pointer; touch-action: none; user-select: none;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(2px); transition: background .08s, transform .08s; }
      .ac-btn.down { background: ${opts.accent}; color: #14091f; transform: scale(.94); }

      /* Targets are deliberately large: a Quest laser at arm's length is far
         less precise than a mouse, and this doubles as the phone layout. */
      .ac-dpad { position: absolute; left: 14px; bottom: 14px;
        display: grid; grid-template-columns: repeat(3, 62px);
        grid-template-rows: repeat(3, 62px); gap: 5px; }
      .ac-dpad .ac-dir { width: 62px; height: 62px; }
      .ac-dpad .u { grid-area: 1 / 2; }
      .ac-dpad .l { grid-area: 2 / 1; }
      .ac-dpad .r { grid-area: 2 / 3; }
      .ac-dpad .d { grid-area: 3 / 2; }
      .ac-dpad.horizontal { grid-template-columns: repeat(2, 72px);
        grid-template-rows: 72px; }
      .ac-dpad.horizontal .ac-dir { width: 72px; height: 72px; }
      .ac-dpad.horizontal .l, .ac-dpad.horizontal .r { grid-area: auto; }

      .ac-actions { position: absolute; right: 14px; bottom: 14px;
        display: flex; align-items: flex-end; gap: 10px; }
      .ac-act { min-width: 84px; height: 76px; border-radius: 40px;
        font-size: 13px; letter-spacing: 1px; padding: 0 12px; }

      /* Fullscreen: scale the canvas up to fill the panel. Without this the
         canvas keeps its 960px intrinsic width and fullscreen gains nothing. */
      :fullscreen #gameCanvas, :-webkit-full-screen #gameCanvas {
        height: 84vh; width: auto; max-width: 100vw; }
      :fullscreen h1, :fullscreen .subtitle, :fullscreen .controls,
      :fullscreen .footer { display: none; }

      /* Headset-only comfort tweaks. The 1px CRT scanlines alias into moiré
         shimmer through the optics, and small HUD text is unreadable at the
         distance the browser panel sits — so both are adjusted, but ONLY in
         the Quest browser. Desktop and phone are untouched. */
      html.ac-vr .crt-overlay { display: none; }
      html.ac-vr .hud { font-size: 1.15rem; gap: 1.9rem; }
      html.ac-vr .controls { font-size: .95rem; color: #c7c2d8; }
      html.ac-vr h1 { font-size: 1.9rem; }
      html.ac-vr .start-overlay h2 { font-size: 2.5rem; }
      html.ac-vr .start-overlay p { font-size: 1.15rem; }
      html.ac-vr #gameCanvas { border-width: 3px; }

      @media (max-width: 720px) {
        .ac-dpad { grid-template-columns: repeat(3, 54px); grid-template-rows: repeat(3, 54px); }
        .ac-dpad .ac-dir { width: 54px; height: 54px; }
        .ac-act { min-width: 70px; height: 66px; font-size: 12px; }
      }
    `;
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
    if (isQuest) document.documentElement.classList.add('ac-vr');
  }

  return api;
})();
