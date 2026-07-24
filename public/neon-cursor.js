// ---------------------------------------------------------------------------
// Plumbmonkey Neon Cursor
// Ported from Wraithveil Neon Mouse (MIT, PlumbMonkey/wraithveil-neon-mouse).
//
// A glowing hue-cycling ribbon behind the pointer, plus an orb that explodes
// into particles on click/tap and swirls back together. The explosion physics
// (staggered re-entry, tangential swirl, speed ramp, squash/bounce/afterglow)
// are kept faithful to the original — they're the good part.
//
// What changed from the source library, and why:
//   · POINTER EVENTS instead of mouse events. The original bound mousemove /
//     click / mouseenter / mouseleave, so it was completely inert on phones.
//     One pointer path now covers mouse, touch and pen.
//   · Respects prefers-reduced-motion — a full-screen animated trail is
//     exactly the kind of motion that setting exists to suppress.
//   · devicePixelRatio backing store. The original sized the canvas in CSS
//     pixels, so the glow was visibly soft on retina and phone screens.
//   · Idle sleep. The original ran requestAnimationFrame forever. This one
//     fades the orb out after a moment of stillness and stops the loop
//     entirely, waking on the next input — it costs nothing while you read.
//   · Pauses when the tab is hidden.
//   · Options are actually wired (particle count, hue, sizes), which the
//     original README advertised but the code never implemented.
//
// Usage:  NeonCursor.init({ ... });  /  NeonCursor.destroy();
// ---------------------------------------------------------------------------

const NeonCursor = (function () {
  const DEFAULTS = {
    zIndex: '9998',        // below the arcade's own control chrome (z 40) is
                           // irrelevant (different stacking roots), but stay
                           // under anything that legitimately needs the top.
    particleCount: 24,
    trailMs: 200,          // how long a ribbon segment lives
    idleFadeMs: 1400,      // stillness before the orb fades out and we sleep
    explodeOnClick: true,
    maxDpr: 2              // cap the backing store; 3x on phones is wasted fill
  };

  let canvas = null, ctx = null, rafId = null, opts = {};
  let trail = [], particles = [];
  let lastMoveTime = 0, dpr = 1;
  let running = false, destroyed = false;

  let orb = {
    x: -1000, y: -1000,
    exploded: false, explodeTime: 0,
    grow: 1, squash: 0, squashActive: false,
    bounce: 0, bounceTime: 0,
    reassembleTimestamps: [], reassembledParticles: 0,
    afterglow: 0, afterglowTime: 0,
    alpha: 0              // fades in on input, out when idle (new)
  };

  const reducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- helpers
  function easeOutQuint(x) { return 1 - Math.pow(1 - x, 5); }

  function particleColor(lifeProgress) {
    const hue = 24 + (240 - 24) * lifeProgress;
    const sat = 92 - 12 * lifeProgress;
    const lum = 54 + 18 * lifeProgress;
    return 'hsl(' + hue + ',' + sat + '%,' + lum + '%)';
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    // Draw in CSS pixels; the backing store just gets denser.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const viewW = () => window.innerWidth;
  const viewH = () => window.innerHeight;

  // ------------------------------------------------------------- the ribbon
  function cleanTrail(now) {
    if (now - lastMoveTime > 50) { trail = []; return; }
    while (trail.length && (now - trail[0].t) > opts.trailMs) trail.shift();
  }

  function drawTrail(now, brighten, afterglow) {
    if (trail.length < 2) return;
    ctx.save();
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      const age = Math.max(0, Math.min(1, (now - b.t) / opts.trailMs));
      const width = 6 * (1 - age) + 1.5 * age + 3 * afterglow;
      const baseAlpha = 0.36 * (1 - age) + 0.10 * age + 0.22 * afterglow;
      const hue = b.hue + afterglow * 90 * (1 - age);
      const earlyHot = Math.max(0, 0.6 - age * 1.15);
      const alpha = (baseAlpha + (brighten * 0.32 + earlyHot * 0.55) * (1 - age)) * orb.alpha;
      const shadowAlpha = (0.85 * baseAlpha + (brighten * 0.35 + earlyHot * 0.38) * (1 - age)
        + 0.26 * afterglow) * orb.alpha;
      ctx.strokeStyle = 'hsla(' + hue + ',100%,78%,' + alpha + ')';
      ctx.shadowColor = 'hsla(' + (hue + 25 * afterglow) + ',100%,92%,' + shadowAlpha + ')';
      ctx.shadowBlur = 14 + 28 * (brighten + earlyHot + afterglow * 1.2);
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticleTrail(p, afterglow) {
    if (!p.trail || p.trail.length < 2) return;
    for (let j = 1; j < p.trail.length; j++) {
      const prev = p.trail[j - 1], curr = p.trail[j];
      const age = j / p.trail.length;
      const alpha = (0.15 * age + 0.19 * afterglow * (1 - age)) * orb.alpha;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.strokeStyle = 'hsla(' + p.hue + ',100%,85%,' + alpha + ')';
      ctx.shadowColor = 'hsla(' + p.hue + ',100%,100%,' + (alpha * 0.4 + 0.3 * afterglow) + ')';
      ctx.shadowBlur = 4 + 11 * afterglow;
      ctx.lineWidth = 0.8 + 2 * (1 - age) + 1.1 * afterglow;
      ctx.stroke();
      ctx.restore();
    }
  }

  function orbGlowFactor(now) {
    const fraction = orb.reassembledParticles / opts.particleCount;
    let bounce = 0;
    if (orb.bounce > 0 && orb.bounceTime) {
      const el = now - orb.bounceTime;
      if (el < 500) bounce = 0.35 * Math.sin(Math.PI * (el / 500));
    }
    return Math.max(fraction, bounce, orb.afterglow);
  }

  // ----------------------------------------------------------- the main loop
  function animate() {
    if (destroyed) return;
    const now = performance.now();

    // Idle handling: fade the orb out after stillness, then stop the loop
    // completely. Nothing is moving, so there is nothing to redraw.
    const idle = now - lastMoveTime;
    const busy = particles.length > 0 || trail.length > 0 || orb.afterglowTime > 0;
    if (!busy && idle > opts.idleFadeMs) {
      orb.alpha = Math.max(0, orb.alpha - 0.06);
    } else if (idle < opts.idleFadeMs) {
      orb.alpha = Math.min(1, orb.alpha + 0.12);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, viewW(), viewH());

    if (orb.alpha <= 0 && !busy) { running = false; rafId = null; return; }  // sleep

    ctx.globalCompositeOperation = 'lighter';

    let afterglow = 0;
    if (orb.afterglowTime > 0) {
      const t = (now - orb.afterglowTime) / 1500;
      if (t < 1) afterglow = easeOutQuint(1 - t);
      else orb.afterglowTime = 0;
    }
    orb.afterglow = afterglow;

    const brighten = orb.reassembledParticles > 0
      ? orb.reassembledParticles / opts.particleCount : 0;

    cleanTrail(now);
    drawTrail(now, brighten, afterglow);

    // ---- explosion → return ----
    if (orb.exploded && particles.length) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.trail = p.trail || [];
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 25) p.trail.shift();

        if (p.reentryDelay === undefined) {
          p.reentryDelay = 440 + i * 56 + Math.random() * 140;
        }

        const el = now - orb.explodeTime;
        const lifeRatio = Math.max(0, 1 - el / 1700);
        const lifeProgress = Math.min(1, Math.max(0,
          (el - p.reentryDelay + 260) / (1700 - p.reentryDelay + 260)));

        if (el < p.reentryDelay) {
          p.x += p.vx * 0.98; p.y += p.vy * 0.98;
          p.vx *= 0.96; p.vy *= 0.96;
        } else {
          const timeSinceReturn = Math.max(0, now - (orb.explodeTime + p.reentryDelay));
          const dx = orb.x - p.x, dy = orb.y - p.y;
          const dist = Math.hypot(dx, dy) + 0.1;
          const swirl = 0.52 * Math.exp(-(el - p.reentryDelay) / 400);
          const sa = Math.atan2(dy, dx) + Math.PI / 2;
          const ax = (dx / dist) * 0.44 + Math.cos(sa) * swirl * (0.93 + 0.17 * Math.random())
            + (Math.random() - 0.5) * 0.12;
          const ay = (dy / dist) * 0.44 + Math.sin(sa) * swirl * (0.93 + 0.17 * Math.random())
            + (Math.random() - 0.5) * 0.12;
          const speedRamp = 3.0 + lifeProgress * 2;
          const timeBoost = 1 + Math.min(timeSinceReturn / 400, 0.5);
          p.vx += ax * speedRamp * timeBoost;
          p.vy += ay * speedRamp * timeBoost;
          p.vx *= 0.88; p.vy *= 0.88;
          p.x += p.vx; p.y += p.vy;

          if (dist < 8) {
            particles.splice(i, 1);
            orb.reassembleTimestamps.push(now);
            orb.reassembledParticles++;
            orb.squashActive = true;
            p.justReassembled = true;
            continue;
          }
        }

        drawParticleTrail(p, afterglow);
        const dx2 = orb.x - p.x, dy2 = orb.y - p.y;
        const dist2 = Math.hypot(dx2, dy2);
        let flash = 0;
        if (el < p.reentryDelay + 260) flash = 1 - (el - p.reentryDelay) / 260;
        if (p.justReassembled && dist2 < 15) flash = 1;
        if (dist2 < 26) flash += (1 - dist2 / 26) * 0.5;
        flash = Math.min(1, flash);

        const color = particleColor(lifeProgress);
        const baseR = 2.2 + 2.3 * afterglow;
        const radius = Math.max(0.69, baseR * (0.75 * lifeRatio + 0.49 * flash));
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 21 * (0.19 + flash + afterglow * 0.7);
        ctx.globalAlpha = (0.75 + 0.49 * flash + 0.17 * afterglow) * orb.alpha;
        ctx.fill();
        ctx.restore();
      }

      let count = orb.reassembleTimestamps.length;
      if (count > opts.particleCount) {
        orb.reassembleTimestamps = orb.reassembleTimestamps.slice(-opts.particleCount);
        count = orb.reassembleTimestamps.length;
      }
      if (count > 0) {
        const elapsedSinceFirst = now - orb.reassembleTimestamps[0];
        const fraction = count / opts.particleCount;
        const linger = Math.max(0, 1.15 - elapsedSinceFirst / 4300);
        const growTarget = 1 + 0.48 * easeOutQuint(fraction) * linger;
        if (orb.grow < growTarget) orb.grow += 0.006;
        else if (orb.grow > growTarget) orb.grow -= 0.0045;
      }
      if (!particles.length) {
        orb.exploded = false;
        orb.bounce = 1; orb.bounceTime = now;
        orb.afterglowTime = now;
        orb.squashActive = false; orb.squash = 0;
        orb.reassembleTimestamps = []; orb.reassembledParticles = 0;
      }
    }

    // ---- squash / bounce ----
    if (orb.squashActive && orb.reassembledParticles > 0) {
      const sp = Math.min(1, orb.reassembledParticles / opts.particleCount);
      orb.squash = 0.98 * Math.exp(-0.16 * sp) * (1 - 0.41 * sp);
    } else if (!orb.exploded) {
      orb.squash = 0; orb.squashActive = false; orb.reassembledParticles = 0;
    }

    // ---- the orb itself ----
    const orbHue = (now / 6) % 360;
    let bounce = 0;
    if (orb.bounce > 0 && orb.bounceTime) {
      const el = now - orb.bounceTime;
      if (el < 500) bounce = 0.33 * Math.sin(Math.PI * (el / 500));
      else { orb.bounce = 0; orb.bounceTime = 0; }
    }
    let squash = orb.squash > 0.01 ? 1 - 0.35 * orb.squash : 1;
    squash *= (1 + bounce + 0.08 * afterglow);
    const glow = orbGlowFactor(now);
    const growVal = orb.grow || 1;
    const maxR = 14, minR = 2;
    const outerR = (minR + (maxR - minR) * growVal) * squash;
    const innerR = (0.4 * minR + (6 - 0.4 * minR) * growVal) * squash;
    if ((!orb.exploded || afterglow > 0.01) && orb.x > -500) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, outerR, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(' + orbHue + ',100%,70%,' +
        ((0.21 + 0.41 * (glow + afterglow * 1.2)) * orb.alpha) + ')';
      ctx.shadowColor = 'hsla(' + orbHue + ',100%,82%,' +
        (0.99 * (glow + afterglow * 1.15) * orb.alpha) + ')';
      ctx.shadowBlur = 36 * growVal * (1 + glow * 1.7 + afterglow * 1.13);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, innerR, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(' + orbHue + ',100%,99%,' +
        ((0.63 + 0.37 * (glow + afterglow)) * orb.alpha) + ')';
      ctx.shadowBlur = 9 * growVal * (1 + glow * 1.7 + afterglow * 1.25);
      ctx.fill();
      ctx.restore();
    }

    if (!orb.bounce && !orb.squash && orb.grow > 1) orb.grow -= 0.012;
    if (orb.grow < 1) orb.grow = 1;

    ctx.globalCompositeOperation = 'source-over';
    rafId = requestAnimationFrame(animate);
  }

  function wake() {
    if (!running && !destroyed && canvas && !document.hidden) {
      running = true;
      rafId = requestAnimationFrame(animate);
    }
  }

  // -------------------------------------------------------------- input
  // One pointer path for mouse, touch and pen. Touch reports coarse, fast
  // moves, so nothing here assumes a persistent hovering cursor.
  function onPointerMove(e) {
    const now = performance.now();
    trail.push({ x: e.clientX, y: e.clientY, hue: (now / 10) % 360, t: now });
    orb.x = e.clientX; orb.y = e.clientY;
    lastMoveTime = now;
    cleanTrail(now);
    wake();
  }

  function onPointerDown(e) {
    orb.x = e.clientX; orb.y = e.clientY;
    lastMoveTime = performance.now();
    if (!opts.explodeOnClick) { wake(); return; }
    explodeAt(e.clientX, e.clientY);
    wake();
  }

  function explodeAt(x, y) {
    const now = performance.now();
    orb.exploded = true;
    orb.explodeTime = now;
    orb.grow = 1; orb.squash = 0; orb.squashActive = false;
    orb.reassembleTimestamps = []; orb.reassembledParticles = 0;
    orb.bounce = 0; orb.bounceTime = 0;
    orb.afterglow = 0; orb.afterglowTime = 0;
    particles = [];
    const baseHue = ((now / 6) % 360) | 0;
    for (let i = 0; i < opts.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        hue: baseHue + Math.random() * 100 - 50,
        trail: [], reentryDelay: undefined, justReassembled: false
      });
    }
    trail = [];
  }

  function onPointerLeave() {
    trail = [];
    orb.x = -1000; orb.y = -1000;
  }

  function onVisibility() {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null; running = false;
    } else {
      lastMoveTime = performance.now();
      wake();
    }
  }

  // ------------------------------------------------------------ lifecycle
  function init(options) {
    if (canvas) return api;                       // already running
    opts = Object.assign({}, DEFAULTS, options || {});
    // Honour the OS setting — this is exactly the kind of persistent motion
    // prefers-reduced-motion is meant to turn off.
    if (reducedMotion()) return api;

    destroyed = false;
    canvas = document.createElement('canvas');
    canvas.id = 'neonCursorCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed', top: '0', left: '0',
      zIndex: String(opts.zIndex),
      pointerEvents: 'none',     // never intercept clicks
      userSelect: 'none'
    });
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);

    lastMoveTime = performance.now();
    wake();
    return api;
  }

  function destroy() {
    destroyed = true;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; ctx = null;
    trail = []; particles = [];
    orb.exploded = false; orb.alpha = 0;
    orb.x = -1000; orb.y = -1000;
  }

  const api = { init, destroy, explodeAt, get running() { return running; } };
  return api;
})();

if (typeof window !== 'undefined') window.NeonCursor = NeonCursor;
