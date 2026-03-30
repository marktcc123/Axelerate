-- Feed 首页：与 brands.is_featured 一致，勾选后进入 TRENDING REWARDS（有任意勾选时仅展示勾选商品）
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_is_featured_feed ON public.products(is_featured) WHERE is_featured = true;

COMMENT ON COLUMN public.products.is_featured IS '是否在 Feed 首页优先展示；若至少一条为 true，则首页横滑仅显示 is_featured 商品';
