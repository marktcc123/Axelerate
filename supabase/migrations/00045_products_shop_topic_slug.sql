-- 专题：在 Supabase 将产品的 shop_topic_slug 设为与前端 Tab 一致的 slug（如 k-beauty），即可归入对应专题。
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shop_topic_slug text;

COMMENT ON COLUMN public.products.shop_topic_slug IS
  'Perks Shop 顶栏专题 slug；任意非空值会在前端生成对应 Topic Tab（去重后按名排序）。NULL 未归入专题，仅在「All」下出现。';

CREATE INDEX IF NOT EXISTS products_shop_topic_slug_idx
  ON public.products (shop_topic_slug)
  WHERE shop_topic_slug IS NOT NULL;
