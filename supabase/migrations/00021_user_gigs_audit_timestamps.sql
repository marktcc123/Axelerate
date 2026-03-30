-- user_gigs 审计时间戳：支持财务打款闭环与审计追踪
ALTER TABLE public.user_gigs
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_gigs.approved_at IS 'Admin 批准时间';
COMMENT ON COLUMN public.user_gigs.submitted_at IS '用户提交 UGC 链接时间';
COMMENT ON COLUMN public.user_gigs.completed_at IS 'Admin 标记完成时间';
COMMENT ON COLUMN public.user_gigs.paid_at IS '财务打款时间（Mark as Paid）';
