-- 钱包 Stripe 充值幂等 + 流水类型
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'wallet_deposit';

CREATE TABLE IF NOT EXISTS public.stripe_wallet_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_checkout_session_id text NOT NULL UNIQUE,
  amount_usd numeric(12, 2) NOT NULL CHECK (amount_usd > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_wallet_topups_user_id
  ON public.stripe_wallet_topups(user_id);

COMMENT ON TABLE public.stripe_wallet_topups IS 'Stripe Checkout 充值入账记录，配合 webhook 幂等';
