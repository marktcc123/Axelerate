-- 提现拒绝留言 + 统一钱包活动（Gig 发薪 XP/Credits/Cash 等）
-- 用户仅可 SELECT 自己的事件；写入由 service_role 服务端完成

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS admin_message TEXT;

COMMENT ON COLUMN public.withdrawals.admin_message IS '运营拒绝提现时给用户看的说明';

CREATE TABLE IF NOT EXISTS public.user_wallet_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  cash_delta NUMERIC(12, 2),
  credits_delta INTEGER,
  xp_delta INTEGER,
  ref_type TEXT,
  ref_id UUID,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_wallet_events_user_created
  ON public.user_wallet_events (user_id, created_at DESC);

COMMENT ON TABLE public.user_wallet_events IS '钱包/积分/XP 聚合流水（与 transactions、orders、withdrawals 一起在客户端合并展示）';

ALTER TABLE public.user_wallet_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_wallet_events_select_own" ON public.user_wallet_events;

CREATE POLICY "user_wallet_events_select_own"
  ON public.user_wallet_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
