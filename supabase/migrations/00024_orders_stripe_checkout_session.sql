-- Stripe Checkout 幂等：同一 session 只履约一次
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_checkout_session_id
  ON public.orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

COMMENT ON COLUMN public.orders.stripe_checkout_session_id IS 'Stripe Checkout Session id（card 支付），用于 webhook 幂等';
