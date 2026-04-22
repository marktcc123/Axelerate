-- Shopify → Supabase 商品同步所需字段
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shopify_product_id BIGINT,
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.products.shopify_product_id IS 'Shopify Admin 商品数字 ID，Webhook 幂等 upsert';
COMMENT ON COLUMN public.products.fulfillment_type IS '履约类型：in_app 自营、dropshipping 等';
COMMENT ON COLUMN public.products.status IS '上架状态：active | draft 等（与业务约定一致）';

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shopify_product_id_unique
  ON public.products (shopify_product_id)
  WHERE shopify_product_id IS NOT NULL;
