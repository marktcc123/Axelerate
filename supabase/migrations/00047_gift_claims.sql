-- Gift checkout: payer order + claim token; recipient claims → new fulfillment order.

CREATE TABLE public.gift_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  purchaser_order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  mirror_cash_share NUMERIC(12, 2) NOT NULL DEFAULT 0,
  mirror_credits_share INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_order_id UUID UNIQUE REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gift_claims IS 'Perks Shop gift links: one row per gift purchase (pending claim or redeemed).';
COMMENT ON COLUMN public.gift_claims.mirror_cash_share IS 'Mirror-line share of payer cash (Shopify fulfillment on claim).';

CREATE INDEX idx_gift_claims_token ON public.gift_claims (token);
CREATE INDEX idx_gift_claims_unclaimed ON public.gift_claims (claimed_at) WHERE claimed_at IS NULL;

ALTER TABLE public.gift_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gift_claims_select_buyer_orders"
  ON public.gift_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = gift_claims.purchaser_order_id AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "gift_claims_select_recipient"
  ON public.gift_claims FOR SELECT
  USING (recipient_user_id = auth.uid());
