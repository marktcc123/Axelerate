-- 商品等候名单：售罄时用户可订阅到货提醒
CREATE TABLE IF NOT EXISTS public.product_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_waitlist_product_id ON public.product_waitlist(product_id);
CREATE INDEX IF NOT EXISTS idx_product_waitlist_user_id ON public.product_waitlist(user_id);

COMMENT ON TABLE public.product_waitlist IS '商品等候名单，售罄时用户可订阅到货提醒';

-- RLS: 用户只能插入/读取自己的等候记录
ALTER TABLE public.product_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own waitlist" ON public.product_waitlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own waitlist" ON public.product_waitlist
  FOR SELECT USING (auth.uid() = user_id);
