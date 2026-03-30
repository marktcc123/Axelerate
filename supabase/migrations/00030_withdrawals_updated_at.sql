-- =============================================================================
-- 补齐 withdrawals.updated_at + 触发器（与 00007 一致）
-- 解决：Could not find the 'updated_at' column ... in the schema cache
-- 执行后：Settings → API → Reload schema
-- =============================================================================

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_withdrawals_updated_at ON public.withdrawals;

CREATE TRIGGER set_withdrawals_updated_at
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.withdrawals.updated_at IS '最后更新时间';
