-- =============================================================================
-- 订单取消申请、退货、审计留言（与 app/actions/orders.ts、admin.ts 对齐）
-- 说明：用户侧写库通过服务端 service_role（见 orders server actions），
--       因 public.orders 仅有 SELECT 的 RLS，无用户 UPDATE 策略。
-- =============================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_status text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_request_status text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_request_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_rejection_message text;

COMMENT ON COLUMN public.orders.cancel_request_status IS '取消申请: none | pending | approved | rejected';
COMMENT ON COLUMN public.orders.cancel_request_reason IS '用户提交的取消原因';
COMMENT ON COLUMN public.orders.admin_rejection_message IS '运营拒绝取消/退货时给用户看的说明';

CREATE INDEX IF NOT EXISTS idx_orders_cancel_request_pending
  ON public.orders (cancel_request_status)
  WHERE cancel_request_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_orders_return_requested
  ON public.orders (return_status)
  WHERE return_status = 'requested';
