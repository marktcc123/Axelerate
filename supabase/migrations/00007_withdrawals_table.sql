-- =============================================================================
-- Axelerate - Withdrawals 提现表
-- 依赖: 00001, 00002
-- =============================================================================

CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 20),
  fee DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  net_amount DECIMAL(12, 2) NOT NULL CHECK (net_amount >= 0),
  method VARCHAR(32) NOT NULL,
  account_info TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.withdrawals IS '用户提现申请';
COMMENT ON COLUMN public.withdrawals.amount IS '提现金额（扣除的总额）';
COMMENT ON COLUMN public.withdrawals.fee IS '手续费';
COMMENT ON COLUMN public.withdrawals.net_amount IS '用户实际到账金额';
COMMENT ON COLUMN public.withdrawals.method IS 'PayPal | Venmo | Zelle';
COMMENT ON COLUMN public.withdrawals.status IS 'pending | completed | rejected';

CREATE INDEX idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX idx_withdrawals_created_at ON public.withdrawals(created_at DESC);

CREATE TRIGGER set_withdrawals_updated_at
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawals_select_own"
  ON public.withdrawals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "withdrawals_insert_own"
  ON public.withdrawals FOR INSERT
  WITH CHECK (auth.uid() = user_id);
