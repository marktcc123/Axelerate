-- =============================================================================
-- Axelerate - 添加 user_gigs.ugc_link 用于 UGC 链接提交
-- 依赖: 00002_schema_v2_advanced.sql
-- =============================================================================

ALTER TABLE public.user_gigs
  ADD COLUMN IF NOT EXISTS ugc_link TEXT;

COMMENT ON COLUMN public.user_gigs.ugc_link IS '用户提交的 TikTok/IG 内容链接，提交后状态变为 completed 等待审核';
