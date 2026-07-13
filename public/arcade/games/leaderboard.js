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
    { slug: 'spectral-food-fight',              title: 'Mess Hall' },
    { slug: 'spectral-robotron',                title: 'Swarm' },
    { slug: 'spectral-skyline',                 title: "Luno's Flight" },
    { slug: 'spectral-manor-soul-circuit',      title: 'Soul Circuit' },
    { slug: 'spectral-manor-crystal-dimension', title: 'Crystal Dimension' },
    { slug: 'spectral-manor-infestation',       title: 'Infestation' },
    { slug: 'spectral-manor-cruise',            title: 'Cruise' }
  ];

  function keyFor(slug) { return PREFIX + slug; }

  function get(slug) {
    try { return JSON.parse(localStorage.getItem(keyFor(slug))) || []; }
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
      <div class="sm-hint">Type A–Z · ← → move · ↑ ↓ change · Enter to submit</div>
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
      add(slug, chars.join(''), score);
      modal.remove();
      if (done) done();
    }

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
  function injectNav() {
    if (attract || document.querySelector('.sm-nav')) return;
    const s = document.createElement('style');
    s.textContent = `
      .sm-nav{position:fixed;top:10px;left:10px;z-index:9998;display:flex;gap:.5rem;
        font-family:'Segoe UI',system-ui,sans-serif;font-size:.78rem}
      .sm-nav a{color:#c084fc;text-decoration:none;padding:.3rem .7rem;border-radius:6px;
        background:rgba(26,16,37,.8);border:1px solid #3b2660;backdrop-filter:blur(4px);
        transition:all .15s;white-space:nowrap}
      .sm-nav a:hover{color:#fff;border-color:#c084fc;box-shadow:0 0 14px rgba(192,132,252,.5)}
      @media (max-width:520px){ .sm-nav{font-size:.7rem} }
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
    'spectral-food-fight':              { pad: 'dpad', actions: [['THROW', 'Space']], aim: true },
    'spectral-robotron':                { pad: 'dpad', actions: [['FIRE', 'Space']], aim: true },
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
      .sm-touch{position:fixed;left:0;right:0;bottom:0;z-index:9997;display:flex;
        justify-content:space-between;align-items:flex-end;padding:12px 14px;
        pointer-events:none;font-family:'Segoe UI',system-ui,sans-serif;touch-action:none}
      .sm-touch .sm-cluster{pointer-events:auto;display:flex;gap:10px;align-items:flex-end}
      .sm-tb{pointer-events:auto;display:flex;align-items:center;justify-content:center;
        color:#e9d5ff;background:rgba(26,16,37,.72);border:2px solid #7c3aed;border-radius:12px;
        font-weight:700;letter-spacing:1px;user-select:none;-webkit-user-select:none;touch-action:none;
        box-shadow:0 0 16px rgba(124,58,237,.35);backdrop-filter:blur(3px)}
      .sm-tb.active{background:rgba(124,58,237,.85);border-color:#e879f9;box-shadow:0 0 22px rgba(232,121,249,.7)}
      .sm-dir{width:58px;height:58px;font-size:1.6rem}
      .sm-lr{width:74px;height:70px;font-size:2rem}
      .sm-act{width:74px;height:74px;border-radius:50%;font-size:.8rem}
      .sm-dpad{display:grid;grid-template-columns:repeat(3,58px);grid-template-rows:repeat(3,58px);gap:6px}
      .sm-dpad .sm-up{grid-area:1/2} .sm-dpad .sm-left{grid-area:2/1}
      .sm-dpad .sm-right{grid-area:2/3} .sm-dpad .sm-down{grid-area:3/2}
      .sm-actions{flex-direction:row}
      @media (max-width:400px){ .sm-dir{width:50px;height:50px} .sm-dpad{grid-template-columns:repeat(3,50px);grid-template-rows:repeat(3,50px)} .sm-act{width:64px;height:64px} }
    `;
    document.head.appendChild(css);

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
