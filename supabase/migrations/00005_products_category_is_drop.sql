-- =============================================================================
-- Axelerate - products 表新增 category 和 is_drop
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Beauty',
  ADD COLUMN IF NOT EXISTS is_drop BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.category IS '商品分类: Beauty, Food, Apparel 等';
COMMENT ON COLUMN public.products.is_drop IS '是否为 Friday Night Drop 商品';

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_drop ON public.products(is_drop) WHERE is_drop = true;
