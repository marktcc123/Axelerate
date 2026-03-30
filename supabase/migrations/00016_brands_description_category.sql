-- =============================================================================
-- Axelerate - brands 表新增 description 和 category
-- =============================================================================

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text;

COMMENT ON COLUMN public.brands.description IS '品牌详细介绍';
COMMENT ON COLUMN public.brands.category IS '品牌分类: K-Beauty, Food, Apparel 等';
