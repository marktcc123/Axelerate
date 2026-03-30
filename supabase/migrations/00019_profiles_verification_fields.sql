-- Axelerate - profiles 验证步骤对应的物理字段
-- 用于 syncVerificationStep 写入实际数据
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS graduation_year TEXT,
  ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resume_url TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT;

COMMENT ON COLUMN public.profiles.graduation_year IS '毕业年份，added_school 步骤';
COMMENT ON COLUMN public.profiles.skills IS '技能标签数组，added_skills 步骤';
COMMENT ON COLUMN public.profiles.interests IS '兴趣标签数组，added_interests 步骤';
COMMENT ON COLUMN public.profiles.resume_url IS '简历 URL，has_resume 步骤';
COMMENT ON COLUMN public.profiles.portfolio_url IS '作品集 URL，added_portfolio 步骤';
