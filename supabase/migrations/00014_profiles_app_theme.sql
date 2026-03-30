-- =============================================================================
-- Axelerate - profiles 表新增 app_theme 字段
-- 解绑 campus 与主题：campus=身份，app_theme=主题色
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS app_theme TEXT DEFAULT 'Default (Axelerate)';

COMMENT ON COLUMN public.profiles.app_theme IS '全站主题色，对应 schools 或 Default (Axelerate)';
