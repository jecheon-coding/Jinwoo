-- Supabase SQL Editor에서 아래 전체를 복사 붙여넣기 후 실행하세요.

CREATE TABLE IF NOT EXISTS records (
  record_date    DATE PRIMARY KEY,
  vehicle_number TEXT,
  driver         TEXT,
  route          TEXT,
  op_start       TEXT,
  op_end         TEXT,
  trips          INT DEFAULT 1,
  weight_1       NUMERIC(10,3) DEFAULT 0,
  weight_2       NUMERIC(10,3) DEFAULT 0,
  weight_3       NUMERIC(10,3) DEFAULT 0,
  chip_3l        INT DEFAULT 0,
  chip_5l        INT DEFAULT 0,
  chip_20l       INT DEFAULT 0,
  chip_120l      INT DEFAULT 0,
  start_km       NUMERIC(10,3),
  end_km         NUMERIC(10,3),
  fuel           NUMERIC(6,1),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workers (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  position       TEXT DEFAULT '수거원',
  dob            TEXT,
  sort_order     INT DEFAULT 0,
  active         BOOLEAN DEFAULT TRUE,
  monthly_salary INT DEFAULT 0,
  bank_name      TEXT DEFAULT '',
  bank_account   TEXT DEFAULT '',
  phone          TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS attendance (
  record_date DATE NOT NULL,
  worker_id   INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  value       NUMERIC(3,1) DEFAULT 0,
  PRIMARY KEY (record_date, worker_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);

INSERT INTO settings (key, value) VALUES
  ('company_name',     ''),
  ('company_reg',      ''),
  ('company_addr',     ''),
  ('company_tel',      ''),
  ('client_name',      ''),
  ('area',             '2구역'),
  ('unit_price',       '0'),
  ('vehicle_number',   '89오4821'),
  ('driver',           ''),
  ('period_start_day', '27')
ON CONFLICT (key) DO NOTHING;
