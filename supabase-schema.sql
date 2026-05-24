-- ─────────────────────────────────────────────────────────────────────────
-- TrackAlert — Supabase Database Schema
-- Run this in your Supabase project → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crossing_id   INTEGER NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('blocked', 'warning', 'clear')),
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast crossing lookups
CREATE INDEX IF NOT EXISTS idx_reports_crossing_id ON reports(crossing_id);
CREATE INDEX IF NOT EXISTS idx_reports_expires_at  ON reports(expires_at);

-- Row Level Security: anyone can read, anyone can insert (no auth required for MVP)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public reads"   ON reports FOR SELECT USING (true);
CREATE POLICY "Allow public inserts" ON reports FOR INSERT WITH CHECK (true);

-- Auto-cleanup: delete expired reports (run daily via Supabase CRON or pg_cron)
-- Optional: install pg_cron extension and enable this:
-- SELECT cron.schedule('cleanup-expired-reports', '0 * * * *',
--   $$ DELETE FROM reports WHERE expires_at < now(); $$
-- );

-- ─────────────────────────────────────────────────────────────────────────
-- Enable Realtime on the reports table
-- ─────────────────────────────────────────────────────────────────────────
-- In Supabase dashboard: Database → Replication → Enable for "reports" table
-- OR run:
-- ALTER PUBLICATION supabase_realtime ADD TABLE reports;
