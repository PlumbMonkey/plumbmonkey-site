/* ============================================================
   Plumbmonkey API — global arcade high scores + private visit counts.

   The site is a static export on GitHub Pages, so this Worker is its only
   backend. Two very different audiences use it:

     PUBLIC  GET  /scores?game=<slug>   top 10 for one game
             GET  /scores               top 10 for every game (the list page)
             POST /run                  a single-use run token (see below)
             POST /scores               submit initials + score
             POST /track                visit/click counts from /shared/track.js

     PRIVATE GET  /admin                the dashboard (HTTP Basic auth)
             GET  /admin/data           its numbers
             POST /admin/delete-score   remove a cheater's entry

   CHEATING. A browser game can never prove a score is real — the player owns
   the code. What this does is make the obvious abuse not worth it:
     · each score needs a run token, signed here, that can only be used once
     · a score has to be reachable at POINTS_PER_SECOND since the token was
       issued, so "999999999 one second after load" is refused
     · SUBMITS_PER_HOUR per visitor, and a hard MAX_SCORE
     · refusals are counted (kind=reject) so the dashboard shows attempts, and
       any entry that slips through can be deleted from there.

   PRIVACY. No cookies and no stored IPs. Visitors are counted with a hash
   salted by the day, so the same person cannot be followed across days, and
   events are rolled up into daily counts rather than kept one by one.
   ============================================================ */

// Must match GAMES in public/arcade/games/leaderboard.js — `npm test` in the
// site checks the two lists agree.
const GAMES = new Set([
  'spectral-manor-revenger',
  'spectral-manor-mess-hall',
  'spectral-manor-swarm',
  'spectral-skyline',
  'spectral-manor-soul-circuit',
  'spectral-manor-crystal-dimension',
  'spectral-manor-infestation',
  'spectral-manor-cruise',
  'spectral-manor-beam-me-up',
  'spectral-manor-amp-rampage',
  'spectral-manor-hooded',
  'spectral-manor-graveyard-shift'
]);

const TOP = 10;
const MAX_SCORE = 50_000_000;
const POINTS_PER_SECOND = 5_000;       // generous; tighten per game if cheats appear
const POINTS_HEADSTART = 5_000;        // lets a very short run still post a score
const MIN_RUN_MS = 3_000;
const MAX_RUN_MS = 24 * 3600_000;
const SUBMITS_PER_HOUR = 12;
const TOP_CACHE_MS = 10_000;

const TRACK_KINDS = new Set(['view', 'click', 'finish']);
const TRACK_MAX_EVENTS = 50;

// Initials a public board should not show. Replaced, not refused, so the
// player still gets their place.
const BLOCKED_INITIALS = new Set([
  'ASS', 'FUK', 'FUC', 'FCK', 'FKU', 'KKK', 'NIG', 'NGR', 'CUM', 'DIK',
  'DIC', 'COK', 'FAG', 'TIT', 'CNT', 'KYS', 'SHT', 'PIS', 'SUK', 'SUC'
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = originAllowed(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
    }

    try {
      const res = await route(request, env, ctx, url, allowed);
      if (!url.pathname.startsWith('/admin')) {
        for (const [k, v] of Object.entries(corsHeaders(origin, allowed))) res.headers.set(k, v);
      }
      return res;
    } catch (err) {
      console.error(err);
      return json({ ok: false, reason: 'server-error' }, 500);
    }
  }
};

async function route(request, env, ctx, url, allowed) {
  const { pathname } = url;
  const method = request.method;

  if (method === 'GET' && pathname === '/scores') {
    const game = url.searchParams.get('game');
    if (game) {
      if (!GAMES.has(game)) return json({ ok: false, reason: 'bad-game' }, 400);
      return json({ ok: true, game, top: await topFor(env, game) }, 200, { 'Cache-Control': 'public, max-age=10' });
    }
    return json({ ok: true, games: await topForAll(env) }, 200, { 'Cache-Control': 'public, max-age=15' });
  }

  // Everything below writes, so only the site itself may call it.
  if (method === 'POST' && ['/run', '/scores', '/track'].includes(pathname)) {
    if (!allowed) return json({ ok: false, reason: 'origin' }, 403);
    if (pathname === '/run') return issueRun(request, env);
    if (pathname === '/scores') return submitScore(request, env);
    return track(request, env);
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return admin(request, env, url);
  }

  if (pathname === '/') return new Response('plumbmonkey-api', { status: 200 });
  return json({ ok: false, reason: 'not-found' }, 404);
}

/* ---------------- scores ---------------- */

// Per-isolate cache of each game's top 10. Isolates are short-lived and not
// shared, so this is only a cheap guard against a burst of reads, not a store.
const topCache = new Map();

async function topFor(env, game) {
  const hit = topCache.get(game);
  if (hit && Date.now() - hit.at < TOP_CACHE_MS) return hit.top;
  const { results } = await env.DB.prepare(
    'SELECT initials AS i, score AS s, created_at AS t FROM scores WHERE game = ? ORDER BY score DESC, created_at ASC LIMIT ?'
  ).bind(game, TOP).all();
  topCache.set(game, { at: Date.now(), top: results });
  return results;
}

async function topForAll(env) {
  const { results } = await env.DB.prepare(
    `SELECT game, initials AS i, score AS s, created_at AS t FROM (
       SELECT game, initials, score, created_at,
              ROW_NUMBER() OVER (PARTITION BY game ORDER BY score DESC, created_at ASC) AS rn
       FROM scores
     ) WHERE rn <= ? ORDER BY game, rn`
  ).bind(TOP).all();
  const games = {};
  for (const slug of GAMES) games[slug] = [];
  for (const r of results) {
    if (games[r.game]) games[r.game].push({ i: r.i, s: r.s, t: r.t });
  }
  return games;
}

async function issueRun(request, env) {
  const body = await readJson(request);
  const game = body && body.game;
  if (!GAMES.has(game)) return json({ ok: false, reason: 'bad-game' }, 400);
  const nonce = crypto.randomUUID();
  const t = Date.now();
  const payload = `${game}.${t}.${nonce}`;
  const sig = await hmac(env.TOKEN_SECRET, payload);
  return json({ ok: true, run: `${payload}.${sig}` });
}

async function submitScore(request, env) {
  const body = await readJson(request);
  if (!body) return json({ ok: false, reason: 'bad-body' }, 400);
  const game = body.game;
  const score = Math.round(Number(body.score));
  const run = String(body.run || '');

  const reject = async (reason, status = 400) => {
    if (GAMES.has(game)) await countEvents(env, [['reject', game, reason]]);
    return json({ ok: false, reason }, status);
  };

  if (!GAMES.has(game)) return json({ ok: false, reason: 'bad-game' }, 400);
  if (!Number.isFinite(score) || score <= 0 || score > MAX_SCORE) return reject('bad-score');

  // run = <game>.<issued ms>.<nonce>.<signature>
  const parts = run.split('.');
  if (parts.length !== 4 || parts[0] !== game) return reject('bad-run');
  const expected = await hmac(env.TOKEN_SECRET, parts.slice(0, 3).join('.'));
  if (!timingSafeEqual(expected, parts[3])) return reject('bad-run');
  const age = Date.now() - Number(parts[1]);
  if (!(age >= MIN_RUN_MS && age <= MAX_RUN_MS)) return reject('bad-run');
  if (score > POINTS_HEADSTART + POINTS_PER_SECOND * (age / 1000)) return reject('too-fast');

  const ipHash = await visitorHash(request, env, 'ip');
  const hourAgo = Date.now() - 3600_000;
  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM scores WHERE ip_hash = ? AND created_at > ?'
  ).bind(ipHash, hourAgo).first();
  if (recent && recent.n >= SUBMITS_PER_HOUR) return reject('too-many', 429);

  const initials = cleanInitials(body.initials);
  const now = Date.now();
  try {
    await env.DB.prepare(
      'INSERT INTO scores (game, initials, score, created_at, ip_hash, run) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(game, initials, score, now, ipHash, run).run();
  } catch (err) {
    if (String(err).includes('UNIQUE')) return reject('duplicate', 409);
    throw err;
  }

  topCache.delete(game);
  const rankRow = await env.DB.prepare(
    'SELECT COUNT(*) + 1 AS rank FROM scores WHERE game = ? AND (score > ? OR (score = ? AND created_at < ?))'
  ).bind(game, score, score, now).first();
  return json({ ok: true, rank: rankRow.rank, initials, top: await topFor(env, game) });
}

function cleanInitials(raw) {
  let s = String(raw || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  if (s.length < 2) s = 'AAA';
  if (BLOCKED_INITIALS.has(s)) s = '***';
  return s;
}

/* ---------------- visit counts ---------------- */

// Body: { p: "/theatre/viewer.html", e: [["view",""], ["click","Enter the Manor"], ...] }
// Sent with navigator.sendBeacon as text/plain, which skips the CORS preflight.
async function track(request, env) {
  const body = await readJson(request);
  if (!body || !Array.isArray(body.e)) return new Response(null, { status: 204 });
  const path = cleanText(body.p, 120) || '/';
  const events = [];
  let sawView = false;
  for (const ev of body.e.slice(0, TRACK_MAX_EVENTS)) {
    if (!Array.isArray(ev) || !TRACK_KINDS.has(ev[0])) continue;
    const label = ev[0] === 'view' ? '' : cleanText(ev[1], 80);
    if (ev[0] === 'view') sawView = true;
    events.push([ev[0], path, label]);
  }
  if (!events.length) return new Response(null, { status: 204 });

  const stmts = [];
  if (sawView) {
    const hash = await visitorHash(request, env, 'visitor');
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO visitors (day, hash) VALUES (?, ?)').bind(today(), hash));
  }
  await countEvents(env, events, stmts);
  return new Response(null, { status: 204 });
}

async function countEvents(env, events, stmts = []) {
  const day = today();
  for (const [kind, path, label] of events) {
    stmts.push(env.DB.prepare(
      `INSERT INTO events (day, kind, path, label, count) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT (day, kind, path, label) DO UPDATE SET count = count + 1`
    ).bind(day, kind, path, label));
  }
  if (stmts.length) await env.DB.batch(stmts);
}

/* ---------------- admin ---------------- */

async function admin(request, env, url) {
  if (!env.ADMIN_PASSWORD) return new Response('Set ADMIN_PASSWORD first: npx wrangler secret put ADMIN_PASSWORD', { status: 503 });
  if (!(await authorised(request, env))) {
    return new Response('Password required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Plumbmonkey dashboard", charset="UTF-8"', 'Cache-Control': 'no-store' }
    });
  }
  const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

  if (request.method === 'GET' && url.pathname === '/admin') {
    return new Response(DASHBOARD_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', ...noStore } });
  }

  if (request.method === 'GET' && url.pathname === '/admin/data') {
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
    const since = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);
    const q = (sql, ...args) => env.DB.prepare(sql).bind(...args).all().then(r => r.results);
    const [visitors, views, pages, clicks, finishes, rejects, scores] = await Promise.all([
      q('SELECT day, COUNT(*) AS n FROM visitors WHERE day >= ? GROUP BY day ORDER BY day', since),
      q("SELECT day, SUM(count) AS n FROM events WHERE kind = 'view' AND day >= ? GROUP BY day ORDER BY day", since),
      q("SELECT path, SUM(count) AS n FROM events WHERE kind = 'view' AND day >= ? GROUP BY path ORDER BY n DESC LIMIT 50", since),
      q("SELECT path, label, SUM(count) AS n FROM events WHERE kind = 'click' AND day >= ? GROUP BY path, label ORDER BY n DESC LIMIT 100", since),
      q("SELECT label AS game, SUM(count) AS n FROM events WHERE kind = 'finish' AND day >= ? GROUP BY label ORDER BY n DESC", since),
      q("SELECT path AS game, label AS reason, SUM(count) AS n FROM events WHERE kind = 'reject' AND day >= ? GROUP BY path, label ORDER BY n DESC", since),
      q('SELECT id, game, initials, score, created_at FROM scores ORDER BY created_at DESC LIMIT 200')
    ]);
    return json({ ok: true, days, since, visitors, views, pages, clicks, finishes, rejects, scores }, 200, noStore);
  }

  // The custom header can't be sent cross-site without a CORS preflight, which
  // /admin never answers — so a forged form on another site can't delete scores.
  if (request.method === 'POST' && url.pathname === '/admin/delete-score' && request.headers.get('X-PM-Admin') === '1') {
    const body = await readJson(request);
    const id = Number(body && body.id);
    if (!Number.isInteger(id)) return json({ ok: false, reason: 'bad-id' }, 400, noStore);
    await env.DB.prepare('DELETE FROM scores WHERE id = ?').bind(id).run();
    topCache.clear();
    return json({ ok: true }, 200, noStore);
  }

  return json({ ok: false, reason: 'not-found' }, 404, noStore);
}

async function authorised(request, env) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded = '';
  try { decoded = atob(header.slice(6)); } catch { return false; }
  const password = decoded.slice(decoded.indexOf(':') + 1);
  const [a, b] = await Promise.all([sha256Hex(password), sha256Hex(env.ADMIN_PASSWORD)]);
  return timingSafeEqual(a, b);
}

/* ---------------- helpers ---------------- */

function originAllowed(origin, env) {
  if (!origin) return false;
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  return env.DEV === '1' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(origin, allowed) {
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '*',
    'Access-Control-Allow-Methods': allowed ? 'GET, POST, OPTIONS' : 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

async function readJson(request) {
  try {
    const text = await request.text();
    if (text.length > 16_000) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function cleanText(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function visitorHash(request, env, purpose) {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ua = purpose === 'visitor' ? (request.headers.get('User-Agent') || '') : '';
  return (await sha256Hex(`${purpose}|${today()}|${ip}|${ua}|${env.TOKEN_SECRET}`)).slice(0, 32);
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret, message) {
  if (!secret) throw new Error('TOKEN_SECRET is not set');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------------- dashboard page ---------------- */

const DASHBOARD_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Plumbmonkey — Visits &amp; Scores</title>
<style>
  :root { color-scheme: dark; --bg:#0d0a14; --panel:#16111f; --line:#2a2238; --ink:#e7e1f2; --dim:#9a91ad; --gold:#f0c274; --bar:#7c3aed; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.45 system-ui,sans-serif; }
  header { display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid var(--line); }
  h1 { margin:0; font-size:18px; color:var(--gold); letter-spacing:.04em; }
  main { display:grid; grid-template-columns:repeat(auto-fit,minmax(360px,1fr)); gap:16px; padding:16px 24px 40px; }
  section { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; min-width:0; }
  section.wide { grid-column:1/-1; }
  h2 { margin:0 0 10px; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--dim); }
  .stats { display:flex; gap:28px; flex-wrap:wrap; }
  .stat b { display:block; font-size:26px; color:var(--ink); font-variant-numeric:tabular-nums; }
  .stat span { color:var(--dim); font-size:12px; }
  .scroll { overflow:auto; max-height:420px; }
  table { width:100%; border-collapse:collapse; }
  td, th { padding:5px 6px; text-align:left; border-bottom:1px solid var(--line); vertical-align:middle; }
  th { color:var(--dim); font-weight:600; font-size:12px; position:sticky; top:0; background:var(--panel); }
  td.n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; width:1%; }
  .barcell { position:relative; }
  .bar { position:absolute; inset:3px auto 3px 0; background:var(--bar); opacity:.28; border-radius:3px; }
  .barcell span { position:relative; overflow-wrap:anywhere; }
  .muted { color:var(--dim); }
  .chart { display:flex; align-items:flex-end; gap:2px; height:120px; }
  .chart div { flex:1; background:var(--bar); border-radius:2px 2px 0 0; min-height:2px; position:relative; }
  .chart div:hover::after { content:attr(data-tip); position:absolute; bottom:100%; left:50%; transform:translateX(-50%); white-space:nowrap; background:#000; padding:2px 6px; border-radius:4px; font-size:11px; }
  select, button { font:inherit; color:var(--ink); background:#221a30; border:1px solid var(--line); border-radius:6px; padding:5px 10px; cursor:pointer; }
  button.del { color:#fca5a5; padding:2px 8px; font-size:12px; }
</style></head>
<body>
<header><h1>Plumbmonkey — Visits &amp; Scores</h1>
  <label class="muted">Range <select id="days"><option value="7">7 days</option><option value="30" selected>30 days</option><option value="90">90 days</option><option value="365">1 year</option></select></label>
</header>
<main>
  <section class="wide"><div class="stats" id="stats"></div></section>
  <section class="wide"><h2>Unique visitors per day</h2><div class="chart" id="chart"></div></section>
  <section><h2>Pages viewed</h2><div class="scroll"><table id="pages"></table></div></section>
  <section><h2>Clicks</h2><div class="scroll"><table id="clicks"></table></div></section>
  <section><h2>Games finished</h2><div class="scroll"><table id="finishes"></table></div></section>
  <section><h2>Refused score submissions</h2><div class="scroll"><table id="rejects"></table></div></section>
  <section class="wide"><h2>Latest scores (delete cheats here)</h2><div class="scroll"><table id="scores"></table></div></section>
</main>
<script>
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = n => Number(n).toLocaleString();

function barTable(el, head, rows, cols) {
  if (!rows.length) { el.innerHTML = '<tr><td class="muted">Nothing yet.</td></tr>'; return; }
  const max = Math.max(...rows.map(r => r.n));
  el.innerHTML = '<tr>' + head.map((h, i) => '<th' + (i === head.length - 1 ? ' class="n"' : '') + '>' + h + '</th>').join('') + '</tr>' +
    rows.map(r => '<tr>' + cols.map((c, i) => i === 0
      ? '<td class="barcell"><div class="bar" style="width:' + (100 * r.n / max).toFixed(1) + '%"></div><span>' + esc(r[c] || '(none)') + '</span></td>'
      : '<td class="muted">' + esc(r[c] || '') + '</td>').join('') + '<td class="n">' + fmt(r.n) + '</td></tr>').join('');
}

async function load() {
  const days = $('days').value;
  // location.origin rather than a relative URL: a page opened as
  // http://user:pass@host cannot fetch relative URLs at all.
  let d;
  try {
    const res = await fetch(location.origin + '/admin/data?days=' + days, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    d = await res.json();
  } catch (err) {
    $('stats').innerHTML = '<div class="stat"><b>—</b><span>Could not load the numbers: ' + esc(err.message) + '</span></div>';
    return;
  }
  const sum = a => a.reduce((t, r) => t + Number(r.n), 0);

  $('stats').innerHTML = [
    [sum(d.visitors), 'visitor-days'], [sum(d.views), 'page views'], [sum(d.clicks), 'clicks'],
    [sum(d.finishes), 'games finished'], [sum(d.rejects), 'refused scores']
  ].map(([n, l]) => '<div class="stat"><b>' + fmt(n) + '</b><span>' + l + ' · last ' + d.days + ' days</span></div>').join('');

  const byDay = Object.fromEntries(d.visitors.map(r => [r.day, r.n]));
  const cells = [];
  for (let t = Date.parse(d.since); t <= Date.now(); t += 86400000) {
    const day = new Date(t).toISOString().slice(0, 10);
    cells.push({ day, n: byDay[day] || 0 });
  }
  const peak = Math.max(1, ...cells.map(c => c.n));
  $('chart').innerHTML = cells.map(c => '<div style="height:' + (100 * c.n / peak) + '%" data-tip="' + c.day + ': ' + c.n + '"></div>').join('');

  barTable($('pages'), ['Page', 'Views'], d.pages, ['path']);
  barTable($('clicks'), ['Clicked', 'Page', 'Clicks'], d.clicks, ['label', 'path']);
  barTable($('finishes'), ['Game', 'Finished'], d.finishes, ['game']);
  barTable($('rejects'), ['Game', 'Reason', 'Count'], d.rejects, ['game', 'reason']);

  $('scores').innerHTML = d.scores.length
    ? '<tr><th>When</th><th>Game</th><th>Initials</th><th class="n">Score</th><th></th></tr>' + d.scores.map(s =>
        '<tr><td class="muted">' + new Date(s.created_at).toLocaleString() + '</td><td>' + esc(s.game) + '</td><td>' + esc(s.initials) +
        '</td><td class="n">' + fmt(s.score) + '</td><td class="n"><button class="del" data-id="' + s.id + '">Delete</button></td></tr>').join('')
    : '<tr><td class="muted">No scores yet.</td></tr>';
}

$('scores').addEventListener('click', async e => {
  const id = e.target.getAttribute('data-id');
  if (!id || !confirm('Delete this score from the public board?')) return;
  await fetch(location.origin + '/admin/delete-score', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-PM-Admin': '1' }, body: JSON.stringify({ id: Number(id) }) });
  load();
});
$('days').addEventListener('change', load);
load();
</script>
</body></html>`;
