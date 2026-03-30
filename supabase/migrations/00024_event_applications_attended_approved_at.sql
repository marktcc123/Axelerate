-- =============================================================================
-- event_applications：可选时间戳列（仅作分析/展示补充）
-- 应用逻辑以 status 枚举（pending | approved | attended）为准，不依赖本迁移。
-- 若已执行过 00022，本文件因 IF NOT EXISTS 为空操作。
-- =============================================================================

ALTER TABLE public.event_applications
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_applications.approved_at IS 'Admin 批准时间';
COMMENT ON COLUMN public.event_applications.attended_at IS 'Admin 签到时间';
