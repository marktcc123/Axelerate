-- =============================================================================
-- Axelerate - Orders 订单表（Perks Shop 结账）
-- 依赖: 00001, 00002
-- =============================================================================

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
  items JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.orders IS 'Perks Shop 订单记录';
COMMENT ON COLUMN public.orders.items IS '购物车商品 JSON: [{ id, quantity }]';
COMMENT ON COLUMN public.orders.status IS 'processing | completed | failed';

CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_own"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);
