-- 商品级购买后 Credits（Pts）返现比例；订单记录已发放数额供取消/退货扣回

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS credit_cashback_percent SMALLINT NOT NULL DEFAULT 10
    CHECK (credit_cashback_percent >= 0 AND credit_cashback_percent <= 100);

COMMENT ON COLUMN public.products.credit_cashback_percent IS
  '成交后按目录价（USD）折算为 Pts 返现到 profile.credit_balance；100 Pts = $1；0 表示关闭。';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS credits_cashback_given INTEGER NOT NULL DEFAULT 0
    CHECK (credits_cashback_given >= 0);

COMMENT ON COLUMN public.orders.credits_cashback_given IS
  '本单发放的积分返现（Pts）；批准取消/退货时需从 credit_balance 扣回。';
