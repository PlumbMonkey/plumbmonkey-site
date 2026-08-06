// ============================================================
// SPECTRAL MANOR ARCADE — shared leaderboard + attract mode
// Loaded by every game (before its game.js) and by the hub.
// Stores top scores per game in localStorage, no backend.
// ============================================================
(function () {
  const PREFIX = 'spectralArcade.scores.';
  const KEEP = 5;   // stored per game
  const SHOW = 3;   // shown per game

  // Canonical game list (slug + display title) — used by the hub Hall of Fame
  const GAMES = [
    { slug: 'spectral-manor-revenger',          title: 'Revenger' },
    { slug: 'spectral-manor-mess-hall',         title: 'Mess Hall' },
    { slug: 'spectral-manor-swarm',             title: 'Swarm' },
    { slug: 'spectral-skyline',                 title: "Luno's Flight" },
    { slug: 'spectral-manor-soul-circuit',      title: 'Soul Circuit' },
    { slug: 'spectral-manor-crystal-dimension', title: 'Crystal Dimension' },
    { slug: 'spectral-manor-infestation',       title: 'Infestation' },
    { slug: 'spectral-manor-cruise',            title: 'Cruise' },
    { slug: 'spectral-manor-beam-me-up',        title: 'Beam Me Up: Live!' },
    { slug: 'spectral-manor-amp-rampage',       title: 'Amp Rampage' },
    { slug: 'spectral-manor-hooded',            title: 'House of the Hooded' },
    { slug: 'spectral-manor-graveyard-shift',   title: 'Graveyard Shift' }
  ];

  function keyFor(slug) { return PREFIX + slug; }

  function get(slug) {
    const legacy = {
      'spectral-manor-mess-hall': 'spectral-food-fight',
      'spectral-manor-swarm': 'spectral-robotron'
    };
    try {
      const current = JSON.parse(localStorage.getItem(keyFor(slug))) || [];
      if (current.length || !legacy[slug]) return current;
      const old = JSON.parse(localStorage.getItem(keyFor(legacy[slug]))) || [];
      if (old.length) save(slug, old);
      return old;
    }
    catch (e) { return []; }
  }
  function save(slug, arr) {
    try { localStorage.setItem(keyFor(slug), JSON.stringify(arr)); } catch (e) {}
  }

  // Derive this game's slug from the URL path (…/arcade/games/<slug>/…)
  function deriveSlug() {
    const m = location.pathname.match(/games\/([^\/]+)/);
    return m ? m[1] : 'unknown';
  }

  const attract = /[?&]attract\b/.test(location.search);

  function qualifies(slug, score) {
    if (!score || score <= 0) return false;
    const a = get(slug);
    if (a.length < SHOW) return true;
    return score > a[a.length - 1].s;
  }

  function add(slug, initials, score) {
    const a = get(slug);
    a.push({ i: (initials || 'AAA').slice(0, 3).toUpperCase(), s: Math.round(score) });
    a.sort((x, y) => y.s - x.s);
    if (a.length > KEEP) a.length = KEEP;
    save(slug, a);
    return a;
  }

  function top(slug, n) { return get(slug).slice(0, n || SHOW); }

  // HTML table of this game's top 3 (for a game-over overlay)
  function boardHTML(slug) {
    const t = top(slug, SHOW);
    let rows = '';
    for (let i = 0; i < SHOW; i++) {
      const e = t[i];
      rows += `<tr><td>${i + 1}</td><td>${e ? e.i : '---'}</td><td>${e ? e.s : '—'}</td></tr>`;
    }
    return `<table class="sm-lb"><thead><tr><th>#</th><th>WHO</th><th>SCORE</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  // Combined Hall of Fame — the N highest scores across all games
  function hallOfFame(n) {
    const all = [];
    GAMES.forEach(g => get(g.slug).forEach(e => all.push({ i: e.i, s: e.s, game: g.title })));
    all.sort((a, b) => b.s - a.s);
    return all.slice(0, n || 9);
  }

  // ---- Initials entry modal (classic 3-letter arcade prompt) ----
  let styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const css = `
      .sm-lb-modal{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;
        align-items:center;justify-content:center;background:rgba(5,3,12,0.94);
        font-family:'Segoe UI',system-ui,sans-serif;color:#e0d4ff;text-align:center}
      .sm-lb-modal h2{font-size:1.8rem;color:#c084fc;text-shadow:0 0 20px #c084fc;margin-bottom:.3rem;letter-spacing:2px}
      .sm-lb-modal .sm-sub{color:#a78bfa;margin-bottom:1.4rem;font-size:.95rem}
      .sm-slots{display:flex;gap:1rem;margin-bottom:1.4rem}
      .sm-slot{display:flex;flex-direction:column;align-items:center;gap:.4rem}
      .sm-slot .sm-char{width:56px;height:70px;display:flex;align-items:center;justify-content:center;
        font-size:2.6rem;font-weight:bold;border:2px solid #7c3aed;border-radius:8px;background:#1a1025;
        color:#e9d5ff;text-shadow:0 0 12px #c084fc}
      .sm-slot.active .sm-char{border-color:#e879f9;box-shadow:0 0 22px rgba(232,121,249,.6)}
      .sm-arrow{cursor:pointer;color:#a78bfa;font-size:1.3rem;user-select:none;line-height:1}
      .sm-arrow:hover{color:#e879f9}
      .sm-lb-modal .sm-hint{font-size:.8rem;color:#9ca3af;margin-bottom:1rem}
      .sm-submit{padding:.6rem 2.4rem;font-size:1rem;font-weight:bold;letter-spacing:2px;cursor:pointer;
        background:#7c3aed;color:#fff;border:none;border-radius:8px;box-shadow:0 0 24px rgba(124,58,237,.5)}
      .sm-submit:hover{background:#8b46f0}
      .sm-lb{margin:.6rem auto;border-collapse:collapse;font-size:.95rem}
      .sm-lb th,.sm-lb td{padding:.18rem .8rem}
      .sm-lb th{color:#a78bfa;font-size:.72rem;letter-spacing:1px;font-weight:600}
      .sm-lb td{color:#e9d5ff}
      .sm-lb tbody tr:first-child td{color:#f0abfc}
    `;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  function promptInitials(slug, score, done) {
    injectStyle();
    const chars = ['A', 'A', 'A'];
    let cur = 0;
    const modal = document.createElement('div');
    modal.className = 'sm-lb-modal';
    modal.innerHTML = `
      <h2>NEW HIGH SCORE!</h2>
      <div class="sm-sub">Score ${Math.round(score)} — enter your initials</div>
      <div class="sm-slots"></div>
      <div class="sm-hint">Type A–Z · ← → move · ↑ ↓ change · Enter to submit<br>Gamepad: stick/D-pad to pick · A to submit · B to clear</div>
      <button class="sm-submit">SUBMIT</button>
    `;
    const slots = modal.querySelector('.sm-slots');
    function render() {
      slots.innerHTML = '';
      chars.forEach((c, i) => {
        const slot = document.createElement('div');
        slot.className = 'sm-slot' + (i === cur ? ' active' : '');
        slot.innerHTML = `<div class="sm-arrow" data-up="${i}">▲</div>
          <div class="sm-char">${c}</div>
          <div class="sm-arrow" data-down="${i}">▼</div>`;
        slots.appendChild(slot);
      });
    }
    render();

    function cycle(i, dir) {
      let code = chars[i].charCodeAt(0) - 65;
      code = (code + dir + 26) % 26;
      chars[i] = String.fromCharCode(65 + code);
      render();
    }
    function submit() {
      window.removeEventListener('keydown', onKey, true);
      padOn = false;
      add(slug, chars.join(''), score);
      modal.remove();
      if (done) done();
    }

    // ---- Gamepad ----
    // This modal is DOM-driven and listens for real keydown events, but
    // arcade-controls.js never dispatches any — it writes keys[code] straight
    // into the game's own object. So a pad is invisible here and a controller
    // player cannot enter their initials in any game. Poll it directly for as
    // long as the modal is up.
    let padOn = true, padPrev = {}, padNext = 0;
    function padPoll() {
      if (!padOn) return;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let pad = null;
      for (let i = 0; i < pads.length; i++) if (pads[i]) { pad = pads[i]; break; }
      if (pad) {
        const held = n => !!(pad.buttons[n] && pad.buttons[n].pressed);
        const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
        const st = {
          left: ax < -0.5 || held(14), right: ax > 0.5 || held(15),
          up: ay < -0.5 || held(12), down: ay > 0.5 || held(13),
          ok: held(0) || held(9), back: held(1)
        };
        const now = Date.now();
        // fire on press, then repeat while held (long delay first, then fast)
        const act = (k, fn) => {
          if (!st[k]) return;
          if (!padPrev[k]) { fn(); padNext = now + 340; }
          else if (now >= padNext) { fn(); padNext = now + 140; }
        };
        act('left', () => { cur = Math.max(0, cur - 1); render(); });
        act('right', () => { cur = Math.min(2, cur + 1); render(); });
        act('up', () => cycle(cur, 1));
        act('down', () => cycle(cur, -1));
        if (st.back && !padPrev.back) { chars[cur] = 'A'; if (cur > 0) cur--; render(); }
        if (st.ok && !padPrev.ok) { submit(); return; }
        padPrev = st;
      }
      requestAnimationFrame(padPoll);
    }
    requestAnimationFrame(padPoll);

    slots.addEventListener('click', e => {
      const up = e.target.getAttribute('data-up');
      const down = e.target.getAttribute('data-down');
      if (up !== null && up !== undefined) { cur = +up; cycle(cur, 1); }
      else if (down !== null && down !== undefined) { cur = +down; cycle(cur, -1); }
    });
    modal.querySelector('.sm-submit').addEventListener('click', submit);

    function onKey(e) {
      // stopImmediatePropagation: the game's own keydown handler is also on
      // window, and plain stopPropagation would not block same-node listeners
      // (Space would restart the game underneath the modal)
      e.stopImmediatePropagation();
      e.preventDefault();
      const k = e.key;
      if (/^[a-zA-Z]$/.test(k)) {
        chars[cur] = k.toUpperCase();
        if (cur < 2) cur++;
        render();
      } else if (k === 'Backspace') {
        chars[cur] = 'A';
        if (cur > 0) cur--;
        render();
      } else if (k === 'ArrowLeft') { cur = Math.max(0, cur - 1); render(); }
      else if (k === 'ArrowRight') { cur = Math.min(2, cur + 1); render(); }
      else if (k === 'ArrowUp') { cycle(cur, 1); }
      else if (k === 'ArrowDown') { cycle(cur, -1); }
      else if (k === 'Enter') { submit(); }
    }
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(modal);
  }

  // Convenience: if the score qualifies, prompt for initials, then run `done`.
  // In attract mode it skips everything and just runs `done`.
  function submitFlow(score, done) {
    const slug = API.slug;
    // Initials entry is DOM-only and cannot be seen on the canvas presented
    // inside WebXR. Bank a headset score and continue to the game-over screen.
    if (typeof ArcadeVR !== 'undefined' && ArcadeVR.active) {
      if (qualifies(slug, score)) add(slug, 'VR', score);
      if (done) done();
      return;
    }
    if (attract || !qualifies(slug, score)) { if (done) done(); return; }
    promptInitials(slug, score, done);
  }

  // ---- Attract mode: auto-start & auto-restart for hub previews ----
  // Games declare gameRunning/startGame with let/function, so we can't read
  // window.gameRunning reliably. Instead we use the start overlay as the
  // "not playing" signal: whenever it's visible we (re)start the game.
  function startFn() {
    return (typeof window.startGame === 'function' && window.startGame) ||
           (typeof window.startRace === 'function' && window.startRace) || null;
  }
  function injectAttractChrome() {
    // strip page chrome so the iframe preview shows only the game canvas
    const s = document.createElement('style');
    s.textContent = `
      h1, .subtitle, .sub, .hud, .controls, .note { display:none !important; }
      html, body { margin:0 !important; padding:0 !important; overflow:hidden !important;
        height:100% !important; background:#07040f !important; }
      body { display:flex !important; align-items:center !important; justify-content:center !important; }
      #gameCanvas { width:100% !important; height:100% !important; object-fit:cover;
        max-width:100% !important; border:none !important; box-shadow:none !important; border-radius:0 !important; }
      .start-overlay { display:none !important; }
    `;
    document.head.appendChild(s);
  }

  function startAttract() {
    if (!attract) return;
    injectAttractChrome();
    const begin = startFn();
    if (begin) { try { begin(); } catch (e) {} }
    setInterval(() => {
      const ov = document.getElementById('startOverlay');
      const waiting = !ov || !ov.classList.contains('hidden'); // overlay visible = game over / idle
      if (waiting) {
        const s = startFn();
        if (s) { try { s(); } catch (e) {} }
        if (ov) ov.classList.add('hidden');
      }
    }, 500);
  }
  if (attract) window.addEventListener('load', startAttract);

  // ---- Persistent back-links (skipped in attract-mode previews) ----
  // Lets a player leave a game for the arcade hub or the main site at any
  // time — matches the site's own /arcade and / links.
  //
  // Deliberately NOT the full site bar (/shared/site-nav.js). Games are
  // fixed-size canvases, several centred against the viewport, so a 64px bar
  // would mean re-centring ten bespoke layouts and would permanently eat play
  // area. The site runs two tiers of chrome by mode: pages you browse get the
  // full bar, experiences you are inside (games, and the 3D rooms) get minimal
  // chrome plus a clear way out. "← Arcade" lands on a page that does carry the
  // full nav, so nothing is more than one extra click away.
  //
  // Palette is the site's brass tokens rather than the older arcade purple:
  // brass-200 #e8c97e text, brass-400 #c4923a hover, brass-500 #a97829 border,
  // moonlit-950 #0a0c11 surface — same values as /shared/site-nav.css.
  function injectNav() {
    if (attract || document.querySelector('.sm-nav')) return;
    const s = document.createElement('style');
    s.textContent = `
      .sm-nav{position:fixed;top:10px;left:10px;z-index:9998;display:flex;gap:.5rem;
        font-family:Inter,ui-sans-serif,system-ui,'Segoe UI',sans-serif;font-size:.72rem}
      .sm-nav a{color:#e8c97e;text-decoration:none;padding:.34rem .72rem;border-radius:6px;
        background:rgba(10,12,17,.82);border:1px solid rgba(169,120,41,.55);
        backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
        letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;
        transition:background .15s ease,border-color .15s ease,color .15s ease}
      .sm-nav a:hover{background:#c4923a;border-color:#c4923a;color:#0a0c11}
      @media (max-width:520px){ .sm-nav{font-size:.66rem} .sm-nav a{padding:.3rem .6rem} }
      @media (prefers-reduced-motion:reduce){ .sm-nav a{transition:none} }
    `;
    document.head.appendChild(s);
    const nav = document.createElement('div');
    nav.className = 'sm-nav';
    nav.innerHTML = `<a href="/arcade">← Arcade</a><a href="/">Plumbmonkey Home</a>`;
    document.body.appendChild(nav);
  }
  if (!attract && typeof document !== 'undefined') {
    if (document.body) injectNav();
    else window.addEventListener('DOMContentLoaded', injectNav);
  }

  // ---- Touch controls (phones/tablets) ----
  // Directional & action buttons synthesize KeyboardEvents on window, so every
  // game's existing key handler works untouched. The two aim games also get
  // canvas-touch → mouse translation. Skipped in attract previews & on desktop.
  // ?touch=1 forces controls on (hybrid devices / testing); ?touch=0 forces off
  const forceTouch = /[?&]touch=1\b/.test(location.search);
  const forceNoTouch = /[?&]touch=0\b/.test(location.search);
  const coarse = typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const isTouch = !attract && !forceNoTouch && (forceTouch || coarse);

  // per-game layout: pad = 'dpad' (4-way) | 'lr' (steer only); actions = [[label, code]]
  const CONTROL_LAYOUTS = {
    'spectral-manor-revenger':          { pad: 'dpad', actions: [['FIRE', 'Space']] },
    'spectral-manor-mess-hall':         { pad: 'dpad', actions: [['THROW', 'Space']], aim: true },
    'spectral-manor-swarm':             { pad: 'dpad', actions: [['FIRE', 'Space']], aim: true },
    'spectral-skyline':                 { pad: 'lr',   actions: [['FLAP', 'Space']] },
    'spectral-manor-soul-circuit':      { pad: 'dpad', actions: [] },
    'spectral-manor-crystal-dimension': { pad: 'lr',   actions: [['THRUST', 'ArrowUp'], ['FIRE', 'Space']] },
    'spectral-manor-infestation':       { pad: 'dpad', actions: [['FIRE', 'Space']] },
    'spectral-manor-cruise':            { pad: 'lr',   actions: [['GAS', 'ArrowUp'], ['BRAKE', 'ArrowDown']] }
  };

  function key(code, type) {
    window.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : code, bubbles: true }));
  }

  function bindHold(el, code) {
    let held = false;
    const down = e => { if (e) { e.preventDefault(); e.stopPropagation(); } if (held) return; held = true; el.classList.add('active'); key(code, 'keydown'); };
    const up = e => { if (e) { e.preventDefault(); e.stopPropagation(); } if (!held) return; held = false; el.classList.remove('active'); key(code, 'keyup'); };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
  }

  function makeBtn(cls, label, code) {
    const b = document.createElement('div');
    b.className = 'sm-tb ' + cls;
    b.textContent = label;
    bindHold(b, code);
    return b;
  }

  function initTouchControls() {
    const layout = CONTROL_LAYOUTS[deriveSlug()];
    if (!layout || document.querySelector('.sm-touch')) return;

    const css = document.createElement('style');
    css.textContent = `
      /* --- reclaim vertical space + keep the WHOLE game on-screen on phones --- */
      body.sm-touch-active { padding: 2px !important; min-height: 0 !important;
        justify-content: flex-start !important; overflow: hidden !important; }
      body.sm-touch-active h1,
      body.sm-touch-active .subtitle,
      body.sm-touch-active .sub,
      body.sm-touch-active .controls,
      body.sm-touch-active .note,
      body.sm-touch-active .hint { display: none !important; }
      body.sm-touch-active .hud { font-size: .68rem !important; gap: .5rem !important; margin: 2px 0 !important; }
      /* fit the canvas inside the viewport (no gameplay off-screen), leaving a
         band at the bottom for the controls so they don't cover the playfield */
      body.sm-touch-active #gameCanvas {
        max-width: 100vw !important;
        max-height: calc(100dvh - 96px) !important;
        height: auto !important; box-shadow: none !important; }

      .sm-touch{position:fixed;left:0;right:0;bottom:0;z-index:9997;display:flex;
        justify-content:space-between;align-items:flex-end;
        padding:8px 10px calc(8px + env(safe-area-inset-bottom));
        pointer-events:none;font-family:'Segoe UI',system-ui,sans-serif;touch-action:none}
      .sm-touch .sm-cluster{pointer-events:auto;display:flex;gap:10px;align-items:flex-end}
      .sm-tb{pointer-events:auto;display:flex;align-items:center;justify-content:center;
        color:#e9d5ff;background:rgba(26,16,37,.66);border:2px solid #7c3aed;border-radius:12px;
        font-weight:700;letter-spacing:1px;user-select:none;-webkit-user-select:none;touch-action:none;
        box-shadow:0 0 14px rgba(124,58,237,.3);backdrop-filter:blur(3px)}
      .sm-tb.active{background:rgba(124,58,237,.85);border-color:#e879f9;box-shadow:0 0 22px rgba(232,121,249,.7)}
      .sm-dir{width:52px;height:52px;font-size:1.4rem}
      .sm-lr{width:64px;height:60px;font-size:1.7rem}
      .sm-act{width:64px;height:64px;border-radius:50%;font-size:.72rem}
      .sm-dpad{display:grid;grid-template-columns:repeat(3,52px);grid-template-rows:repeat(3,52px);gap:5px}
      .sm-dpad .sm-up{grid-area:1/2} .sm-dpad .sm-left{grid-area:2/1}
      .sm-dpad .sm-right{grid-area:2/3} .sm-dpad .sm-down{grid-area:3/2}
      .sm-actions{flex-direction:row}
      /* These games are 16:9, so in portrait the canvas is capped by screen
         width and a lot of height goes unused — nudge the player to rotate,
         where the side-gutter layout gives a much bigger play area. */
      .sm-rotate-hint{position:fixed;left:0;right:0;top:52%;z-index:9995;text-align:center;
        pointer-events:none;font:600 .78rem system-ui,sans-serif;color:#a78bfa;opacity:.75}
      @media (min-height:461px){ .sm-rotate-hint{display:block} }
      @media (max-height:460px){ .sm-rotate-hint{display:none} }
      /* narrow phones — shrink so 2-action layouts never clip the right edge */
      @media (max-width:380px){
        .sm-dir{width:46px;height:46px} .sm-dpad{grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,46px)}
        .sm-lr{width:56px;height:54px} .sm-act{width:56px;height:56px} }
      /* Landscape / short viewports — the game is 16:9 inside a ~2:1 screen, so
         when it fits by height there's spare width at the sides. Put the controls
         in those side gutters instead of a bottom band: the canvas keeps its full
         height (much bigger play area) and nothing overlaps. */
      @media (max-height:460px){
        /* Gutters are sized per side to the controls that actually live there —
           the dpad needs ~150px on the left but the single action button only
           needs ~70px on the right, so an asymmetric page padding reclaims the
           difference for the canvas rather than mirroring the widest side. */
        body.sm-touch-active.sm-pad-dpad{ padding: 2px 76px 2px 156px !important; }
        body.sm-touch-active.sm-pad-lr{ padding: 2px 138px 2px 138px !important; }
        body.sm-touch-active #gameCanvas{ max-height: calc(100dvh - 26px) !important; max-width: 100% !important; }
        .sm-dir{width:44px;height:44px;font-size:1.2rem} .sm-dpad{grid-template-columns:repeat(3,44px);grid-template-rows:repeat(3,44px);gap:4px}
        .sm-lr{width:56px;height:48px;font-size:1.4rem} .sm-act{width:54px;height:54px;font-size:.66rem}
        .sm-touch{padding:6px 12px calc(6px + env(safe-area-inset-bottom))} }
    `;
    document.head.appendChild(css);
    document.body.classList.add('sm-touch-active');
    document.body.classList.add('sm-pad-' + layout.pad); // dpad clusters are wider → need bigger side gutters in landscape
    addFullscreenBtn();

    const rotate = document.createElement('div');
    rotate.className = 'sm-rotate-hint';
    rotate.textContent = '⟳ Rotate your device for a bigger screen';
    document.body.appendChild(rotate);

    const bar = document.createElement('div');
    bar.className = 'sm-touch';

    // left cluster — directional
    const left = document.createElement('div');
    left.className = 'sm-cluster';
    if (layout.pad === 'dpad') {
      const pad = document.createElement('div');
      pad.className = 'sm-dpad';
      pad.appendChild(makeBtn('sm-dir sm-up', '▲', 'ArrowUp'));
      pad.appendChild(makeBtn('sm-dir sm-left', '◀', 'ArrowLeft'));
      pad.appendChild(makeBtn('sm-dir sm-right', '▶', 'ArrowRight'));
      pad.appendChild(makeBtn('sm-dir sm-down', '▼', 'ArrowDown'));
      left.appendChild(pad);
    } else { // lr
      left.appendChild(makeBtn('sm-lr', '◀', 'ArrowLeft'));
      left.appendChild(makeBtn('sm-lr', '▶', 'ArrowRight'));
    }
    bar.appendChild(left);

    // right cluster — action buttons
    const right = document.createElement('div');
    right.className = 'sm-cluster sm-actions';
    layout.actions.forEach(([label, code]) => right.appendChild(makeBtn('sm-act', label, code)));
    bar.appendChild(right);

    document.body.appendChild(bar);

    // Aim games: drag anywhere on the play area to aim (and auto-fire) via the
    // game's existing mouse handlers. touch-action:none is essential — without
    // it mobile browsers steal the drag as a scroll and aim never registers.
    if (layout.aim) {
      const cv = document.getElementById('gameCanvas');
      if (cv) {
        cv.style.touchAction = 'none';
        const toMouse = (type, t) => cv.dispatchEvent(new MouseEvent(type, { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
        cv.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; toMouse('mousemove', t); toMouse('mousedown', t); }, { passive: false });
        cv.addEventListener('touchmove', e => { e.preventDefault(); toMouse('mousemove', e.changedTouches[0]); }, { passive: false });
        cv.addEventListener('touchend', e => { e.preventDefault(); toMouse('mouseup', e.changedTouches[0]); }, { passive: false });
        cv.addEventListener('touchcancel', e => { toMouse('mouseup', e.changedTouches[0]); }, { passive: false });
      }
    }
  }
  if (isTouch && typeof document !== 'undefined') {
    if (document.body) initTouchControls();
    else window.addEventListener('DOMContentLoaded', initTouchControls);
  }

  // ---- Gamepad support (Bluetooth or USB, via the standard Gamepad API) ----
  // A connected controller drives the SAME synthetic key/mouse events as the
  // touch buttons, so every game works untouched. Standard mapping:
  //   left stick + D-pad → arrow keys · face buttons A/B/X/Y → the game's
  //   actions · Start → begin/restart · right stick → aim cursor (aim games).
  let gamepadIndex = null;
  let gamepadTimer = null;       // ~60Hz input poll (setInterval, not rAF, so it
                                 // keeps polling even when the tab isn't painting)
  let aimCursor = null;          // virtual aim cursor in canvas coords (aim games)
  let reticleEl = null;
  const vk = {};                 // synthetic-key held-state for edge detection
  let prevStart = false, prevAimFire = false;

  function setVK(code, pressed) {
    if (!!vk[code] === !!pressed) return;
    vk[code] = !!pressed;
    key(code, pressed ? 'keydown' : 'keyup');
  }

  function gamepadBadge(on) {
    let b = document.getElementById('sm-gp-badge');
    if (on) {
      if (!b) {
        b = document.createElement('div');
        b.id = 'sm-gp-badge';
        b.textContent = '🎮 Controller';
        // top-centre so it never collides with the back-links (left) or the
        // fullscreen button (right)
        b.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9998;' +
          'font:600 .72rem system-ui,sans-serif;color:#e0d4ff;background:rgba(26,16,37,.85);' +
          'border:1px solid #7c3aed;border-radius:6px;padding:.3rem .6rem;box-shadow:0 0 12px rgba(124,58,237,.4)';
        document.body.appendChild(b);
      }
    } else if (b) { b.remove(); }
  }

  // ---- Fullscreen toggle (touch devices) ----
  // Reclaims the browser's URL bar / toolbars — that chrome is what pushes the
  // bottom controls out of reach — and gives the game the whole screen.
  // Feature-detected: iPhone Safari can't fullscreen arbitrary elements, so the
  // button is simply not shown there rather than silently failing.
  function fullscreenSupported() {
    const el = document.documentElement;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  }
  async function toggleFullscreen() {
    const el = document.documentElement;
    try {
      const isFs = document.fullscreenElement || document.webkitFullscreenElement;
      if (!isFs) {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        // Android/Chrome can lock orientation once fullscreen; unsupported
        // elsewhere, so failure here is fine.
        try {
          if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
        } catch (e) {}
      } else {
        try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    } catch (e) {}
  }
  function addFullscreenBtn() {
    if (attract || document.getElementById('sm-fs') || !fullscreenSupported()) return;
    const b = document.createElement('button');
    b.id = 'sm-fs';
    b.textContent = '⛶';
    b.title = 'Fullscreen';
    b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9998;cursor:pointer;' +
      'font:700 1rem system-ui,sans-serif;color:#c084fc;background:rgba(26,16,37,.8);' +
      'border:1px solid #3b2660;border-radius:6px;padding:.25rem .5rem;line-height:1;touch-action:manipulation';
    b.addEventListener('click', toggleFullscreen);
    document.body.appendChild(b);
  }

  function moveReticle(cx, cy) {
    if (!reticleEl) {
      reticleEl = document.createElement('div');
      reticleEl.style.cssText = 'position:fixed;width:26px;height:26px;margin:-13px 0 0 -13px;z-index:9996;' +
        'pointer-events:none;border:2px solid rgba(240,171,252,.9);border-radius:50%;' +
        'box-shadow:0 0 10px rgba(240,171,252,.7),inset 0 0 6px rgba(240,171,252,.5)';
      document.body.appendChild(reticleEl);
    }
    reticleEl.style.left = cx + 'px';
    reticleEl.style.top = cy + 'px';
  }

  function pollGamepad() {
    if (attract || gamepadIndex === null) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[gamepadIndex];
    if (!gp) return;
    const ax = gp.axes || [], btn = gp.buttons || [];
    const DZ = 0.4;
    const held = i => !!(btn[i] && btn[i].pressed);
    const axis = i => (typeof ax[i] === 'number' ? ax[i] : 0);
    const layout = CONTROL_LAYOUTS[deriveSlug()] || { pad: 'dpad', actions: [] };

    // Directions: left stick + D-pad → arrow keys (edge-detected)
    setVK('ArrowLeft',  axis(0) < -DZ || held(14));
    setVK('ArrowRight', axis(0) >  DZ || held(15));
    setVK('ArrowUp',    axis(1) < -DZ || held(12));
    setVK('ArrowDown',  axis(1) >  DZ || held(13));

    // Face buttons A/B/X/Y (0-3) → the game's actions in order; RT (7) also fires action 0
    layout.actions.forEach(([label, code], i) => {
      setVK(code, held(i) || (i === 0 && held(7)));
    });

    // Start (9) → a momentary Space to begin / restart (universal start key)
    const startNow = held(9);
    if (startNow !== prevStart) key('Space', startNow ? 'keydown' : 'keyup');
    prevStart = startNow;

    // Aim games: right stick steers a virtual cursor; deflection (or RT) fires
    if (layout.aim) {
      const cv = document.getElementById('gameCanvas');
      if (cv) {
        const rx = axis(2), ry = axis(3);
        const mag = Math.hypot(rx, ry);
        if (!aimCursor) aimCursor = { x: cv.width / 2, y: cv.height / 2 };
        if (mag > DZ) {
          aimCursor.x = Math.max(0, Math.min(cv.width, aimCursor.x + rx * 12));
          aimCursor.y = Math.max(0, Math.min(cv.height, aimCursor.y + ry * 12));
        }
        const rect = cv.getBoundingClientRect();
        const clientX = rect.left + (aimCursor.x / cv.width) * rect.width;
        const clientY = rect.top + (aimCursor.y / cv.height) * rect.height;
        cv.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true }));
        moveReticle(clientX, clientY);
        const fireNow = mag > DZ || held(7);
        if (fireNow !== prevAimFire) {
          cv.dispatchEvent(new MouseEvent(fireNow ? 'mousedown' : 'mouseup', { clientX, clientY, bubbles: true }));
          prevAimFire = fireNow;
        }
      }
    }
  }

  function releaseAllVK() {
    Object.keys(vk).forEach(c => setVK(c, false));
    if (prevStart) { key('Space', 'keyup'); prevStart = false; }
  }

  // Standard gamepads are owned by arcade-controls.js. A second poller here
  // used to dispatch competing key releases and could cancel held input.

  const API = {
    slug: deriveSlug(),
    attract,
    isTouch,
    GAMES,
    get, add, top, qualifies, boardHTML, hallOfFame, promptInitials, submitFlow, injectStyle
  };
  window.Arcade = API;

  // Make the .sm-lb board styling available on every game page (for game-over boards)
  if (typeof document !== 'undefined') {
    if (document.head) injectStyle();
    else window.addEventListener('DOMContentLoaded', injectStyle);
  }
})();
