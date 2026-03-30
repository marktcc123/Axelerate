-- =============================================================================
-- Axelerate - 商品详情页丰富字段 + 评论表
-- 请在 Supabase SQL Editor 中运行，或使用 supabase db push
-- =============================================================================

-- 1. products 表新增详细信息字段
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS features text[],
  ADD COLUMN IF NOT EXISTS specifications jsonb,
  ADD COLUMN IF NOT EXISTS long_description_html text,
  ADD COLUMN IF NOT EXISTS images text[],
  ADD COLUMN IF NOT EXISTS brand_link_url text;

COMMENT ON COLUMN public.products.features IS '关键功能点 (Bullet Points)';
COMMENT ON COLUMN public.products.specifications IS '技术参数/规格表 (JSON)';
COMMENT ON COLUMN public.products.long_description_html IS 'A+ 图文详情 HTML';
COMMENT ON COLUMN public.products.images IS '多角度图片 URL 数组';
COMMENT ON COLUMN public.products.brand_link_url IS '品牌店铺链接';

-- 2. 创建商品评论表
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.product_reviews IS '商品评论';

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON public.product_reviews(user_id);

-- RLS: 允许所有人读取评论
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_reviews_select" ON public.product_reviews
  FOR SELECT USING (true);

CREATE POLICY "product_reviews_insert" ON public.product_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);
