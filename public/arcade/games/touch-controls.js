// ---------------------------------------------------------------------------
// Spectral Manor Arcade — shared twin-stick touch controls
//
// Twin-stick games (Swarm, Mess Hall) aim with atan2(mouse - player), which is
// unplayable on a phone: your finger has to sit on top of the thing you want to
// shoot. This module gives each canvas two floating analog sticks —
//   left  half : move
//   right half : aim + auto-fire
// — and feeds the result back through the SAME `mouse` object the games already
// read, so game logic barely changes.
//
// Aim is a DIRECTION relative to where the thumb touched down, not an absolute
// point, so the aiming hand can live in a corner and stay out of the action.
//
// Usage (see Swarm and Mess Hall):
//   TouchPad.init(canvas, { onStart, targets: () => monsters });
//   TouchPad.sync(mouse, playerCx, playerCy);   // once per update()
//   if (TouchPad.moveActive) { vx = TouchPad.mx * speed; ... }
//   TouchPad.draw(ctx);                          // end of draw()
// On mouse/keyboard machines every call is a no-op.
// ---------------------------------------------------------------------------

const TouchPad = (function () {
  const mq = q => !!(window.matchMedia && window.matchMedia(q).matches);

  // Two separate questions. A touchscreen laptop can drive the sticks, but it
  // must keep the desktop layout — hiding its HUD would be a downgrade.
  const isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const isPhone = isTouch && mq('(pointer: coarse)') && !mq('(any-pointer: fine)');

  // Canvas-space geometry (canvas is 960x540, scaled to fit the screen)
  const RADIUS    = 92;   // full-tilt travel from the stick origin
  const DEAD      = 13;   // ignore micro-drift so a resting thumb doesn't creep
  const ASSIST    = 0.20; // rad — snap aim to a target within ~11 degrees
  const AIM_REACH = 320;  // how far ahead the virtual "mouse" point is projected

  const api = {
    enabled: isTouch,
    phoneLayout: isPhone,
    moveActive: false,   // left stick held
    firing: false,       // right stick held
    mx: 0, my: 0,        // analog move vector, magnitude 0..1
    aimAngle: 0,         // persists after release so aim never snaps back
    init, sync, draw
  };

  if (!isTouch) {
    // Desktop: hand back a fully inert object.
    api.sync = function () {};
    api.draw = function () {};
    api.init = function () {};
    return api;
  }

  let canvas = null, W = 960, H = 540;
  let opts = {};
  let hintTime = isPhone ? 420 : 0;  // frames of on-canvas hint, until first touch
  const move = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const aim  = { id: null, ox: 0, oy: 0, x: 0, y: 0 };

  function toCanvas(t) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (t.clientX - r.left) * (W / r.width),
      y: (t.clientY - r.top) * (H / r.height)
    };
  }

  function init(cv, o) {
    canvas = cv;
    opts = o || {};
    W = canvas.width;
    H = canvas.height;
    document.documentElement.classList.add('touch-mode');
    if (isPhone) document.documentElement.classList.add('touch-layout');
    injectStyles();

    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });
    canvas.addEventListener('touchcancel', onEnd, { passive: false });
  }

  function onStart(e) {
    e.preventDefault();
    if (hintTime > 0) hintTime = 0;
    if (opts.onStart) opts.onStart();

    for (const t of e.changedTouches) {
      const p = toCanvas(t);
      // Side picks the stick, but a free stick always wins over a busy one —
      // that keeps it usable left-handed and forgiving of sloppy thumb placement.
      let stick = p.x < W / 2 ? move : aim;
      if (stick.id !== null) stick = (stick === move) ? aim : move;
      if (stick.id !== null) continue;
      stick.id = t.identifier;
      stick.ox = p.x; stick.oy = p.y;
      stick.x = p.x;  stick.y = p.y;
    }
    refresh();
  }

  function onMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const s = t.identifier === move.id ? move : (t.identifier === aim.id ? aim : null);
      if (!s) continue;
      const p = toCanvas(t);
      s.x = p.x; s.y = p.y;
      // Drag past full tilt and the origin trails the thumb, so the stick can
      // never end up pinned against a screen edge mid-fight.
      const dx = s.x - s.ox, dy = s.y - s.oy;
      const d = Math.hypot(dx, dy);
      if (d > RADIUS) {
        s.ox = s.x - (dx / d) * RADIUS;
        s.oy = s.y - (dy / d) * RADIUS;
      }
    }
    refresh();
  }

  function onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === move.id) move.id = null;
      if (t.identifier === aim.id) aim.id = null;
    }
    refresh();
  }

  function refresh() {
    api.moveActive = move.id !== null;
    api.firing = aim.id !== null;

    if (api.moveActive) {
      const dx = move.x - move.ox, dy = move.y - move.oy;
      const d = Math.hypot(dx, dy);
      if (d < DEAD) { api.mx = 0; api.my = 0; }
      else {
        const mag = Math.min(1, (d - DEAD) / (RADIUS - DEAD));
        api.mx = (dx / d) * mag;
        api.my = (dy / d) * mag;
      }
    } else { api.mx = 0; api.my = 0; }

    if (api.firing) {
      const dx = aim.x - aim.ox, dy = aim.y - aim.oy;
      if (Math.hypot(dx, dy) > DEAD) api.aimAngle = Math.atan2(dy, dx);
    }
  }

  // Nudge the aim onto a nearby target — on a 5-inch screen the difference
  // between fun and hopeless. Touch-only, so it never touches mouse play.
  function assist(cx, cy) {
    if (!opts.targets) return api.aimAngle;
    let list;
    try { list = opts.targets(); } catch (err) { return api.aimAngle; }
    if (!list || !list.length) return api.aimAngle;

    let bestAng = api.aimAngle, bestDiff = ASSIST;
    for (const t of list) {
      const tx = t.x + (t.w || 0) / 2;
      const ty = t.y + (t.h || 0) / 2;
      const ang = Math.atan2(ty - cy, tx - cx);
      let diff = Math.abs(((ang - api.aimAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < bestDiff) { bestDiff = diff; bestAng = ang; }
    }
    return bestAng;
  }

  // Project a virtual cursor out along the aim direction and drop it into the
  // game's existing `mouse` object — every mouse-based line keeps working.
  function sync(mouse, cx, cy) {
    if (hintTime > 0) hintTime--;
    const ang = api.firing ? assist(cx, cy) : api.aimAngle;
    mouse.x = cx + Math.cos(ang) * AIM_REACH;
    mouse.y = cy + Math.sin(ang) * AIM_REACH;
    mouse.down = api.firing;
  }

  function drawStick(ctx, s, color) {
    if (s.id === null) return;
    const dx = s.x - s.ox, dy = s.y - s.oy;
    const d = Math.hypot(dx, dy);
    const nx = d > RADIUS ? s.ox + (dx / d) * RADIUS : s.x;
    const ny = d > RADIUS ? s.oy + (dy / d) * RADIUS : s.y;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(nx, ny, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw(ctx) {
    const accent = opts.accent || '#c084fc';
    drawStick(ctx, move, accent);
    drawStick(ctx, aim, opts.aimAccent || '#f0abfc');

    if (hintTime > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.55, hintTime / 90);
      ctx.fillStyle = '#e0d4ff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('DRAG TO MOVE', W * 0.25, H - 40);
      ctx.fillText('DRAG TO AIM & FIRE', W * 0.75, H - 40);
      ctx.restore();
    }
  }

  // --- Mobile layout: give the arena every pixel it can have ----------------
  // Chrome on the title/subtitle/keyboard-legend goes away, the canvas fills the
  // viewport at its native 16:9, and the HUD floats on top of it instead of
  // stealing vertical space underneath.
  function injectStyles() {
    const css = `
      /* Any touch-capable device: a drag on the arena must not scroll the page */
      html.touch-mode #gameCanvas { touch-action: none; }

      /* Phones only — the desktop/laptop layout is left completely alone */
      html.touch-layout, html.touch-layout body {
        touch-action: none;
        overscroll-behavior: none;
        overflow: hidden;
        height: 100%;
      }
      html.touch-layout body { justify-content: center; padding: 0; }
      html.touch-layout h1,
      html.touch-layout .subtitle,
      html.touch-layout .controls { display: none !important; }
      html.touch-layout #gameCanvas {
        display: block;          /* kill the inline-descender gap that offsets centring */
        width: 100vw;
        height: auto;
        max-width: 100vw;
        max-height: 100vh;
        border: none;
        box-shadow: none;
      }
      @media (orientation: landscape) {
        html.touch-layout #gameCanvas { width: auto; height: 100vh; }
      }
      html.touch-layout .hud {
        position: fixed;
        top: 0; left: 0; right: 0;
        margin: 0;
        padding: 3px 6px;
        gap: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
        font-size: 0.62rem;
        background: rgba(7, 4, 15, 0.55);
        pointer-events: none;
        z-index: 6;
      }
      html.touch-layout .start-overlay p { font-size: 0.85rem; padding: 0 1rem; text-align: center; }
      html.touch-layout .kbd-only { display: none !important; }
      html.touch-layout .touch-only { display: block !important; }
      html.touch-layout .rotate-nudge {
        position: fixed;
        inset: 0;
        z-index: 20;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        background: rgba(7, 4, 15, 0.94);
        color: #d8b4fe;
        font-size: 1rem;
        text-align: center;
        padding: 2rem;
      }
      @media (orientation: portrait) {
        html.touch-layout .rotate-nudge { display: flex; }
      }
    `;
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);

    // Portrait is hopeless for a 16:9 arena — nudge, but let it be dismissed
    // in case the player has rotation locked.
    const nudge = document.createElement('div');
    nudge.className = 'rotate-nudge';
    nudge.innerHTML =
      '<div style="font-size:2.2rem">↻</div>' +
      '<div>Rotate your device sideways<br>for the full arena</div>' +
      '<div style="opacity:0.6;font-size:0.8rem;margin-top:0.4rem">tap to play anyway</div>';
    nudge.addEventListener('touchstart', function (e) {
      e.preventDefault();
      nudge.style.display = 'none';
    }, { passive: false });
    document.body.appendChild(nudge);
  }

  return api;
})();
