-- Mac Mini SQLite — primary database for web dialer (no Supabase)

CREATE TABLE IF NOT EXISTS leads (
  id                TEXT PRIMARY KEY,
  business_name     TEXT NOT NULL,
  phone             TEXT NOT NULL UNIQUE,
  website           TEXT,
  status            TEXT NOT NULL DEFAULT 'New',
  niche             TEXT,
  assigned_rep      TEXT,
  status_changed_at TEXT NOT NULL,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS leads_status_created_idx
  ON leads (status, created_at ASC);

CREATE INDEX IF NOT EXISTS leads_rep_new_idx
  ON leads (assigned_rep, created_at ASC)
  WHERE status = 'New';

CREATE TABLE IF NOT EXISTS coach_messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  lead_id     TEXT REFERENCES leads (id) ON DELETE SET NULL,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS coach_messages_session_created_idx
  ON coach_messages (session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS call_sessions (
  id                TEXT PRIMARY KEY,
  lead_id           TEXT REFERENCES leads (id) ON DELETE SET NULL,
  niche             TEXT,
  call_source       TEXT NOT NULL,
  rep_name          TEXT,
  started_at        TEXT NOT NULL,
  ended_at          TEXT,
  outcome_status    TEXT,
  duration_seconds  INTEGER,
  transcript_full   TEXT,
  summary           TEXT,
  objections        TEXT,
  rep_score         INTEGER,
  recommendations   TEXT,
  opener_suggestion TEXT,
  analysis_status   TEXT NOT NULL DEFAULT 'pending',
  analyzed_at       TEXT,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS call_sessions_pending_idx
  ON call_sessions (ended_at ASC)
  WHERE analysis_status = 'pending' AND ended_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS playbook_entries (
  id                 TEXT PRIMARY KEY,
  niche              TEXT NOT NULL DEFAULT 'all',
  objection_pattern  TEXT NOT NULL,
  winning_response   TEXT NOT NULL,
  source_session_id  TEXT,
  win_count          INTEGER NOT NULL DEFAULT 0,
  loss_count         INTEGER NOT NULL DEFAULT 0,
  score              REAL NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (niche, objection_pattern)
);

CREATE INDEX IF NOT EXISTS playbook_entries_niche_score_idx
  ON playbook_entries (niche, score DESC);

CREATE TABLE IF NOT EXISTS daily_insights (
  id          TEXT PRIMARY KEY,
  report_date TEXT NOT NULL UNIQUE,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scraper_runs (
  id                      TEXT PRIMARY KEY,
  started_at              TEXT NOT NULL,
  finished_at             TEXT,
  status                  TEXT NOT NULL DEFAULT 'running',
  leads_upserted          INTEGER NOT NULL DEFAULT 0,
  search_api_calls        INTEGER NOT NULL DEFAULT 0,
  search_cache_hits       INTEGER NOT NULL DEFAULT 0,
  error_message           TEXT,
  text_search_http_calls  INTEGER NOT NULL DEFAULT 0,
  place_details_http_calls INTEGER NOT NULL DEFAULT 0,
  estimated_usd           REAL,
  created_at              TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS scraper_runs_started_idx
  ON scraper_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS coach_feedback (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  message_id  TEXT,
  rep_name    TEXT NOT NULL,
  helpful     INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);
