-- =============================================================================
-- Axelerate - W-9 合规字段 (profiles)
-- 依赖: 00001
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_w9_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS annual_payout_total DECIMAL(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.is_w9_verified IS 'W-9 表单已提交并验证';
COMMENT ON COLUMN public.profiles.annual_payout_total IS '本年度已支付总额（用于 IRS $600 阈值）';
