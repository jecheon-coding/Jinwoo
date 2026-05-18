-- 수정 이력 테이블
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS record_audit_log (
  id           BIGSERIAL PRIMARY KEY,
  record_date  DATE         NOT NULL,
  contract_id  INTEGER,
  changed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  changed_by   TEXT         NOT NULL DEFAULT 'unknown',  -- 'admin' | 'user'
  before_data  JSONB,
  after_data   JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_record_date ON record_audit_log (record_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at  ON record_audit_log (changed_at  DESC);
