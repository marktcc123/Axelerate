-- 集成/异步任务错误留痕，便于人工补单与排障（仅 service_role 可写；通过 Table Editor 查看）
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  stripe_checkout_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.error_logs IS '外部集成失败等错误日志，供人工补单与排查；勿向 anon 开放';
COMMENT ON COLUMN public.error_logs.source IS '错误分类，如 shopify_order_create、stripe_webhook';
COMMENT ON COLUMN public.error_logs.context IS '堆栈、HTTP 体片段、元数据等';

CREATE INDEX IF NOT EXISTS idx_error_logs_source_created
  ON public.error_logs (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_stripe_session
  ON public.error_logs (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "error_logs_deny_all"
  ON public.error_logs FOR ALL
  USING (false)
  WITH CHECK (false);
