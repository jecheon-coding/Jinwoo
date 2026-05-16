-- records 테이블: id SERIAL PK 추가 (다중 계약 같은 날짜 지원)
-- 현재 DB: record_date DATE PRIMARY KEY (날짜당 1건만 가능)
-- 변경 후:  id SERIAL PRIMARY KEY + UNIQUE(record_date, contract_id)
-- ※ 같은 날짜에 계약별로 별도 기록이 필요할 때 실행

-- 1. id SERIAL 컬럼 추가 (기존 행들에 자동으로 1, 2, 3... 부여)
ALTER TABLE records ADD COLUMN id SERIAL;

-- 2. 기존 record_date PK 제거
ALTER TABLE records DROP CONSTRAINT records_pkey;

-- 3. id를 새 PK로 설정
ALTER TABLE records ADD PRIMARY KEY (id);

-- 4. (record_date, contract_id) 유니크 제약 — 같은 날짜+계약 중복 방지
ALTER TABLE records ADD CONSTRAINT records_date_contract_uq
  UNIQUE (record_date, contract_id);

-- ※ 현재 contract_id=NULL 레코드들은 NULL끼리 유니크 제약 미적용 (PostgreSQL 동작)
--    필요 시 아래 마이그레이션도 실행:
-- UPDATE records SET contract_id = 1 WHERE contract_id IS NULL;
-- UPDATE attendance SET contract_id = 1 WHERE contract_id IS NULL;
