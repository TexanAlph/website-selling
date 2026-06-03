-- Reference only — Mac Mini SQLite uses storage/schema.sql inbound_calls table

CREATE TABLE IF NOT EXISTS inbound_calls (
  id                TEXT PRIMARY KEY,
  from_phone        TEXT NOT NULL,
  call_sid          TEXT,
  recording_sid     TEXT,
  recording_url     TEXT,
  duration_seconds  INTEGER,
  business_name     TEXT,
  listened_at       TEXT,
  created_at        TEXT NOT NULL
);
