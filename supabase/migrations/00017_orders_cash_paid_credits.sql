-- =============================================================================
-- Axelerate - Orders 实付金额与积分字段
-- 依赖: 00006, 00011
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cash_paid DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS credits_used INTEGER NOT NULL DEFAULT 0;

-- 将已有订单的 cash_paid 从 total_amount 回填
UPDATE public.orders SET cash_paid = total_amount WHERE cash_paid IS NULL;

-- 使 total_amount 可选，新订单优先使用 cash_paid
ALTER TABLE public.orders ALTER COLUMN total_amount DROP NOT NULL;

COMMENT ON COLUMN public.orders.cash_paid IS '实付美金金额';
COMMENT ON COLUMN public.orders.credits_used IS '结账时使用的积分数量';
