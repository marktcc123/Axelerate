-- =============================================================================
-- Axelerate - Orders 物流追踪字段
-- 依赖: 00006
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.tracking_number IS '物流单号，供用户复制';
COMMENT ON COLUMN public.orders.shipped_at IS '发货时间';
