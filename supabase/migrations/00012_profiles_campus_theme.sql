-- =============================================================================
-- Axelerate - profiles 表新增 campus_theme 字段
-- 依赖: 00001
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS campus_theme TEXT DEFAULT 'Default (Axelerate)';

COMMENT ON COLUMN public.profiles.campus_theme IS '校园主题键，对应 CAMPUS_THEMES';
