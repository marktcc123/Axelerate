-- PostgREST upsert(onConflict: shopify_product_id) 对「部分唯一索引」支持不稳定，改为整列唯一约束
--（PostgreSQL 中 UNIQUE 允许多行 shopify_product_id IS NULL，仅非空值需唯一）
DROP INDEX IF EXISTS idx_products_shopify_product_id_unique;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_shopify_product_id_key;

ALTER TABLE public.products
  ADD CONSTRAINT products_shopify_product_id_key UNIQUE (shopify_product_id);

COMMENT ON CONSTRAINT products_shopify_product_id_key ON public.products IS
  'Shopify 商品 ID 与 PostgREST upsert 的 onConflict 列对齐';
