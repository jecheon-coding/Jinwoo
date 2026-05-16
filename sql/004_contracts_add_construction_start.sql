-- contracts 테이블에 누락된 construction_start 컬럼 추가
-- 003_contracts.sql 부분 적용 시 발생하는 문제 보완
-- 적용일: 2026-05-16

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS construction_start DATE;
