-- Dropshipping / Shopify 镜像单同步失败，供运营在后台重试或手工建单
COMMENT ON COLUMN public.orders.status IS
  'processing | completed | failed | shopify_sync_failed (Shopify 静默建单失败，待人工处理)';
