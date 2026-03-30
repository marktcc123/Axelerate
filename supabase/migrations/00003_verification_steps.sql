-- =============================================================================
-- Axelerate - 游戏化验证系统 (HFC 风格)
-- 依赖: 00002_schema_v2_advanced.sql
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_steps JSONB DEFAULT '{
    "has_avatar": false,
    "has_resume": false,
    "phone_verified": false,
    "email_verified": false,
    "added_school": false,
    "added_skills": false,
    "added_interests": false,
    "added_portfolio": false,
    "followed_brands": false,
    "answered_questions": false
  }'::jsonb;

COMMENT ON COLUMN public.profiles.verification_steps IS '10 个验证步骤的布尔值，用于游戏化进度';
