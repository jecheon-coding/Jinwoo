-- 다중 계약 지원: contracts 테이블 추가 및 records/attendance에 contract_id 연결
-- 적용일: 2026-05-16

-- 1. contracts 테이블 생성
CREATE TABLE IF NOT EXISTS contracts (
  id                 SERIAL PRIMARY KEY,
  name               TEXT NOT NULL,
  number             TEXT DEFAULT '',
  amount             INTEGER DEFAULT 0,
  unit_price         NUMERIC(10,2) DEFAULT 0,
  area               TEXT DEFAULT '',
  client_name        TEXT DEFAULT '',
  client_recipient_1 TEXT DEFAULT '',
  client_recipient_2 TEXT DEFAULT '',
  contract_start     DATE,
  contract_end       DATE,
  construction_start DATE,
  active             BOOLEAN DEFAULT true,
  sort_order         INTEGER DEFAULT 0
);

-- 2. records에 contract_id 추가
ALTER TABLE records
  ADD COLUMN IF NOT EXISTS contract_id INTEGER REFERENCES contracts(id);

-- 3. attendance에 contract_id 추가
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS contract_id INTEGER REFERENCES contracts(id);

-- ※ 기존 데이터 마이그레이션 (계약 등록 후 실행)
-- contracts 테이블에 첫 번째 계약을 등록한 뒤 아래 실행:
--
-- UPDATE records    SET contract_id = 1 WHERE contract_id IS NULL;
-- UPDATE attendance SET contract_id = 1 WHERE contract_id IS NULL;
