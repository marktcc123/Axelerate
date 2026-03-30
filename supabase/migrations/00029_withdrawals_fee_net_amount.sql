-- =============================================================================
-- 补齐 withdrawals.fee / net_amount（与 00007 一致）
-- 适用于远程表缺少这两列时出现：Could not find the 'fee' column in the schema cache
-- 执行后：Dashboard → Settings → API → Reload schema（或等待 ~1 分钟让 PostgREST 刷新）
-- =============================================================================

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS fee DECIMAL(12, 2);

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS net_amount DECIMAL(12, 2);

UPDATE public.withdrawals
SET fee = 0
WHERE fee IS NULL;

UPDATE public.withdrawals
SET net_amount = GREATEST(amount - COALESCE(fee, 0), 0)
WHERE net_amount IS NULL;

ALTER TABLE public.withdrawals
  ALTER COLUMN fee SET DEFAULT 0;

ALTER TABLE public.withdrawals
  ALTER COLUMN fee SET NOT NULL;

ALTER TABLE public.withdrawals
  ALTER COLUMN net_amount SET NOT NULL;

COMMENT ON COLUMN public.withdrawals.fee IS '手续费';
COMMENT ON COLUMN public.withdrawals.net_amount IS '用户实际到账金额';
