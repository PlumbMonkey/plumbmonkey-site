-- Plumbmonkey API schema. Idempotent: safe to re-run with `npm run db:local`
-- or `npm run db:remote`.

-- One row per submitted arcade score. Duplicate initials are allowed, the way
-- a real cabinet allows them.
CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game       TEXT    NOT NULL,
  initials   TEXT    NOT NULL,
  score      INTEGER NOT NULL,
  created_at INTEGER NOT NULL,           -- unix ms
  ip_hash    TEXT    NOT NULL,           -- daily-salted hash, for rate limiting only
  run        TEXT    NOT NULL UNIQUE     -- the single-use run token, so a run can't be replayed
);
CREATE INDEX IF NOT EXISTS scores_by_game ON scores (game, score DESC, created_at);
CREATE INDEX IF NOT EXISTS scores_by_ip   ON scores (ip_hash, created_at);

-- Private visit counts, rolled up per day. No raw events, no IPs, no cookies:
-- a click on the same button on the same page adds 1 to one row.
--   kind = view | click | finish | reject
CREATE TABLE IF NOT EXISTS events (
  day   TEXT    NOT NULL,                -- YYYY-MM-DD (UTC)
  kind  TEXT    NOT NULL,
  path  TEXT    NOT NULL,
  label TEXT    NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, path, label)
);

-- Unique visitors per day. The hash is salted with the day, so the same person
-- cannot be linked from one day to the next.
CREATE TABLE IF NOT EXISTS visitors (
  day  TEXT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (day, hash)
);
