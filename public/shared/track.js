/* ============================================================
   Plumbmonkey — the one client for workers/plumbmonkey-api.

   Two jobs:
     · window.PMApi.get / .post — used by the arcade leaderboard
       (public/arcade/games/leaderboard.js) and the arcade page
       (app/arcade/ArcadeRoom.tsx) for the global top 10s.
     · private visit counts: a page view on load, and a count for every
       link/button click, labelled by its text. They land on the dashboard at
       <API>/admin and nowhere else — nothing here is shown on the site.

   No cookies, nothing stored in the browser, no IPs kept server-side. Visitors
   who send Global Privacy Control or Do Not Track are not counted at all (the
   leaderboard still works for them).

   Loaded by app/layout.tsx (every Next.js page), by the standalone pages next
   to /shared/rooms.js, and injected into the games by leaderboard.js.
   ============================================================ */
(function () {
  if (window.PMApi) return;

  // Local pages talk to `npm run dev` in workers/plumbmonkey-api; the live site
  // talks to the deployed Worker.
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var BASE = LOCAL ? 'http://127.0.0.1:8787' : 'https://plumbmonkey-api.plumbmonkey-api.workers.dev';

  // Plain text, not JSON: a text/plain POST skips the CORS preflight, which
  // halves the requests. The Worker parses the body either way.
  function post(path, body) {
    return fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
      keepalive: true
    }).then(function (r) { return r.json(); });
  }
  function get(path) {
    return fetch(BASE + path).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  var attract = /[?&]attract\b/.test(location.search);  // arcade cabinet previews
  var optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  var counting = !attract && !optedOut;

  var queue = [];
  var timer = null;

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!queue.length) return;
    var body = JSON.stringify({ p: location.pathname, e: queue.splice(0, 50) });
    var sent = false;
    try {
      sent = navigator.sendBeacon && navigator.sendBeacon(BASE + '/track', new Blob([body], { type: 'text/plain' }));
    } catch (e) {}
    if (!sent) {
      try { fetch(BASE + '/track', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true }); } catch (e) {}
    }
    if (queue.length) flush();
  }

  function track(kind, label) {
    if (!counting) return;
    queue.push([kind, String(label || '').slice(0, 80)]);
    if (queue.length >= 20) flush();
    else if (!timer) timer = setTimeout(flush, 4000);
  }

  // What a click is called on the dashboard. data-track wins, then the
  // accessible name, then the visible text, then where the link goes.
  function labelFor(el) {
    var named = el.getAttribute('data-track') || el.getAttribute('aria-label') || el.getAttribute('title');
    if (named) return named;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) return text;
    var href = el.getAttribute('href');
    if (href) return href;
    return el.id ? '#' + el.id : el.tagName.toLowerCase();
  }

  if (counting) {
    // A page framed inside another (the 3D arcade inside /arcade, instruments
    // inside /music) would count twice, so only the top page counts the view.
    var framed = false;
    try { framed = window.top !== window.self; } catch (e) { framed = true; }
    if (!framed) track('view');

    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest &&
        e.target.closest('a[href], button, [role="button"], summary, [data-track]');
      if (el) track('click', labelFor(el));
    }, true);

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
  }

  window.PMApi = { base: BASE, get: get, post: post, track: track, counting: counting };
})();
