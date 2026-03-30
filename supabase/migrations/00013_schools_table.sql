-- =============================================================================
-- Axelerate - schools 表：校园主题资产，驱动动态主题引擎
-- 依赖: 00001
-- =============================================================================

CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  primary_color TEXT NOT NULL DEFAULT '#EC4899',
  secondary_color TEXT NOT NULL DEFAULT '#831843',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schools IS '校园主题资产，name 与 profile.campus 关联';
COMMENT ON COLUMN public.schools.primary_color IS '主色 HEX，如 #E57200';
COMMENT ON COLUMN public.schools.secondary_color IS '辅色 HEX';

CREATE TRIGGER set_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: 所有人可读，仅 service_role 可写（通过 admin actions）
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schools_select_all"
  ON public.schools FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE 无策略 = 拒绝普通用户；service_role 绕过 RLS 通过 admin actions 操作

-- 种子数据：Default + UVA + UCLA
INSERT INTO public.schools (name, primary_color, secondary_color, logo_url)
VALUES
  ('Default (Axelerate)', '#EC4899', '#831843', ''),
  ('University of Virginia', '#E57200', '#232D4B', 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/University_of_Virginia_seal.svg/1200px-University_of_Virginia_seal.svg.png'),
  ('UCLA', '#2774AE', '#FFD100', '')
ON CONFLICT (name) DO NOTHING;
