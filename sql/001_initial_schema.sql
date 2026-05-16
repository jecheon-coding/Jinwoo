-- 초기 스키마 (records, attendance, workers, settings)
-- 적용일: 2026-05-16 이전

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS workers (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  position   TEXT DEFAULT '수거원',
  dob        TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  active     BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS records (
  record_date    DATE PRIMARY KEY,  -- 실제 DB는 record_date가 PK (id 없음)
  vehicle_number TEXT,
  driver         TEXT,
  route          TEXT,
  op_start       TEXT,
  op_end         TEXT,
  trips          INTEGER DEFAULT 1,
  start_km       NUMERIC,
  end_km         NUMERIC,
  fuel           NUMERIC,
  weight_1       NUMERIC DEFAULT 0,
  weight_2       NUMERIC DEFAULT 0,
  weight_3       NUMERIC DEFAULT 0,
  chip_3l        INTEGER DEFAULT 0,
  chip_5l        INTEGER DEFAULT 0,
  chip_20l       INTEGER DEFAULT 0,
  chip_120l      INTEGER DEFAULT 0,
  notes          TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  id          SERIAL PRIMARY KEY,
  record_date DATE NOT NULL,
  worker_id   INTEGER REFERENCES workers(id),
  value       NUMERIC DEFAULT 1.0
);
