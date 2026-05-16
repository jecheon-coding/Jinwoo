-- workers 테이블에 급여/계좌/연락처 컬럼 추가
-- 적용일: 2026-05-16

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS monthly_salary  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_name       TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone           TEXT DEFAULT '';
