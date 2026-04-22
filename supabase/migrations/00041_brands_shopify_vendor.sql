-- Shopify Webhook：按商品 vendor 匹配/自动创建品牌行
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS shopify_vendor text;

COMMENT ON COLUMN public.brands.shopify_vendor IS
  'Shopify Product.vendor 规范化键；同键只对应一行品牌。无 vendor 时用字面量 __no_vendor__';

CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_shopify_vendor_unique
  ON public.brands (shopify_vendor)
  WHERE shopify_vendor IS NOT NULL;
